// DBD (Department of Business Development) enrichment.
//
// The official OpenAPI `juristic_person` endpoint is open (no key) and returns
// registration status, business objective, and capital. Directors/committee
// are NOT exposed by any clean API (DBD DataWarehouse has them but sits behind
// an Imperva WAF), so we deep-link to the DataWarehouse profile for a human to
// view directors in their browser.

const DBD_API = "https://openapi.dbd.go.th/api/v1/juristic_person";

export interface DbdInfo {
  status?: string; // ยังดำเนินกิจการอยู่ / เลิกกิจการ ...
  businessObjective?: string; // ประเภทกิจการ (sector)
  registeredCapital?: string; // e.g. "1000000.0"
  registerDate?: string; // YYYYMMDD
  dbdUrl: string; // human deep-link (directors, financials, etc.)
}

// Public DataWarehouse company profile — opens fine in a normal browser.
export function dbdProfileUrl(tin: string): string {
  return `https://datawarehouse.dbd.go.th/company/profile/0/${tin}`;
}

export async function getDbdInfo(tin: string): Promise<DbdInfo> {
  const dbdUrl = dbdProfileUrl(tin);
  try {
    const res = await fetch(`${DBD_API}/${tin}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) return { dbdUrl };
    const json = await res.json();
    const p = json?.data?.[0]?.["cd:OrganizationJuristicPerson"];
    if (!p) return { dbdUrl };

    let obj = p["cd:OrganizationJuristicObjective"]?.["td:JuristicObjective"];
    if (Array.isArray(obj)) obj = obj[0];
    const capital = p["cd:OrganizationJuristicRegisterCapital"];

    return {
      status: p["cd:OrganizationJuristicStatus"] || undefined,
      businessObjective: obj?.["td:JuristicObjectiveTextTH"] || undefined,
      registeredCapital: capital != null ? String(capital) : undefined,
      registerDate: p["cd:OrganizationJuristicRegisterDate"] || undefined,
      dbdUrl,
    };
  } catch {
    return { dbdUrl };
  }
}
