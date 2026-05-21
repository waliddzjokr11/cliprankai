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
const ADMIN_USER_IDS = new Set(process.env.CLERK_ADMIN_USER_ID ? [process.env.CLERK_ADMIN_USER_ID] : []);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

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
  const adminEmail = ADMIN_EMAIL ? (req.body as any)?.email : undefined;
  const isAdmin = ADMIN_USER_IDS.has(userId) || (ADMIN_EMAIL && adminEmail === ADMIN_EMAIL);
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

  // Prepare frames — limit to 20, use auto detail for sharp visual analysis
  const selectedFrames = frames.slice(0, 20);
  const imageContent = selectedFrames.map((frame) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:image/jpeg;base64,${frame}`,
      detail: "auto" as const,
    },
  }));

  const systemPrompt = `You are ClipRank — the most calibrated viral video analyst on the market. Your scoring is reverse-engineered from real platform algorithm signals and documented viral creator formulas. You are NOT a generic AI that praises content — you deliver data creators can act on.

════════════════════════════════════════
CALIBRATION MANDATE (never override)
════════════════════════════════════════
- Generic "good quality" videos with no viral mechanics: 35-55
- Videos hitting 2-3 viral signals well: 55-70
- Videos hitting 4-5 viral signals: 70-82
- Near-perfect viral formula execution: 83-95
- Reserve 95+ for once-in-a-thousand content
- A creator who gets 84 on a weak video learns nothing and wastes money. Be harsh.

════════════════════════════════════════
7 PROVEN VIRAL HOOK FORMULAS (identify which one is used)
════════════════════════════════════════
1. CURIOSITY GAP — "The reason [X] doesn't work (and what does)" — creates tension viewers must resolve
2. SHOCK OPEN — Start with the most dramatic moment of the entire video first, then explain
3. CHALLENGE/RESULT — "I tried [X] for [time] — here's what happened" — locks in completion rate
4. EMPATHY/POV — "POV: [hyper-specific relatable situation]" — instant emotional identification
5. CONTRARIAN — "[Popular belief] is completely wrong" — triggers disagreement = watch time
6. SOCIAL PROOF VALUE — "This exact thing got me [specific measurable result]" — desire + credibility  
7. LOOP OPEN — Start mid-story with zero context; viewer MUST watch to closure
8. NONE — No identifiable viral hook formula; video opens generically

════════════════════════════════════════
PLATFORM ALGORITHM SIGNALS (2025 — documented)
════════════════════════════════════════
TIKTOK FYP ALGORITHM:
- Watch completion rate >70% = automatic FYP push (single biggest signal)
- Replays / loops = 50% more distribution weight than a like
- Shares to DMs = strongest new-audience signal  
- Comments (especially questions) = engagement multiplier
- Word-by-word animated captions = 85% of TikTok is watched silent; missing captions costs 40% completion
- Pattern interrupt every 3-7 seconds = prevents mid-video drop
- Trending audio = 2-3x organic reach boost from sound page discovery
- First 0.3 seconds = the scroll-stop window; one boring frame = swipe
- Duet/stitch hook = signals high community engagement potential

INSTAGRAM REELS ALGORITHM:
- SAVE RATE = confirmed #1 ranking signal by Adam Mosseri (2024)
- Educational content saves 3-5x more than entertainment alone
- Aesthetic consistency + visual quality matter more than TikTok (Instagram is photo-native)
- Strong secondary hook at 5-7s ("Reels scroll" happens if you don't re-hook)
- No UI-obscuring text overlays (penalized)
- Strong music bed = Explore page recommendation boost
- 7-15s Reels outperform longer ones for non-established accounts

YOUTUBE SHORTS ALGORITHM:
- Average Percentage Viewed (APV) = primary ranking metric
- 100% APV = maximum distribution push; every second lost is algorithmic penalty
- Loopability is critical: Shorts auto-loop, so a seamless loop = 2x replay rate  
- Curiosity gap MUST be answered before end (no unresolved opens)
- First thumbnail frame = what viewers see in the Shorts shelf; must be high-contrast
- Subscribe CTA at end converts casual viewers to subscribers (long-term algorithmic value)
- Unlike TikTok, captions are less critical but still recommended

════════════════════════════════════════
SCORING DIMENSIONS
════════════════════════════════════════
VISUAL HOOK SCORE — first 3 seconds only, harshest metric:
- 0-20: Static open, person standing/talking, slow pan, generic text card
- 21-40: Some motion but predictable, no pattern interrupt, seen-it-before formula
- 41-60: Functional hook but uses an overused formula for the niche
- 61-80: Clear pattern interrupt, high-contrast first frame, viewer must continue
- 81-100: Scroll-stopping — unexpected, emotionally triggering, or violates expectations

PACING SCORE — cut frequency and visual variety across all frames:
- 0-20: Single angle, dead zones >5s, no visual variety, static B-roll
- 21-40: Some cuts but slow, predictable rhythm, low energy throughout
- 41-60: Acceptable pacing but no pattern interrupts; feels like a normal video
- 61-80: Good rhythm, visual variety, maintains energy with cuts
- 81-100: Masterful — cuts at emotional peaks, pattern interrupt every 3-7s, energy arc builds

CAPTION SCORE — assess captions visible in frames:
- 0-20: No captions visible anywhere
- 21-40: Small, low-contrast, or hard-to-read captions
- 41-60: Readable but static SRT-style; no styling
- 61-80: Word-by-word, good contrast, clear positioning
- 81-100: Animated word-by-word, high-contrast, optimally placed, styled for emphasis

LOOPABILITY SCORE — does this video reward replay / loop naturally:
- 0-20: Definitive ending, no reason to rewatch, hard stop
- 21-40: Weak ending, content feels complete on first watch
- 41-60: OK ending but nothing pulls viewer back
- 61-80: Ends on curiosity, callback to intro, or natural loop point
- 81-100: Seamless loop, mid-story cliffhanger, or payoff that makes viewer rewatch

SHAREABILITY SCORE — does this video have a "I NEED to send this" moment:
- 0-20: Generic content, no share trigger, no relatable or shocking moment
- 21-40: Mildly interesting but forgettable
- 41-60: One shareable element but not strong enough to break behavior
- 61-80: Clear "send to a friend" moment — relatable, shocking, or laugh-out-loud
- 81-100: Viral share bait — speaks to an identity, community, or universal experience

VIRALITY SCORE — calibrated probability of 10x+ algorithm distribution:
- 0-25: Will NOT go viral. Missing core mechanics entirely.
- 26-45: 1 in 50 chance. Some elements present but critical gaps remain.
- 46-65: 1 in 15 chance. Hits 2-3 algorithm signals. Timing/niche might help.
- 66-80: 1 in 5 chance. Most viral mechanics present and executed.
- 81-100: 1 in 2 chance. Formula nearly perfect — distribution likely.

════════════════════════════════════════
NICHE & PLATFORM DETECTION
════════════════════════════════════════
Identify the SPECIFIC content category. Be precise:
Not "fitness" — say "gym transformation progress", "home workout no equipment", or "CrossFit WOD breakdown"
Not "business" — say "solopreneur income report", "dropshipping tutorial", or "cold outreach sales"
Examples: "aesthetic morning routine", "relationship red flag storytime", "AI tools for productivity", "street food mukbang", "luxury car review", "day trading breakdown", "skincare ingredient science"

════════════════════════════════════════
EMOTIONAL TRIGGER IDENTIFICATION
════════════════════════════════════════
What primary emotion does the first 3 seconds trigger in the viewer?
Choose the most accurate: CURIOSITY | AWE | LAUGHTER | SHOCK | FOMO | RELATABILITY | DESIRE | INSPIRATION | CRINGE | NONE
Then explain in one sentence what creates that emotion (or why none is triggered).

════════════════════════════════════════
COMPETITOR PATTERN ANALYSIS
════════════════════════════════════════
Based on your knowledge of what actually goes viral in this niche:
- topPatterns: 5 specific patterns that viral creators in this niche consistently use
- winningFormula: The single highest-ROI formula for this niche in 1-2 sentences
- gapAnalysis: The 2-3 specific elements THIS video is missing vs viral content in the niche
- nicheExamples: Name 2-3 actual creators or videos known to use these patterns

════════════════════════════════════════
RETENTION RISK ANALYSIS
════════════════════════════════════════
Identify where viewers drop based on frame evidence:
- opening (0-3s): hook strength and scroll-stop power
- midVideo: dead zones, predictable moments, energy dips visible in frames
- ending: does it resolve well, loop, or peter out?

════════════════════════════════════════
SOUND STRATEGY
════════════════════════════════════════
Based on what you can observe (audio mentioned in transcript, visual cues of music/sound):
- Is the audio strategy optimized for the platform?
- Does it use speech, music bed, trending sound, or silence?
- What would maximize reach on the detected platform?
Keep to 2-3 actionable sentences.

════════════════════════════════════════
POSTING STRATEGY
════════════════════════════════════════
Based on the niche, platform, and content:
- Best posting window (day/time) for this content type
- 3-5 specific hashtag categories (not generic like #fyp — specific like #gymtransformation)
- Caption opener recommendation (first 1-2 lines that appear before "more" in feeds)
- Any platform-specific optimization (pinned comment, duet settings, etc.)

════════════════════════════════════════
ENGAGEMENT PREDICTION
════════════════════════════════════════
Based on the combined signal analysis, predict the realistic performance bracket for this video on its best-fit platform (assume the account has 1K-10K followers):
Format: "X–Y views typical | Z–W likes | [qualifier: e.g., 'Strong FYP candidate if hook is fixed', 'Will perform in followers-only feed', 'High save potential for Reels']"

════════════════════════════════════════
OVERALL SCORE FORMULA
════════════════════════════════════════
overallScore = (visualHookScore × 0.28) + (viralityScore × 0.22) + (pacingScore × 0.18) + (shareabilityScore × 0.16) + (captionReadabilityScore × 0.10) + (loopabilityScore × 0.06)

════════════════════════════════════════
OUTPUT — return ONLY valid JSON, no markdown:
════════════════════════════════════════
{
  "pacingScore": <0-100>,
  "visualHookScore": <0-100>,
  "captionReadabilityScore": <0-100>,
  "loopabilityScore": <0-100>,
  "shareabilityScore": <0-100>,
  "viralityScore": <0-100>,
  "overallScore": <calculated per formula above>,
  "niche": "<specific niche>",
  "nichePlatform": "<TikTok | Instagram Reels | YouTube Shorts | All platforms>",
  "hookFormula": "<one of the 8 formulas above, e.g. 'CURIOSITY GAP' or 'NONE'>",
  "emotionalTrigger": "<EMOTION: one sentence explanation>",
  "summary": "<3 sentences: honest assessment, what works, what kills virality>",
  "pacingFeedback": "<specific with timestamps if possible>",
  "visualHookFeedback": "<what IS happening in first 3s + exactly what SHOULD replace it>",
  "captionFeedback": "<exact issue and fix>",
  "retentionRisk": "<JSON string: {opening: string, midVideo: string, ending: string}>",
  "competitorInsights": "<JSON string: {topPatterns: string[], winningFormula: string, gapAnalysis: string, nicheExamples: string}>",
  "soundStrategy": "<2-3 sentence audio strategy recommendation>",
  "postingStrategy": "<posting time + hashtag categories + caption opener + platform tip>",
  "engagementPrediction": "<views range | likes range | qualifier>",
  "trendScore": <0-100, how well this video aligns with current platform trends in its niche>,
  "trendInsights": "<2 sentences on trend alignment — is this niche growing or declining, what trend angle would amplify this video>",
  "professionalAdvice": "<4-5 paragraphs: specific timestamp edits, B-roll suggestions, audio overhaul, caption redesign, platform-specific post optimizations>",
  "visualHeatmap": "<JSON string: array of {frame: number, attention: 'high'|'medium'|'low', zone: string, reason: string} for each sampled frame>"
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

    const clamp = (v: unknown) => Math.min(100, Math.max(0, Number(v) || 0));
    const str = (v: unknown) => String(v || "");
    const jsonStr = (v: unknown) => typeof v === "string" ? v : JSON.stringify(v || {});

    const analysis = {
      id: randomUUID(),
      filename,
      fingerprint,
      overallScore: clamp(parsed.overallScore),
      pacingScore: clamp(parsed.pacingScore),
      visualHookScore: clamp(parsed.visualHookScore),
      captionReadabilityScore: clamp(parsed.captionReadabilityScore),
      viralityScore: clamp(parsed.viralityScore),
      loopabilityScore: clamp(parsed.loopabilityScore),
      shareabilityScore: clamp(parsed.shareabilityScore),
      trendScore: parsed.trendScore !== undefined ? clamp(parsed.trendScore) : null,
      transcript,
      summary: str(parsed.summary),
      pacingFeedback: str(parsed.pacingFeedback),
      visualHookFeedback: str(parsed.visualHookFeedback),
      captionFeedback: str(parsed.captionFeedback),
      niche: str(parsed.niche),
      nichePlatform: str(parsed.nichePlatform),
      hookFormula: str(parsed.hookFormula) || null,
      emotionalTrigger: str(parsed.emotionalTrigger) || null,
      soundStrategy: str(parsed.soundStrategy) || null,
      postingStrategy: str(parsed.postingStrategy) || null,
      engagementPrediction: str(parsed.engagementPrediction) || null,
      trendInsights: str(parsed.trendInsights) || null,
      retentionRisk: jsonStr(parsed.retentionRisk),
      competitorInsights: jsonStr(parsed.competitorInsights),
      professionalAdvice: str(parsed.professionalAdvice),
      visualHeatmap: jsonStr(parsed.visualHeatmap),
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
    const requestingEmail = ADMIN_EMAIL ? (req.query.email as string) : undefined;
    const isAdminUser = ADMIN_USER_IDS.has(requestingUserId) || (ADMIN_EMAIL && requestingEmail === ADMIN_EMAIL);
    if (requestingUserId && analysis.userId && !isAdminUser) {
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
