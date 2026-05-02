import { Router } from "express";
import { randomUUID } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import multer from "multer";
import { execSync } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { eq, sql } from "drizzle-orm";
import { db, analysesTable, userCreditsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";
import {
  createJob,
  getJob,
  emitProgress,
  emitDone,
  emitError,
  addClient,
  removeClient,
} from "../lib/jobStore.js";

// Discover system ffmpeg/ffprobe — works on NixOS Replit; avoids ffmpeg-static bundling issues
function whichBinary(name: string): string | null {
  try { return execSync(`which ${name}`, { encoding: "utf8" }).trim(); } catch { return null; }
}
const sysFfmpeg = whichBinary("ffmpeg");
const sysFfprobe = whichBinary("ffprobe");
if (sysFfmpeg) { ffmpeg.setFfmpegPath(sysFfmpeg); logger.info({ path: sysFfmpeg }, "ffmpeg resolved"); }
if (sysFfprobe) { ffmpeg.setFfprobePath(sysFfprobe); logger.info({ path: sysFfprobe }, "ffprobe resolved"); }

const router = Router();

// Multer disk storage — saves to /tmp
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpdir()),
  filename: (_req, _file, cb) => cb(null, `cliprank-upload-${randomUUID()}.mp4`),
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files are accepted"));
    }
    cb(null, true);
  },
});

const CREDITS_PER_10S = 1;

function creditsRequired(durationSeconds: number): number {
  return Math.ceil(durationSeconds / 10) * CREDITS_PER_10S;
}

// Compute a SHA-256 fingerprint from the first 1 MB of the file
async function computeFingerprint(filePath: string): Promise<string> {
  const { createHash } = await import("crypto");
  const hash = createHash("sha256");
  const CHUNK = 1024 * 1024;
  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(filePath, { start: 0, end: CHUNK - 1 });
    rs.on("data", (d) => hash.update(d));
    rs.on("end", resolve);
    rs.on("error", reject);
  });
  return hash.digest("hex");
}

// Get video duration using ffprobe
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 30);
    });
  });
}

