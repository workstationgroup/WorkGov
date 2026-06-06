import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  schedules,
  keywords,
  tenders,
  winnerCompanies,
  scrapeLog,
  settings,
} from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { scrapeEgp, parseBidPrice, safeDate, type RawTender } from "@/lib/scraper/egp";
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

function getCurrentTimeUTC7(): string {
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return utc7.toISOString().slice(11, 16); // "HH:MM"
}

// e-GP may have no published winner yet; the AI fills unknown fields with the
// literal "ไม่ระบุ". Never persist that as a winner — keep only a real name.
function cleanWinnerName(name: string | null | undefined): string | null {
  const n = (name ?? "").trim();
  return n && n !== "ไม่ระบุ" ? n : null;
}

// Vercel Cron heartbeat — runs every 15 minutes.
// e-GP rate-limits bursts (429 after ~3 keywords), so instead of scraping all
// keywords at once we ROTATE: each tick scrapes ONE keyword (cursor in
// settings). Small bursts spaced 15 min apart stay under the limit; a full
// cycle takes ~N×15 min and then repeats, refreshing all day.
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const currentTime = getCurrentTimeUTC7();

  // The Vercel cron fires every 15 min; act only on :00 and :30 so we scrape
  // one keyword roughly every 30 min — gentle on the shared e-GP account.
  const minute = currentTime.slice(3);
  if (minute !== "00" && minute !== "30") {
    return NextResponse.json({ ok: true, checked_at: currentTime, skipped: true });
  }

  // Scraping on/off is controlled by whether ANY schedule is enabled. The
  // specific times are no longer used for matching (we rotate continuously).
  const enabledSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.enabled, true));

  if (enabledSchedules.length === 0) {
    return NextResponse.json({
      ok: true,
      checked_at: currentTime,
      scraping: false,
      message: "Scraping disabled (no enabled schedule)",
    });
  }

  // Enabled search keywords (stable order) + negative filters.
  const allKeywords = await db
    .select()
    .from(keywords)
    .where(eq(keywords.enabled, true))
    .orderBy(asc(keywords.id));

  const enabledKeywords = allKeywords.filter((k) => k.type !== "negative");
  const negativeKeywords = allKeywords
    .filter((k) => k.type === "negative")
    .map((k) => k.keyword.toLowerCase());

  if (enabledKeywords.length === 0) {
    return NextResponse.json({
      ok: true,
      checked_at: currentTime,
      message: "No keywords configured",
    });
  }

  // Pick one keyword via a rotating cursor, then advance it.
  const [cur] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "scrape_cursor"));
  const cursor = cur ? parseInt(cur.value, 10) || 0 : 0;
  const selected = enabledKeywords[cursor % enabledKeywords.length];
  const nextCursor = String((cursor + 1) % enabledKeywords.length);
  await db
    .insert(settings)
    .values({ key: "scrape_cursor", value: nextCursor })
    .onConflictDoUpdate({ target: settings.key, set: { value: nextCursor } });

  const [log] = await db
    .insert(scrapeLog)
    .values({ status: "running" })
    .returning();

  try {
    // Scrape just this tick's keyword.
    const scrapeResults = await scrapeEgp([selected]);

    // Observability: winner-stage projects seen vs. winners actually resolved.
    // A large gap means getProcureResult isn't extracting winners.
    const winnerStageSeen = scrapeResults.reduce(
      (n, r) => n + (r.winnerStageSeen ?? 0),
      0
    );
    const winnerResolved = scrapeResults.reduce(
      (n, r) => n + (r.winnerResolved ?? 0),
      0
    );
    console.log(
      `[Cron] keyword="${selected.keyword}" winner-stage seen=${winnerStageSeen} resolved=${winnerResolved}`
    );

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

    // Drop tenders matching a negative keyword
    const filteredTenders =
      negativeKeywords.length > 0
        ? uniqueTenders.filter(
            (t) =>
              !negativeKeywords.some((neg) =>
                t.projectName.toLowerCase().includes(neg)
              )
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
          tenderType: row.tenderType as "type_a" | "type_b" | "type_c",
          aiSummary: "เอกสาร/ประกาศมีการอัปเดต",
          submissionDate: row.submissionDate
            ? row.submissionDate.toLocaleDateString("th-TH")
            : null,
          detailUrl: `https://workgov.workstationoffice.com/t/${row.egpId}`,
        });
      }
    }

    // Classify and insert new tenders
    const notifyList: TenderNotification[] = [];
    const notifiedTenderIds: number[] = [];

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

      // Skip tenders the AI judges irrelevant to the furniture business
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
          // Structured getProcureResult winner only — never the AI's "ไม่ระบุ".
          winnerName: cleanWinnerName(tender.winnerName),
          winnerTin: tender.winnerTin ?? null,
          bidders: tender.bidders ?? null,
          winnerPrice:
            parseBidPrice(tender.winnerPrice) ??
            parseBidPrice(classification.winner?.winnerPrice),
          matchedKeyword: tender.matchedKeyword,
          announceDate: safeDate(tender.announceDate),
          submissionDate: safeDate(tender.submissionDate),
          contractDate: safeDate(classification.winner?.contractDate),
          detailUrl: tender.detailUrl || null,
          requiredDocuments: tender.documents || null,
          rawData: tender.rawData || null,
        })
        .onConflictDoNothing({ target: tenders.egpId })
        .returning();

      if (!inserted) continue;

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
        tenderType: inserted.tenderType as "type_a" | "type_b" | "type_c",
        aiSummary: inserted.aiSummary,
        submissionDate: inserted.submissionDate
          ? inserted.submissionDate.toLocaleDateString("th-TH")
          : null,
        detailUrl: `https://workgov.workstationoffice.com/t/${inserted.egpId}`,
      });
      notifiedTenderIds.push(inserted.id);
    }

    // Send LINE notification for new relevant tenders
    let lineResult = null;
    if (notifyList.length > 0) {
      lineResult = await sendLineNotification(notifyList);

      // Mark exactly the rows we just inserted as notified — keyed by id, not
      // projectName (names aren't unique and could mark the wrong rows).
      if (notifiedTenderIds.length > 0) {
        await db
          .update(tenders)
          .set({ notifiedAt: new Date() })
          .where(inArray(tenders.id, notifiedTenderIds));
      }
    }

    // Separate notification for tenders whose documents changed
    if (updatedNotify.length > 0) {
      await sendLineNotification(updatedNotify, { kind: "updated" });
    }

    // Update scrape log
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
      checked_at: currentTime,
      keyword: selected.keyword,
      tenders_found: filteredTenders.length,
      tenders_new: notifyList.length,
      tenders_updated: updatedNotify.length,
      line_sent: lineResult?.sent ?? false,
      winner_stage_seen: winnerStageSeen,
      winner_resolved: winnerResolved,
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
