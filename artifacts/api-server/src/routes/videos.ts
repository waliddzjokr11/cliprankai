import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, desc, avg, count, sum, sql } from "drizzle-orm";
import { db, analysesTable, userCreditsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  AnalyzeVideoBody,
  GetAnalysisParams,
  UnlockPremiumParams,
  UnlockPremiumBody,
} from "@workspace/api-zod";

const router = Router();

const CREDITS_PER_10S = 1;

// Admin users always get premium unlocked and are never blocked by credits
const ADMIN_USER_IDS = new Set(["user_3DAainmIJ1RHEdNGbA8rXsNn8Nk"]);

// ─── TESTING FLAG ────────────────────────────────────────────────────────────
// Set TESTING_UNLIMITED_CREDITS=true env var to bypass all credit checks.
// To turn off: delete the env var and restart the API server.
const TESTING_UNLIMITED_CREDITS = process.env.TESTING_UNLIMITED_CREDITS === "true";
// ─────────────────────────────────────────────────────────────────────────────

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
    niche: a.niche ?? null,
    nichePlatform: a.nichePlatform ?? null,
    viralityScore: a.viralityScore ?? null,
    competitorInsights: a.competitorInsights ?? null,
    retentionRisk: a.retentionRisk ?? null,
    trendScore: a.trendScore ?? null,
    trendInsights: a.trendInsights ?? null,
  };
}

function creditsRequired(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 10) * CREDITS_PER_10S;
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

