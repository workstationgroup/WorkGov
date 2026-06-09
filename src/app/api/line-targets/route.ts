import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lineTargets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logChange } from "@/lib/changelog";

// Managing LINE notification groups is admin-only.
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const rows = await db.select().from(lineTargets).orderBy(lineTargets.id);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const { lineId, name } = await request.json();

  if (!lineId || typeof lineId !== "string") {
    return NextResponse.json({ error: "Missing lineId" }, { status: 400 });
  }

  const [row] = await db
    .insert(lineTargets)
    .values({
      lineId: lineId.trim(),
      name: typeof name === "string" ? name.trim() : "",
      enabled: true, // a manually-added group is intentional → on by default
    })
    .onConflictDoNothing({ target: lineTargets.lineId })
    .returning();

  if (!row) {
    return NextResponse.json(
      { error: "Group already exists" },
      { status: 409 }
    );
  }

  await logChange("line", "add", `Added LINE group "${row.name || row.lineId}"`);
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const { id, name, enabled } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const set: { name?: string; enabled?: boolean } = {};
  if (typeof name === "string") set.name = name.trim();
  if (typeof enabled === "boolean") set.enabled = enabled;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(lineTargets)
    .set(set)
    .where(eq(lineTargets.id, id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (typeof enabled === "boolean") {
    await logChange(
      "line",
      "toggle",
      `${enabled ? "Enabled" : "Disabled"} LINE group "${row.name || row.lineId}"`
    );
  } else {
    await logChange("line", "update", `Renamed LINE group to "${row.name}"`);
  }
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(lineTargets)
    .where(eq(lineTargets.id, id))
    .returning();
  if (deleted) {
    await logChange(
      "line",
      "remove",
      `Removed LINE group "${deleted.name || deleted.lineId}"`
    );
  }
  return NextResponse.json({ ok: true });
}
