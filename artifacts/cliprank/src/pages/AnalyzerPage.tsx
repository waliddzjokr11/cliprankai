import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAnalysis,
  useGetStats,
  getGetAnalysisQueryKey,
  getGetStatsQueryKey,
  getListAnalysesQueryKey,
} from "@workspace/api-client-react";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useCredits } from "@/hooks/useCredits";
import { RadialProgress } from "@/components/RadialProgress";
import { PaypalButton } from "@/components/PaypalButton";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Upload,
  Film,
  Zap,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Clock,
  Layers,
  ShoppingCart,
  AlertTriangle,
  CreditCard,
  TrendingUp,
  Target,
  Users,
  ArrowRight,
  CheckCircle2,
  XCircle,
  LogOut,
} from "lucide-react";
import { useClerk, useUser } from "@clerk/react";

type Step = "idle" | "processing" | "done";

// Parse competitor insights JSON safely
interface CompetitorInsights {
  topPatterns?: string[];
  winningFormula?: string;
  gapAnalysis?: string;
  nicheExamples?: string;
}

interface RetentionRisk {
  opening?: string;
  midVideo?: string;
  ending?: string;
}

function parseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function ViralityBadge({ score }: { score: number }) {
  const color =
    score >= 66
      ? "from-emerald-500 to-green-400"
      : score >= 46
      ? "from-amber-500 to-yellow-400"
      : "from-rose-500 to-red-400";

  const label =
    score >= 81
      ? "Exceptional"
      : score >= 66
      ? "Strong potential"
      : score >= 46
      ? "Moderate chance"
      : score >= 26
      ? "Low chance"
      : "Won't go viral";

  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="relative">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <motion.circle
            cx="40" cy="40" r="34"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 34}
            className={`stroke-current`}
            style={{ stroke: score >= 66 ? "#10b981" : score >= 46 ? "#f59e0b" : "#f43f5e" }}
            initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - score / 100) }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-xl font-bold font-mono"
            style={{ color: score >= 66 ? "#10b981" : score >= 46 ? "#f59e0b" : "#f43f5e" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(score)}
          </motion.span>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Virality Score</span>
        </div>
        <p className="text-lg font-bold text-white">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {score >= 66
            ? "Hits most algorithm signals — strong distribution potential"
            : score >= 46
            ? "Some viral mechanics present — gaps are costing you reach"
            : "Missing core viral mechanics — significant changes needed"}
        </p>
      </div>
    </div>
  );
}

