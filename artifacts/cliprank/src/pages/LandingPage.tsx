import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Zap, BarChart3, Film, Clock, ArrowRight, ChevronRight, Star } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function NavBar() {
  const [, nav] = useLocation();
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={`${basePath}/logo.svg`} className="w-7 h-7" alt="ClipRank" />
          <span className="font-semibold text-white tracking-tight">ClipRank</span>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          <button onClick={() => nav("/learn-more")} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors">Learn More</button>
          <button onClick={() => nav("/pricing")} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors">Pricing</button>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav("/sign-in")}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => nav("/sign-up")}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Get started free
          </button>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    icon: <Film className="w-5 h-5 text-indigo-400" />,
    title: "Client-side frame extraction",
    desc: "Video is processed in your browser using ffmpeg-wasm. Nothing is uploaded to our servers raw.",
  },
  {
    icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,
    title: "Three-axis AI scoring",
    desc: "Pacing, Visual Hook strength, and Caption Readability — each scored 0–100 with specific feedback.",
  },
  {
    icon: <Clock className="w-5 h-5 text-indigo-400" />,
    title: "Results in seconds",
    desc: "Edge-cached results mean repeat analyses return instantly. Your credits never expire.",
  },
];

const steps = [
  { n: "01", title: "Upload your video", desc: "Drop any MP4, MOV, AVI or WebM clip. No size limits in your plan." },
  { n: "02", title: "AI extracts & analyzes frames", desc: "Frames are sampled adaptively and sent to GPT-4 vision for frame-by-frame analysis." },
  { n: "03", title: "Get actionable scores", desc: "Receive pacing, visual hook, and caption scores with specific feedback you can act on immediately." },
];

export default function LandingPage() {
  const [, nav] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <NavBar />

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%)" }}
        />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-zinc-400 mb-8"
          >
            <Star className="w-3 h-3 text-indigo-400 fill-indigo-400" />
            3 free credits on signup — no credit card needed
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            Rank your video{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              before you post
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            ClipRank uses multimodal AI to score your pacing, visual hooks, and caption readability — giving you a creator-ready report card in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <button
              onClick={() => nav("/sign-up")}
              className="group flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
            >
              Start analyzing free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => nav("/learn-more")}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 font-medium transition-colors"
            >
              See how it works
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>

        {/* Mock score card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-xl mx-auto mt-20 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-semibold text-white">my_reel_final_v2.mp4</p>
              <p className="text-xs text-zinc-500 mt-0.5">58s · 19 frames analyzed</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-indigo-400">84</p>
              <p className="text-xs text-zinc-500">Overall</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Pacing", v: 87, color: "#34d399" },
              { label: "Visual Hook", v: 76, color: "#6366f1" },
              { label: "Captions", v: 91, color: "#a78bfa" },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-2xl font-bold" style={{ color: m.color }}>{m.v}</p>
                <p className="text-xs text-zinc-500 mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">How it works</p>
            <h2 className="text-4xl font-bold">Three steps to better content</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <p className="text-5xl font-bold text-white/[0.06] font-mono mb-4">{s.n}</p>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Features</p>
            <h2 className="text-4xl font-bold">Built for serious creators</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-indigo-500/30 hover:bg-indigo-500/[0.04] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Ready to rank your content?</h2>
          <p className="text-zinc-400 mb-8">Sign up free and get 3 credits instantly. One credit covers 10 seconds of video.</p>
          <button
            onClick={() => nav("/sign-up")}
            className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all"
          >
            Get started — it's free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} className="w-5 h-5" alt="" />
            <span className="text-sm text-zinc-600 font-medium">ClipRank</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <button onClick={() => nav("/learn-more")} className="hover:text-zinc-400 transition-colors">Learn More</button>
            <button onClick={() => nav("/pricing")} className="hover:text-zinc-400 transition-colors">Pricing</button>
            <button onClick={() => nav("/sign-in")} className="hover:text-zinc-400 transition-colors">Sign In</button>
          </div>
          <p className="text-xs text-zinc-700">© 2026 ClipRank. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
