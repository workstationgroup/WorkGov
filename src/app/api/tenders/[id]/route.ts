import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tenders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function findTender(db: ReturnType<typeof getDb>, id: string) {
  // Support lookup by numeric ID or e-GP ID
  const isNumeric = /^\d+$/.test(id) && id.length < 6;
  return db
    .select()
    .from(tenders)
    .where(isNumeric ? eq(tenders.id, Number(id)) : eq(tenders.egpId, id));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const [tender] = await findTender(db, id);

  if (!tender) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(tender);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const allowedFields = ["status", "tenderType"] as const;
  const updates: Record<string, string> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  // Find tender first to get numeric ID for update
  const [existing] = await findTender(db, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(tenders)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tenders.id, existing.id))
    .returning();

  return NextResponse.json(updated);
}
