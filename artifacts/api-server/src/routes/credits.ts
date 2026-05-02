import { Router } from "express";
import { db, userCreditsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { InitUserBody } from "@workspace/api-zod";

const router = Router();

const TRIAL_CREDITS = 3;

// GET /api/credits/:userId
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const [row] = await db
      .select()
      .from(userCreditsTable)
      .where(eq(userCreditsTable.userId, userId))
      .limit(1);

    if (!row) {
      return res.status(404).json({ error: "User not found. Call /credits/init first." });
    }

    return res.json({ userId: row.userId, credits: row.credits, email: row.email ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get user credits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/credits/init — idempotent, returns existing or creates with 3 trial credits
router.post("/init", async (req, res) => {
  const bodyResult = InitUserBody.safeParse(req.body);
  if (!bodyResult.success) return res.status(400).json({ error: "userId required" });

  const { userId } = bodyResult.data;

  try {
    const [existing] = await db
      .select()
      .from(userCreditsTable)
      .where(eq(userCreditsTable.userId, userId))
      .limit(1);

    if (existing) {
      return res.json({ userId: existing.userId, credits: existing.credits, email: existing.email ?? null });
    }

    const [created] = await db
      .insert(userCreditsTable)
      .values({ userId, credits: TRIAL_CREDITS })
      .returning();

    req.log.info({ userId }, "New user initialized with trial credits");
    return res.json({ userId: created.userId, credits: created.credits, email: created.email ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to init user credits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
