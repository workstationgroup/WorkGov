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

function buildTenderBubble(t: TenderNotification) {
  const typeLabel = t.tenderType === "type_a" ? "A" : "B";
  const typeColor = t.tenderType === "type_a" ? "#0EA5E9" : "#F59E0B";
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

  // Header text message
  const headerLines = [
    `🔔 WorkGov: พบประกาศใหม่ ${tenders.length} รายการ`,
    typeACount > 0 ? `  Type A (เสนอราคาได้): ${typeACount}` : "",
    typeBCount > 0 ? `  Type B (โอกาสในอนาคต): ${typeBCount}` : "",
  ].filter(Boolean);

  const headerMessage = {
    type: "text" as const,
    text: headerLines.join("\n"),
  };

  // Flex carousel with tender cards (max 10 bubbles)
  const bubbles = tenders.slice(0, 10).map(buildTenderBubble);

  const flexMessage = {
    type: "flex" as const,
    altText: `พบประกาศใหม่ ${tenders.length} รายการ`,
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

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[LINE] Push failed:", res.status, err);
    return { sent: false, reason: "api_error", error: err };
  }

  return { sent: true, count: tenders.length };
}
