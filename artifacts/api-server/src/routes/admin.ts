import { Router } from "express";
import { db, userCreditsTable, analysesTable } from "@workspace/db";
import { eq, desc, sql, count, avg } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";

const router = Router();

const ADMIN_USER_ID = process.env.CLERK_ADMIN_USER_ID;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

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
  const email = (req.query.email as string) || (req.body?.email as string);
  const isAdmin = userId === ADMIN_USER_ID || (ADMIN_EMAIL && email === ADMIN_EMAIL);
  if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
  next();
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

// GET /api/admin/stats?userId=...
router.get("/stats", adminOnly, async (req, res) => {
  try {
    const [analysisStats] = await db.select({
      total: count(analysesTable.id),
      avgScore: avg(analysesTable.overallScore),
      premiumUnlocks: sql<number>`SUM(CASE WHEN ${analysesTable.isPremiumUnlocked} THEN 1 ELSE 0 END)`,
    }).from(analysesTable);

    const [userStats] = await db.select({
      total: count(userCreditsTable.userId),
      totalCredits: sql<number>`SUM(${userCreditsTable.credits})`,
    }).from(userCreditsTable);

    const [pendingCount] = await db.select({
      cnt: count(accessRequestsTable.id),
    }).from(accessRequestsTable).where(eq(accessRequestsTable.status, "pending"));

    const [unreadCount] = await db.select({
      cnt: count(contactMessagesTable.id),
    }).from(contactMessagesTable).where(eq(contactMessagesTable.read, false));

    const recentAnalyses = await db.select({
      id: analysesTable.id,
      filename: analysesTable.filename,
      overallScore: analysesTable.overallScore,
      userId: analysesTable.userId,
      niche: analysesTable.niche,
      isPremiumUnlocked: analysesTable.isPremiumUnlocked,
      createdAt: analysesTable.createdAt,
    }).from(analysesTable).orderBy(desc(analysesTable.createdAt)).limit(10);

    res.json({
      totalAnalyses: Number(analysisStats?.total ?? 0),
      avgScore: Number(analysisStats?.avgScore ?? 0),
      premiumUnlocks: Number(analysisStats?.premiumUnlocks ?? 0),
      totalUsers: Number(userStats?.total ?? 0),
      totalCreditsInSystem: Number(userStats?.totalCredits ?? 0),
      pendingRequests: Number(pendingCount?.cnt ?? 0),
      unreadMessages: Number(unreadCount?.cnt ?? 0),
      recentAnalyses: recentAnalyses.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to approve request");
    return res.status(500).json({ error: "Internal server error" });
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
    return res.json({ success: true, userId: targetUserId, credits });
  } catch (err) {
    req.log.error({ err }, "Failed to update credits");
    return res.status(500).json({ error: "Internal server error" });
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
