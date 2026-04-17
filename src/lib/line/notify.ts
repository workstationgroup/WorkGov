export interface TenderNotification {
  projectName: string;
  agency: string;
  budget: string | null;
  tenderType: "type_a" | "type_b";
  aiSummary: string | null;
  submissionDate: string | null;
  detailUrl: string | null;
}

export async function isLineEnabled(): Promise<boolean> {
  // Dynamic import to avoid circular deps
  const { getDb } = await import("@/lib/db");
  const { settings } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "line_enabled"));
  // Default to true if not set
  return !row || row.value !== "false";
}

export async function sendLineNotification(tenders: TenderNotification[]) {
  const enabled = await isLineEnabled();
  if (!enabled) {
    console.log("[LINE] Notifications disabled in settings");
    return { sent: false, reason: "disabled" };
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = process.env.LINE_GROUP_ID;

  if (!token || !groupId) {
    console.log("[LINE] Missing credentials, skipping notification");
    return { sent: false, reason: "missing_credentials" };
  }

  if (tenders.length === 0) {
    return { sent: false, reason: "no_tenders" };
  }

  const typeACount = tenders.filter((t) => t.tenderType === "type_a").length;
  const typeBCount = tenders.filter((t) => t.tenderType === "type_b").length;

  const header = `🔔 WorkGov: พบประกาศใหม่ ${tenders.length} รายการ`;
  const summary = [
    typeACount > 0 ? `Type A (เสนอราคาได้): ${typeACount}` : "",
    typeBCount > 0 ? `Type B (โอกาสในอนาคต): ${typeBCount}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const details = tenders
    .slice(0, 5)
    .map((t, i) => {
      const typeLabel = t.tenderType === "type_a" ? "[A]" : "[B]";
      const budget = t.budget
        ? `฿${Number(t.budget).toLocaleString()}`
        : "ไม่ระบุงบ";
      const deadline = t.submissionDate
        ? `ยื่นซอง: ${t.submissionDate}`
        : "";
      return [
        `${i + 1}. ${typeLabel} ${t.projectName.slice(0, 80)}`,
        `   ${t.agency}`,
        `   ${budget}${deadline ? ` | ${deadline}` : ""}`,
        t.aiSummary ? `   📝 ${t.aiSummary.slice(0, 60)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const overflow =
    tenders.length > 5 ? `\n\n...และอีก ${tenders.length - 5} รายการ` : "";

  const footer = "\n\n🔗 ดูทั้งหมดที่ WorkGov Dashboard";

  const message = [header, summary, "", details, overflow, footer].join("\n");

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[LINE] Push failed:", res.status, err);
    return { sent: false, reason: "api_error", error: err };
  }

  return { sent: true, count: tenders.length };
}
