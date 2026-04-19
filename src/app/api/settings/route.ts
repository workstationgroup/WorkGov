import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Keys that only admin can read/write
const ADMIN_ONLY_KEYS = ["admin_user_id"];

// Keys that no one can write via API (system-managed)
const SYSTEM_KEYS = ["admin_user_id", "captured_line_group_id"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key) {
    if (ADMIN_ONLY_KEYS.includes(key) && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return NextResponse.json(row || null);
  }

  const rows = await db.select().from(settings);
  // Filter out admin-only keys for non-admins
  const filtered = session.user.isAdmin
    ? rows
    : rows.filter((r) => !ADMIN_ONLY_KEYS.includes(r.key));
  return NextResponse.json(filtered);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  // Block writes to system-managed keys
  if (SYSTEM_KEYS.includes(key)) {
    return NextResponse.json({ error: "Cannot modify system key" }, { status: 403 });
  }

  // Block writes to admin-only keys for non-admins
  if (ADMIN_ONLY_KEYS.includes(key) && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
