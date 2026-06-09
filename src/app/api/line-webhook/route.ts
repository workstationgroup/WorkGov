import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lineTargets } from "@/lib/db/schema";
import { fetchLineGroupName } from "@/lib/line/notify";

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

  const db = getDb();
  const seen = new Set<string>();

  for (const event of events) {
    const src = event.source || {};
    const lineId: string | undefined = src.groupId || src.roomId;
    if (!lineId || seen.has(lineId)) continue;
    seen.add(lineId);

    const kind = src.groupId ? "group" : "room";
    const name = src.groupId ? await fetchLineGroupName(src.groupId) : "";

    // Register the group so an admin can name/enable it in the UI. New groups
    // start disabled (enabled defaults to false); onConflictDoNothing keeps an
    // admin's existing name/toggle untouched on repeat events.
    await db
      .insert(lineTargets)
      .values({ lineId, kind, name })
      .onConflictDoNothing({ target: lineTargets.lineId });

    console.log(`[LINE Webhook] Registered ${kind} target`);
  }

  return NextResponse.json({ ok: true });
}

// GET: verify webhook is reachable (no sensitive data)
export async function GET() {
  return NextResponse.json({ ok: true, purpose: "LINE webhook endpoint" });
}
