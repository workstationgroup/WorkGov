import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Temporary webhook to capture LINE Group ID
// Set this URL as webhook in LINE Developers console:
// https://your-domain.vercel.app/api/line-webhook

export async function POST(request: Request) {
  const body = await request.json();
  const events = body.events || [];

  for (const event of events) {
    if (event.source?.groupId) {
      const groupId = event.source.groupId;
      console.log("[LINE Webhook] Group ID found:", groupId);

      // Save to database for retrieval
      const db = getDb();
      await db
        .insert(settings)
        .values({ key: "captured_line_group_id", value: groupId })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: groupId },
        });

      return NextResponse.json({
        groupId,
        eventType: event.type,
        saved: true,
      });
    }
  }

  return NextResponse.json({ ok: true, events: events.length });
}

// GET: verify webhook + show captured group ID
export async function GET() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "captured_line_group_id"));

  return NextResponse.json({
    ok: true,
    purpose: "LINE webhook endpoint",
    capturedGroupId: row?.value || null,
  });
}