// GET /api/videos — list analyses for a specific user (userId required)
router.get("/", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    // Never leak other users' data — require userId
    return res.json([]);
  }
  try {
    const analyses = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.userId, userId))
      .orderBy(desc(analysesTable.createdAt))
      .limit(50);

    return res.json(analyses.map(serializeAnalysis));
  } catch (err) {
    req.log.error({ err }, "Failed to list analyses");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/videos/analyze
router.post("/analyze", async (req, res) => {
  const bodyResult = AnalyzeVideoBody.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: "Invalid request body", issues: bodyResult.error.issues });
  }

  const { frames, audioBase64, filename, durationSeconds, fingerprint, userId } = bodyResult.data;

  // Cache check — instant return on hit, no credits deducted
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

  // Credit check (skipped for admin users and during testing)
  const isAdmin = ADMIN_USER_IDS.has(userId);
  const required = creditsRequired(durationSeconds);
  if (!isAdmin && !TESTING_UNLIMITED_CREDITS) {
    try {
      const [userRow] = await db
        .select()
        .from(userCreditsTable)
        .where(eq(userCreditsTable.userId, userId))
        .limit(1);

      const available = userRow?.credits ?? 0;
      if (available < required) {
        req.log.warn({ userId, required, available }, "Insufficient credits");
        return res.status(402).json({
          error: "Insufficient credits",
          creditsRequired: required,
          creditsAvailable: available,
        });
      }
    } catch (err) {
      req.log.error({ err }, "Credit check failed");
      return res.status(500).json({ error: "Internal server error" });
    }
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

  // Prepare frames — limit to 20
  const selectedFrames = frames.slice(0, 20);
  const imageContent = selectedFrames.map((frame) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:image/jpeg;base64,${frame}`,
      detail: "low" as const,
    },
  }));

  const systemPrompt = `You are ClipRank — the world's most calibrated viral video analyst for TikTok, Instagram Reels, and YouTube Shorts. Your scoring is based on real platform algorithm research and viral video mechanics, NOT subjective quality. Creators need HONEST, HARSH data to improve.

CALIBRATION RULES (critical — do not ignore):
- A generic "good" video that doesn't hit virality signals scores 45-65, NOT 80+
- To score 70+, a video must have SPECIFIC viral mechanics, not just look professional
- Common mistake videos make that score high on generic AI but don't go viral: slow openers, no pattern interrupts, missing captions, no emotional trigger
- Be BRUTALLY HONEST. A creator who gets 84 on a non-viral video learns nothing.

PLATFORM ALGORITHM RESEARCH (2024-2025):
- TikTok: Hook in first 1s = #1 signal. Pattern interrupt = 3x distribution. Completion rate >70% = viral push. Word-by-word captions essential (85% watch silently).
- Instagram Reels: Save rate = hidden ranking signal. Aesthetic + educational content. Strong mid-hook to prevent early drops.
- YouTube Shorts: First 3-5 seconds decide everything. Curiosity gap must be answered. End CTA. 100% watch = algorithm push.

VIRALITY SCORE — calibrated probability this video gets 10x+ algorithm distribution:
- 0-25: Will NOT go viral. Missing core mechanics.
- 26-45: Tiny chance (1 in 50). Some elements present but critical gaps.
- 46-65: Moderate (1 in 15). Hits some algorithm signals. Right niche + timing might help.
- 66-80: Strong chance (1 in 5). Most viral mechanics present.
- 81-100: Exceptional (1 in 2). Viral formula nearly perfect.

VISUAL HOOK SCORE (harshest metric — based only on first 3 seconds from frames):
- 0-20: Static opening, person just standing/talking, slow pan, generic title card
- 21-40: Some motion but predictable opener, no pattern interrupt
- 41-60: Decent hook but it's a common formula for the niche (not scroll-stopping)
- 61-80: Clear pattern interrupt, viewer must keep watching, strong first frame
- 81-100: Exceptional — unexpected, emotionally triggering, or scroll-stopping opener

PACING SCORE (based on frame variety and cut frequency):
- 0-20: Single angle, no visual changes, dead zones >5s, static B-roll
- 21-40: Some cuts but slow rhythm, low energy
- 41-60: OK pacing but no pattern interrupts, predictable
- 61-80: Good rhythm, visual variety, cuts maintain energy
- 81-100: Masterful — cuts at peak moments, pattern interrupts every 3-7s, energy builds

CAPTION SCORE:
- 0-20: No captions visible in frames
- 21-40: Small or low-contrast captions
- 41-60: Readable but static subtitle-style
- 61-80: Word-by-word, good contrast
- 81-100: Animated/styled captions, high contrast, optimally placed

NICHE DETECTION — identify the specific content category:
Examples: "fitness motivation", "cooking/recipe tutorial", "travel vlog", "comedy skit", "educational tech", "beauty/makeup tutorial", "day-in-my-life", "business/entrepreneur", "sports highlight", "music performance", "fashion haul", "relationship advice", "gaming"

COMPETITOR ANALYSIS — based on your knowledge of what viral videos in this niche do:
Provide JSON with keys: topPatterns (array of 5 strings describing what viral videos in this niche consistently use), winningFormula (1-2 sentences on the #1 formula), gapAnalysis (what specific elements this video is missing compared to viral content), nicheExamples (name 2-3 famous viral videos or creators in this exact niche that use these patterns).

RETENTION RISK — identify specific drop-off risks:
- First 2 seconds: hook strength
- Mid-video (time ranges from frames): dead zones or predictable moments
- Final seconds: does it end with a hook or peter out?

Return ONLY valid JSON:
{
  "pacingScore": <0-100 number>,
  "visualHookScore": <0-100 number>,
  "captionReadabilityScore": <0-100 number>,
  "viralityScore": <0-100 number, separate virality probability>,
  "overallScore": <weighted: hook 35% + pacing 25% + captions 20% + virality 20%>,
  "niche": "<specific niche string>",
  "nichePlatform": "<TikTok | Instagram Reels | YouTube Shorts | All platforms>",
  "summary": "<2-3 sentences: honest assessment including virality potential>",
  "pacingFeedback": "<specific actionable feedback with timestamps if possible>",
  "visualHookFeedback": "<be specific: what IS the first 3 seconds, what SHOULD it be instead>",
  "captionFeedback": "<exact issue and fix>",
  "retentionRisk": "<JSON string: {opening: string, midVideo: string, ending: string}>",
  "competitorInsights": "<JSON string: {topPatterns: string[], winningFormula: string, gapAnalysis: string, nicheExamples: string}>",
  "professionalAdvice": "<3-4 paragraphs of professional editing advice: specific timestamps, B-roll suggestions, audio recommendations, platform-specific optimizations>",
  "visualHeatmap": "<JSON string: frame-by-frame attention zones — which frames are high/medium/low attention with specific reasoning>"
}`;

  const userMessage = transcript
    ? `Video: "${filename}" (${durationSeconds}s duration, ${selectedFrames.length} frames sampled)

Transcript of audio:
${transcript}

Analyze these ${selectedFrames.length} frames from the video to score virality potential. Be calibrated and harsh — creators need real data:`
    : `Video: "${filename}" (${durationSeconds}s duration, ${selectedFrames.length} frames sampled)

No audio transcript available (silent video or audio extraction disabled).

Analyze these ${selectedFrames.length} frames — NOTE: no captions in transcript means caption score should reflect only what's VISIBLE in the frames. Score virality potential calibrated to platform algorithms:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const rawJson = jsonMatch ? jsonMatch[0] : "{}";
    const sanitized = rawJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");
    const parsed = JSON.parse(sanitized);

    const analysis = {
      id: randomUUID(),
      filename,
      fingerprint,
      overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 0)),
      pacingScore: Math.min(100, Math.max(0, Number(parsed.pacingScore) || 0)),
      visualHookScore: Math.min(100, Math.max(0, Number(parsed.visualHookScore) || 0)),
      captionReadabilityScore: Math.min(100, Math.max(0, Number(parsed.captionReadabilityScore) || 0)),
      viralityScore: Math.min(100, Math.max(0, Number(parsed.viralityScore) || 0)),
      transcript,
      summary: String(parsed.summary || ""),
      pacingFeedback: String(parsed.pacingFeedback || ""),
      visualHookFeedback: String(parsed.visualHookFeedback || ""),
      captionFeedback: String(parsed.captionFeedback || ""),
      niche: String(parsed.niche || ""),
      nichePlatform: String(parsed.nichePlatform || ""),
      retentionRisk: typeof parsed.retentionRisk === "string"
        ? parsed.retentionRisk
        : JSON.stringify(parsed.retentionRisk || {}),
      competitorInsights: typeof parsed.competitorInsights === "string"
        ? parsed.competitorInsights
        : JSON.stringify(parsed.competitorInsights || {}),
      professionalAdvice: String(parsed.professionalAdvice || ""),
      visualHeatmap: typeof parsed.visualHeatmap === "string"
        ? parsed.visualHeatmap
        : JSON.stringify(parsed.visualHeatmap || {}),
      isPremiumUnlocked: isAdmin,
      durationSeconds,
      frameCount: selectedFrames.length,
    };

    const [inserted] = await db.insert(analysesTable).values(analysis).returning();

    // Deduct credits after successful analysis (skipped for admin and during testing)
    if (!isAdmin && !TESTING_UNLIMITED_CREDITS) {
      try {
        await db
          .update(userCreditsTable)
          .set({
            credits: sql`${userCreditsTable.credits} - ${required}`,
            updatedAt: new Date(),
          })
          .where(eq(userCreditsTable.userId, userId));
        req.log.info({ userId, creditsDeducted: required }, "Credits deducted");
      } catch (err) {
        req.log.error({ err }, "Failed to deduct credits — analysis saved anyway");
      }
    }

    return res.json(serializeAnalysis(inserted));
  } catch (err) {
    req.log.error({ err }, "AI analysis failed");
    return res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

// GET /api/videos/:id — only the owner may view their analysis
router.get("/:id", async (req, res) => {
  const paramsResult = GetAnalysisParams.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ error: "Invalid params" });
  }

  // Caller must pass their userId so we can verify ownership
  const requestingUserId = req.query.userId as string | undefined;

  try {
    const [analysis] = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.id, paramsResult.data.id))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    // Ownership check — admin can always view
    if (requestingUserId && analysis.userId && !ADMIN_USER_IDS.has(requestingUserId)) {
      if (analysis.userId !== requestingUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

    if (!analysis) return res.status(404).json({ error: "Analysis not found" });
    if (analysis.isPremiumUnlocked) return res.json(serializeAnalysis(analysis));

    const [updated] = await db
      .update(analysesTable)
      .set({ isPremiumUnlocked: true, paypalOrderId })
      .where(eq(analysesTable.id, id))
      .returning();

    return res.json(serializeAnalysis(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to unlock premium");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
