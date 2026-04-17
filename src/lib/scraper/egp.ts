// e-GP Scraper — searches process5.gprocurement.go.th for tenders
//
// The e-GP site is an SPA that requires login. On Vercel serverless,
// we can't run a full Playwright browser. This module uses the underlying
// REST API that the SPA calls internally.
//
// Discovery: The SPA at process5.gprocurement.go.th makes XHR calls to
// its backend API. We replicate those calls directly.

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

// Login and get session token
async function getSession(): Promise<string | null> {
  const username = process.env.EGP_USERNAME;
  const password = process.env.EGP_PASSWORD;

  if (!username || !password) {
    console.error("[Scraper] Missing EGP_USERNAME or EGP_PASSWORD");
    return null;
  }

  try {
    // The e-GP SPA uses a login API endpoint
    const res = await fetch(`${EGP_BASE}/egp-agpc01-api/security/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      console.error("[Scraper] Login failed:", res.status);
      return null;
    }

    const data = await res.json();
    // The session token is typically in the response body or a cookie
    return data.token || data.access_token || null;
  } catch (err) {
    console.error("[Scraper] Login error:", err);
    return null;
  }
}

// Search tenders by keyword
async function searchTenders(
  token: string,
  keyword: string
): Promise<RawTender[]> {
  try {
    const res = await fetch(
      `${EGP_BASE}/egp-agpc01-api/announcement/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          keyword,
          page: 1,
          pageSize: 50,
        }),
      }
    );

    if (!res.ok) {
      console.error(`[Scraper] Search failed for "${keyword}":`, res.status);
      return [];
    }

    const data = await res.json();
    const items = data.data || data.items || data.content || [];

    return items.map((item: Record<string, unknown>) => ({
      egpId: String(item.announcementId || item.id || ""),
      projectName: String(item.projectName || item.name || ""),
      agency: String(item.deptName || item.agency || ""),
      subAgency: item.subDeptName ? String(item.subDeptName) : undefined,
      province: item.province ? String(item.province) : undefined,
      budget: item.budget ? String(item.budget) : undefined,
      procurementMethod: item.procurementMethod
        ? String(item.procurementMethod)
        : undefined,
      announceDate: item.announceDate ? String(item.announceDate) : undefined,
      submissionDate: item.submissionDate
        ? String(item.submissionDate)
        : undefined,
      detailUrl: item.announcementId
        ? `${EGP_BASE}/egp-agpc01-web/announcement#targetproc=detail&id=${item.announcementId}`
        : undefined,
      rawData: item as Record<string, unknown>,
    }));
  } catch (err) {
    console.error(`[Scraper] Search error for "${keyword}":`, err);
    return [];
  }
}

// Main scrape function — logs in once, searches all keywords
export async function scrapeEgp(
  enabledKeywords: { keyword: string; type: string }[]
): Promise<ScrapeResult[]> {
  const token = await getSession();

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
