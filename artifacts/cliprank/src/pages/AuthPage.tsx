import { useState } from "react";
import { useSignIn, useSignUp, useAuth } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Mail, ShieldCheck, BarChart3, Film, Clock, Zap } from "lucide-react";
import { Redirect } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type FlowMode = "email" | "verify";
type AuthMethod = "signIn" | "signUp";

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
  const { isLoaded, isSignedIn } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signInHook = useSignIn() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signUpHook = useSignUp() as any;

  const [mode, setMode] = useState<FlowMode>("email");
  const [method, setMethod] = useState<AuthMethod>("signIn");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (isLoaded && isSignedIn) return <Redirect to="/app" />;

  const signIn = signInHook.signIn;
  const setSignInActive = signInHook.setActive;
  const signUp = signUpHook.signUp;
  const setSignUpActive = signUpHook.setActive;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || !signUp) return;
    setLoading(true);
    setErrorMsg("");

    try {
      // Try sign-in with email code first
      const result = await signIn.create({ strategy: "email_code", identifier: email });
      if (result.status === "needs_first_factor") {
        setMethod("signIn");
        setMode("verify");
      }
    } catch (err: any) {
      const errCode = err?.errors?.[0]?.code ?? "";
      if (errCode === "form_identifier_not_found") {
        // User doesn't exist → create account seamlessly
        try {
          await signUp.create({ emailAddress: email });
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setMethod("signUp");
          setMode("verify");
        } catch (suErr: any) {
          setErrorMsg(suErr?.errors?.[0]?.longMessage ?? "Could not create account. Please try again.");
        }
      } else {
        setErrorMsg(err?.errors?.[0]?.longMessage ?? "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || !signUp) return;
    setLoading(true);
    setErrorMsg("");

    try {
      if (method === "signIn") {
        const result = await signIn.attemptFirstFactor({ strategy: "email_code", code });
        if (result.status === "complete") {
          await setSignInActive({ session: result.createdSessionId });
        }
      } else {
        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === "complete") {
          await setSignUpActive({ session: result.createdSessionId });
        }
      }
    } catch (err: any) {
      const clerkCode = err?.errors?.[0]?.code ?? "";
      if (clerkCode === "form_code_incorrect") {
        setErrorMsg("Incorrect code. Check your email and try again.");
      } else {
        setErrorMsg(err?.errors?.[0]?.longMessage ?? "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
  };

  const handleOAuth = async (provider: string) => {
    if (!signIn) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy: `oauth_${provider}` as any,
        redirectUrl: `${window.location.origin}${basePath}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${basePath}/app`,
      });
    } catch {
      setErrorMsg("OAuth failed. Please use email instead.");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Left panel */}
      <div className="w-full lg:w-[460px] flex-shrink-0 flex flex-col items-center justify-center px-8 py-12 min-h-screen">
        <div className="w-full max-w-[380px]">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <img src={`${basePath}/logo.svg`} className="w-8 h-8" alt="ClipRank" />
            <span className="font-semibold text-lg text-white tracking-tight">ClipRank</span>
          </div>

          <AnimatePresence mode="wait">
            {mode === "email" ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-2xl font-bold text-white mb-1">Get started</h1>
                <p className="text-sm text-zinc-500 mb-8">
                  Enter your email — we'll sign you in or create your account automatically.
                </p>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5 font-medium">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#18181b] border border-white/10 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Continue <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-zinc-600">or continue with</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { name: "Google", logo: "https://www.svgrepo.com/show/475656/google-color.svg", provider: "google" },
                    { name: "GitHub", logo: "https://www.svgrepo.com/show/512317/github-142.svg", provider: "github" },
                  ].map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleOAuth(p.provider)}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-colors"
                    >
                      <img src={p.logo} className="w-4 h-4" alt={p.name} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Check your email</h1>
                <p className="text-sm text-zinc-500 mb-1">We sent a 6-digit code to</p>
                <p className="text-sm font-semibold text-white mb-8">{email}</p>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-1.5 font-medium">Verification code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={code}
                      onChange={handleCodeChange}
                      placeholder="000000"
                      required
                      autoFocus
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl bg-[#18181b] border border-white/10 text-white text-center text-2xl font-mono tracking-[0.4em] placeholder:text-zinc-700 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    />
                  </div>

                  {errorMsg && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || code.length < 6}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & continue"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => { setMode("email"); setCode(""); setErrorMsg(""); }}
                  className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  ← Use a different email
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-8 text-center text-xs text-zinc-600">
            By continuing, you agree to our{" "}
            <a href="#" className="underline hover:text-zinc-400 transition-colors">Terms</a>
            {" "}and{" "}
            <a href="#" className="underline hover:text-zinc-400 transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>

      <AuthShowcase />
    </div>
  );
}
