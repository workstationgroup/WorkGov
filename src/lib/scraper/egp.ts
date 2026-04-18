// e-GP Scraper — searches process5.gprocurement.go.th for tenders
//
// Uses Keycloak OIDC direct-access grant to authenticate,
// then queries the announcement search API with the Bearer token.
//
// API discovered from the e-GP Angular SPA (egp-aann09-web module).

export interface RawTender {
  egpId: string;
  projectName: string;
  agency: string;
  subAgency?: string;
  province?: string;
  budget?: string;
  procurementMethod?: string;
  announceDate?: string;
  submissionDate?: string;
  detailUrl?: string;
  rawData?: Record<string, unknown>;
}

export interface ScrapeResult {
  tenders: RawTender[];
  keyword: string;
  error?: string;
}

const EGP_BASE = "https://process5.gprocurement.go.th";
const KEYCLOAK_URL =
  "https://login-process5.gprocurement.go.th/auth/realms/egpms/protocol/openid-connect/token";
const SEARCH_URL = `${EGP_BASE}/egp-atpj27-service/pb/a-egp-allt-project/announcement`;

const METHOD_MAP: Record<string, string> = {
  "15": "ประกวดราคา",
  "16": "e-bidding",
  "17": "คัดเลือก",
  "19": "เฉพาะเจาะจง",
  "20": "จ้างที่ปรึกษา",
  "21": "จ้างออกแบบ",
};

function mapMethodId(id: string): string {
  return METHOD_MAP[id] || id;
}

// Get current Thai Buddhist year (e.g. 2569 for 2026 CE)
function getCurrentBudgetYear(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const ceYear = now.getFullYear();
  // Thai fiscal year starts October: Oct-Dec = next year's budget
  const beYear = month >= 9 ? ceYear + 544 : ceYear + 543;
  return beYear.toString();
}

// Login via Keycloak direct-access grant (Resource Owner Password Credentials)
async function getAccessToken(): Promise<string | null> {
  const username = process.env.EGP_USERNAME;
  const password = process.env.EGP_PASSWORD;

  if (!username || !password) {
    console.error("[Scraper] Missing EGP_USERNAME or EGP_PASSWORD");
    return null;
  }

  try {
    const res = await fetch(KEYCLOAK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "egp-login-keycloak-web",
        username,
        password,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Scraper] Keycloak login failed:", res.status, err);
      return null;
    }

    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error("[Scraper] Login error:", err);
    return null;
  }
}

// Search tenders by keyword using the announcement API
async function searchTenders(
  token: string,
  keyword: string
): Promise<RawTender[]> {
  try {
    const params = new URLSearchParams({
      budgetYear: getCurrentBudgetYear(),
      keywordSearch: keyword,
      announcementTodayFlag: "false",
      page: "1",
    });

    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.error(`[Scraper] Search failed for "${keyword}":`, res.status);
      return [];
    }

    const json = await res.json();

    // Check Cloudflare validation
    if (json.validateCfTurnTile === false) {
      console.error(`[Scraper] Cloudflare blocked for "${keyword}"`);
      return [];
    }

    const items = json.data?.data || [];

    return items.map(
      (item: Record<string, unknown>) => ({
        egpId: String(item.projectId || ""),
        projectName: String(item.projectName || ""),
        agency: String(item.deptSubName || item.announceSubDesc || ""),
        province: item.rdbProvinceMoiName
          ? String(item.rdbProvinceMoiName)
          : undefined,
        budget: item.projectMoney ? String(item.projectMoney) : undefined,
        procurementMethod: item.methodId
          ? mapMethodId(String(item.methodId))
          : undefined,
        announceDate: item.announceDate
          ? String(item.announceDate)
          : undefined,
        detailUrl: item.projectId
          ? `${EGP_BASE}/egp-agpc01-web/announcement#targetproc=detail&projectId=${item.projectId}`
          : undefined,
        rawData: item as Record<string, unknown>,
      })
    );
  } catch (err) {
    console.error(`[Scraper] Search error for "${keyword}":`, err);
    return [];
  }
}

// Main scrape function — logs in once, searches all keywords
export async function scrapeEgp(
  enabledKeywords: { keyword: string; type: string }[]
): Promise<ScrapeResult[]> {
  const token = await getAccessToken();

  if (!token) {
    return enabledKeywords.map((kw) => ({
      tenders: [],
      keyword: kw.keyword,
      error: "Login failed — check EGP_USERNAME and EGP_PASSWORD",
    }));
  }

  const results: ScrapeResult[] = [];

  for (const kw of enabledKeywords) {
    const tenders = await searchTenders(token, kw.keyword);
    results.push({ tenders, keyword: kw.keyword });
  }

  return results;
}
