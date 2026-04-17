import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenders, scrapeLog, schedules } from "@/lib/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";

export async function GET() {
  const db = getDb();

  // Stats
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenders);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [newTodayResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenders)
    .where(gte(tenders.createdAt, todayStart));

  const [activeBidsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenders)
    .where(eq(tenders.status, "bidding"));

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const [deadlineSoonResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tenders)
    .where(
      and(
        gte(tenders.submissionDate, new Date()),
        sql`${tenders.submissionDate} <= ${sevenDaysFromNow}`
      )
    );

  // Recent tenders (last 5)
  const recentTenders = await db
    .select({
      id: tenders.id,
      egpId: tenders.egpId,
      projectName: tenders.projectName,
      agency: tenders.agency,
      tenderType: tenders.tenderType,
      status: tenders.status,
      budget: tenders.budget,
      submissionDate: tenders.submissionDate,
    })
    .from(tenders)
    .orderBy(desc(tenders.createdAt))
    .limit(5);

  // Latest scrape log
  const [latestScrape] = await db
    .select()
    .from(scrapeLog)
    .orderBy(desc(scrapeLog.id))
    .limit(1);

  // Next scheduled run
  const enabledSchedules = await db
    .select({ time: schedules.time })
    .from(schedules)
    .where(eq(schedules.enabled, true))
    .orderBy(schedules.time);

  return NextResponse.json({
    stats: {
      total: Number(totalResult.count),
      newToday: Number(newTodayResult.count),
      activeBids: Number(activeBidsResult.count),
      deadlineSoon: Number(deadlineSoonResult.count),
    },
    recentTenders,
    latestScrape,
    schedules: enabledSchedules.map((s) => s.time),
  });
}
