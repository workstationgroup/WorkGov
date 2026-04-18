import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { keywords, tenders, scrapeLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeEgp } from "@/lib/scraper/egp";
import { classifyTender } from "@/lib/ai/classify";
import { sendLineNotification } from "@/lib/line/notify";
import type { TenderNotification } from "@/lib/line/notify";

// Manual scrape trigger — POST /api/scrape
export async function POST() {
  const db = getDb();

  const [log] = await db
    .insert(scrapeLog)
    .values({ status: "running" })
    .returning();

  try {
    const enabledKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.enabled, true));

    if (enabledKeywords.length === 0) {
      await db
        .update(scrapeLog)
        .set({
          status: "completed",
          finishedAt: new Date(),
          tendersFound: 0,
          tendersNew: 0,
        })
        .where(eq(scrapeLog.id, log.id));

      return NextResponse.json({
        ok: true,
        message: "No keywords configured",
        tenders_found: 0,
        tenders_new: 0,
      });
    }

    const scrapeResults = await scrapeEgp(enabledKeywords);

    // Deduplicate
    const seen = new Set<string>();
    const uniqueTenders: Array<{
      egpId: string;
      projectName: string;
      agency: string;
      subAgency?: string;
      province?: string;
      budget?: string;
      procurementMethod?: string;
      announceDate?: string;
      submissionDate?: string;
      detailUrl?: string;
      rawData?: Record<string, unknown>;
      matchedKeyword: string;
    }> = [];

    for (const result of scrapeResults) {
      for (const tender of result.tenders) {
        if (!tender.egpId || seen.has(tender.egpId)) continue;
        seen.add(tender.egpId);
        uniqueTenders.push({ ...tender, matchedKeyword: result.keyword });
      }
    }

    // Filter out existing
    const existingIds = new Set(
      (await db.select({ egpId: tenders.egpId }).from(tenders)).map(
        (r) => r.egpId
      )
    );
    const newTenders = uniqueTenders.filter(
      (t) => !existingIds.has(t.egpId)
    );

    // Classify and insert
    const notifyList: TenderNotification[] = [];

    for (const tender of newTenders) {
      const classification = await classifyTender({
        projectName: tender.projectName,
        agency: tender.agency,
        budget: tender.budget,
        matchedKeyword: tender.matchedKeyword,
      });

      if (classification.tenderType === "irrelevant") continue;

      const [inserted] = await db
        .insert(tenders)
        .values({
          egpId: tender.egpId,
          projectName: tender.projectName,
          agency: tender.agency,
          subAgency: tender.subAgency || null,
          province: tender.province || null,
          budget: tender.budget || null,
          procurementMethod: tender.procurementMethod || null,
          tenderType: classification.tenderType,
          status: "new",
          aiSummary: classification.summary,
          aiClassificationReason: classification.reason,
          matchedKeyword: tender.matchedKeyword,
          announceDate: tender.announceDate
            ? new Date(tender.announceDate)
            : null,
          submissionDate: tender.submissionDate
            ? new Date(tender.submissionDate)
            : null,
          detailUrl: tender.detailUrl || null,
          rawData: tender.rawData || null,
        })
        .onConflictDoNothing({ target: tenders.egpId })
        .returning();

      if (!inserted) continue; // Already exists from concurrent scrape

      notifyList.push({
        projectName: inserted.projectName,
        agency: inserted.agency || "",
        budget: inserted.budget,
        tenderType: inserted.tenderType as "type_a" | "type_b",
        aiSummary: inserted.aiSummary,
        submissionDate: inserted.submissionDate
          ? inserted.submissionDate.toLocaleDateString("th-TH")
          : null,
        detailUrl: `https://workgov.workstationoffice.com/tenders/${inserted.egpId}`,
      });
    }

    // Send LINE notification
    let lineResult = null;
    if (notifyList.length > 0) {
      lineResult = await sendLineNotification(notifyList);

      const now = new Date();
      for (const tender of notifyList) {
        await db
          .update(tenders)
          .set({ notifiedAt: now })
          .where(eq(tenders.projectName, tender.projectName));
      }
    }

    await db
      .update(scrapeLog)
      .set({
        status: "completed",
        finishedAt: new Date(),
        tendersFound: uniqueTenders.length,
        tendersNew: notifyList.length,
      })
      .where(eq(scrapeLog.id, log.id));

    return NextResponse.json({
      ok: true,
      tenders_found: uniqueTenders.length,
      tenders_new: notifyList.length,
      line_sent: lineResult?.sent ?? false,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[Scrape] Error:", errorMessage);

    await db
      .update(scrapeLog)
      .set({
        status: "error",
        finishedAt: new Date(),
        errorMessage,
      })
      .where(eq(scrapeLog.id, log.id));

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// GET /api/scrape — return latest scrape log
export async function GET() {
  const db = getDb();
  const [latest] = await db
    .select()
    .from(scrapeLog)
    .orderBy(scrapeLog.id)
    .limit(1);

  return NextResponse.json(latest || null);
}
