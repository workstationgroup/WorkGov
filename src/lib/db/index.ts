import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  // The NextAuth Drizzle adapter builds the db at module load (auth.ts), which
  // runs during `next build` page-data collection where DATABASE_URL is unset.
  // neon() throws "No database connection string was provided" on an empty
  // value, so fall back to a dummy URL at build time. neon() is lazy — it only
  // connects when a query actually runs — so this placeholder is never used:
  // at runtime on Vercel the real DATABASE_URL is present.
  const url =
    process.env.DATABASE_URL ||
    "postgres://build:build@localhost:5432/build";
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
