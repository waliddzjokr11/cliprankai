import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Check } from "lucide-react";
import { useUser } from "@clerk/react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RequestAccessModal({ open, onClose }: Props) {
  const { user } = useUser();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.primaryEmailAddress?.emailAddress, reason }),
      });
      if (res.ok) setStatus("sent");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="relative bg-[#141414] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>

            {status === "sent" ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Request sent!</h2>
                <p className="text-zinc-400 text-sm mb-6">We'll review your request and get back to you at {user?.primaryEmailAddress?.emailAddress}.</p>
                <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-sm font-medium transition-colors">Close</button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-1">Request free access</h2>
                <p className="text-sm text-zinc-400 mb-5">Tell us a bit about yourself and how you'd use ClipRank. We review all requests within 24 hours.</p>
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Your email</label>
                    <input
                      readOnly
                      value={user?.primaryEmailAddress?.emailAddress ?? ""}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-zinc-400 text-sm cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Why do you need free access?</label>
                    <textarea
                      required
                      rows={4}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. I'm a student content creator, small creator just starting out, building for a non-profit..."
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none text-sm"
                    />
                  </div>
                  {status === "error" && <p className="text-red-400 text-sm">Something went wrong. Please try again.</p>}
                  <button
                    type="submit"
                    disabled={status === "sending" || !reason.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold transition-colors w-full justify-center"
                  >
                    {status === "sending" ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                    {status === "sending" ? "Sending…" : "Submit request"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