// Hook-first frame extraction strategy:
// • Pass 1 — Hook zone (first 3.5s): 2 fps at 640px, q:v 2 → up to 6 high-res hook frames
// • Pass 2 — Body zone (4s → end): scene-detection first, uniform fallback if < 4 scene frames
// • Pass 3 — Emergency fallback: fires only if both passes yield 0 frames (unusual codec/format)
// scale=640:-2 (not -1) ensures even output height, preventing JPEG encoder crashes on portrait videos
async function extractFrames(
  filePath: string,
  duration: number,
  frameDir: string,
  onProgress: (pct: number) => void
): Promise<{ frames: string[]; hookCount: number }> {
  const { readdirSync, readFileSync } = await import("fs");

  const hookDir = join(frameDir, "hook");
  const spreadDir = join(frameDir, "spread");
  mkdirSync(hookDir, { recursive: true });
  mkdirSync(spreadDir, { recursive: true });

  const HOOK_END = Math.min(3.5, duration);
  const MAX_HOOK = 6;
  const MAX_SPREAD = 19;

  // Helper: run a single ffmpeg pass, log errors (never throw)
  const runPass = (opts: {
    label: string;
    inputOpts?: string[];
    outputOpts: string[];
    output: string;
  }): Promise<void> =>
    new Promise<void>((resolveP) => {
      const cmd = ffmpeg(filePath);
      if (opts.inputOpts?.length) cmd.inputOptions(opts.inputOpts);
      cmd
        .outputOptions(opts.outputOpts)
        .output(opts.output)
        .on("end", () => resolveP())
        .on("error", (err: Error) => {
          logger.warn({ err: err.message, label: opts.label, filePath }, "ffmpeg pass failed");
          resolveP();
        })
        .run();
    });

  // Pass 1: Hook frames — first 3.5s at 2 fps
  // scale=640:-2 forces even height (avoids JPEG crash on portrait video like 1080×1921)
  // format=yuvj420p ensures full-range JPEG-compatible pixel format for all codecs
  await runPass({
    label: "hook",
    outputOpts: [
      "-t", String(HOOK_END),
      "-vf", "fps=2,scale=640:-2,format=yuvj420p",
      "-q:v", "2",
      "-frames:v", String(MAX_HOOK),
    ],
    output: join(hookDir, "h_%03d.jpg"),
  });

  onProgress(40);

  // Pass 2: Body frames — scene-change-aware sampling from 4s onward
  // -ss as INPUT option = fast decode seek (much faster than output-side -ss)
  if (duration > 5) {
    const bodyDuration = duration - 4;
    const uniformFps = Math.min(MAX_SPREAD / bodyDuration, 0.5).toFixed(6);

    // 2a: Scene detection — picks frames at actual cuts/transitions
    // select='gt(scene,0.22)' threshold: 0=any change, 1=complete scene cut; 0.22 catches most edits
    await runPass({
      label: "body-scene",
      inputOpts: ["-ss", "4"],
      outputOpts: [
        "-vf", "select='gt(scene,0.22)',setpts=PTS-STARTPTS,scale=640:-2,format=yuvj420p",
        "-vsync", "vfr",
        "-q:v", "3",
        "-frames:v", String(MAX_SPREAD),
      ],
      output: join(spreadDir, "scene_%03d.jpg"),
    });

    const sceneCount = readdirSync(spreadDir).filter((f) => f.startsWith("scene_")).length;
    logger.info({ sceneCount, duration }, "Body scene detection complete");

    // 2b: Uniform fallback — fills gaps for static/talking-head content
    if (sceneCount < 4) {
      await runPass({
        label: "body-uniform",
        inputOpts: ["-ss", "4"],
        outputOpts: [
          "-vf", `fps=${uniformFps},scale=640:-2,format=yuvj420p`,
          "-q:v", "3",
          "-frames:v", String(MAX_SPREAD - sceneCount),
        ],
        output: join(spreadDir, "uniform_%03d.jpg"),
      });
    }
  }

  onProgress(85);

  const hookFiles = readdirSync(hookDir).filter((f) => f.endsWith(".jpg")).sort().slice(0, MAX_HOOK);
  const spreadFiles = readdirSync(spreadDir).filter((f) => f.endsWith(".jpg")).sort().slice(0, MAX_SPREAD);

  // Pass 3: Emergency fallback — if BOTH passes yielded 0 frames, try a bare-minimum extraction
  // This handles unusual codecs, container mismatches, or HDR/10-bit video
  if (hookFiles.length === 0 && spreadFiles.length === 0) {
    logger.warn({ filePath, duration }, "Zero frames from all passes — running emergency fallback");
    const fallbackDir = join(frameDir, "fallback");
    mkdirSync(fallbackDir, { recursive: true });
    const fallbackFps = Math.min(10 / Math.max(duration, 1), 1).toFixed(6);
    await runPass({
      label: "emergency-fallback",
      outputOpts: [
        "-vf", `fps=${fallbackFps},scale=640:-2,format=yuvj420p`,
        "-q:v", "2",
        "-frames:v", "10",
      ],
      output: join(fallbackDir, "f_%03d.jpg"),
    });
    const fallbackFiles = readdirSync(fallbackDir).filter((f) => f.endsWith(".jpg")).sort();
    logger.info({ fallbackCount: fallbackFiles.length }, "Emergency fallback complete");
    const frames: string[] = [];
    for (const f of fallbackFiles) frames.push(readFileSync(join(fallbackDir, f)).toString("base64"));
    return { frames, hookCount: frames.length };
  }

  const frames: string[] = [];
  for (const f of hookFiles) frames.push(readFileSync(join(hookDir, f)).toString("base64"));
  for (const f of spreadFiles) frames.push(readFileSync(join(spreadDir, f)).toString("base64"));

  return { frames, hookCount: hookFiles.length };
}

// Extract full audio as mp3 for transcription (no time limit — full video for accurate caption analysis)
function extractAudio(filePath: string, audioPath: string): Promise<void> {
  return new Promise((resolve) => {
    ffmpeg(filePath)
      .outputOptions(["-vn", "-ar", "16000", "-ac", "1", "-b:a", "64k"])
      .output(audioPath)
      .on("end", () => resolve())
      .on("error", () => {
        // Non-fatal — some videos have no audio track
        resolve();
      })
      .run();
  });
}

