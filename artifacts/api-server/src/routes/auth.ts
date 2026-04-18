import { Router, type IRouter } from "express";
import { nanoid } from "nanoid";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/v1/keys/generate", async (req, res): Promise<void> => {
  const { name, scope } = req.body as { name: string; scope: "read" | "write" | "admin" };
  if (!name || !scope) {
    res.status(400).json({ error: "name and scope are required" });
    return;
  }

  const key = `sk_live_${nanoid(32)}`;
  const id = nanoid();

  const [apiKey] = await db.insert(apiKeysTable).values({
    id,
    key,
    name,
    scope,
  }).returning();

  res.json({
    key: apiKey.key,
    name: apiKey.name,
    scope: apiKey.scope,
    createdAt: apiKey.createdAt.toISOString(),
  });
});

export async function validateApiKey(key: string): Promise<boolean> {
  if (!key) return false;
  const [found] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, key));
  return !!found;
}

export default router;