export default function AnalyzerPage() {
  const [step, setStep] = useState<Step>("idle");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [competitorOpen, setCompetitorOpen] = useState(true);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, progress: uploadProgress, reset: resetUpload } = useVideoUpload();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { userId, credits, creditsRequired, hasEnoughCredits, refetch: refetchCredits } = useCredits();
  const { signOut } = useClerk();
  const { user } = useUser();

  const { data: stats } = useGetStats({
    query: { queryKey: getGetStatsQueryKey() },
  });

  const { data: analysis } = useGetAnalysis(
    analysisId ?? "",
    {
      query: {
        enabled: !!analysisId && step === "done",
        queryKey: getGetAnalysisQueryKey(analysisId ?? ""),
        refetchInterval: false,
      },
    }
  );

  const processAndAnalyze = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please upload a video file.", variant: "destructive" });
      return;
    }
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({ title: "File too large", description: `Maximum file size is 500 MB. Your file is ${(file.size / 1024 / 1024).toFixed(0)} MB.`, variant: "destructive" });
      return;
    }

    setCurrentFilename(file.name);
    setStep("processing");

    try {
      const result = await upload(file, userId ?? "");

      setAnalysisId(result.analysisId);
      setStep("done");
      refetchCredits();

      queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(result.analysisId) });
    } catch (err: any) {
      if (err?.status === 402) {
        setPendingFile(file);
        setStep("idle");
        setShowBuyCredits(true);
        const required = err?.creditsRequired ?? "?";
        const available = err?.creditsAvailable ?? credits ?? 0;
        toast({
          title: "Not enough credits",
          description: `This video needs ${required} credit${required !== 1 ? "s" : ""}. You have ${available}.`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Analysis failed",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setStep("idle");
      resetUpload();
    }
  }, [upload, resetUpload, queryClient, toast, credits, refetchCredits, userId]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    processAndAnalyze(files[0]);
  }, [processAndAnalyze]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const resetAnalyzer = () => {
    setStep("idle");
    setAnalysisId(null);
    setTranscriptOpen(false);
    setRetentionOpen(false);
    setPendingFile(null);
    setCurrentFilename("");
    resetUpload();
  };

  const handleCreditsPurchased = (_newBalance: number) => {
    refetchCredits();
    if (pendingFile) {
      const file = pendingFile;
      setPendingFile(null);
      setTimeout(() => processAndAnalyze(file), 300);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 z-10 backdrop-blur-xl bg-background/80">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-semibold text-base tracking-tight">ClipRank</span>
            </div>
          </Link>

          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            {stats && (
              <div className="hidden sm:flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs">
                  <BarChart3 className="w-3 h-3" />
                  {stats.totalAnalyses} analyzed
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Film className="w-3 h-3" />
                  avg {Math.round(stats.avgOverallScore)}/100
                </span>
              </div>
            )}

            {/* Credit balance pill */}
            <button
              onClick={() => setShowBuyCredits(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 hover:border-primary/40 transition-colors group text-xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-white tabular-nums">
                {credits === null ? "—" : credits}
              </span>
              <span>credits</span>
              <ShoppingCart className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <Link href="/history">
              <button className="text-muted-foreground hover:text-foreground transition-colors text-xs hidden sm:block">
                History
              </button>
            </Link>

            {user && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">

          {/* IDLE: Upload zone */}
          {step === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-10">
                <h1 className="text-4xl font-bold tracking-tight mb-3">
                  Analyze your <span className="text-primary">video</span>
                </h1>
                <p className="text-muted-foreground text-base max-w-lg mx-auto">
                  Get a calibrated virality score based on real TikTok, Reels & Shorts algorithm signals — not generic AI ratings.
                </p>
                {credits !== null && credits <= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {credits === 0 ? "You're out of credits." : `Only ${credits} credit${credits !== 1 ? "s" : ""} left.`}
                    <button
                      onClick={() => setShowBuyCredits(true)}
                      className="underline underline-offset-2 font-medium hover:text-amber-300 transition-colors"
                    >
                      Top up
                    </button>
                  </motion.div>
                )}
              </div>

              <motion.div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => credits === 0 ? setShowBuyCredits(true) : fileInputRef.current?.click()}
                animate={{
                  borderColor: isDragging ? "hsl(var(--primary))" : credits === 0 ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)",
                  backgroundColor: isDragging ? "rgba(99, 130, 246, 0.06)" : "rgba(255,255,255,0.02)",
                  scale: isDragging ? 1.01 : 1,
                }}
                transition={{ duration: 0.2 }}
                className="relative cursor-pointer rounded-2xl border-2 border-dashed p-14 flex flex-col items-center gap-5 group"
              >
                <motion.div
                  animate={{ scale: isDragging ? 1.1 : 1, rotate: isDragging ? 5 : 0 }}
                  className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                >
                  <Upload className="w-7 h-7 text-primary" />
                </motion.div>

                <div className="text-center">
                  <p className="text-lg font-semibold mb-1.5">
                    {credits === 0 ? "Buy credits to analyze" : isDragging ? "Drop to analyze" : "Drop your video here"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {credits === 0
                      ? "1 credit per 10 seconds of video"
                      : "or click to browse — MP4, MOV, AVI, WebM · 1 credit / 10s"}
                  </p>
                </div>

                <div className="flex items-center gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-primary" />
                    Server-side processing
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-primary" />
                    Frame-level AI
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-primary" />
                    Real-time progress
                  </span>
                </div>
              </motion.div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </motion.div>
          )}

          {/* PROCESSING: Server-side step progress */}
          {step === "processing" && (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center min-h-[60vh] px-4"
            >
              <AnalysisProgress
                currentStep={uploadProgress.step === "idle" || uploadProgress.step === "done" || uploadProgress.step === "error" ? "uploading" : uploadProgress.step}
                progressPct={uploadProgress.pct}
                filename={currentFilename}
                onCancel={resetAnalyzer}
              />
            </motion.div>
          )}

          {/* DONE: Results */}
          {step === "done" && analysis && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Top bar */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{analysis.filename}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-zinc-500 text-sm">
                      {analysis.durationSeconds}s · {analysis.frameCount} frames
                    </span>
                    {analysis.niche && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
                        {analysis.niche}
                      </span>
                    )}
                    {analysis.nichePlatform && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                        {analysis.nichePlatform}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={resetAnalyzer}
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50 hover:text-primary transition-colors whitespace-nowrap flex-shrink-0"
                >
                  Analyze another
                </button>
              </div>

              {/* Virality score (prominent) + overall score grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Virality score — left, bigger */}
                {analysis.viralityScore !== null && analysis.viralityScore !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2"
                  >
                    <ViralityBadge score={analysis.viralityScore} />
                  </motion.div>
                )}

                {/* Score grid — right */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className={`glass-card p-6 ${analysis.viralityScore !== null && analysis.viralityScore !== undefined ? "lg:col-span-3" : "lg:col-span-5"}`}
                >
                  <div className="flex items-center justify-around gap-4">
                    <RadialProgress score={analysis.overallScore} label="Overall" size={100} strokeWidth={7} isMain />
                    <div className="w-px h-12 bg-white/10 hidden sm:block" />
                    <RadialProgress score={analysis.visualHookScore} label="Hook" size={78} strokeWidth={6} />
                    <RadialProgress score={analysis.pacingScore} label="Pacing" size={78} strokeWidth={6} />
                    <RadialProgress score={analysis.captionReadabilityScore} label="Captions" size={78} strokeWidth={6} />
                  </div>
                </motion.div>
              </div>

              {/* Summary */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-5"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Summary
                </h3>
                <p className="text-foreground leading-relaxed text-sm">{analysis.summary}</p>
              </motion.div>

              {/* Feedback Cards */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {[
                  { label: "Hook (0-3s)", feedback: analysis.visualHookFeedback, score: analysis.visualHookScore },
                  { label: "Pacing", feedback: analysis.pacingFeedback, score: analysis.pacingScore },
                  { label: "Captions", feedback: analysis.captionFeedback, score: analysis.captionReadabilityScore },
                ].map(({ label, feedback, score }) => (
                  <div key={label} className="glass-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </span>
                      <span
                        className={`text-sm font-mono font-bold ${
                          score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-rose-400"
                        }`}
                      >
                        {Math.round(score)}/100
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">{feedback}</p>
                  </div>
                ))}
              </motion.div>

              {/* Retention Risk */}
              {analysis.retentionRisk && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card overflow-hidden"
                >
                  <button
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    onClick={() => setRetentionOpen(!retentionOpen)}
                  >
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold">Retention Risk Analysis</span>
                      <span className="text-xs text-zinc-500">Where viewers drop off</span>
                    </div>
                    {retentionOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>
                  <AnimatePresence>
                    {retentionOpen && (() => {
                      const risk = parseJson<RetentionRisk>(analysis.retentionRisk, {});
                      return (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden border-t border-border/50"
                        >
                          <div className="px-5 pb-5 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                              { label: "Opening (0-3s)", text: risk.opening, icon: "🪝" },
                              { label: "Mid-video", text: risk.midVideo, icon: "📉" },
                              { label: "Ending", text: risk.ending, icon: "🔚" },
                            ].map(({ label, text, icon }) => (
                              <div key={label} className="space-y-1.5">
                                <p className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                                  <span>{icon}</span>{label}
                                </p>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                  {text || "No specific risk identified."}
                                </p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Competitor / Viral Pattern Insights */}
              {analysis.competitorInsights && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="glass-card overflow-hidden"
                >
                  <button
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    onClick={() => setCompetitorOpen(!competitorOpen)}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold">
                        Viral Pattern Analysis
                      </span>
                      {analysis.niche && (
                        <span className="text-xs text-zinc-500">
                          Top {analysis.niche} creators
                        </span>
                      )}
                    </div>
                    {competitorOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>
                  <AnimatePresence>
                    {competitorOpen && (() => {
                      const insights = parseJson<CompetitorInsights>(analysis.competitorInsights, {});
                      return (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden border-t border-border/50"
                        >
                          <div className="px-5 pb-5 pt-4 space-y-5">
                            {/* Top patterns */}
                            {insights.topPatterns && insights.topPatterns.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                                  What viral {analysis.niche || "niche"} videos consistently do
                                </p>
                                <div className="space-y-2">
                                  {insights.topPatterns.map((pattern, i) => (
                                    <div key={i} className="flex items-start gap-2.5">
                                      <div className="flex-shrink-0 mt-0.5">
                                        <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                          <span className="text-[9px] font-bold text-purple-400">{i + 1}</span>
                                        </div>
                                      </div>
                                      <p className="text-sm text-zinc-300 leading-relaxed">{pattern}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Gap analysis */}
                              {insights.gapAnalysis && (
                                <div className="rounded-xl bg-rose-500/[0.07] border border-rose-500/20 p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                                    <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                                      Your gaps
                                    </span>
                                  </div>
                                  <p className="text-sm text-zinc-400 leading-relaxed">
                                    {insights.gapAnalysis}
                                  </p>
                                </div>
                              )}

                              {/* Winning formula */}
                              {insights.winningFormula && (
                                <div className="rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                      Winning formula
                                    </span>
                                  </div>
                                  <p className="text-sm text-zinc-400 leading-relaxed">
                                    {insights.winningFormula}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Niche examples */}
                            {insights.nicheExamples && (
                              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <ArrowRight className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-zinc-500 mb-0.5">
                                    Study these creators/videos
                                  </p>
                                  <p className="text-sm text-zinc-400 leading-relaxed">
                                    {insights.nicheExamples}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Transcript (collapsible) */}
              {analysis.transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card overflow-hidden"
                >
                  <button
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    onClick={() => setTranscriptOpen(!transcriptOpen)}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Transcript
                    </span>
                    {transcriptOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {transcriptOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-border/50"
                      >
                        <p className="px-5 pb-5 pt-4 text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">
                          {analysis.transcript}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Premium Section */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                {analysis.isPremiumUnlocked ? (
                  <div className="space-y-4">
                    {analysis.professionalAdvice && (
                      <div className="glass-card-bright p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider">
                            Professional Editing Advice
                          </h3>
                        </div>
                        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-sm">
                          {analysis.professionalAdvice}
                        </p>
                      </div>
                    )}
                    {analysis.visualHeatmap && (
                      <div className="glass-card-bright p-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider">
                            Visual Attention Heatmap
                          </h3>
                        </div>
                        <p className="text-foreground/80 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                          {analysis.visualHeatmap}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden">
                    <div className="blur-sm pointer-events-none select-none p-6 space-y-3 glass-card">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-3 bg-white/10 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
                      ))}
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                      <div className="glass-card-bright rounded-2xl px-8 py-7 flex flex-col items-center gap-4 w-full max-w-sm">
                        <h3 className="text-base font-semibold text-center">
                          Unlock Professional Advice
                        </h3>
                        <p className="text-sm text-muted-foreground text-center">
                          Detailed editing notes, frame-by-frame attention heatmap, and platform-specific posting strategy.
                        </p>
                        <PaypalButton analysisId={analysis.id} />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showBuyCredits && (
        <BuyCreditsModal
          open={showBuyCredits}
          userId={userId ?? ""}
          onClose={() => setShowBuyCredits(false)}
          onPurchased={handleCreditsPurchased}
          currentCredits={credits}
        />
      )}
    </div>
  );
}
