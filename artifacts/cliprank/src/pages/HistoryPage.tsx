import { motion } from "framer-motion";
import { useListAnalyses, useGetStats, getGetStatsQueryKey, getListAnalysesQueryKey } from "@workspace/api-client-react";
import { Film, Zap, Lock, BarChart3, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function HistoryPage() {
  const { data: analyses, isLoading } = useListAnalyses({
    query: { queryKey: getListAnalysesQueryKey() },
  });

  const { data: stats } = useGetStats({
    query: { queryKey: getGetStatsQueryKey() },
  });

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-400";
    if (score >= 40) return "text-amber-400";
    return "text-rose-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return "bg-emerald-400/10 border-emerald-400/20";
    if (score >= 40) return "bg-amber-400/10 border-amber-400/20";
    return "bg-rose-400/10 border-rose-400/20";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/app">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold text-lg tracking-tight">ClipRank</span>
            </div>
          </Link>

          <Link href="/app">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              <Film className="w-4 h-4" />
              New Analysis
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analysis History</h1>
          <p className="text-muted-foreground">All your past video analyses</p>
        </div>

        {/* Stats Strip */}
        {stats && stats.totalAnalyses > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-4 gap-4 mb-8"
          >
            {[
              { label: "Total Analyses", value: stats.totalAnalyses, icon: BarChart3 },
              { label: "Avg Overall", value: `${Math.round(stats.avgOverallScore)}/100`, icon: TrendingUp },
              { label: "Avg Pacing", value: `${Math.round(stats.avgPacingScore)}/100`, icon: Film },
              { label: "Premium Unlocks", value: stats.premiumUnlocks, icon: Lock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{value}</span>
              </div>
            ))}
          </motion.div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-5 h-20 animate-pulse" />
            ))}
          </div>
        ) : !analyses?.length ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 gap-4 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-border flex items-center justify-center">
              <Film className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold">No analyses yet</p>
            <p className="text-muted-foreground">Upload your first video to get started</p>
            <Link href="/">
              <button className="mt-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Analyze a video
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {analyses.map((analysis, i) => (
              <motion.div
                key={analysis.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5 flex items-center gap-6 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                data-testid={`card-analysis-${analysis.id}`}
                onClick={() => window.location.href = `/`}
              >
                {/* Score badge */}
                <div className={`w-14 h-14 rounded-xl border flex items-center justify-center flex-shrink-0 ${getScoreBg(analysis.overallScore)}`}>
                  <span className={`text-xl font-bold font-mono ${getScoreColor(analysis.overallScore)}`}>
                    {Math.round(analysis.overallScore)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate mb-1" data-testid={`text-filename-${analysis.id}`}>
                    {analysis.filename}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{analysis.durationSeconds}s</span>
                    <span>{analysis.frameCount} frames</span>
                    <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                    {analysis.isPremiumUnlocked && (
                      <span className="text-primary flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    )}
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="flex items-center gap-6 text-sm">
                  {[
                    { label: "Pacing", score: analysis.pacingScore },
                    { label: "Hook", score: analysis.visualHookScore },
                    { label: "Caption", score: analysis.captionReadabilityScore },
                  ].map(({ label, score }) => (
                    <div key={label} className="text-center">
                      <div className={`font-mono font-bold ${getScoreColor(score)}`}>
                        {Math.round(score)}
                      </div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
