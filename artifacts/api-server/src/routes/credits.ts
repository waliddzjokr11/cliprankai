import { Router } from "express";
import { db, userCreditsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { InitUserBody } from "@workspace/api-zod";

const router = Router();

const TRIAL_CREDITS = 0;

// ─── TESTING FLAG ────────────────────────────────────────────────────────────
// When TESTING_UNLIMITED_CREDITS=true, all users appear to have 9999 credits
// and new accounts are initialized with 9999. Delete the env var to revert.
const TESTING_UNLIMITED_CREDITS = process.env.TESTING_UNLIMITED_CREDITS === "true";
const TESTING_CREDIT_AMOUNT = 9999;
// ─────────────────────────────────────────────────────────────────────────────

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

    const credits = TESTING_UNLIMITED_CREDITS ? TESTING_CREDIT_AMOUNT : row.credits;
    return res.json({ userId: row.userId, credits, email: row.email ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get user credits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/credits/init — idempotent, returns existing or creates with trial credits
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
      const credits = TESTING_UNLIMITED_CREDITS ? TESTING_CREDIT_AMOUNT : existing.credits;
      return res.json({ userId: existing.userId, credits, email: existing.email ?? null });
    }

    const startingCredits = TESTING_UNLIMITED_CREDITS ? TESTING_CREDIT_AMOUNT : TRIAL_CREDITS;
    const [created] = await db
      .insert(userCreditsTable)
      .values({ userId, credits: startingCredits })
      .returning();

    req.log.info({ userId, credits: startingCredits }, "New user initialized with credits");
    return res.json({ userId: created.userId, credits: created.credits, email: created.email ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to init user credits");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
