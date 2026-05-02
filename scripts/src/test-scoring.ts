/**
 * ClipRank 20-video scoring test
 * Generates 10 "failure" and 10 "viral" synthetic videos, runs each through
 * the full analysis pipeline, then prints a comparison table.
 *
 * Run:  pnpm --filter @workspace/scripts run test-scoring
 */

import { execSync, spawnSync } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const API_BASE = "http://localhost:80/api";
const ADMIN_USER_ID = "user_3DAainmIJ1RHEdNGbA8rXsNn8Nk";
const WORK_DIR = join(tmpdir(), "cliprank-scoring-test");

// ─── helpers ──────────────────────────────────────────────────────────────────

function ffmpeg(args: string[]): void {
  const result = spawnSync("ffmpeg", ["-y", ...args], {
    stdio: ["ignore", "ignore", "pipe"],
    timeout: 60_000,
  });
  if (result.status !== 0) {
    const err = result.stderr?.toString().slice(-400) ?? "";
    throw new Error(`ffmpeg failed:\n${err}`);
  }
}

async function uploadVideo(filePath: string, label: string): Promise<string> {
  const form = new FormData();
  const data = await import("fs").then((f) => f.readFileSync(filePath));
  form.append("video", new Blob([data], { type: "video/mp4" }), `${label}.mp4`);
  form.append("filename", `${label}.mp4`);
  form.append("userId", ADMIN_USER_ID);

  const res = await fetch(`${API_BASE}/videos/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed ${res.status}: ${await res.text()}`);
  const json = await res.json() as { jobId?: string; analysisId?: string };

  if (json.analysisId) return json.analysisId; // cache hit
  if (!json.jobId) throw new Error("No jobId returned");
  return await waitForJob(json.jobId, label);
}

