import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenders } from "@/lib/db/schema";
import { desc, eq, ilike, or, and, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "all";
  const status = searchParams.get("status") || "all";

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

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(tenders)
    .where(where)
    .orderBy(desc(tenders.createdAt))
    .limit(100);

  return NextResponse.json(rows);
}
