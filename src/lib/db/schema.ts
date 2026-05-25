import {
  pgTable,
  text,
  timestamp,
  varchar,
  numeric,
  integer,
  boolean,
  serial,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

// ── Auth tables (next-auth + passkey) ──────────────────────────

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => ({
    compositePK: primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  })
);

// ── App tables ─────────────────────────────────────────────────

export const tenders = pgTable("tenders", {
  id: serial("id").primaryKey(),
  egpId: varchar("egp_id", { length: 100 }).notNull().unique(),
  projectName: text("project_name").notNull(),
  agency: text("agency"),
  subAgency: text("sub_agency"),
  province: varchar("province", { length: 100 }),
  budget: numeric("budget", { precision: 18, scale: 2 }),
  priceReference: numeric("price_reference", { precision: 18, scale: 2 }),
  procurementMethod: varchar("procurement_method", { length: 100 }),
  tenderType: varchar("tender_type", { length: 20 })
    .notNull()
    .default("type_a"),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  egpStatus: varchar("egp_status", { length: 100 }),
  aiSummary: text("ai_summary"),
  aiClassificationReason: text("ai_classification_reason"),
  scopeOfWork: text("scope_of_work"),
  requiredDocuments: jsonb("required_documents"),
  competitors: jsonb("competitors"),
  matchedKeyword: varchar("matched_keyword", { length: 100 }),

  // Type A — structured summary of the 8 key review points
  // { qualifications, medianPrice, medianPriceSource, deliveryTime,
  //   penalty, detailedSpecs, specLockNote, contactChannel }
  keyPoints: jsonb("key_points"),

  // Type B — winning bid summary (winner company is in winner_companies)
  winnerName: text("winner_name"),
  winnerTin: varchar("winner_tin", { length: 20 }),
  winnerPrice: numeric("winner_price", { precision: 18, scale: 2 }),
  // All bidders + proposed prices from getProcureResult (สรุปการเสนอราคา)
  bidders: jsonb("bidders"),

  // Timeline checkpoints
  announceDate: timestamp("announce_date"),
  documentStartDate: timestamp("document_start_date"),
  documentEndDate: timestamp("document_end_date"),
  siteVisitDate: timestamp("site_visit_date"),
  submissionDate: timestamp("submission_date"),
  openingDate: timestamp("opening_date"),
  resultDate: timestamp("result_date"),
  contractDate: timestamp("contract_date"),

  // Set when a re-scrape detects a changed/new related document.
  documentsUpdatedAt: timestamp("documents_updated_at"),

  // Source data
  detailUrl: text("detail_url"),
  rawData: jsonb("raw_data"),

  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  time: varchar("time", { length: 5 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  keyword: varchar("keyword", { length: 200 }).notNull(),
  type: varchar("type", { length: 20 }).notNull().default("type_a"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const settingsChangelog = pgTable("settings_changelog", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  userName: text("user_name"),
  action: varchar("action", { length: 50 }).notNull(), // add, remove, update, toggle
  category: varchar("category", { length: 50 }).notNull(), // schedule, keyword, line, passkey, admin
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scrapeLog = pgTable("scrape_log", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  tendersFound: integer("tenders_found").default(0),
  tendersNew: integer("tenders_new").default(0),
  errorMessage: text("error_message"),
});

// Documents downloaded from a tender's "เอกสาร/ประกาศที่เกี่ยวข้อง" section.
// Versioned: when a doc's webDate changes, the old row is marked supersededAt
// and a new row inserted, so we can diff versions.
export const tenderDocuments = pgTable("tender_documents", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  // price_median | tor_bidding | invitation | bid_summary | winner | other
  category: varchar("category", { length: 20 }).notNull().default("other"),
  name: text("name").notNull(),
  webDate: timestamp("web_date"),
  url: text("url"),
  fetchedAt: timestamp("fetched_at"),
  supersededAt: timestamp("superseded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Type B — winning company researched after a winner announcement.
export const winnerCompanies = pgTable("winner_companies", {
  id: serial("id").primaryKey(),
  tenderId: integer("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  taxId: varchar("tax_id", { length: 20 }),
  address: text("address"),
  mapUrl: text("map_url"),
  phone: varchar("phone", { length: 100 }),
  website: text("website"),
  socialMedia: jsonb("social_media"),
  businessType: text("business_type"),
  blacklistStatus: varchar("blacklist_status", { length: 50 }),
  directors: jsonb("directors"),
  // From DBD OpenAPI
  dbdStatus: varchar("dbd_status", { length: 100 }),
  businessObjective: text("business_objective"),
  registeredCapital: varchar("registered_capital", { length: 50 }),
  registerDate: varchar("register_date", { length: 8 }),
  dbdUrl: text("dbd_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
