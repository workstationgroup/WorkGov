import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { authenticators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select({
      credentialID: authenticators.credentialID,
      credentialDeviceType: authenticators.credentialDeviceType,
      credentialBackedUp: authenticators.credentialBackedUp,
      transports: authenticators.transports,
    })
    .from(authenticators)
    .where(eq(authenticators.userId, session.user.id));

  return NextResponse.json(rows);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { credentialID } = await request.json();
  if (!credentialID) {
    return NextResponse.json({ error: "Missing credentialID" }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(authenticators)
    .where(
      and(
        eq(authenticators.credentialID, credentialID),
        eq(authenticators.userId, session.user.id)
      )
    );

  return NextResponse.json({ ok: true });
}
