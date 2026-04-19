import { getDb } from "@/lib/db";
import { settingsChangelog } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

export async function logChange(
  category: string,
  action: string,
  detail: string
) {
  const session = await auth();
  const db = getDb();
  await db.insert(settingsChangelog).values({
    userId: session?.user?.id ?? null,
    userName: session?.user?.name ?? null,
    action,
    category,
    detail,
  });
}
