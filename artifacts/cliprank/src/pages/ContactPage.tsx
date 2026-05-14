import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Check, Zap } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ContactPage() {
  usePageTitle("Contact Us");
  const [, nav] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setStatus("sent");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => nav("/")} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} className="w-6 h-6" alt="ClipRank" />
            <span className="font-semibold">ClipRank</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-3">Get in touch</h1>
            <p className="text-zinc-400 text-lg">Have a question, issue, or partnership inquiry? We read every message.</p>
          </div>

          {status === "sent" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-10 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Message sent!</h2>
              <p className="text-zinc-400 mb-6">We'll get back to you within 24 hours.</p>
              <button onClick={() => nav("/")} className="px-6 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-sm font-medium transition-colors">
                Back to home
              </button>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Name</label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Message</label>
                <textarea
                  required
                  rows={6}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="How can we help?"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
              {status === "error" && (
                <p className="text-red-400 text-sm">Something went wrong. Please try again or email us directly.</p>
              )}
              <button
                type="submit"
                disabled={status === "sending"}
                className="flex items-center gap-2 px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 font-semibold text-sm transition-colors w-full justify-center"
              >
                {status === "sending" ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}

          <div className="mt-12 pt-8 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-1">Email</h3>
              <p className="text-sm text-zinc-400">support@cliprankai.com</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1">Response time</h3>
              <p className="text-sm text-zinc-400">Within 24 hours on business days</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
