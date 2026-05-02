import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userCreditsTable = pgTable("user_credits", {
  userId: text("user_id").primaryKey(),
  email: text("email"),
  credits: integer("credits").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserCreditsSchema = createInsertSchema(userCreditsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUserCredits = z.infer<typeof insertUserCreditsSchema>;
export type UserCredits = typeof userCreditsTable.$inferSelect;
