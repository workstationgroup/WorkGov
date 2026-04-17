import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schedules, keywords } from "../src/lib/db/schema";

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log("Seeding schedules...");
  await db.insert(schedules).values([
    { time: "07:00", enabled: true },
    { time: "13:00", enabled: true },
  ]);

  console.log("Seeding keywords...");
  await db.insert(keywords).values([
    { keyword: "ครุภัณฑ์", type: "type_a", enabled: true },
    { keyword: "ครุภัณฑ์สำนักงาน", type: "type_a", enabled: true },
    { keyword: "เฟอร์นิเจอร์", type: "type_a", enabled: true },
    { keyword: "โต๊ะ", type: "type_a", enabled: true },
    { keyword: "เก้าอี้", type: "type_a", enabled: true },
    { keyword: "ตู้", type: "type_a", enabled: true },
    { keyword: "พาร์ทิชั่น", type: "type_a", enabled: true },
    { keyword: "ปรับปรุงสำนักงาน", type: "type_a", enabled: true },
    { keyword: "ก่อสร้างอาคาร", type: "type_b", enabled: true },
    { keyword: "ปรับปรุงอาคาร", type: "type_b", enabled: true },
  ]);

  console.log("Seed complete!");
}

seed().catch(console.error);
