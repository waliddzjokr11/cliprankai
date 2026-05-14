import { Router } from "express";
import { db } from "@workspace/db";
import { randomUUID } from "crypto";
import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

const router = Router();

const contactMessagesTable = pgTable("contact_messages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// POST /api/contact
router.post("/", async (req, res) => {
  const { name, email, message } = req.body as { name?: string; email?: string; message?: string };
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "name, email, and message are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: "Message too long (max 5000 characters)" });
  }

  try {
    await db.insert(contactMessagesTable).values({
      id: randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
    });
    req.log.info({ email }, "Contact message received");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save contact message");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
