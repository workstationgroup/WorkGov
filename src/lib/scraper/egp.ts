// e-GP Scraper — searches process5.gprocurement.go.th for tenders
//
// Uses Keycloak OIDC direct-access grant to authenticate,
// then queries the announcement search API with the Bearer token.
//
// API discovered from the e-GP Angular SPA (egp-aann09-web module).

import { getDbdInfo } from "./dbd";

export type DocumentCategory =
  | "price_median" // ประกาศราคากลาง
  | "tor_bidding" // ร่างเอกสารประกวดราคา (e-bidding) / TOR
  | "invitation" // ประกาศเชิญชวน
  | "bid_summary" // สรุปข้อมูลการเสนอราคาเบื้องต้น
  | "winner" // ประกาศรายชื่อผู้ชนะการเสนอราคา
  | "other";

export interface TenderDocument {
  name: string;
  date: string | null;
  category: DocumentCategory;
  url?: string;
}

// A winning-bid price arrives as a free-form Thai string; extract the numeric
// value (drizzle numeric accepts a string) or null if not parseable.
export function parseBidPrice(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d.]/g, "");
  if (!digits || isNaN(Number(digits))) return null;
  return digits;
}

// Classify an e-GP document by its Thai name. Order matters — winner and
// bid-summary checks come before the generic "ประกวดราคา" TOR match so a
// winner announcement isn't mislabeled as a bidding document.
export function categorizeDocument(name: string): DocumentCategory {
  const n = name.replace(/\s+/g, "");
  if (n.includes("ราคากลาง")) return "price_median";
  if (n.includes("ผู้ชนะ") || n.includes("ผู้ชนะการเสนอราคา")) return "winner";
  if (n.includes("สรุป") && n.includes("เสนอราคา")) return "bid_summary";
  if (n.includes("เชิญชวน")) return "invitation";
  if (
    n.includes("ร่าง") ||
    n.includes("TOR") ||
    n.includes("ประกวดราคา") ||
    n.includes("e-bidding") ||
    n.includes("ebidding")
  )
    return "tor_bidding";
  return "other";
}

export interface RawTender {
  egpId: string;
  projectName: string;
  agency: string;
  subAgency?: string;
  province?: string;
  budget?: string;
  priceReference?: string;
  egpStatus?: string;
  procurementMethod?: string;
  announceDate?: string;
  submissionDate?: string;
  detailUrl?: string;
  documents?: TenderDocument[];
  rawData?: Record<string, unknown>;

  // Lane derived from the e-GP flow stage (not the keyword):
  //   type_a = ร่าง TOR / ประกาศเชิญชวน (we bid)
  //   type_b = ประกาศผู้ชนะ (find winner to sell to)
  lane?: "type_a" | "type_b";
  // Structured fields straight from getProcurementDetail (no PDF parsing):
  deliverDay?: number; // ระยะเวลาส่งมอบ (วัน)
  winnerPrice?: string; // priceAgree — ราคาที่ตกลง/ชนะ (Type B)

  // Type B — winner + all bidders from getProcureResult (structured).
  winnerName?: string;
  winnerTin?: string;
  bidders?: Bidder[];
  // Type B — winner company from getMerchantData (structured).
  company?: WinnerCompanyData;
}

export interface Bidder {
  name: string;
  tin: string;
  price: string | null;
  isWinner: boolean;
}

export interface WinnerCompanyData {
  name: string;
  nameEn?: string;
  taxId: string;
  address?: string;
  mapUrl?: string;
  phone?: string;
  website?: string;
  businessType?: string;
  blacklistStatus?: string;
  // From DBD OpenAPI (directors are a deep-link, not a field — see dbd.ts)
  dbdStatus?: string;
  businessObjective?: string;
  registeredCapital?: string;
  registerDate?: string;
  dbdUrl?: string;
}

