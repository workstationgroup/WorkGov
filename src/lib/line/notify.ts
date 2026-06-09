export interface TenderNotification {
  projectName: string;
  agency: string;
  budget: string | null;
  tenderType: "type_a" | "type_b" | "type_c";
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

// Resolve the list of LINE ids to push to. Prefers the enabled rows in the
// line_targets table (managed in the admin UI); if none are enabled yet, falls
// back to the legacy LINE_GROUP_ID env var so existing setups keep working.
async function getEnabledTargets(): Promise<string[]> {
  const { getDb } = await import("@/lib/db");
  const { lineTargets } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const rows = await db
    .select()
    .from(lineTargets)
    .where(eq(lineTargets.enabled, true));
  if (rows.length > 0) return rows.map((r) => r.lineId);
  const envGroup = process.env.LINE_GROUP_ID;
  return envGroup ? [envGroup] : [];
}

// Low-level push to a single LINE destination. Returns true on success.
async function pushToLine(
  token: string,
  to: string,
  messages: Record<string, unknown>[]
): Promise<boolean> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[LINE] Push failed:", res.status, to, err);
    return false;
  }
  return true;
}

// Fetch a group's display name via the LINE bot API (best-effort).
export async function fetchLineGroupName(groupId: string): Promise<string> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return "";
  try {
    const res = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/summary`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return "";
    const j = await res.json();
    return typeof j.groupName === "string" ? j.groupName : "";
  } catch {
    return "";
  }
}

// Send a one-off test message to a single LINE destination (admin UI button).
export async function sendLineTestMessage(
  lineId: string
): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { sent: false, reason: "missing_credentials" };
  const ok = await pushToLine(token, lineId, [
    {
      type: "text",
      text: "✅ WorkGov: ทดสอบการแจ้งเตือน — กลุ่มนี้เชื่อมต่อกับ WorkGov เรียบร้อยแล้ว",
    },
  ]);
  return ok ? { sent: true } : { sent: false, reason: "api_error" };
}

function buildTenderBubble(t: TenderNotification) {
  const typeLabel =
    t.tenderType === "type_a" ? "A" : t.tenderType === "type_b" ? "B" : "C";
  const typeColor =
    t.tenderType === "type_a"
      ? "#0EA5E9"
      : t.tenderType === "type_b"
        ? "#F59E0B"
        : "#8B5CF6"; // type_c = purple
  const budget = t.budget
    ? `฿${Number(t.budget).toLocaleString()}`
    : "ไม่ระบุงบ";

  const bodyContents: Record<string, unknown>[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: `Type ${typeLabel}`,
          size: "xxs",
          color: "#FFFFFF",
          weight: "bold",
          align: "center",
        },
      ],
      backgroundColor: typeColor,
      cornerRadius: "sm",
      paddingAll: "3px",
      paddingStart: "8px",
      paddingEnd: "8px",
      width: "55px",
    },
    {
      type: "text",
      text: t.projectName.slice(0, 100),
      size: "sm",
      weight: "bold",
      wrap: true,
      margin: "md",
    },
    {
      type: "text",
      text: t.agency || "—",
      size: "xs",
      color: "#888888",
      margin: "sm",
    },
    {
      type: "separator",
      margin: "md",
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "งบประมาณ", size: "xs", color: "#888888", flex: 3 },
        { type: "text", text: budget, size: "xs", weight: "bold", align: "end", flex: 5 },
      ],
      margin: "md",
    },
  ];

  if (t.submissionDate) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "ยื่นซอง", size: "xs", color: "#888888", flex: 3 },
        { type: "text", text: t.submissionDate, size: "xs", align: "end", flex: 5 },
      ],
      margin: "sm",
    });
  }

  if (t.aiSummary) {
    bodyContents.push(
      { type: "separator", margin: "md" },
      {
        type: "text",
        text: t.aiSummary.slice(0, 120),
        size: "xs",
        color: "#666666",
        wrap: true,
        margin: "md",
      }
    );
  }

  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      paddingAll: "16px",
    },
  };

  if (t.detailUrl) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "ดูรายละเอียด",
            uri: t.detailUrl,
          },
          style: "primary",
          color: "#1E3A5F",
          height: "sm",
        },
      ],
      paddingAll: "12px",
    };
  }

  return bubble;
}

export async function sendLineNotification(
  tenders: TenderNotification[],
  opts: { kind?: "new" | "updated" } = {}
) {
  const kind = opts.kind ?? "new";
  const enabled = await isLineEnabled();
  if (!enabled) {
    console.log("[LINE] Notifications disabled in settings");
    return { sent: false, reason: "disabled" };
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log("[LINE] Missing channel token, skipping notification");
    return { sent: false, reason: "missing_credentials" };
  }

  if (tenders.length === 0) {
    return { sent: false, reason: "no_tenders" };
  }

  const targets = await getEnabledTargets();
  if (targets.length === 0) {
    console.log("[LINE] No enabled groups configured");
    return { sent: false, reason: "no_targets" };
  }

  const typeACount = tenders.filter((t) => t.tenderType === "type_a").length;
  const typeBCount = tenders.filter((t) => t.tenderType === "type_b").length;
  const typeCCount = tenders.filter((t) => t.tenderType === "type_c").length;

  // Header text message
  const headerLines =
    kind === "updated"
      ? [
          `📝 WorkGov: เอกสารอัปเดต ${tenders.length} โครงการ`,
          `  (มีการเปลี่ยนแปลงเอกสาร/ประกาศ — ควรตรวจสอบ)`,
        ]
      : [
          `🔔 WorkGov: พบประกาศใหม่ ${tenders.length} รายการ`,
          typeACount > 0 ? `  Type A (เสนอราคาเอง): ${typeACount}` : "",
          typeBCount > 0 ? `  Type B (หาผู้ชนะไปขาย): ${typeBCount}` : "",
          typeCCount > 0 ? `  Type C (ไม่ใช่ e-bidding): ${typeCCount}` : "",
        ].filter(Boolean);

  const headerMessage = {
    type: "text" as const,
    text: headerLines.join("\n"),
  };

  // Flex carousel with tender cards (max 10 bubbles)
  const bubbles = tenders.slice(0, 10).map(buildTenderBubble);

  const flexMessage = {
    type: "flex" as const,
    altText:
      kind === "updated"
        ? `เอกสารอัปเดต ${tenders.length} โครงการ`
        : `พบประกาศใหม่ ${tenders.length} รายการ`,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };

  const messages: Record<string, unknown>[] = [headerMessage, flexMessage];

  if (tenders.length > 10) {
    messages.push({
      type: "text",
      text: `...และอีก ${tenders.length - 10} รายการ\n🔗 ดูทั้งหมดที่ workgov.workstationoffice.com`,
    });
  }

  // Push to every enabled group. LINE has no multicast for groups, so each
  // destination is an individual push; one failure doesn't block the others.
  const results = await Promise.all(
    targets.map((to) => pushToLine(token, to, messages))
  );
  const delivered = results.filter(Boolean).length;

  if (delivered === 0) {
    return { sent: false, reason: "api_error", targets: targets.length };
  }

  return {
    sent: true,
    count: tenders.length,
    targets: targets.length,
    delivered,
  };
}
