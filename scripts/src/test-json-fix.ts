/**
 * Quick verification: re-test the 4 videos that hit JSON parse errors.
 * These all previously errored with "Bad control character in string literal".
 */

import { spawnSync } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const API_BASE = "http://localhost:80/api";
const ADMIN_USER_ID = "user_3DAainmIJ1RHEdNGbA8rXsNn8Nk";
const WORK_DIR = join(tmpdir(), "cliprank-json-fix-test");

function ffmpeg(args: string[]): void {
  const r = spawnSync("ffmpeg", ["-y", ...args], { stdio: ["ignore","ignore","pipe"], timeout: 60_000 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr?.toString().slice(-200)}`);
}

async function uploadAndWait(filePath: string, label: string): Promise<string> {
  const fs = await import("fs");
  const data = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("video", new Blob([data], { type: "video/mp4" }), `${label}.mp4`);
  form.append("filename", `${label}.mp4`);
  form.append("userId", ADMIN_USER_ID);

  const res = await fetch(`${API_BASE}/videos/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload ${res.status}: ${await res.text()}`);
  const j = await res.json() as { jobId?: string; analysisId?: string };
  if (j.analysisId) return j.analysisId;
  if (!j.jobId) throw new Error("No jobId");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), 4 * 60_000);
    fetch(`${API_BASE}/videos/jobs/${j.jobId}/stream`).then(async (r) => {
      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const e = JSON.parse(line.slice(5));
            if (e.type === "done") { clearTimeout(timeout); reader.cancel(); resolve(e.analysisId); return; }
            if (e.type === "error") { clearTimeout(timeout); reader.cancel(); reject(new Error(e.message)); return; }
          } catch {}
        }
      }
    }).catch(reject);
  });
}

const FONT = "fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:";

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });
  console.log("\n🔁 Verifying JSON parse fix on 4 previously-errored videos...\n");

  const videos = [
    {
      label: "fail_06_muted_blue",
      cmd: ["-f","lavfi","-i","color=c=#1c2a40:size=1080x1920:rate=30:duration=20","-vf","format=yuv420p","-c:v","libx264","-preset","ultrafast","-an",join(WORK_DIR,"fail_06.mp4")],
    },
    {
      label: "fail_10_logo_reveal",
      cmd: ["-f","lavfi","-i","color=black:size=1080x1920:rate=30:duration=20","-vf",`fade=in:0:75,drawtext=${FONT}text='BRAND':fontcolor=gray:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2,format=yuv420p`,"-c:v","libx264","-preset","ultrafast","-an",join(WORK_DIR,"fail_10.mp4")],
    },
    {
      label: "viral_04_flash",
      cmd: [
        "-f","lavfi","-i","color=c=#ff2d55:size=1080x1920:rate=30:duration=2",
        "-f","lavfi","-i","color=c=#ffffff:size=1080x1920:rate=30:duration=2",
        "-f","lavfi","-i","color=c=#0a0a0a:size=1080x1920:rate=30:duration=16",
        "-filter_complex",`[0:v]drawtext=${FONT}text='STOP scrolling':fontcolor=white:fontsize=120:x=(w-text_w)/2:y=(h-text_h)/2[v0];[1:v]drawtext=${FONT}text='YOU NEED THIS':fontcolor=black:fontsize=100:x=(w-text_w)/2:y=(h-text_h)/2[v1];[2:v]drawtext=${FONT}text='Here is what nobody tells you':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=h*0.45[v2];[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[out]`,
        "-map","[out]","-c:v","libx264","-preset","ultrafast","-an",join(WORK_DIR,"viral_04.mp4"),
      ],
    },
    {
      label: "viral_05_neon",
      cmd: [
        "-f","lavfi","-i","color=c=#0a0a0a:size=1080x1920:rate=30:duration=20",
        "-vf",`drawtext=${FONT}text='this changed my life':fontcolor=#ff2d55:fontsize=100:x=(w-text_w)/2:y=h*0.35:enable='between(t,0,3)',drawtext=${FONT}text='watch till end':fontcolor=#ffcc00:fontsize=80:x=(w-text_w)/2:y=h*0.80:enable='between(t,5,20)',format=yuv420p`,
        "-c:v","libx264","-preset","ultrafast","-an",join(WORK_DIR,"viral_05.mp4"),
      ],
    },
  ];

  const filemap: Record<string, string> = {
    fail_06_muted_blue: join(WORK_DIR,"fail_06.mp4"),
    fail_10_logo_reveal: join(WORK_DIR,"fail_10.mp4"),
    viral_04_flash: join(WORK_DIR,"viral_04.mp4"),
    viral_05_neon: join(WORK_DIR,"viral_05.mp4"),
  };

  for (const v of videos) {
    process.stdout.write(`  Generating ${v.label}... `);
    try { ffmpeg(v.cmd); console.log("✓"); } catch (e: any) { console.log(`✗ ${e.message.slice(0,80)}`); }
  }

  console.log("");
  let passed = 0, failed = 0;
  for (const v of videos) {
    const fp = filemap[v.label];
    if (!existsSync(fp)) { console.log(`  ✗ ${v.label} — skipped (no file)`); failed++; continue; }
    process.stdout.write(`  Analyzing ${v.label}... `);
    try {
      const id = await uploadAndWait(fp, v.label);
      const r = await fetch(`${API_BASE}/videos/${id}`);
      const d = await r.json() as { overallScore: number; viralityScore: number; trendScore: number };
      console.log(`✅ overall=${Math.round(d.overallScore)} virality=${Math.round(d.viralityScore)} trend=${Math.round(d.trendScore)} — JSON parse OK`);
      passed++;
    } catch (e: any) {
      console.log(`❌ ${e.message.slice(0,100)}`);
      failed++;
    }
  }

  try { rmSync(WORK_DIR, { recursive: true, force: true }); } catch {}
  console.log(`\n${passed}/${passed+failed} passed. ${failed === 0 ? "✅ JSON fix confirmed!" : "⚠ Some still failing."}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
