import { Router } from "express";
import { db } from "@workspace/db";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

const router = Router();

const siteConfigTable = pgTable("site_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const DEFAULTS: Record<string, string> = {
  hero_title: "Rank your video before you post",
  hero_subtitle: "AI-powered virality scores for TikTok, Reels & Shorts — based on real algorithm signals",
  hero_cta: "Start analyzing free",
  hero_badge: "Request free access",
  features_title: "Built on real algorithm research",
};

// GET /api/config
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(siteConfigTable);
    const config = { ...DEFAULTS };
    for (const row of rows) config[row.key] = row.value;
    res.set("Cache-Control", "s-maxage=60, stale-while-revalidate");
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to get config");
    res.json(DEFAULTS);
  }
});

export default router;
