import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Zap, BarChart3, Film, Clock, ArrowRight, ChevronRight, Star, Menu, X, Shield } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useUser } from "@clerk/react";
import RequestAccessModal from "@/components/RequestAccessModal";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const ADMIN_USER_ID = "user_3DAainmIJ1RHEdNGbA8rXsNn8Nk";

function NavBar() {
  const [, nav] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_USER_ID;

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={`${basePath}/logo.svg`} className="w-7 h-7" alt="ClipRank" />
          <span className="font-semibold text-white tracking-tight">ClipRank</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <button onClick={() => nav("/learn-more")} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors">Learn More</button>
          <button onClick={() => nav("/pricing")} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors">Pricing</button>
          <button onClick={() => nav("/contact")} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors">Contact</button>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => nav("/admin")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-500/40 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
          <button onClick={() => nav("/auth")} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Sign In</button>
          <button onClick={() => nav("/auth")} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Get started free</button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors" onClick={() => setMenuOpen(v => !v)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0a0a0a] px-4 py-4 flex flex-col gap-1">
          {[
            { label: "Learn More", path: "/learn-more" },
            { label: "Pricing", path: "/pricing" },
            { label: "Contact", path: "/contact" },
          ].map(({ label, path }) => (
            <button key={path} onClick={() => { nav(path); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors">
              {label}
            </button>
          ))}
          <div className="border-t border-white/[0.06] mt-2 pt-2 flex flex-col gap-2">
            <button onClick={() => { nav("/auth"); setMenuOpen(false); }} className="w-full px-4 py-3 text-sm text-zinc-400 hover:text-white text-left rounded-xl hover:bg-white/[0.05] transition-colors">Sign In</button>
            <button onClick={() => { nav("/auth"); setMenuOpen(false); }} className="w-full px-4 py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">Get started free</button>
          </div>
        </div>
      )}
    </header>
  );
}

const features = [
  {
    icon: <Film className="w-5 h-5 text-indigo-400" />,
    title: "Hook-first frame extraction",
    desc: "Server-side ffmpeg samples 5 dense frames in the first 3 seconds for precise hook scoring, then spreads frames evenly across the full video.",
  },
  {
    icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,
    title: "Four-axis AI scoring",
    desc: "Visual Hook, Pacing, Caption Readability, and Virality Probability — each scored 0–100 with calibrated, actionable feedback.",
  },
  {
    icon: <Clock className="w-5 h-5 text-indigo-400" />,
    title: "Real-time progress + caching",
    desc: "Live step-by-step updates as your video is processed. Identical videos return cached results instantly — credits never expire.",
  },
];

const steps = [
  { n: "01", title: "Upload your video", desc: "Drop any MP4, MOV, AVI or WebM clip up to 500 MB. Instant cache hit for re-uploads." },
  { n: "02", title: "AI extracts & analyzes frames", desc: "Frames are sampled adaptively and sent to GPT-4 vision for frame-by-frame analysis." },
  { n: "03", title: "Get actionable scores", desc: "Receive pacing, visual hook, and caption scores with specific feedback you can act on immediately." },
];

export default function LandingPage() {
  const [, nav] = useLocation();
  const { isSignedIn, isLoaded } = useUser();
  const [requestOpen, setRequestOpen] = useState(false);
  usePageTitle("", "AI-powered video analysis for TikTok, Reels & Shorts. Get a calibrated virality score based on real algorithm signals — pacing, hook strength, captions, and more.");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <NavBar />

      {/* Hero */}
      <section className="relative pt-36 pb-20 px-4 sm:px-6 overflow-hidden">
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
            Buy credits to start — or request free access below
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
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
            className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed px-2"
          >
            ClipRank uses multimodal AI to score your pacing, visual hooks, and caption readability — giving you a creator-ready report card in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
          >
            <button
              onClick={() => nav("/auth")}
              className="group w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
            >
              Start analyzing
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => {
                if (isLoaded && isSignedIn) setRequestOpen(true);
                else nav("/auth");
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 font-medium transition-colors"
            >
              Request free access
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>

        {/* Product preview — animated UI teaser, no fake data */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-sm sm:max-w-xl mx-auto mt-16 sm:mt-20"
        >
          {/* Upload zone preview */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-5 sm:p-6 mb-3">
            <div className="border-2 border-dashed border-white/[0.10] rounded-xl px-6 py-8 flex flex-col items-center gap-3 group">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                <Film className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-zinc-300">Drop your video here</p>
              <p className="text-xs text-zinc-600">MP4, MOV, AVI, WebM · 1 credit / 10s</p>
            </div>
          </div>
          {/* Score preview strip */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl px-5 py-4 flex items-center justify-around gap-4">
            {[
              { label: "Overall", color: "text-indigo-400", bar: "bg-indigo-500" },
              { label: "Hook", color: "text-emerald-400", bar: "bg-emerald-500" },
              { label: "Pacing", color: "text-amber-400", bar: "bg-amber-500" },
              { label: "Captions", color: "text-violet-400", bar: "bg-violet-500" },
            ].map((m, i) => (
              <div key={m.label} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${m.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${[78, 65, 82, 71][i]}%` }}
                    transition={{ duration: 1.2, delay: 0.8 + i * 0.12, ease: "easeOut" }}
                  />
                </div>
                <span className="text-xs text-zinc-600">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-zinc-700 mt-3">Sign in to see your real scores</p>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-24 px-4 sm:px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Three steps to better content</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-8">
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
      <section className="py-20 sm:py-24 px-4 sm:px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Built for serious creators</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6 hover:border-indigo-500/30 hover:bg-indigo-500/[0.04] transition-colors">
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
      <section className="py-20 sm:py-24 px-4 sm:px-6 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to rank your content?</h2>
          <p className="text-zinc-400 mb-8 px-2">Buy a credit pack and start analyzing instantly. Or request free access if you're a student or small creator.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => nav("/pricing")}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base sm:text-lg transition-all"
            >
              View pricing
            </button>
            <button
              onClick={() => {
                if (isLoaded && isSignedIn) setRequestOpen(true);
                else nav("/auth");
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 font-semibold text-base sm:text-lg transition-colors"
            >
              Request free access
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
            <div className="flex items-center gap-2">
              <img src={`${basePath}/logo.svg`} className="w-5 h-5" alt="" />
              <span className="text-sm text-zinc-500 font-medium">ClipRank AI</span>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-xs text-zinc-600">
              <button onClick={() => nav("/learn-more")} className="hover:text-zinc-400 transition-colors">Learn More</button>
              <button onClick={() => nav("/pricing")} className="hover:text-zinc-400 transition-colors">Pricing</button>
              <button onClick={() => nav("/contact")} className="hover:text-zinc-400 transition-colors">Contact</button>
              <button onClick={() => nav("/privacy")} className="hover:text-zinc-400 transition-colors">Privacy Policy</button>
              <button onClick={() => nav("/terms")} className="hover:text-zinc-400 transition-colors">Terms of Service</button>
              <button onClick={() => nav("/cookies")} className="hover:text-zinc-400 transition-colors">Cookie Policy</button>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-zinc-700">© 2026 ClipRank AI. All rights reserved.</p>
            <button
              onClick={() => {
                localStorage.removeItem("cliprank_cookie_consent");
                window.location.reload();
              }}
              className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
            >
              Cookie settings
            </button>
          </div>
        </div>
      </footer>

      <RequestAccessModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