// Map an e-GP flowName to our lane. Returns null for stages we don't track
// (contract management, cancelled, etc.).
export function deriveLane(flowName: string): "type_a" | "type_b" | null {
  const f = flowName || "";
  if (f.includes("ผู้ชนะ")) return "type_b";
  if (f.includes("ร่าง") || f.includes("เชิญชวน")) return "type_a";
  return null;
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
const MERCHANT_URL = `${EGP_BASE}/egp-acc-merchant-service`;
const EGP_API_KEY = "Liaqv30xLpFGOlJPW1N0hPKJkbO7vWUS";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// e-GP rate-limits the shared login aggressively (429 after a burst). To stay
// under the limit AND survive transient 429s, every e-GP request goes through
// egpFetch, which (1) serializes calls with a global minimum gap and (2) backs
// off and retries on 429 instead of dropping the request.
const REQUEST_DELAY_MS = 600;
const BACKOFF_MS = [3000, 8000, 15000]; // retry waits on a single 429
// If we get this many consecutive give-ups, e-GP is applying a sustained block
// (not a transient burst limit). Stop hammering for the rest of the run — keep
// the partial data we have and finish fast instead of timing out (and instead
// of digging the rate-limit penalty deeper on the shared login).
const CIRCUIT_THRESHOLD = 3;
let lastRequestAt = 0;
let gate: Promise<void> = Promise.resolve();
let consecutiveGiveUps = 0;
let circuitOpen = false;

// Reset per-run state (scrapeEgp calls this at the start of each run).
function resetEgpThrottle(): void {
  consecutiveGiveUps = 0;
  circuitOpen = false;
}

// Serialize through a promise chain so concurrent callers still respect the gap.
async function throttle(): Promise<void> {
  const mine = gate.then(async () => {
    const wait = REQUEST_DELAY_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });
  gate = mine.catch(() => {});
  return mine;
}

async function egpFetch(
  url: string,
  token: string,
  label = "request"
): Promise<Response | null> {
  if (circuitOpen) return null; // sustained block detected — skip remaining calls
  const init: RequestInit = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  for (let attempt = 0; ; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      console.error(`[Scraper] ${label} network error:`, err);
      return null;
    }
    if (res.status !== 429) {
      consecutiveGiveUps = 0;
      return res;
    }
    if (attempt >= BACKOFF_MS.length) {
      consecutiveGiveUps++;
      console.error(
        `[Scraper] ${label} still 429 after retries — giving up (${consecutiveGiveUps})`
      );
      if (consecutiveGiveUps >= CIRCUIT_THRESHOLD) {
        circuitOpen = true;
        console.error(
          "[Scraper] sustained 429 — opening circuit breaker, aborting remaining requests this run"
        );
      }
      return res;
    }
    console.warn(
      `[Scraper] 429 on ${label} — backoff ${BACKOFF_MS[attempt]}ms (retry ${attempt + 1})`
    );
    await sleep(BACKOFF_MS[attempt]);
  }
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

// Generate encrypted detail URL for a project
async function getDetailUrl(
  token: string,
  projectId: string
): Promise<string | undefined> {
  try {
    const res = await egpFetch(
      `${SEARCH_URL}/encryptApiKey?passKey=${EGP_API_KEY}&sDataValue=${projectId}`,
      token,
      "encryptApiKey"
    );
    if (!res || !res.ok) return undefined;
    const json = await res.json();
    if (json.data) {
      const encrypted = encodeURIComponent(json.data);
      return `${EGP_BASE}/egp-agpc01-web/announcement/procurement/${encrypted}`;
    }
  } catch {
    // Non-critical — fall back to no URL
  }
  return undefined;
}

// Fetch procurement detail for a project (for document queries)
async function getProcurementDetail(
  token: string,
  projectId: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await egpFetch(
      `${SEARCH_URL}/getProcurementDetail?projectId=${projectId}`,
      token,
      "getProcurementDetail"
    );
    if (!res || !res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

// Fetch TOR document list for a project
async function getTorDocuments(
  token: string,
  projectId: string,
  detail: Record<string, unknown>
): Promise<TenderDocument[]> {
  try {
    const params = new URLSearchParams({
      projectId,
      methodId: String(detail.methodId || ""),
      projectVersion: String(detail.projectVersion || ""),
      typeProject: String(detail.typeProject || ""),
      stepId: String(detail.stepId || ""),
      typeId: String(detail.typeId || ""),
    });

    const res = await egpFetch(
      `${SEARCH_URL}/getTorZipList?${params.toString()}`,
      token,
      "getTorZipList"
    );
    if (!res || !res.ok) return [];
    const json = await res.json();

    // getTorZipList returns the bidding-document zip bundle (buildName is a
    // ".zip" filename), so these are all the TOR/bidding document, dated by
    // webDate (used for version diffing on re-scrape). Download URL is not
    // exposed by this endpoint — users download from the e-GP detail page.
    return (json.data || []).map((doc: Record<string, unknown>) => ({
      name: String(doc.buildName || ""),
      date: doc.webDate ? String(doc.webDate) : null,
      category: "tor_bidding" as const,
    }));
  } catch {
    return [];
  }
}

// Fetch the procurement result (all bidders + winner) for a Type B project.
// resultFlag "P" = the winning bidder.
async function getProcureResult(
  token: string,
  projectId: string
): Promise<{ winner?: Bidder; bidders: Bidder[] } | null> {
  try {
    const res = await egpFetch(
      `${SEARCH_URL}/getProcureResult?projectId=${projectId}`,
      token,
      "getProcureResult"
    );
    if (!res || !res.ok) return null;
    const json = await res.json();
    const lists = json.data?.procureResultList || [];

    const bidders: Bidder[] = [];
    for (const lot of lists as Record<string, unknown>[]) {
      const rows = (lot.procureResultDataResponse || []) as Record<
        string,
        unknown
      >[];
      for (const r of rows) {
        bidders.push({
          name: String(r.receiveNameTh || "").trim(),
          tin: String(r.receiveTin || "").trim(),
          price:
            r.priceProposal != null ? String(r.priceProposal) : null,
          isWinner: r.resultFlag === "P" || r.priceAgree != null,
        });
      }
    }
    const winner = bidders.find((b) => b.isWinner);
    return { winner, bidders };
  } catch {
    return null;
  }
}

// Look up a company in e-GP's own merchant DB by 13-digit tax ID.
async function getMerchantData(
  token: string,
  tin: string
): Promise<WinnerCompanyData | null> {
  try {
    const res = await egpFetch(
      `${MERCHANT_URL}/getMerchantData?merchantTin=${tin}&merchantStatus=N1`,
      token,
      "getMerchantData"
    );
    if (!res || !res.ok) return null;
    const m = (await res.json()).data;
    if (!m || !m.merchantTin) return null;

    const clean = (s: unknown) => String(s ?? "").trim();
    const addressParts = [
      clean(m.merchantAddno) && `เลขที่ ${clean(m.merchantAddno)}`,
      clean(m.merchantMoono) && `หมู่ ${clean(m.merchantMoono)}`,
      clean(m.merchantSoi) && `ซอย${clean(m.merchantSoi)}`,
      clean(m.merchantThanon) && `ถนน${clean(m.merchantThanon)}`,
      clean(m.merchantSubdistrict),
      clean(m.merchantDistrict),
      clean(m.merchantProvince),
      clean(m.merchantPostcode),
    ].filter(Boolean);
    const address = addressParts.join(" ");

    return {
      name: clean(m.merchantNameTh),
      nameEn: clean(m.merchantNameEn) || undefined,
      taxId: clean(m.merchantTin),
      address: address || undefined,
      mapUrl: address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : undefined,
      phone:
        [clean(m.merchantPhone), clean(m.merchantMobile)]
          .filter(Boolean)
          .join(" / ") || undefined,
      website:
        clean(m.merchantWebsite) && clean(m.merchantWebsite) !== "-"
          ? clean(m.merchantWebsite)
          : undefined,
      businessType: clean(m.merchantTitleName) || undefined,
      blacklistStatus: clean(m.blacklistStatus) || undefined,
    };
  } catch {
    return null;
  }
}

// Search tenders by keyword using the announcement API
async function searchTenders(
  token: string,
  keyword: string
): Promise<RawTender[]> {
  try {
    // methodId=16 filters to e-bidding server-side, so the pages are dense
    // with the announcements both flows care about. Page through a few pages.
    const MAX_PAGES = 3;
    const items: Record<string, unknown>[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        budgetYear: getCurrentBudgetYear(),
        keywordSearch: keyword,
        methodId: "16",
        announcementTodayFlag: "false",
        page: String(page),
      });

      const res = await egpFetch(
        `${SEARCH_URL}?${params.toString()}`,
        token,
        `search "${keyword}" p${page}`
      );

      if (!res || !res.ok) {
        console.error(
          `[Scraper] Search failed for "${keyword}":`,
          res?.status ?? "no response"
        );
        break;
      }

      const json = await res.json();
      if (json.validateCfTurnTile === false) {
        console.error(`[Scraper] Cloudflare blocked for "${keyword}"`);
        break;
      }

      const pageItems = (json.data?.data || []) as Record<string, unknown>[];
      items.push(...pageItems);
      if (pageItems.length === 0) break;
    }

    const tenders: RawTender[] = [];

    for (const item of items as Record<string, unknown>[]) {
      const projectId = String(item.projectId || "");
      if (!projectId) continue;

      // Both flows require e-bidding (ประกวดราคาอิเล็กทรอนิกส์).
      if (String(item.methodId || "") !== "16") continue;

      // Lane comes from the announcement stage, not the keyword. Skip stages
      // we don't track (contract management, cancelled, etc.).
      const lane = deriveLane(String(item.flowName || ""));
      if (!lane) continue;

      // Only now (for relevant tenders) fetch detail/documents.
      // (egpFetch throttles every request globally.)
      const detailUrl = await getDetailUrl(token, projectId);
      const detail = await getProcurementDetail(token, projectId);
      const documents = detail
        ? await getTorDocuments(token, projectId, detail)
        : [];

      // priceAgree is the agreed/winning price (Type B); deliverDay is the
      // delivery window — both structured, no PDF parsing needed.
      const priceAgree = detail?.priceAgree;
      const deliverDay = detail?.deliverDay;

      // Type B: pull the winner + bidders, then the winner's company record.
      let winnerName: string | undefined;
      let winnerTin: string | undefined;
      let bidders: Bidder[] | undefined;
      let company: WinnerCompanyData | undefined;
      if (lane === "type_b") {
        const result = await getProcureResult(token, projectId);
        if (result) {
          bidders = result.bidders;
          winnerName = result.winner?.name;
          winnerTin = result.winner?.tin;
          if (winnerTin) {
            const merchant = await getMerchantData(token, winnerTin);
            await sleep(REQUEST_DELAY_MS); // DBD is a separate host
            const dbd = await getDbdInfo(winnerTin);
            const name = merchant?.name || winnerName;
            if (name) {
              company = {
                name,
                nameEn: merchant?.nameEn,
                taxId: merchant?.taxId || winnerTin,
                address: merchant?.address,
                mapUrl: merchant?.mapUrl,
                phone: merchant?.phone,
                website: merchant?.website,
                businessType: merchant?.businessType,
                blacklistStatus: merchant?.blacklistStatus,
                dbdStatus: dbd.status,
                businessObjective: dbd.businessObjective,
                registeredCapital: dbd.registeredCapital,
                registerDate: dbd.registerDate,
                dbdUrl: dbd.dbdUrl,
              };
            }
          }
        }
      }

      tenders.push({
        egpId: projectId,
        projectName: String(item.projectName || ""),
        agency: String(item.deptSubName || item.announceSubDesc || ""),
        province: item.rdbProvinceMoiName
          ? String(item.rdbProvinceMoiName)
          : undefined,
        budget: item.projectMoney ? String(item.projectMoney) : undefined,
        priceReference: item.priceBuild
          ? String(item.priceBuild)
          : undefined,
        egpStatus: item.flowName ? String(item.flowName) : undefined,
        procurementMethod: item.methodId
          ? mapMethodId(String(item.methodId))
          : undefined,
        announceDate: item.announceDate
          ? String(item.announceDate)
          : undefined,
        detailUrl,
        documents: documents.length > 0 ? documents : undefined,
        lane,
        deliverDay: typeof deliverDay === "number" ? deliverDay : undefined,
        winnerPrice:
          lane === "type_b" && priceAgree != null
            ? String(priceAgree)
            : undefined,
        winnerName,
        winnerTin,
        bidders,
        company,
        rawData: item as Record<string, unknown>,
      });
    }

    return tenders;
  } catch (err) {
    console.error(`[Scraper] Search error for "${keyword}":`, err);
    return [];
  }
}

// Main scrape function — logs in once, searches all keywords
export async function scrapeEgp(
  enabledKeywords: { keyword: string; type: string }[]
): Promise<ScrapeResult[]> {
  resetEgpThrottle();
  const token = await getAccessToken();

  if (!token) {
    return enabledKeywords.map((kw) => ({
      tenders: [],
      keyword: kw.keyword,
      error: "Login failed — check EGP_USERNAME and EGP_PASSWORD",
    }));
  }

  const results: ScrapeResult[] = [];

  // egpFetch throttles + retries (429 backoff) across every request globally,
  // so keywords can run back-to-back without manual inter-keyword delays.
  for (const kw of enabledKeywords) {
    const tenders = await searchTenders(token, kw.keyword);
    results.push({ tenders, keyword: kw.keyword });
  }

  return results;
}
