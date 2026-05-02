import { SignIn } from "@clerk/react";
import { motion } from "framer-motion";
import { BarChart3, Film, Clock, Zap } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthShowcase() {
  const metrics = [
    { label: "Pacing", value: 87, color: "#34d399" },
    { label: "Visual Hook", value: 74, color: "#6366f1" },
    { label: "Captions", value: 91, color: "#a78bfa" },
  ];
  return (
    <div className="relative flex-1 hidden lg:flex flex-col justify-between overflow-hidden bg-[#070707] p-12">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(99,102,241,0.18) 0%, transparent 70%)" }}
      />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-zinc-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI-powered video intelligence
        </div>
        <h2 className="text-4xl font-bold text-white leading-tight tracking-tight max-w-xs">
          Rank your videos before you post.
        </h2>
        <p className="mt-4 text-zinc-500 text-sm leading-relaxed max-w-sm">
          ClipRank analyzes pacing, visual hooks, and captions using AI — giving you a calibrated virality score in seconds.
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="relative z-10"
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 max-w-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">hook_video_v3.mp4</p>
              <p className="text-xs text-zinc-500">45s · 15 frames analyzed</p>
            </div>
            <span className="ml-auto text-2xl font-bold text-indigo-400">82</span>
          </div>
          <div className="space-y-3">
            {metrics.map((m, i) => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">{m.label}</span>
                  <span className="font-mono font-semibold" style={{ color: m.color }}>{m.value}/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: m.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${m.value}%` }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.15, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-4 flex-wrap">
          {[
            { icon: <Film className="w-3 h-3" />, text: "Frame-level AI" },
            { icon: <BarChart3 className="w-3 h-3" />, text: "Virality scored" },
            { icon: <Clock className="w-3 h-3" />, text: "Real-time progress" },
          ].map((s) => (
            <div key={s.text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-xs text-zinc-500">
              {s.icon}{s.text}
            </div>
          ))}
        </div>
      </motion.div>
      <p className="relative z-10 text-xs text-zinc-600">
        3 free credits on signup · No credit card required
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Left panel — Clerk SignIn with routing="path" handles all OAuth + OTP flows */}
      <div className="w-full lg:w-[460px] flex-shrink-0 flex flex-col items-center justify-center px-8 py-12 min-h-screen">
        <div className="w-full max-w-[380px]">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <img src={`${basePath}/logo.svg`} className="w-8 h-8" alt="ClipRank" />
            <span className="font-semibold text-lg text-white tracking-tight">ClipRank</span>
          </div>

          {/* Clerk handles Google, GitHub, email OTP — all OAuth callbacks go to /auth/sso-callback */}
          <SignIn
            routing="path"
            path={`${basePath}/auth`}
            signUpUrl={`${basePath}/auth`}
            fallbackRedirectUrl={`${basePath}/app`}
          />
        </div>
      </div>

      {/* Right panel */}
      <AuthShowcase />
    </div>
  );
}
