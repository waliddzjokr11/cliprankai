import { Router } from "express";
import { db, userCreditsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";

const router = Router();

const ADMIN_USER_ID = "user_3DAainmIJ1RHEdNGbA8rXsNn8Nk";

// Inline table defs for tables not yet in shared lib schema
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

const contactMessagesTable = pgTable("contact_messages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const siteConfigTable = pgTable("site_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Middleware: only admin — reads userId from query (GET) or body (POST/PUT)
function adminOnly(req: any, res: any, next: any) {
  const userId = (req.query.userId as string) || (req.body?.userId as string);
  if (userId !== ADMIN_USER_ID) return res.status(403).json({ error: "Forbidden" });
  next();
}

// ─── Access Requests ───────────────────────────────────────────────────────────

// GET /api/admin/requests?userId=...
router.get("/requests", adminOnly, async (req, res) => {
  try {
    const rows = await db.select().from(accessRequestsTable).orderBy(desc(accessRequestsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list access requests");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/requests/:id/approve
router.post("/requests/:id/approve", adminOnly, async (req, res) => {
  const { id } = req.params;
  const { credits } = req.body as { credits: number; userId: string };
  if (!credits || credits < 1) return res.status(400).json({ error: "credits must be >= 1" });

  try {
    const [request] = await db.select().from(accessRequestsTable).where(eq(accessRequestsTable.id, id)).limit(1);
    if (!request) return res.status(404).json({ error: "Request not found" });

    await db.update(accessRequestsTable)
      .set({ status: "approved", grantedCredits: credits, updatedAt: new Date() })
      .where(eq(accessRequestsTable.id, id));

    // Upsert user credits
    const [existing] = await db.select().from(userCreditsTable).where(eq(userCreditsTable.userId, request.userId)).limit(1);
    if (existing) {
      await db.update(userCreditsTable)
        .set({ credits: sql`${userCreditsTable.credits} + ${credits}`, updatedAt: new Date() })
        .where(eq(userCreditsTable.userId, request.userId));
    } else {
      await db.insert(userCreditsTable).values({ userId: request.userId, email: request.email, credits });
    }

    req.log.info({ requestId: id, userId: request.userId, credits }, "Access request approved");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to approve request");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/requests/:id/reject
router.post("/requests/:id/reject", adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await db.update(accessRequestsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(accessRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reject request");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Users & Credits ──────────────────────────────────────────────────────────

// GET /api/admin/users?userId=...
router.get("/users", adminOnly, async (req, res) => {
  try {
    const rows = await db.select().from(userCreditsTable).orderBy(desc(userCreditsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/users/:userId/credits
router.put("/users/:targetUserId/credits", adminOnly, async (req, res) => {
  const { targetUserId } = req.params;
  const { credits } = req.body as { credits: number; userId: string };
  if (credits === undefined || credits < 0) return res.status(400).json({ error: "Invalid credits value" });

  try {
    await db.update(userCreditsTable)
      .set({ credits, updatedAt: new Date() })
      .where(eq(userCreditsTable.userId, targetUserId));
    res.json({ success: true, userId: targetUserId, credits });
  } catch (err) {
    req.log.error({ err }, "Failed to update credits");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Contact Messages ─────────────────────────────────────────────────────────

// GET /api/admin/messages?userId=...
router.get("/messages", adminOnly, async (req, res) => {
  try {
    const rows = await db.select().from(contactMessagesTable).orderBy(desc(contactMessagesTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/messages/:id/read
router.post("/messages/:id/read", adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await db.update(contactMessagesTable).set({ read: true }).where(eq(contactMessagesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark message read");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── CMS Config ───────────────────────────────────────────────────────────────

// PUT /api/admin/config
router.put("/config", adminOnly, async (req, res) => {
  const { userId: _uid, ...updates } = req.body as Record<string, string>;
  try {
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== "string") continue;
      await db.insert(siteConfigTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteConfigTable.key, set: { value, updatedAt: new Date() } });
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
