export interface ClassificationResult {
  tenderType: "type_a" | "type_b" | "irrelevant";
  reason: string;
  summary: string;
}

export async function classifyTender(tender: {
  projectName: string;
  agency?: string;
  budget?: string;
  scopeOfWork?: string;
  matchedKeyword?: string;
}): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log("[AI] Missing ANTHROPIC_API_KEY, using keyword-only classification");
    return fallbackClassify(tender);
  }

  const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการจัดซื้อจัดจ้างภาครัฐของไทย วิเคราะห์ประกาศจัดซื้อจัดจ้างนี้สำหรับบริษัทขายเฟอร์นิเจอร์สำนักงาน (โต๊ะ, เก้าอี้, ตู้, พาร์ทิชั่น, ครุภัณฑ์สำนักงาน)

ข้อมูลประกาศ:
- ชื่อโครงการ: ${tender.projectName}
- หน่วยงาน: ${tender.agency || "ไม่ระบุ"}
- งบประมาณ: ${tender.budget || "ไม่ระบุ"}
- ขอบเขตงาน: ${tender.scopeOfWork || "ไม่ระบุ"}
- คีย์เวิร์ดที่พบ: ${tender.matchedKeyword || "ไม่ระบุ"}

จำแนกประเภท:
- type_a: เสนอราคาได้โดยตรง — โครงการซื้อเฟอร์นิเจอร์/ครุภัณฑ์สำนักงาน
- type_b: โอกาสในอนาคต — โครงการก่อสร้าง/ปรับปรุงอาคารที่อาจต้องใช้เฟอร์นิเจอร์ภายหลัง
- irrelevant: ไม่เกี่ยวข้องกับเฟอร์นิเจอร์สำนักงานเลย

ตอบเป็น JSON เท่านั้น:
{"tenderType": "type_a|type_b|irrelevant", "reason": "เหตุผลสั้นๆ", "summary": "สรุปโครงการ 1-2 ประโยค"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[AI] API error:", res.status);
      return fallbackClassify(tender);
    }

    const data = await res.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error("[AI] Could not parse JSON from response");
      return fallbackClassify(tender);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!["type_a", "type_b", "irrelevant"].includes(parsed.tenderType)) {
      return fallbackClassify(tender);
    }

    return {
      tenderType: parsed.tenderType,
      reason: parsed.reason || "",
      summary: parsed.summary || "",
    };
  } catch (err) {
    console.error("[AI] Classification error:", err);
    return fallbackClassify(tender);
  }
}

function fallbackClassify(tender: {
  projectName: string;
  matchedKeyword?: string;
}): ClassificationResult {
  const name = tender.projectName.toLowerCase();
  const keyword = tender.matchedKeyword || "";

  const typeAPatterns = [
    "ครุภัณฑ์สำนักงาน",
    "เฟอร์นิเจอร์",
    "โต๊ะ",
    "เก้าอี้",
    "ตู้",
    "พาร์ทิชั่น",
  ];
  const typeBPatterns = ["ก่อสร้างอาคาร", "ปรับปรุงอาคาร"];

  if (typeAPatterns.some((p) => name.includes(p) || keyword.includes(p))) {
    return {
      tenderType: "type_a",
      reason: "Keyword match (fallback — no AI key)",
      summary: tender.projectName.slice(0, 100),
    };
  }

  if (typeBPatterns.some((p) => name.includes(p) || keyword.includes(p))) {
    return {
      tenderType: "type_b",
      reason: "Construction keyword match (fallback — no AI key)",
      summary: tender.projectName.slice(0, 100),
    };
  }

  return {
    tenderType: "type_a",
    reason: "Default classification (fallback — no AI key)",
    summary: tender.projectName.slice(0, 100),
  };
}
