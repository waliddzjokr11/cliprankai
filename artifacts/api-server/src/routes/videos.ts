import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, desc, avg, count, sum, sql } from "drizzle-orm";
import { db, analysesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  AnalyzeVideoBody,
  GetAnalysisParams,
  UnlockPremiumParams,
  UnlockPremiumBody,
} from "@workspace/api-zod";

const router = Router();

function serializeAnalysis(a: typeof analysesTable.$inferSelect) {
  return {
    id: a.id,
    filename: a.filename,
    fingerprint: a.fingerprint,
    overallScore: a.overallScore,
    pacingScore: a.pacingScore,
    visualHookScore: a.visualHookScore,
    captionReadabilityScore: a.captionReadabilityScore,
    transcript: a.transcript,
    summary: a.summary,
    pacingFeedback: a.pacingFeedback,
    visualHookFeedback: a.visualHookFeedback,
    captionFeedback: a.captionFeedback,
    professionalAdvice: a.professionalAdvice ?? null,
    visualHeatmap: a.visualHeatmap ?? null,
    isPremiumUnlocked: a.isPremiumUnlocked,
    durationSeconds: a.durationSeconds,
    frameCount: a.frameCount,
    createdAt: a.createdAt.toISOString(),
  };
}

// GET /api/videos/stats — MUST be before /:id
router.get("/stats", async (req, res) => {
  try {
    const result = await db
      .select({
        totalAnalyses: count(analysesTable.id),
        avgOverallScore: avg(analysesTable.overallScore),
        avgPacingScore: avg(analysesTable.pacingScore),
        avgVisualHookScore: avg(analysesTable.visualHookScore),
        avgCaptionScore: avg(analysesTable.captionReadabilityScore),
        premiumUnlocks: sum(
          sql<number>`CASE WHEN ${analysesTable.isPremiumUnlocked} THEN 1 ELSE 0 END`
        ),
      })
      .from(analysesTable);

    const row = result[0];
    res.json({
      totalAnalyses: Number(row?.totalAnalyses ?? 0),
      avgOverallScore: Number(row?.avgOverallScore ?? 0),
      avgPacingScore: Number(row?.avgPacingScore ?? 0),
      avgVisualHookScore: Number(row?.avgVisualHookScore ?? 0),
      avgCaptionScore: Number(row?.avgCaptionScore ?? 0),
      premiumUnlocks: Number(row?.premiumUnlocks ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/videos — list recent analyses
router.get("/", async (req, res) => {
  try {
    const analyses = await db
      .select()
      .from(analysesTable)
      .orderBy(desc(analysesTable.createdAt))
      .limit(20);
    res.json(analyses.map(serializeAnalysis));
  } catch (err) {
    req.log.error({ err }, "Failed to list analyses");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/videos/analyze
router.post("/analyze", async (req, res) => {
  const bodyResult = AnalyzeVideoBody.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: "Invalid request body", issues: bodyResult.error.issues });
  }

  const { frames, audioBase64, filename, durationSeconds, fingerprint } = bodyResult.data;

  // Cache check — instant return if this video was analyzed before
  try {
    const cached = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.fingerprint, fingerprint))
      .limit(1);

    if (cached.length > 0) {
      req.log.info({ fingerprint }, "Cache hit — returning cached analysis");
      return res.json(serializeAnalysis(cached[0]));
    }
  } catch (err) {
    req.log.error({ err }, "Cache lookup failed");
  }

  // Transcribe audio if provided
  let transcript = "";
  if (audioBase64) {
    try {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
      const file = new File([audioBlob], "audio.wav", { type: "audio/wav" });
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "gpt-4o-mini-transcribe",
        response_format: "json",
      });
      transcript = transcription.text ?? "";
    } catch (err) {
      req.log.warn({ err }, "Audio transcription failed, continuing without transcript");
    }
  }

  // Prepare frames for GPT-4 vision — limit to 20 frames
  const selectedFrames = frames.slice(0, 20);
  const imageContent = selectedFrames.map((frame) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:image/jpeg;base64,${frame}`,
      detail: "low" as const,
    },
  }));

  const systemPrompt = `You are ClipRank, a multimodal video analysis expert. Analyze the provided video frames and transcript to score the video on three dimensions. Return ONLY valid JSON.

Score each metric from 0-100 where:
- 0-39: Poor
- 40-69: Average
- 70-100: Good

Return this exact JSON structure:
{
  "pacingScore": <number>,
  "visualHookScore": <number>,
  "captionReadabilityScore": <number>,
  "overallScore": <number>,
  "summary": "<1-2 sentence overall summary of the video>",
  "pacingFeedback": "<specific, actionable 1-2 sentence feedback on pacing>",
  "visualHookFeedback": "<specific, actionable 1-2 sentence feedback on visual hooks — what captures attention and what loses it>",
  "captionFeedback": "<specific, actionable 1-2 sentence feedback on caption readability — text size, contrast, timing, placement>",
  "professionalAdvice": "<detailed 3-4 paragraph professional editing advice including specific timestamps, B-roll suggestions, music recommendations, and platform-specific optimizations>",
  "visualHeatmap": "<JSON string describing attention zones: which frames are high-attention (strong visual hooks), medium-attention, or low-attention with specific reasoning per frame range>"
}

Scoring criteria:
- Pacing: Are cuts appropriately timed? Is there good rhythm and momentum? Does the video avoid dead zones?
- Visual Hook: Are the first 3 seconds compelling? Are there strong visual patterns, motion, and contrast that hold attention?
- Caption Readability: Are captions/text overlays readable? Good contrast, appropriate size, well-timed?`;

  const userMessage = transcript
    ? `Video: ${filename} (${durationSeconds}s, ${selectedFrames.length} frames sampled)\n\nTranscript:\n${transcript}\n\nAnalyze these ${selectedFrames.length} frames extracted from the video:`
    : `Video: ${filename} (${durationSeconds}s, ${selectedFrames.length} frames sampled)\n\nNo audio transcript available. Analyze these ${selectedFrames.length} frames:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userMessage },
            ...imageContent,
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "{}";
    const parsed = JSON.parse(jsonStr);

    const analysis = {
      id: randomUUID(),
      filename,
      fingerprint,
      overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 0)),
      pacingScore: Math.min(100, Math.max(0, Number(parsed.pacingScore) || 0)),
      visualHookScore: Math.min(100, Math.max(0, Number(parsed.visualHookScore) || 0)),
      captionReadabilityScore: Math.min(100, Math.max(0, Number(parsed.captionReadabilityScore) || 0)),
      transcript,
      summary: String(parsed.summary || ""),
      pacingFeedback: String(parsed.pacingFeedback || ""),
      visualHookFeedback: String(parsed.visualHookFeedback || ""),
      captionFeedback: String(parsed.captionFeedback || ""),
      professionalAdvice: String(parsed.professionalAdvice || ""),
      visualHeatmap: String(parsed.visualHeatmap || ""),
      isPremiumUnlocked: false,
      durationSeconds,
      frameCount: selectedFrames.length,
    };

    const [inserted] = await db.insert(analysesTable).values(analysis).returning();
    return res.json(serializeAnalysis(inserted));
  } catch (err) {
    req.log.error({ err }, "AI analysis failed");
    return res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

// GET /api/videos/:id
router.get("/:id", async (req, res) => {
  const paramsResult = GetAnalysisParams.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ error: "Invalid params" });
  }

  try {
    const [analysis] = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.id, paramsResult.data.id))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    return res.json(serializeAnalysis(analysis));
  } catch (err) {
    req.log.error({ err }, "Failed to get analysis");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/videos/:id/unlock
router.post("/:id/unlock", async (req, res) => {
  const paramsResult = UnlockPremiumParams.safeParse(req.params);
  const bodyResult = UnlockPremiumBody.safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { id } = paramsResult.data;
  const { paypalOrderId } = bodyResult.data;

  try {
    const [analysis] = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.id, id))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    if (analysis.isPremiumUnlocked) {
      return res.json(serializeAnalysis(analysis));
    }

    const [updated] = await db
      .update(analysesTable)
      .set({
        isPremiumUnlocked: true,
        paypalOrderId,
      })
      .where(eq(analysesTable.id, id))
      .returning();

    return res.json(serializeAnalysis(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to unlock premium");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
