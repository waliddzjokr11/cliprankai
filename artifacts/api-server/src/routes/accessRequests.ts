import { Router } from "express";
import { db } from "@workspace/db";
import { randomUUID } from "crypto";
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

const router = Router();

const accessRequestsTable = pgTable("access_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  grantedCredits: integer("granted_credits"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// POST /api/access-requests
router.post("/", async (req, res) => {
  const { userId, email, reason } = req.body as { userId?: string; email?: string; reason?: string };
  if (!userId || !email || !reason?.trim()) {
    return res.status(400).json({ error: "userId, email, and reason are required" });
  }

  try {
    // Check for existing pending request from same user
    const [existing] = await db.select()
      .from(accessRequestsTable)
      .where(eq(accessRequestsTable.userId, userId))
      .limit(1);

    if (existing && existing.status === "pending") {
      return res.status(409).json({ error: "You already have a pending request" });
    }

    await db.insert(accessRequestsTable).values({
      id: randomUUID(),
      userId,
      email,
      reason: reason.trim(),
    });

    req.log.info({ userId, email }, "Access request submitted");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save access request");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
