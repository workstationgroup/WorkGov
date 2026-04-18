import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { schedules, keywords, tenders, scrapeLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { scrapeEgp, type RawTender } from "@/lib/scraper/egp";
import { classifyTender } from "@/lib/ai/classify";
import { sendLineNotification } from "@/lib/line/notify";
import type { TenderNotification } from "@/lib/line/notify";

function getCurrentTimeUTC7(): string {
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return utc7.toISOString().slice(11, 16); // "HH:MM"
}

// Vercel Cron heartbeat — runs every 15 minutes
// Checks if current time matches a scheduled run in the database
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const currentTime = getCurrentTimeUTC7();

  // Check if current time matches any enabled schedule
  // Cron runs every 15 min, so match if current HH:MM equals a schedule time
  const enabledSchedules = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enabled, true), eq(schedules.time, currentTime)));

  if (enabledSchedules.length === 0) {
    return NextResponse.json({
      ok: true,
      checked_at: currentTime,
      matched: false,
      message: "No matching schedule",
    });
  }

  // We have a match — run the scraper
  const [log] = await db
    .insert(scrapeLog)
    .values({ status: "running" })
    .returning();

  try {
    // Get enabled keywords
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
        checked_at: currentTime,
        matched: true,
        message: "No keywords configured",
      });
    }

    // Scrape e-GP for each keyword
    const scrapeResults = await scrapeEgp(enabledKeywords);

    // Deduplicate by egpId across all keyword results
    const seen = new Set<string>();
    const uniqueTenders: Array<RawTender & { matchedKeyword: string }> = [];

    for (const result of scrapeResults) {
      for (const tender of result.tenders) {
        if (!tender.egpId || seen.has(tender.egpId)) continue;
        seen.add(tender.egpId);
        uniqueTenders.push({ ...tender, matchedKeyword: result.keyword });
      }
    }

    // Check which tenders are already in our database
    const existingIds = new Set(
      (await db.select({ egpId: tenders.egpId }).from(tenders)).map(
        (r) => r.egpId
      )
    );

    const newTenders = uniqueTenders.filter(
      (t) => !existingIds.has(t.egpId)
    );

    // Classify and insert new tenders
    const notifyList: TenderNotification[] = [];

    for (const tender of newTenders) {
      const classification = await classifyTender({
        projectName: tender.projectName,
        agency: tender.agency,
        budget: tender.budget,
        matchedKeyword: tender.matchedKeyword,
      });

      // Skip irrelevant tenders
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
          priceReference: tender.priceReference || null,
          egpStatus: tender.egpStatus || null,
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
          requiredDocuments: tender.documents || null,
          rawData: tender.rawData || null,
        })
        .onConflictDoNothing({ target: tenders.egpId })
        .returning();

      if (!inserted) continue;

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

    // Send LINE notification for new relevant tenders
    let lineResult = null;
    if (notifyList.length > 0) {
      lineResult = await sendLineNotification(notifyList);

      // Mark tenders as notified
      const now = new Date();
      for (const tender of notifyList) {
        await db
          .update(tenders)
          .set({ notifiedAt: now })
          .where(eq(tenders.projectName, tender.projectName));
      }
    }

    // Update scrape log
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
      checked_at: currentTime,
      matched: true,
      tenders_found: uniqueTenders.length,
      tenders_new: notifyList.length,
      line_sent: lineResult?.sent ?? false,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[Cron] Error:", errorMessage);

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