async function waitForJob(jobId: string, label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/videos/jobs/${jobId}/stream`;
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error(`Timeout waiting for ${label}`)); }
    }, 4 * 60_000);

    fetch(url)
      .then(async (res) => {
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop()!;

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const evt = JSON.parse(line.slice(5));
              if (evt.type === "done" && !settled) {
                settled = true;
                clearTimeout(timeout);
                resolve(evt.analysisId);
              } else if (evt.type === "error" && !settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(evt.message ?? "Job error"));
              }
              if (settled) { reader.cancel(); return; }
            } catch {}
          }
        }
        if (!settled) reject(new Error(`Stream ended without done for ${label}`));
      })
      .catch(reject);
  });
}

interface AnalysisRow {
  overallScore: number;
  pacingScore: number;
  visualHookScore: number;
  captionReadabilityScore: number;
  viralityScore: number;
  trendScore: number;
  niche: string;
  summary: string;
}

async function fetchAnalysis(id: string): Promise<AnalysisRow> {
  const res = await fetch(`${API_BASE}/videos/${id}`);
  if (!res.ok) throw new Error(`Fetch analysis ${id} failed: ${res.status}`);
  const j = await res.json() as AnalysisRow;
  return j;
}

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function scoreColor(s: number): string {
  if (s >= 70) return "\x1b[32m"; // green
  if (s >= 45) return "\x1b[33m"; // yellow
  return "\x1b[31m";              // red
}
const RESET = "\x1b[0m";

// ─── video generators ─────────────────────────────────────────────────────────

type VideoSpec = { label: string; type: "failure" | "viral"; cmd: string[][] };

function makeVideos(dir: string): VideoSpec[] {
  const f = (label: string, filters: string) => {
    const path = join(dir, `${label}.mp4`);
    return [
      "-f", "lavfi",
      "-i", `color=black:size=1080x1920:rate=30:duration=25`,
      "-f", "lavfi",
      "-i", "anullsrc=r=44100:cl=mono",
      "-vf", filters,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-c:a", "aac",
      "-t", "25",
      "-pix_fmt", "yuv420p",
      path,
    ];
  };

  const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  const hasFonts = existsSync(font);
  const fontStr = hasFonts ? `fontfile=${font}:` : "";

  return [
    // ────────── FAILURE VIDEOS ──────────────────────────────────────────────
    {
      label: "fail_01_static_black_no_audio",
      type: "failure",
      cmd: [
        "-f", "lavfi", "-i", "color=c=black:size=1080x1920:rate=30:duration=25",
        "-vf", "format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast",
        "-an",
        join(dir, "fail_01_static_black_no_audio.mp4"),
      ],
    },
    {
      label: "fail_02_dark_gray_static",
      type: "failure",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#1a1a1a:size=1080x1920:rate=30:duration=25",
        "-vf", "format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "fail_02_dark_gray_static.mp4"),
      ],
    },
    {
      label: "fail_03_slow_dim_pan",
      type: "failure",
      cmd: [
        "-f", "lavfi",
        "-i", "color=c=#2a2a2a:size=1080x1920:rate=30:duration=30",
        "-vf", "zoompan=z='1.0':x='iw/2':y='ih/2-(ih/zoom/2)':d=900:fps=30,format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-an", "-t", "30",
        join(dir, "fail_03_slow_dim_pan.mp4"),
      ],
    },
    {
      label: "fail_04_white_corporate_slide",
      type: "failure",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#f0f0f0:size=1080x1920:rate=30:duration=25",
        "-vf", "format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "fail_04_white_corporate_slide.mp4"),
      ],
    },
    {
      label: "fail_05_overexposed_washed_out",
      type: "failure",
      cmd: [
        "-f", "lavfi", "-i", "color=c=white:size=1080x1920:rate=30:duration=25",
        "-vf", "format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "fail_05_overexposed_washed_out.mp4"),
      ],
    },
    {
      label: "fail_06_muted_blue_static",
      type: "failure",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#1c2a40:size=1080x1920:rate=30:duration=25",
        "-vf", "format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "fail_06_muted_blue_static.mp4"),
      ],
    },
    {
      label: "fail_07_barely_visible_text",
      type: "failure",
      cmd: f(
        "fail_07_barely_visible_text",
        `drawtext=${fontStr}text='presentation.pptx':fontcolor=#333333:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2,format=yuv420p`,
      ),
    },
    {
      label: "fail_08_single_angle_talking",
      type: "failure",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#3a2e2e:size=1080x1920:rate=30:duration=20",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-vf", "format=yuv420p",
        "-c:v", "libx264", "-c:a", "aac", "-preset", "ultrafast", "-t", "20",
        join(dir, "fail_08_single_angle_talking.mp4"),
      ],
    },
    {
      label: "fail_09_dark_no_motion_silence",
      type: "failure",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#111111:size=1080x1920:rate=30:duration=30",
        "-vf", "noise=alls=8:allf=t,format=yuv420p",
        "-c:v", "libx264", "-preset", "ultrafast", "-an", "-t", "30",
        join(dir, "fail_09_dark_no_motion_silence.mp4"),
      ],
    },
    {
      label: "fail_10_logo_reveal_slow",
      type: "failure",
      cmd: f(
        "fail_10_logo_reveal_slow",
        `fade=in:0:75,drawtext=${fontStr}text='BRAND':fontcolor=gray:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2,format=yuv420p`,
      ),
    },

    // ────────── VIRAL VIDEOS ────────────────────────────────────────────────
    {
      label: "viral_01_hook_first_bold_text",
      type: "viral",
      cmd: [
        "-f", "lavfi",
        "-i", `color=c=#ff2d55:size=1080x1920:rate=30:duration=3[c1];color=c=#0a0a0a:size=1080x1920:rate=30:duration=22[c2];[c1][c2]concat=n=2:v=1:a=0`,
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='POV\\: You did this wrong':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h*0.15):box=1:boxcolor=black@0.6:boxborderw=12:enable='between(t,0,3)',drawtext=${fontStr}text='WAIT FOR IT...':fontcolor=#ffcc00:fontsize=64:x=(w-text_w)/2:y=(h*0.75):enable='between(t,0.5,3)',format=yuv420p[v]`,
        "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-an", "-t", "25",
        join(dir, "viral_01_hook_first_bold_text.mp4"),
      ],
    },
    {
      label: "viral_02_fast_cuts_5colors",
      type: "viral",
      cmd: [
        "-f", "lavfi",
        "-i", "color=c=#ff2d55:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi",
        "-i", "color=c=#0a84ff:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi",
        "-i", "color=c=#30d158:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi",
        "-i", "color=c=#ff9f0a:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi",
        "-i", "color=c=#bf5af2:size=1080x1920:rate=30:duration=5",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='5 THINGS you MUST know':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=h*0.1:box=1:boxcolor=black@0.5:boxborderw=10[v0];[1:v]drawtext=${fontStr}text='#1 Start here':fontcolor=white:fontsize=88:x=(w-text_w)/2:y=h*0.45[v1];[2:v]drawtext=${fontStr}text='#2 This is KEY':fontcolor=white:fontsize=88:x=(w-text_w)/2:y=h*0.45[v2];[3:v]drawtext=${fontStr}text='#3 Most people skip this':fontcolor=black:fontsize=72:x=(w-text_w)/2:y=h*0.45[v3];[4:v]drawtext=${fontStr}text='Save this for later!':fontcolor=white:fontsize=88:x=(w-text_w)/2:y=h*0.45[v4];[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,format=yuv420p[out]`,
        "-map", "[out]", "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "viral_02_fast_cuts_5colors.mp4"),
      ],
    },
    {
      label: "viral_03_tutorial_step_captions",
      type: "viral",
      cmd: [
        "-f", "lavfi",
        "-i", "color=c=#1c1c1e:size=1080x1920:rate=30:duration=25",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='How to go viral in 2025':fontcolor=#ff9f0a:fontsize=72:x=(w-text_w)/2:y=h*0.08:enable='between(t,0,5)',drawtext=${fontStr}text='Step 1\\: Hook in 1 second':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=h*0.20:enable='between(t,0,5)',drawtext=${fontStr}text='Step 2\\: Pattern interrupt':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=h*0.30:enable='between(t,5,10)',drawtext=${fontStr}text='Step 3\\: Caption every word':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=h*0.40:enable='between(t,10,15)',drawtext=${fontStr}text='Step 4\\: CTA at the end':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=h*0.50:enable='between(t,15,20)',drawtext=${fontStr}text='Save & Follow for Part 2!':fontcolor=#ff2d55:fontsize=72:x=(w-text_w)/2:y=h*0.85:enable='between(t,20,25)',format=yuv420p[v]`,
        "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-c:a", "aac",
        "-preset", "ultrafast", "-t", "25",
        join(dir, "viral_03_tutorial_step_captions.mp4"),
      ],
    },
    {
      label: "viral_04_pattern_interrupt_flash",
      type: "viral",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#ff2d55:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#ffffff:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#0a0a0a:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#ff9f0a:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#30d158:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#0a84ff:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#bf5af2:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#ff2d55:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#ff9f0a:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#ffffff:size=1080x1920:rate=30:duration=1",
        "-f", "lavfi", "-i", "color=c=#0a0a0a:size=1080x1920:rate=30:duration=15",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='STOP':fontcolor=white:fontsize=160:x=(w-text_w)/2:y=(h-text_h)/2[v0];[1:v]drawtext=${fontStr}text='scrolling':fontcolor=black:fontsize=120:x=(w-text_w)/2:y=(h-text_h)/2[v1];[2:v]drawtext=${fontStr}text='YOU':fontcolor=#ff2d55:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2[v2];[3:v]drawtext=${fontStr}text='NEED':fontcolor=black:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2[v3];[4:v]drawtext=${fontStr}text='TO':fontcolor=white:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2[v4];[5:v]drawtext=${fontStr}text='SEE':fontcolor=white:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2[v5];[6:v]drawtext=${fontStr}text='THIS':fontcolor=white:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2[v6];[7:v]drawtext=${fontStr}text='right now':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2[v7];[8:v]drawtext=${fontStr}text='trust me':fontcolor=black:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2[v8];[9:v]drawtext=${fontStr}text='lets go':fontcolor=black:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2[v9];[10:v]drawtext=${fontStr}text='Here is what nobody tells you...':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=h*0.45[v10];[v0][v1][v2][v3][v4][v5][v6][v7][v8][v9][v10]concat=n=11:v=1:a=0,format=yuv420p[out]`,
        "-map", "[out]", "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "viral_04_pattern_interrupt_flash.mp4"),
      ],
    },
    {
      label: "viral_05_neon_captions_bright",
      type: "viral",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#0a0a0a:size=1080x1920:rate=30:duration=20",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='this':fontcolor=#ff2d55:fontsize=140:x=(w-text_w)/2:y=h*0.35:enable='between(t,0,1.2)',drawtext=${fontStr}text='video':fontcolor=#ff9f0a:fontsize=140:x=(w-text_w)/2:y=h*0.35:enable='between(t,1.2,2.4)',drawtext=${fontStr}text='changed':fontcolor=#30d158:fontsize=140:x=(w-text_w)/2:y=h*0.35:enable='between(t,2.4,3.6)',drawtext=${fontStr}text='my life':fontcolor=#0a84ff:fontsize=140:x=(w-text_w)/2:y=h*0.35:enable='between(t,3.6,5)',drawtext=${fontStr}text='no joke':fontcolor=#bf5af2:fontsize=100:x=(w-text_w)/2:y=h*0.55:enable='between(t,5,7)',drawtext=${fontStr}text='watch till end':fontcolor=#ffcc00:fontsize=80:x=(w-text_w)/2:y=h*0.80:enable='between(t,7,20)',format=yuv420p[v]`,
        "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-c:a", "aac",
        "-preset", "ultrafast", "-t", "20",
        join(dir, "viral_05_neon_captions_bright.mp4"),
      ],
    },
    {
      label: "viral_06_before_after_transformation",
      type: "viral",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#1c1c1e:size=1080x1920:rate=30:duration=12",
        "-f", "lavfi", "-i", "color=c=#30d158:size=1080x1920:rate=30:duration=13",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='BEFORE':fontcolor=#ff2d55:fontsize=120:x=(w-text_w)/2:y=h*0.10,drawtext=${fontStr}text='struggling every day':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=h*0.35,drawtext=${fontStr}text='no results':fontcolor=#ff9f0a:fontsize=72:x=(w-text_w)/2:y=h*0.50[v0];[1:v]drawtext=${fontStr}text='AFTER':fontcolor=#30d158:fontsize=120:x=(w-text_w)/2:y=h*0.10,drawtext=${fontStr}text='completely transformed':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=h*0.35,drawtext=${fontStr}text='$47k in 30 days':fontcolor=#ffcc00:fontsize=72:x=(w-text_w)/2:y=h*0.50[v1];[v0][v1]concat=n=2:v=1:a=0,format=yuv420p[out]`,
        "-map", "[out]", "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "viral_06_before_after_transformation.mp4"),
      ],
    },
    {
      label: "viral_07_zoompan_dynamic",
      type: "viral",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#bf5af2:size=1080x1920:rate=30:duration=20",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-filter_complex",
        `[0:v]zoompan=z='if(lte(mod(t\\,4)\\,2)\\,1+0.3*(mod(t\\,2)/2)\\,1.3-0.3*(mod(t\\,2)/2))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,drawtext=${fontStr}text='The secret nobody shares':fontcolor=white:fontsize=68:x=(w-text_w)/2:y=h*0.12:box=1:boxcolor=black@0.5:boxborderw=8,drawtext=${fontStr}text='watch this NOW':fontcolor=#ffcc00:fontsize=80:x=(w-text_w)/2:y=h*0.80:enable='between(t,5,20)',format=yuv420p[v]`,
        "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-c:a", "aac",
        "-preset", "ultrafast", "-t", "20",
        join(dir, "viral_07_zoompan_dynamic.mp4"),
      ],
    },
    {
      label: "viral_08_storytelling_text",
      type: "viral",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#1c2a40:size=1080x1920:rate=30:duration=25",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='I was broke 6 months ago':fontcolor=white:fontsize=68:x=(w-text_w)/2:y=h*0.15:enable='between(t,0,4)',drawtext=${fontStr}text='Then I found this method':fontcolor=#ffcc00:fontsize=68:x=(w-text_w)/2:y=h*0.15:enable='between(t,4,8)',drawtext=${fontStr}text='Nobody talks about it':fontcolor=#ff2d55:fontsize=68:x=(w-text_w)/2:y=h*0.15:enable='between(t,8,12)',drawtext=${fontStr}text='Here is exactly what I did':fontcolor=#30d158:fontsize=68:x=(w-text_w)/2:y=h*0.15:enable='between(t,12,16)',drawtext=${fontStr}text='Step by step':fontcolor=white:fontsize=68:x=(w-text_w)/2:y=h*0.15:enable='between(t,16,20)',drawtext=${fontStr}text='Follow for part 2':fontcolor=#ff9f0a:fontsize=80:x=(w-text_w)/2:y=h*0.80:enable='between(t,20,25)',format=yuv420p[v]`,
        "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-c:a", "aac",
        "-preset", "ultrafast", "-t", "25",
        join(dir, "viral_08_storytelling_text.mp4"),
      ],
    },
    {
      label: "viral_09_reaction_energy",
      type: "viral",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#ff9f0a:size=1080x1920:rate=30:duration=2",
        "-f", "lavfi", "-i", "color=c=#0a0a0a:size=1080x1920:rate=30:duration=2",
        "-f", "lavfi", "-i", "color=c=#ff2d55:size=1080x1920:rate=30:duration=2",
        "-f", "lavfi", "-i", "color=c=#0a84ff:size=1080x1920:rate=30:duration=2",
        "-f", "lavfi", "-i", "color=c=#30d158:size=1080x1920:rate=30:duration=2",
        "-f", "lavfi", "-i", "color=c=#ff9f0a:size=1080x1920:rate=30:duration=16",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='NO WAY':fontcolor=black:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2[v0];[1:v]drawtext=${fontStr}text='wait':fontcolor=white:fontsize=120:x=(w-text_w)/2:y=(h-text_h)/2[v1];[2:v]drawtext=${fontStr}text='WHAT':fontcolor=white:fontsize=180:x=(w-text_w)/2:y=(h-text_h)/2[v2];[3:v]drawtext=${fontStr}text='literally':fontcolor=white:fontsize=100:x=(w-text_w)/2:y=(h-text_h)/2[v3];[4:v]drawtext=${fontStr}text='insane':fontcolor=white:fontsize=140:x=(w-text_w)/2:y=(h-text_h)/2[v4];[5:v]drawtext=${fontStr}text='This actually works':fontcolor=black:fontsize=80:x=(w-text_w)/2:y=h*0.3,drawtext=${fontStr}text='Part 2 drops tomorrow':fontcolor=black:fontsize=64:x=(w-text_w)/2:y=h*0.75:enable='between(t,8,16)'[v5];[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0,format=yuv420p[out]`,
        "-map", "[out]", "-c:v", "libx264", "-preset", "ultrafast", "-an",
        join(dir, "viral_09_reaction_energy.mp4"),
      ],
    },
    {
      label: "viral_10_trending_grwm_format",
      type: "viral",
      cmd: [
        "-f", "lavfi", "-i", "color=c=#ffb3c6:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi", "-i", "color=c=#ffd6a5:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi", "-i", "color=c=#caffbf:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi", "-i", "color=c=#9bf6ff:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi", "-i", "color=c=#a0c4ff:size=1080x1920:rate=30:duration=5",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-filter_complex",
        `[0:v]drawtext=${fontStr}text='GRWM':fontcolor=#ff2d55:fontsize=140:x=(w-text_w)/2:y=h*0.10,drawtext=${fontStr}text='get ready with me':fontcolor=#333333:fontsize=60:x=(w-text_w)/2:y=h*0.30[v0];[1:v]drawtext=${fontStr}text='morning routine 2025':fontcolor=#333333:fontsize=64:x=(w-text_w)/2:y=h*0.20[v1];[2:v]drawtext=${fontStr}text='aesthetic lifestyle':fontcolor=#333333:fontsize=64:x=(w-text_w)/2:y=h*0.20[v2];[3:v]drawtext=${fontStr}text='that girl era':fontcolor=#0a84ff:fontsize=80:x=(w-text_w)/2:y=h*0.45[v3];[4:v]drawtext=${fontStr}text='follow for daily inspo!':fontcolor=#ff2d55:fontsize=72:x=(w-text_w)/2:y=h*0.45[v4];[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,map=0,format=yuv420p[vout]`,
        "-map", "[vout]", "-map", "5:a", "-c:v", "libx264", "-c:a", "aac",
        "-preset", "ultrafast", "-t", "25",
        join(dir, "viral_10_trending_grwm_format.mp4"),
      ],
    },
  ];
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n\x1b[1m═══════════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1m   ClipRank — 20-Video Scoring Test Suite\x1b[0m");
  console.log("\x1b[1m═══════════════════════════════════════════════════════\x1b[0m\n");

  mkdirSync(WORK_DIR, { recursive: true });

  const specs = makeVideos(WORK_DIR);

  // ── Step 1: Generate all videos ──────────────────────────────────────────
  console.log("📹 Generating 20 synthetic test videos...");
  const genErrors: string[] = [];
  for (const spec of specs) {
    process.stdout.write(`  • ${spec.label}... `);
    try {
      ffmpeg(spec.cmd);
      console.log("✓");
    } catch (e: any) {
      console.log(`✗ ${e.message.split("\n")[0]}`);
      genErrors.push(spec.label);
    }
  }
  if (genErrors.length) {
    console.warn(`\n⚠ ${genErrors.length} videos failed to generate, they will be skipped.\n`);
  }

  const toTest = specs.filter((s) => {
    const p = join(WORK_DIR, `${s.label}.mp4`);
    return existsSync(p);
  });

  // ── Step 2: Upload & analyze (sequentially to avoid hammering OpenAI) ────
  console.log(`\n🔬 Analyzing ${toTest.length} videos (this will take a few minutes)...\n`);

  type Result = {
    label: string;
    type: "failure" | "viral";
    scores?: {
      overall: number; pacing: number; hook: number;
      captions: number; virality: number; trend: number;
    };
    niche?: string;
    summary?: string;
    error?: string;
  };

  const results: Result[] = [];

  for (const [i, spec] of toTest.entries()) {
    const prefix = spec.type === "viral" ? "\x1b[32m[VIRAL]\x1b[0m  " : "\x1b[31m[FAIL] \x1b[0m  ";
    process.stdout.write(`  ${prefix}${String(i + 1).padStart(2, "0")}/20 ${spec.label}... `);
    const filePath = join(WORK_DIR, `${spec.label}.mp4`);

    try {
      const analysisId = await uploadVideo(filePath, spec.label);
      const data = await fetchAnalysis(analysisId);
      results.push({
        label: spec.label,
        type: spec.type,
        scores: {
          overall: data.overallScore,
          pacing: data.pacingScore,
          hook: data.visualHookScore,
          captions: data.captionReadabilityScore,
          virality: data.viralityScore,
          trend: data.trendScore,
        },
        niche: data.niche,
        summary: data.summary,
      });
      console.log(`\x1b[32m✓ overall=${Math.round(data.overallScore)}\x1b[0m`);
    } catch (err: any) {
      results.push({ label: spec.label, type: spec.type, error: err.message });
      console.log(`\x1b[31m✗ ${err.message.slice(0, 80)}\x1b[0m`);
    }
  }

  // ── Step 3: Comparison table ─────────────────────────────────────────────
  console.log("\n\n\x1b[1m═══════════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1m   RESULTS COMPARISON\x1b[0m");
  console.log("\x1b[1m═══════════════════════════════════════════════════════\x1b[0m");

  const header = [
    "Type".padEnd(8),
    "Video".padEnd(42),
    "OVRL".padEnd(5),
    "PACE".padEnd(5),
    "HOOK".padEnd(5),
    "CAPT".padEnd(5),
    "VIRL".padEnd(5),
    "TRND".padEnd(5),
  ].join(" | ");
  console.log("\n" + header);
  console.log("─".repeat(header.length));

  const virals = results.filter((r) => r.type === "viral" && r.scores);
  const fails = results.filter((r) => r.type === "failure" && r.scores);
  const errors = results.filter((r) => r.error);

  for (const r of [...virals, ...fails]) {
    if (!r.scores) continue;
    const s = r.scores;
    const type = r.type === "viral"
      ? "\x1b[32mVIRAL\x1b[0m  "
      : "\x1b[31mFAIL \x1b[0m  ";
    const fmt = (v: number) => `${scoreColor(v)}${Math.round(v).toString().padStart(3)}\x1b[0m  `;
    const short = r.label.replace(/^(viral|fail)_\d+_/, "").slice(0, 40).padEnd(40);
    console.log([type, short, fmt(s.overall), fmt(s.pacing), fmt(s.hook), fmt(s.captions), fmt(s.virality), fmt(s.trend)].join(" | "));
  }

  // ── Averages ──────────────────────────────────────────────────────────────
  if (virals.length && fails.length) {
    const avg = (arr: Result[], key: keyof NonNullable<Result["scores"]>) =>
      Math.round(arr.reduce((a, r) => a + (r.scores?.[key] ?? 0), 0) / arr.length);

    console.log("\n" + "─".repeat(header.length));
    const va = virals, fa = fails;
    console.log(
      "\x1b[32mVIRAL avg\x1b[0m".padEnd(52) + " | " +
      [avg(va,"overall"), avg(va,"pacing"), avg(va,"hook"), avg(va,"captions"), avg(va,"virality"), avg(va,"trend")]
        .map((v) => `${scoreColor(v)}${v.toString().padStart(3)}\x1b[0m  `).join(" | ")
    );
    console.log(
      "\x1b[31mFAIL  avg\x1b[0m".padEnd(52) + " | " +
      [avg(fa,"overall"), avg(fa,"pacing"), avg(fa,"hook"), avg(fa,"captions"), avg(fa,"virality"), avg(fa,"trend")]
        .map((v) => `${scoreColor(v)}${v.toString().padStart(3)}\x1b[0m  `).join(" | ")
    );

    const sep = avg(va, "overall") - avg(fa, "overall");
    console.log(`\n\x1b[1mOverall score gap (viral avg − failure avg): ${sep > 0 ? "+" : ""}${sep} pts\x1b[0m`);
  }

  if (errors.length) {
    console.log(`\n⚠  ${errors.length} video(s) errored:`);
    errors.forEach((r) => console.log(`  • ${r.label}: ${r.error}`));
  }

  // ── Niche breakdown ───────────────────────────────────────────────────────
  console.log("\n\x1b[1m── Niche Detection ─────────────────────────────────────\x1b[0m");
  for (const r of results.filter((r) => r.scores)) {
    const tag = r.type === "viral" ? "\x1b[32m●\x1b[0m" : "\x1b[31m●\x1b[0m";
    console.log(`  ${tag} ${r.label.replace(/^(viral|fail)_\d+_/, "").padEnd(38)} → ${r.niche ?? "unknown"}`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  try { rmSync(WORK_DIR, { recursive: true, force: true }); } catch {}

  console.log("\n\x1b[1m═══════════════════════════════════════════════════════\x1b[0m\n");
  console.log("✅ Test complete.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
