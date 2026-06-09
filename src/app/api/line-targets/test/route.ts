import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lineTargets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendLineTestMessage } from "@/lib/line/notify";

// POST /api/line-targets/test { id } — push a sample message to one group so an
// admin can confirm the bot reaches it. Admin-only.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const db = getDb();
  const [target] = await db
    .select()
    .from(lineTargets)
    .where(eq(lineTargets.id, id));
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await sendLineTestMessage(target.lineId);
  return NextResponse.json(result, { status: result.sent ? 200 : 502 });
}
