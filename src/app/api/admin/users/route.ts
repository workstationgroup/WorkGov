import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users, authenticators } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return null;
  }
  return session;
}

// GET /api/admin/users — list all users with passkey counts
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users);

  // Get passkey counts per user
  const passkeyCounts = await db
    .select({
      userId: authenticators.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(authenticators)
    .groupBy(authenticators.userId);

  const countMap = new Map(passkeyCounts.map((r) => [r.userId, r.count]));

  const result = allUsers.map((u) => ({
    ...u,
    passkeyCount: countMap.get(u.id) ?? 0,
  }));

  return NextResponse.json(result);
}

// DELETE /api/admin/users — remove all passkeys for a user
export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, credentialID } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const db = getDb();

  if (credentialID) {
    // Delete specific passkey
    await db
      .delete(authenticators)
      .where(
        and(
          eq(authenticators.userId, userId),
          eq(authenticators.credentialID, credentialID)
        )
      );
  } else {
    // Delete all passkeys for user
    await db
      .delete(authenticators)
      .where(eq(authenticators.userId, userId));
  }

  return NextResponse.json({ ok: true });
}
