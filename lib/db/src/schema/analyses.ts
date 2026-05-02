import { pgTable, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  filename: text("filename").notNull(),
  fingerprint: text("fingerprint").notNull(),
  overallScore: real("overall_score").notNull(),
  pacingScore: real("pacing_score").notNull(),
  visualHookScore: real("visual_hook_score").notNull(),
  captionReadabilityScore: real("caption_readability_score").notNull(),
  transcript: text("transcript").notNull().default(""),
  summary: text("summary").notNull().default(""),
  pacingFeedback: text("pacing_feedback").notNull().default(""),
  visualHookFeedback: text("visual_hook_feedback").notNull().default(""),
  captionFeedback: text("caption_feedback").notNull().default(""),
  professionalAdvice: text("professional_advice"),
  visualHeatmap: text("visual_heatmap"),
  isPremiumUnlocked: boolean("is_premium_unlocked").notNull().default(false),
  durationSeconds: real("duration_seconds").notNull().default(0),
  frameCount: integer("frame_count").notNull().default(0),
  paypalOrderId: text("paypal_order_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Virality & niche analysis (v2)
  niche: text("niche"),
  nichePlatform: text("niche_platform"),
  viralityScore: real("virality_score"),
  competitorInsights: text("competitor_insights"),
  retentionRisk: text("retention_risk"),
  // Trend analysis (v3)
  trendScore: real("trend_score"),
  trendInsights: text("trend_insights"),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
