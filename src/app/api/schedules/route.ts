import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { schedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logChange } from "@/lib/changelog";

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

  await logChange("schedule", "add", `Added schedule ${time}`);
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

  await logChange("schedule", "toggle", `${enabled ? "Enabled" : "Disabled"} schedule ${row.time}`);
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const [deleted] = await db.delete(schedules).where(eq(schedules.id, id)).returning();
  if (deleted) await logChange("schedule", "remove", `Removed schedule ${deleted.time}`);
  return NextResponse.json({ ok: true });
}
