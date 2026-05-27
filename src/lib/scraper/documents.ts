// Document persistence + version diffing.
//
// e-GP re-publishes a related document under a new filename (buildName encodes
// the publish date), so a "changed" document shows up as a new (category, name)
// pair. We key on category|name: anything in the fresh scrape that we haven't
// stored is a NEW version — we mark the prior current docs of that category as
// superseded and insert the new ones, keeping full history for comparison.

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tenderDocuments } from "@/lib/db/schema";
import { safeDate, type TenderDocument } from "@/lib/scraper/egp";

type Db = ReturnType<typeof getDb>;

const docKey = (category: string, name: string) => `${category}|${name}`;

// Insert documents for a brand-new tender (no prior versions to diff).
export async function insertTenderDocuments(
  db: Db,
  tenderId: number,
  docs: TenderDocument[]
): Promise<void> {
  if (docs.length === 0) return;
  await db.insert(tenderDocuments).values(
    docs.map((doc) => ({
      tenderId,
      category: doc.category,
      name: doc.name,
      webDate: safeDate(doc.date),
      url: doc.url ?? null,
      fetchedAt: new Date(),
    }))
  );
}

// Diff a fresh scrape's documents against what we've stored for an existing
// tender. Supersedes stale versions, inserts new ones, and reports whether
// anything changed (so the caller can flag/notify).
export async function reconcileTenderDocuments(
  db: Db,
  tenderId: number,
  incoming: TenderDocument[]
): Promise<{ changed: boolean; added: TenderDocument[] }> {
  if (incoming.length === 0) return { changed: false, added: [] };

  const stored = await db
    .select()
    .from(tenderDocuments)
    .where(
      and(
        eq(tenderDocuments.tenderId, tenderId),
        isNull(tenderDocuments.supersededAt)
      )
    );

  // No baseline yet (e.g. tenders first stored before doc-versioning existed):
  // backfill the current docs silently — there's no prior version to diff
  // against, so this is NOT a "change" and must not trigger an update alert.
  if (stored.length === 0) {
    await insertTenderDocuments(db, tenderId, incoming);
    return { changed: false, added: [] };
  }

  const storedKeys = new Set(stored.map((d) => docKey(d.category, d.name)));
  const added = incoming.filter(
    (d) => !storedKeys.has(docKey(d.category, d.name))
  );
  if (added.length === 0) return { changed: false, added: [] };

  const now = new Date();

  // Supersede the current docs of each category that has a new version.
  const changedCategories = new Set(added.map((d) => d.category));
  for (const category of changedCategories) {
    await db
      .update(tenderDocuments)
      .set({ supersededAt: now })
      .where(
        and(
          eq(tenderDocuments.tenderId, tenderId),
          eq(tenderDocuments.category, category),
          isNull(tenderDocuments.supersededAt)
        )
      );
  }

  await db.insert(tenderDocuments).values(
    added.map((doc) => ({
      tenderId,
      category: doc.category,
      name: doc.name,
      webDate: safeDate(doc.date),
      url: doc.url ?? null,
      fetchedAt: now,
    }))
  );

  return { changed: true, added };
}
