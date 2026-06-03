// Tender analysis.
//
// The tender TYPE is decided by which search lane found it (Type A = we bid;
// Type B = construction winner we sell furniture to) — NOT guessed here. This
// module's job is to (1) gate relevance to the office-furniture business and
// (2) extract the structured review points the team needs for each lane.

// type_c = non-e-bidding (uses the winner-oriented prompt, like type_b)
export type TenderLane = "type_a" | "type_b" | "type_c";

export interface TypeAKeyPoints {
  qualifications: string; // คุณสมบัติผู้เข้าร่วม
  medianPrice: string; // ราคากลาง
  medianPriceSource: string; // ราคากลางมาจากบริษัทไหน / สืบค้นจากเว็บ
  deliveryTime: string; // ระยะเวลาส่งมอบงาน
  penalty: string; // ค่าปรับ
  detailedSpecs: string; // สเปคสินค้าแบบละเอียด
  specLockNote: string; // มีใคร lock spec ไหม
  contactChannel: string; // ช่องทางติดต่อ
}

export interface TypeBWinner {
  winnerName: string;
  winnerPrice: string;
  contractDate: string; // วันเซ็นสัญญา (ระวังเลขไทย)
}

export interface ClassificationResult {
  relevant: boolean;
  reason: string;
  summary: string;
  keyPoints?: TypeAKeyPoints; // type_a only
  winner?: TypeBWinner; // type_b only
}

interface ClassifyInput {
  lane: TenderLane;
  projectName: string;
  agency?: string;
  budget?: string;
  scopeOfWork?: string;
  matchedKeyword?: string;
  documentText?: string; // extracted PDF text, when available
}

const MODEL = "claude-haiku-4-5-20251001";

export async function classifyTender(
  input: ClassifyInput
): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[AI] Missing ANTHROPIC_API_KEY, using relevance fallback");
    return fallbackClassify(input);
  }

  const prompt = buildPrompt(input);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[AI] API error:", res.status);
      return fallbackClassify(input);
    }

    const data = await res.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI] Could not parse JSON from response");
      return fallbackClassify(input);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      relevant: parsed.relevant !== false,
      reason: parsed.reason || "",
      summary: parsed.summary || "",
      keyPoints: input.lane === "type_a" ? parsed.keyPoints : undefined,
      winner: input.lane === "type_a" ? undefined : parsed.winner,
    };
  } catch (err) {
    console.error("[AI] Classification error:", err);
    return fallbackClassify(input);
  }
}

function buildPrompt(input: ClassifyInput): string {
  const header = `คุณเป็นผู้เชี่ยวชาญด้านการจัดซื้อจัดจ้างภาครัฐของไทย วิเคราะห์ประกาศนี้ให้บริษัทขายเฟอร์นิเจอร์สำนักงาน (โต๊ะ, เก้าอี้, ตู้, พาร์ทิชั่น, ครุภัณฑ์สำนักงาน)

ข้อมูลประกาศ:
- ชื่อโครงการ: ${input.projectName}
- หน่วยงาน: ${input.agency || "ไม่ระบุ"}
- งบประมาณ: ${input.budget || "ไม่ระบุ"}
- ขอบเขตงาน: ${input.scopeOfWork || "ไม่ระบุ"}
- คีย์เวิร์ดที่พบ: ${input.matchedKeyword || "ไม่ระบุ"}${
    input.documentText
      ? `\n\nเนื้อหาจากเอกสารแนบ:\n${input.documentText.slice(0, 12000)}`
      : ""
  }`;

  if (input.lane === "type_a") {
    return `${header}

นี่คืองานที่บริษัทจะ "เข้าประมูลเอง" (Type A) ให้ทำ 2 อย่าง:
1. ประเมินว่าโครงการนี้เกี่ยวข้องกับเฟอร์นิเจอร์/ครุภัณฑ์สำนักงานที่เราขายหรือไม่ (relevant)
2. สกัดประเด็นสำคัญสำหรับเตรียมยื่นซอง

ตอบเป็น JSON เท่านั้น (ฟิลด์ที่ไม่พบให้ใส่ "ไม่ระบุ"):
{"relevant": true|false, "reason": "เหตุผลสั้นๆ", "summary": "สรุปโครงการ 1-2 ประโยค", "keyPoints": {"qualifications": "คุณสมบัติผู้เข้าร่วม", "medianPrice": "ราคากลาง", "medianPriceSource": "ราคากลางมาจากบริษัทใด/สืบค้นจากเว็บ", "deliveryTime": "ระยะเวลาส่งมอบ", "penalty": "ค่าปรับ", "detailedSpecs": "สเปคสินค้าโดยละเอียด", "specLockNote": "มีการล็อกสเปคให้รายใดหรือไม่ พร้อมเหตุผล", "contactChannel": "ช่องทางติดต่อหน่วยงาน"}}`;
  }

  return `${header}

นี่คืองานก่อสร้างที่เรา "ไม่ได้ประมูลเอง" แต่ต้องการหา "ผู้ชนะ" เพื่อวิ่งเข้าไปขายเฟอร์นิเจอร์ภายหลัง (Type B) ให้ทำ 2 อย่าง:
1. ประเมินว่าโครงการนี้น่าจะมีความต้องการเฟอร์นิเจอร์ตามมาหรือไม่ (relevant)
2. สกัดข้อมูลผู้ชนะ — ระวังตัวเลขไทย (๐๑๒๓๔๕๖๗๘๙) ให้แปลงเป็นเลขอารบิก

ตอบเป็น JSON เท่านั้น (ฟิลด์ที่ไม่พบให้ใส่ "ไม่ระบุ"):
{"relevant": true|false, "reason": "เหตุผลสั้นๆ", "summary": "สรุปโครงการ 1-2 ประโยค", "winner": {"winnerName": "ชื่อบริษัทผู้ชนะ", "winnerPrice": "ราคาที่ชนะ (ตัวเลขอารบิก)", "contractDate": "วันเซ็นสัญญา (YYYY-MM-DD ถ้าทราบ)"}}`;
}

// No API key: keep everything (don't silently drop tenders), no extraction.
function fallbackClassify(input: ClassifyInput): ClassificationResult {
  return {
    relevant: true,
    reason: "Kept without AI analysis (no ANTHROPIC_API_KEY)",
    summary: input.projectName.slice(0, 120),
  };
}
