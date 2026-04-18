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
} from "drizzle-orm/pg-core";

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

  // Timeline checkpoints
  announceDate: timestamp("announce_date"),
  documentStartDate: timestamp("document_start_date"),
  documentEndDate: timestamp("document_end_date"),
  siteVisitDate: timestamp("site_visit_date"),
  submissionDate: timestamp("submission_date"),
  openingDate: timestamp("opening_date"),
  resultDate: timestamp("result_date"),
  contractDate: timestamp("contract_date"),

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

export const scrapeLog = pgTable("scrape_log", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: varchar("status", { length: 20 }).notNull().default("running"),
  tendersFound: integer("tenders_found").default(0),
  tendersNew: integer("tenders_new").default(0),
  errorMessage: text("error_message"),
});
