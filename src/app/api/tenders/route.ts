import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenders, keywords } from "@/lib/db/schema";
import { desc, eq, ilike, or, and, not } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "all";
  const status = searchParams.get("status") || "all";

  // Load negative keywords
  const negativeKeywords = (
    await db
      .select({ keyword: keywords.keyword })
      .from(keywords)
      .where(and(eq(keywords.type, "negative"), eq(keywords.enabled, true)))
  ).map((k) => k.keyword.toLowerCase());

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(tenders.projectName, `%${search}%`),
        ilike(tenders.agency, `%${search}%`)
      )
    );
  }

  if (type !== "all") {
    conditions.push(eq(tenders.tenderType, type));
  }

  if (status !== "all") {
    conditions.push(eq(tenders.status, status));
  }

  // Exclude tenders matching negative keywords
  for (const neg of negativeKeywords) {
    conditions.push(not(ilike(tenders.projectName, `%${neg}%`)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(tenders)
    .where(where)
    .orderBy(desc(tenders.createdAt))
    .limit(100);

  return NextResponse.json(rows);
}
