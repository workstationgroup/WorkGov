import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { keywords, tenders, winnerCompanies, scrapeLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { scrapeEgp, parseBidPrice, type RawTender } from "@/lib/scraper/egp";
import {
  insertTenderDocuments,
  reconcileTenderDocuments,
} from "@/lib/scraper/documents";
import { classifyTender, type TenderLane } from "@/lib/ai/classify";
import { sendLineNotification } from "@/lib/line/notify";
import type { TenderNotification } from "@/lib/line/notify";

// The scrape does many sequential, throttled e-GP requests — use the full
// Node function budget so a heavy run can't be cut off mid-flight.
export const maxDuration = 300;

// Manual scrape trigger — POST /api/scrape
export async function POST() {
  const db = getDb();

  const [log] = await db
    .insert(scrapeLog)
    .values({ status: "running" })
    .returning();

  try {
    const allKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.enabled, true));

    const enabledKeywords = allKeywords.filter((k) => k.type !== "negative");
    const negativeKeywords = allKeywords
      .filter((k) => k.type === "negative")
      .map((k) => k.keyword.toLowerCase());

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
    const uniqueTenders: Array<RawTender & { matchedKeyword: string }> = [];

    for (const result of scrapeResults) {
      for (const tender of result.tenders) {
        if (!tender.egpId || seen.has(tender.egpId)) continue;
        seen.add(tender.egpId);
        uniqueTenders.push({ ...tender, matchedKeyword: result.keyword });
      }
    }

    // Filter out tenders matching negative keywords
    const filteredTenders = negativeKeywords.length > 0
      ? uniqueTenders.filter(
          (t) => !negativeKeywords.some((neg) => t.projectName.toLowerCase().includes(neg))
        )
      : uniqueTenders;

    // Split into new vs. already-tracked tenders (existing → document diff)
    const existingMap = new Map(
      (await db
        .select({ id: tenders.id, egpId: tenders.egpId })
        .from(tenders)).map((r) => [r.egpId, r.id])
    );
    const newTenders = filteredTenders.filter((t) => !existingMap.has(t.egpId));
    const existingTenders = filteredTenders.filter((t) =>
      existingMap.has(t.egpId)
    );

    // Re-scrape: detect changed/new documents on tenders we already track.
    const updatedNotify: TenderNotification[] = [];
    for (const tender of existingTenders) {
      if (!tender.documents || tender.documents.length === 0) continue;
      const tenderId = existingMap.get(tender.egpId)!;
      const { changed } = await reconcileTenderDocuments(
        db,
        tenderId,
        tender.documents
      );
      if (!changed) continue;

      const [row] = await db
        .update(tenders)
        .set({ documentsUpdatedAt: new Date(), updatedAt: new Date() })
        .where(eq(tenders.id, tenderId))
        .returning();
      if (row) {
        updatedNotify.push({
          projectName: row.projectName,
          agency: row.agency || "",
          budget: row.budget,
          tenderType: row.tenderType as "type_a" | "type_b",
          aiSummary: "เอกสาร/ประกาศมีการอัปเดต",
          submissionDate: row.submissionDate
            ? row.submissionDate.toLocaleDateString("th-TH")
            : null,
          detailUrl: `https://workgov.workstationoffice.com/t/${row.egpId}`,
        });
      }
    }

    // Classify and insert
    const notifyList: TenderNotification[] = [];

    for (const tender of newTenders) {
      // Lane is derived from the e-GP announcement stage during scraping.
      const lane: TenderLane = tender.lane ?? "type_a";

      const classification = await classifyTender({
        lane,
        projectName: tender.projectName,
        agency: tender.agency,
        budget: tender.budget,
        matchedKeyword: tender.matchedKeyword,
      });

      if (!classification.relevant) continue;

      // Fold the reliable structured delivery window into the Type A summary.
      const keyPoints =
        lane === "type_a" && classification.keyPoints
          ? {
              ...classification.keyPoints,
              deliveryTime: tender.deliverDay
                ? `${tender.deliverDay} วัน`
                : classification.keyPoints.deliveryTime,
            }
          : classification.keyPoints;

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
          tenderType: lane,
          status: "new",
          aiSummary: classification.summary,
          aiClassificationReason: classification.reason,
          keyPoints: keyPoints ?? null,
          // Prefer structured getProcureResult data over AI extraction.
          winnerName: tender.winnerName ?? classification.winner?.winnerName ?? null,
          winnerTin: tender.winnerTin ?? null,
          bidders: tender.bidders ?? null,
          winnerPrice:
            parseBidPrice(tender.winnerPrice) ??
            parseBidPrice(classification.winner?.winnerPrice),
          matchedKeyword: tender.matchedKeyword,
          announceDate: tender.announceDate
            ? new Date(tender.announceDate)
            : null,
          submissionDate: tender.submissionDate
            ? new Date(tender.submissionDate)
            : null,
          contractDate: classification.winner?.contractDate
            ? new Date(classification.winner.contractDate)
            : null,
          detailUrl: tender.detailUrl || null,
          requiredDocuments: tender.documents || null,
          rawData: tender.rawData || null,
        })
        .onConflictDoNothing({ target: tenders.egpId })
        .returning();

      if (!inserted) continue; // Already exists from concurrent scrape

      // Persist categorized documents for this new tender.
      if (tender.documents) {
        await insertTenderDocuments(db, inserted.id, tender.documents);
      }

      // Type B: persist the researched winner company.
      if (tender.company) {
        await db.insert(winnerCompanies).values({
          tenderId: inserted.id,
          name: tender.company.name,
          nameEn: tender.company.nameEn ?? null,
          taxId: tender.company.taxId ?? null,
          address: tender.company.address ?? null,
          mapUrl: tender.company.mapUrl ?? null,
          phone: tender.company.phone ?? null,
          website: tender.company.website ?? null,
          businessType: tender.company.businessType ?? null,
          blacklistStatus: tender.company.blacklistStatus ?? null,
          dbdStatus: tender.company.dbdStatus ?? null,
          businessObjective: tender.company.businessObjective ?? null,
          registeredCapital: tender.company.registeredCapital ?? null,
          registerDate: tender.company.registerDate ?? null,
          dbdUrl: tender.company.dbdUrl ?? null,
        });
      }

      notifyList.push({
        projectName: inserted.projectName,
        agency: inserted.agency || "",
        budget: inserted.budget,
        tenderType: inserted.tenderType as "type_a" | "type_b",
        aiSummary: inserted.aiSummary,
        submissionDate: inserted.submissionDate
          ? inserted.submissionDate.toLocaleDateString("th-TH")
          : null,
        detailUrl: `https://workgov.workstationoffice.com/t/${inserted.egpId}`,
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

    // Separate notification for tenders whose documents changed
    if (updatedNotify.length > 0) {
      await sendLineNotification(updatedNotify, { kind: "updated" });
    }

    await db
      .update(scrapeLog)
      .set({
        status: "completed",
        finishedAt: new Date(),
        tendersFound: filteredTenders.length,
        tendersNew: notifyList.length,
      })
      .where(eq(scrapeLog.id, log.id));

    return NextResponse.json({
      ok: true,
      tenders_found: uniqueTenders.length,
      tenders_new: notifyList.length,
      tenders_updated: updatedNotify.length,
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
