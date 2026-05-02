import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Upload, Cpu, BarChart3, Lock, Zap, Film, Clock, CreditCard } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LearnMorePage() {
  const [, nav] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => nav("/")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} className="w-6 h-6" alt="ClipRank" />
            <span className="font-semibold text-white tracking-tight">ClipRank</span>
          </div>
          <button
            onClick={() => nav("/sign-up")}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Get started free
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Documentation</p>
          <h1 className="text-5xl font-bold tracking-tight mb-4">How ClipRank works</h1>
          <p className="text-lg text-zinc-400 leading-relaxed mb-16">
            ClipRank combines client-side video processing with multimodal AI to give creators a clear, actionable report card on every video before it goes live.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-16">
          {[
            {
              icon: <Upload className="w-6 h-6 text-indigo-400" />,
              step: "Step 1",
              title: "Upload your video",
              body: "Drop any MP4, MOV, AVI, or WebM file onto the upload zone. ClipRank accepts videos of any length — your credit balance determines how many seconds you can process (1 credit = 10 seconds).",
              detail: "Your file is processed entirely in your browser using ffmpeg-wasm — a WebAssembly port of the industry-standard ffmpeg tool. This means your raw video never leaves your device.",
            },
            {
              icon: <Film className="w-6 h-6 text-indigo-400" />,
              step: "Step 2",
              title: "Adaptive frame extraction",
              body: "ClipRank automatically selects the right sampling strategy based on your video's length:",
              bullets: [
                "Short clips (≤ 30 seconds): 1 frame every 60 video-frames for fine-grained detail",
                "Longer clips (> 30 seconds): 1 frame every 3 seconds to optimize AI token cost without losing quality",
                "Maximum of 20 frames sent per analysis to keep results fast",
              ],
              detail: "Frames are extracted as compressed JPEG thumbnails at 320px width — enough detail for AI vision analysis, small enough to transmit quickly.",
            },
            {
              icon: <Cpu className="w-6 h-6 text-indigo-400" />,
              step: "Step 3",
              title: "Multimodal AI analysis",
              body: "Extracted frames are sent to GPT-4 vision along with your video's metadata. Our carefully crafted system prompt instructs the AI to evaluate three core creator metrics simultaneously:",
              bullets: [
                "Pacing — Are cuts well-timed? Is there rhythm and momentum? Are there dead zones?",
                "Visual Hook — Are the first 3 seconds compelling? Is there strong motion, contrast, and visual interest?",
                "Caption Readability — Are text overlays readable? Good contrast, right size, appropriate timing?",
              ],
              detail: "Results are edge-cached by a SHA-256 fingerprint of your video. Uploading the same clip again returns instantly and costs no credits.",
            },
            {
              icon: <BarChart3 className="w-6 h-6 text-indigo-400" />,
              step: "Step 4",
              title: "Your score report",
              body: "Every analysis returns a full score report with:",
              bullets: [
                "An overall score (0–100) — weighted average of all three metrics",
                "Individual scores for Pacing, Visual Hook, and Caption Readability",
                "A 1–2 sentence summary of the video's overall quality",
                "Specific, actionable feedback for each metric",
              ],
            },
            {
              icon: <Lock className="w-6 h-6 text-indigo-400" />,
              step: "Premium",
              title: "Professional advice & visual heatmap",
              body: "Unlock the full analysis for any video with a one-time $10 payment. You get:",
              bullets: [
                "3–4 paragraph professional editing advice with timestamp-level suggestions",
                "B-roll recommendations and music guidance",
                "Platform-specific optimization tips (TikTok, Instagram Reels, YouTube Shorts)",
                "A visual attention heatmap showing which frames are high, medium, and low attention",
              ],
            },
          ].map((section, i) => (
            <motion.div
              key={section.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  {section.icon}
                </div>
                <div>
                  <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">{section.step}</p>
                  <h2 className="text-xl font-bold text-white">{section.title}</h2>
                </div>
              </div>
              <div className="pl-13 ml-13 border-l border-white/[0.06] pl-8 ml-5 space-y-4">
                <p className="text-zinc-400 leading-relaxed">{section.body}</p>
                {section.bullets && (
                  <ul className="space-y-2">
                    {section.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-zinc-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {section.detail && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-sm text-zinc-500 leading-relaxed">
                    {section.detail}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Credit system */}
        <div className="mt-20 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold">The credit system</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { icon: <Zap className="w-4 h-4" />, title: "1 credit = 10 seconds", desc: "A 60-second video costs 6 credits to analyze" },
              { icon: <Clock className="w-4 h-4" />, title: "Credits never expire", desc: "Buy once, use whenever. No subscription required" },
              { icon: <Film className="w-4 h-4" />, title: "Cache hits are free", desc: "Re-analyzing the same video costs zero credits" },
            ].map((c) => (
              <div key={c.title} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-indigo-400 mb-2">{c.icon}<p className="text-sm font-semibold text-white">{c.title}</p></div>
                <p className="text-xs text-zinc-500">{c.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => nav("/pricing")}
              className="px-4 py-2 rounded-lg border border-white/10 text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
            >
              View pricing
            </button>
            <button
              onClick={() => nav("/sign-up")}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors"
            >
              Start with 3 free credits
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
