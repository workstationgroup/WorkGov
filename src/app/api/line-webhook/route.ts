import { NextResponse } from "next/server";

// Temporary webhook to capture LINE Group ID
// Set this URL as webhook in LINE Developers console:
// https://your-domain.vercel.app/api/line-webhook

export async function POST(request: Request) {
  const body = await request.json();
  const events = body.events || [];

  for (const event of events) {
    if (event.source?.groupId) {
      console.log("[LINE Webhook] Group ID found:", event.source.groupId);
      return NextResponse.json({
        groupId: event.source.groupId,
        eventType: event.type,
      });
    }
  }

  return NextResponse.json({ ok: true, events: events.length });
}

// LINE sends a GET to verify the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true, purpose: "LINE webhook endpoint" });
}
