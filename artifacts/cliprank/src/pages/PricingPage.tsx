import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Zap, Star, Crown, HelpCircle } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const TIERS = [
  {
    name: "Trial",
    price: "Free",
    credits: 3,
    coveredTime: "30 seconds",
    icon: <Zap className="w-5 h-5" />,
    color: "text-zinc-400",
    border: "border-white/10",
    bg: "bg-white/[0.02]",
    badge: null,
    cta: "Start for free",
    ctaStyle: "border border-white/10 text-zinc-300 hover:text-white hover:border-white/20",
    features: [
      "3 credits on signup",
      "All three AI metrics",
      "Full score report",
      "Edge-cached results",
      "No credit card required",
    ],
  },
  {
    name: "Starter",
    price: "$14.99",
    credits: 50,
    coveredTime: "~8 minutes",
    icon: <Zap className="w-5 h-5" />,
    color: "text-indigo-400",
    border: "border-indigo-500/30",
    bg: "bg-indigo-500/[0.04]",
    badge: null,
    cta: "Buy Starter",
    ctaStyle: "bg-indigo-600 hover:bg-indigo-500 text-white",
    features: [
      "50 credits",
      "All four AI metrics",
      "Full score report",
      "Edge-cached results",
      "Credits never expire",
    ],
  },
  {
    name: "Creator",
    price: "$34.99",
    credits: 150,
    coveredTime: "~25 minutes",
    icon: <Star className="w-5 h-5" />,
    color: "text-violet-400",
    border: "border-violet-500/40",
    bg: "bg-violet-500/[0.05]",
    badge: "Most Popular",
    badgeStyle: "bg-violet-600 text-white",
    cta: "Buy Creator",
    ctaStyle: "bg-violet-600 hover:bg-violet-500 text-white",
    features: [
      "150 credits",
      "All four AI metrics",
      "Full score report",
      "Edge-cached results",
      "Credits never expire",
      "Best value per credit",
    ],
  },
  {
    name: "Pro",
    price: "$79.99",
    credits: 500,
    coveredTime: "~83 minutes",
    icon: <Crown className="w-5 h-5" />,
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.03]",
    badge: "Best Value",
    badgeStyle: "bg-amber-600 text-white",
    cta: "Buy Pro",
    ctaStyle: "bg-amber-600 hover:bg-amber-500 text-white",
    features: [
      "500 credits",
      "All three AI metrics",
      "Full score report",
      "Edge-cached results",
      "Credits never expire",
      "Lowest cost per credit",
    ],
  },
];

const FAQ = [
  { q: "What counts as one credit?", a: "One credit covers 10 seconds of video processed. A 60-second clip costs 6 credits. The credit cost is always shown before you confirm an analysis." },
  { q: "Do credits expire?", a: "Never. Credits stay in your account until you use them. There's no subscription or renewal." },
  { q: "What if I re-upload the same video?", a: "Identical videos are recognized by their fingerprint and returned from cache instantly — at zero credit cost." },
  { q: "What's the $19.99 premium unlock?", a: "Each individual analysis can be unlocked for $19.99 to reveal professional editing advice, timestamp-level suggestions, and a visual attention heatmap for that specific video." },
  { q: "Is there a free trial?", a: "Yes — every new account gets 3 trial credits on signup (no credit card required). That covers up to 30 seconds of video." },
];

export default function PricingPage() {
  const [, nav] = useLocation();
  usePageTitle("Pricing", "3 free credits to start. Buy more credits to keep analyzing — no subscriptions, no commitments. 1 credit per 10 seconds of video.");

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

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-3">Pricing</p>
          <h1 className="text-5xl font-bold tracking-tight mb-4">Simple, credit-based pricing</h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto">
            Pay only for what you use. 1 credit = 10 seconds of video. Credits never expire.
          </p>
        </motion.div>

        {/* Tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-20">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-2xl border ${tier.border} ${tier.bg} p-6 flex flex-col`}
            >
              {tier.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold ${tier.badgeStyle}`}>
                  {tier.badge}
                </div>
              )}

              <div className={`flex items-center gap-2 mb-4 ${tier.color}`}>
                {tier.icon}
                <span className="font-semibold text-white text-sm">{tier.name}</span>
              </div>

              <div className="mb-1">
                <span className="text-4xl font-bold text-white">{tier.price}</span>
                {tier.price !== "Free" && <span className="text-zinc-500 text-sm ml-1">one-time</span>}
              </div>

              <div className="mb-5">
                <p className={`text-lg font-semibold ${tier.color}`}>{tier.credits} credits</p>
                <p className="text-xs text-zinc-600">covers {tier.coveredTime} of video</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => nav("/sign-up")}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${tier.ctaStyle}`}
              >
                {tier.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Cost per credit table */}
        <div className="mb-20 rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <h3 className="font-semibold text-white">Cost per credit</h3>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {[
              { plan: "Trial", credits: 3, price: "$0", cpc: "Free" },
              { plan: "Starter", credits: 50, price: "$14.99", cpc: "$0.30 / credit" },
              { plan: "Creator", credits: 150, price: "$34.99", cpc: "$0.23 / credit" },
              { plan: "Pro", credits: 500, price: "$79.99", cpc: "$0.16 / credit" },
            ].map((row) => (
              <div key={row.plan} className="px-6 py-3.5 flex items-center justify-between text-sm">
                <span className="text-white font-medium">{row.plan}</span>
                <span className="text-zinc-500">{row.credits} credits</span>
                <span className="text-zinc-500">{row.price}</span>
                <span className="text-indigo-400 font-semibold">{row.cpc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 flex items-center justify-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <p className="font-semibold text-white mb-2">{item.q}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
