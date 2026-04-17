import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { keywords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(keywords).orderBy(keywords.id);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { keyword, type } = body;

  if (!keyword || typeof keyword !== "string") {
    return NextResponse.json(
      { error: "Invalid keyword" },
      { status: 400 }
    );
  }

  if (type !== "type_a" && type !== "type_b") {
    return NextResponse.json(
      { error: "Type must be type_a or type_b" },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(keywords)
    .values({ keyword: keyword.trim(), type, enabled: true })
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
    .update(keywords)
    .set({ enabled })
    .where(eq(keywords.id, id))
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

  await db.delete(keywords).where(eq(keywords.id, id));
  return NextResponse.json({ ok: true });
}