const SYSTEM_PROMPT = `You are ClipRank — the world's most calibrated viral video analyst for TikTok, Instagram Reels, and YouTube Shorts. Your scoring is based on real platform algorithm research and viral video mechanics, NOT subjective quality. Creators need HONEST, HARSH data to improve.

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

TREND ALIGNMENT SCORE — how well the content topic, format, and style matches currently trending content (2024-2025):
- 0-20: Content is outdated, overused format, or targets a declining niche
- 21-40: Niche exists but format is not what's currently performing
- 41-60: Reasonable niche but not riding any specific current wave
- 61-80: Topic or format is aligned with current platform trends
- 81-100: Riding a clear trend wave — topic is hot RIGHT NOW on at least one major platform
Consider: Is this topic/niche currently getting massive organic distribution? Is the VIDEO FORMAT (POV, green screen, duet, reaction, GRWM, etc.) what's trending? Does it use current audio trends or viral sounds (if detectable from transcript)?

NICHE DETECTION — identify the specific content category.
COMPETITOR ANALYSIS — based on your knowledge of what viral videos in this niche do. Provide JSON with: topPatterns (array of 5), winningFormula (1-2 sentences), gapAnalysis (what this video is missing), nicheExamples (2-3 famous viral creators/videos in this niche).
RETENTION RISK — identify drop-off risks: first 2s, mid-video, final seconds.

AUDIO/TRANSCRIPT ANALYSIS — If a transcript is provided, assess: spoken hook quality (first 5 words), speech pacing, whether the spoken content matches viral formats (storytelling, listicle, tutorial, reaction). A strong spoken hook in the transcript boosts viralityScore.

Return ONLY valid JSON:
{
  "pacingScore": <0-100>,
  "visualHookScore": <0-100>,
  "captionReadabilityScore": <0-100>,
  "viralityScore": <0-100>,
  "trendScore": <0-100, trend alignment score>,
  "overallScore": <weighted: hook 30% + pacing 20% + captions 15% + virality 20% + trend 15%>,
  "niche": "<specific niche>",
  "nichePlatform": "<TikTok | Instagram Reels | YouTube Shorts | All platforms>",
  "summary": "<2-3 sentences honest assessment including audio/spoken content quality>",
  "pacingFeedback": "<specific actionable feedback>",
  "visualHookFeedback": "<specific: what IS the first 3s, what SHOULD it be>",
  "captionFeedback": "<exact issue and fix>",
  "trendInsights": "<2-3 sentences: what trend this could ride, what format is hot in this niche right now, specific suggestions to make it more trend-aligned>",
  "retentionRisk": "<JSON string: {opening, midVideo, ending}>",
  "competitorInsights": "<JSON string: {topPatterns, winningFormula, gapAnalysis, nicheExamples}>",
  "professionalAdvice": "<3-4 paragraphs of professional editing advice>",
  "visualHeatmap": "<JSON string: frame-by-frame attention zones>"
}`;

// Main background processing function
async function processVideoJob(
  jobId: string,
  filePath: string,
  filename: string,
  userId: string,
  fingerprint: string,
  durationSeconds: number
) {
  const job = getJob(jobId);
  if (!job) return;

  job.status = "running";
  const frameDir = join(tmpdir(), `cliprank-frames-${jobId}`);

  try {
    mkdirSync(frameDir, { recursive: true });

    // Step 1: Extract frames (hook-first strategy)
    emitProgress(job, "extracting", 5, "Extracting frames…");
    const { frames, hookCount } = await extractFrames(filePath, durationSeconds, frameDir, (pct) => {
      emitProgress(job, "extracting", 5 + Math.round(pct * 0.35), `Extracting frames… ${pct}%`);
    });

    // Step 2: Extract + transcribe audio (full video — no time limit)
    emitProgress(job, "transcribing", 42, "Transcribing audio…");
    let transcript = "";
    const audioPath = join(tmpdir(), `cliprank-audio-${jobId}.mp3`);
    try {
      await extractAudio(filePath, audioPath);
      const { existsSync } = await import("fs");
      if (existsSync(audioPath)) {
        const audioBuffer = (await import("fs")).readFileSync(audioPath);
        if (audioBuffer.length > 1000) {
          const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });
          const audioFile = new File([audioBlob], "audio.mp3", { type: "audio/mp3" });
          const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "gpt-4o-mini-transcribe",
            response_format: "json",
          });
          transcript = transcription.text ?? "";
        }
      }
    } catch {
      // Non-fatal — continue without transcript
    }

    // Step 3: AI scoring
    emitProgress(job, "scoring", 55, "Scoring virality…");

    // First hookCount images = hook zone (first ~3.5s), remainder = body spread
    const imageContent = frames.map((frame, i) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${frame}`,
        // Use "high" detail for hook frames — visual hook score depends on them
        detail: i < hookCount ? ("high" as const) : ("low" as const),
      },
    }));

    const hookNote = `FRAME LAYOUT: Images 1-${hookCount} are HOOK ZONE frames (first ~3.5s, high-res). Images ${hookCount + 1}-${frames.length} are BODY frames spread across the rest of the video. Base visualHookScore ONLY on the hook zone frames.`;

    const userMessage = transcript
      ? `Video: "${filename}" (${Math.round(durationSeconds)}s · ${hookCount} hook frames + ${frames.length - hookCount} body frames)\n\n${hookNote}\n\nTranscript (full video):\n${transcript}\n\nScore virality potential:`
      : `Video: "${filename}" (${Math.round(durationSeconds)}s · ${hookCount} hook frames + ${frames.length - hookCount} body frames)\n\n${hookNote}\n\nNo audio transcript available.\n\nScore virality potential:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [{ type: "text", text: userMessage }, ...imageContent] },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");

    // Step 4: Viral pattern research (brief pause for UX, AI already did it above)
    emitProgress(job, "researching", 88, "Mapping viral patterns…");
    await new Promise((r) => setTimeout(r, 600));

    // Step 5: Save to DB
    const required = creditsRequired(durationSeconds);
    const clamp = (v: unknown) => Math.min(100, Math.max(0, Number(v) || 0));
    const analysis = {
      id: randomUUID(),
      filename,
      fingerprint,
      overallScore: clamp(parsed.overallScore),
      pacingScore: clamp(parsed.pacingScore),
      visualHookScore: clamp(parsed.visualHookScore),
      captionReadabilityScore: clamp(parsed.captionReadabilityScore),
      viralityScore: clamp(parsed.viralityScore),
      trendScore: clamp(parsed.trendScore),
      transcript,
      summary: String(parsed.summary || ""),
      pacingFeedback: String(parsed.pacingFeedback || ""),
      visualHookFeedback: String(parsed.visualHookFeedback || ""),
      captionFeedback: String(parsed.captionFeedback || ""),
      trendInsights: String(parsed.trendInsights || ""),
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
      isPremiumUnlocked: false,
      durationSeconds,
      frameCount: frames.length,
    };

    const [inserted] = await db.insert(analysesTable).values(analysis).returning();

    // Deduct credits
    await db
      .update(userCreditsTable)
      .set({ credits: sql`${userCreditsTable.credits} - ${required}`, updatedAt: new Date() })
      .where(eq(userCreditsTable.userId, userId));

    emitDone(job, inserted.id, durationSeconds);
  } catch (err: any) {
    emitError(job, err?.message ?? "Processing failed");
  } finally {
    // Cleanup temp files
    try { rmSync(filePath, { force: true }); } catch {}
    try { rmSync(frameDir, { recursive: true, force: true }); } catch {}
    try { rmSync(join(tmpdir(), `cliprank-audio-${jobId}.mp3`), { force: true }); } catch {}
  }
}

