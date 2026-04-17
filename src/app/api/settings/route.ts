import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key) {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return NextResponse.json(row || null);
  }

  const rows = await db.select().from(settings);
  return NextResponse.json(rows);
}

export async function PUT(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key));

  if (existing.length > 0) {
    const [row] = await db
      .update(settings)
      .set({ value: String(value), updatedAt: new Date() })
      .where(eq(settings.key, key))
      .returning();
    return NextResponse.json(row);
  }

  const [row] = await db
    .insert(settings)
    .values({ key, value: String(value) })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
