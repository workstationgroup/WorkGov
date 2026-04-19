import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function verifyLineSignature(
  body: string,
  signature: string | null
): Promise<boolean> {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.warn("[LINE Webhook] LINE_CHANNEL_SECRET not set, skipping verification");
    return false;
  }
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return signature === expected;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  const valid = await verifyLineSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const body = JSON.parse(rawBody);
  const events = body.events || [];

  for (const event of events) {
    if (event.source?.groupId) {
      const groupId = event.source.groupId;
      console.log("[LINE Webhook] Group ID captured");

      const db = getDb();
      await db
        .insert(settings)
        .values({ key: "captured_line_group_id", value: groupId })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: groupId },
        });

      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ ok: true });
}

// GET: verify webhook is reachable (no sensitive data)
export async function GET() {
  return NextResponse.json({ ok: true, purpose: "LINE webhook endpoint" });
}
