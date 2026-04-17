import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(schedules).orderBy(schedules.time);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { time, enabled } = body;

  if (!time || typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Invalid time format" }, { status: 400 });
  }

  const [row] = await db
    .insert(schedules)
    .values({ time, enabled: enabled ?? true })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { id, enabled } = body;

  if (!id || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [row] = await db
    .update(schedules)
    .set({ enabled })
    .where(eq(schedules.id, id))
    .returning();

  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(schedules).where(eq(schedules.id, id));
  return NextResponse.json({ ok: true });
}