// POST /api/videos/upload — accepts multipart video file
router.post("/upload", upload.single("video"), async (req, res) => {
  const file = req.file;
  const userId = String(req.body?.userId ?? "");
  const filename = String(req.body?.filename ?? file?.originalname ?? "video.mp4");

  if (!file) {
    return res.status(400).json({ error: "No video file provided" });
  }

  req.log.info({ filename, size: file.size }, "Video upload received");

  try {
    // 1. Fingerprint + duration
    const [fingerprint, durationSeconds] = await Promise.all([
      computeFingerprint(file.path),
      getVideoDuration(file.path).catch(() => 30),
    ]);

    // 2. Cache check
    const cached = await db
      .select()
      .from(analysesTable)
      .where(eq(analysesTable.fingerprint, fingerprint))
      .limit(1);

    if (cached.length > 0) {
      req.log.info({ fingerprint }, "Cache hit");
      rmSync(file.path, { force: true });
      return res.json({ analysisId: cached[0].id, durationSeconds });
    }

    // 3. Credit check
    const required = creditsRequired(durationSeconds);
    if (userId) {
      const [userRow] = await db
        .select()
        .from(userCreditsTable)
        .where(eq(userCreditsTable.userId, userId))
        .limit(1);

      const available = userRow?.credits ?? 0;
      if (available < required) {
        rmSync(file.path, { force: true });
        return res.status(402).json({
          error: "Insufficient credits",
          creditsRequired: required,
          creditsAvailable: available,
          durationSeconds,
        });
      }
    }

    // 4. Create job + start background processing
    const jobId = randomUUID();
    createJob(jobId);

    // Fire-and-forget background processing
    processVideoJob(jobId, file.path, filename, userId, fingerprint, durationSeconds).catch(() => {});

    return res.json({ jobId, durationSeconds });
  } catch (err: any) {
    req.log.error({ err }, "Upload handling failed");
    try { rmSync(file.path, { force: true }); } catch {}
    return res.status(500).json({ error: "Upload failed" });
  }
});

// GET /api/videos/jobs/:jobId/stream — SSE progress stream
router.get("/jobs/:jobId/stream", (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15_000);

  const send = (data: string) => { res.write(data); };

  addClient(job, send);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(job, send);
  });
});

export default router;
