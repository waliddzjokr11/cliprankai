import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAnalyzeVideo,
  useGetAnalysis,
  useGetStats,
  getGetAnalysisQueryKey,
  getGetStatsQueryKey,
  getListAnalysesQueryKey,
} from "@workspace/api-client-react";
import { useVideoProcessor } from "@/hooks/useVideoProcessor";
import { useCredits } from "@/hooks/useCredits";
import { RadialProgress } from "@/components/RadialProgress";
import { PaypalButton } from "@/components/PaypalButton";
import { AnalysisSkeleton } from "@/components/AnalysisSkeleton";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Film,
  Zap,
  Lock,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Clock,
  Layers,
  ShoppingCart,
  AlertTriangle,
  CreditCard,
} from "lucide-react";

type Step = "idle" | "processing" | "uploading" | "analyzing" | "done";

export default function AnalyzerPage() {
  const [step, setStep] = useState<Step>("idle");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { processVideo, isProcessing, progress } = useVideoProcessor();
  const analyzeVideo = useAnalyzeVideo();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { userId, credits, creditsRequired, hasEnoughCredits, refetch: refetchCredits } = useCredits();

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

    try {
      setStep("processing");
      const result = await processVideo(file);

      // Credit gate — check after we know the exact duration
      if (!hasEnoughCredits(result.durationSeconds)) {
        const required = creditsRequired(result.durationSeconds);
        setPendingFile(file);
        setStep("idle");
        setShowBuyCredits(true);
        toast({
          title: "Not enough credits",
          description: `This video needs ${required} credit${required !== 1 ? "s" : ""} (${Math.floor(result.durationSeconds)}s ÷ 10). You have ${credits ?? 0}.`,
          variant: "destructive",
        });
        return;
      }

      setStep("uploading");
      const data = await analyzeVideo.mutateAsync({
        data: {
          frames: result.frames,
          audioBase64: result.audioBase64 ?? undefined,
          filename: file.name,
          durationSeconds: result.durationSeconds,
          fingerprint: result.fingerprint,
          userId: userId ?? "",
        },
      });

      setAnalysisId(data.id);
      setStep("done");
      refetchCredits();

      queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    } catch (err: any) {
      // 402 = insufficient credits (shouldn't normally hit here but handle gracefully)
      if (err?.status === 402 || err?.response?.status === 402) {
        setStep("idle");
        setShowBuyCredits(true);
        return;
      }
      toast({
        title: "Analysis failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setStep("idle");
    }
  }, [processVideo, analyzeVideo, queryClient, toast, hasEnoughCredits, creditsRequired, credits, refetchCredits]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) return;
    processAndAnalyze(files[0]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const resetAnalyzer = () => {
    setStep("idle");
    setAnalysisId(null);
    setTranscriptOpen(false);
    setPendingFile(null);
  };

  const handleCreditsPurchased = (newBalance: number) => {
    refetchCredits();
    // If there's a pending file, retry the analysis with the new credits
    if (pendingFile) {
      const file = pendingFile;
      setPendingFile(null);
      setTimeout(() => processAndAnalyze(file), 300);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight">ClipRank</span>
          </div>

          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            {stats && (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {stats.totalAnalyses} analyses
                </span>
                <span className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  avg {Math.round(stats.avgOverallScore)}/100
                </span>
              </div>
            )}

            {/* Credit balance pill */}
            <button
              onClick={() => setShowBuyCredits(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
            >
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-white tabular-nums">
                {credits === null ? "—" : credits}
              </span>
              <span className="text-muted-foreground">credits</span>
              <ShoppingCart className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button
              onClick={() => window.location.href = `${import.meta.env.BASE_URL}history`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              History
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
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
              <div className="text-center mb-12">
                <h1 className="text-5xl font-bold tracking-tight mb-4">
                  Analyze your{" "}
                  <span className="text-primary">video</span>
                </h1>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  Upload any video clip. ClipRank uses AI to score pacing, visual hooks, and caption readability.
                </p>
                {credits !== null && credits <= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {credits === 0
                      ? "You're out of credits. "
                      : `Only ${credits} credit${credits !== 1 ? "s" : ""} remaining. `}
                    <button
                      onClick={() => setShowBuyCredits(true)}
                      className="underline underline-offset-2 font-medium hover:text-amber-300 transition-colors"
                    >
                      Top up now
                    </button>
                  </motion.div>
                )}
              </div>

              <motion.div
                data-testid="upload-dropzone"
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
                className="relative cursor-pointer rounded-2xl border-2 border-dashed p-16 flex flex-col items-center gap-6 group"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <motion.div
                  animate={{ scale: isDragging ? 1.1 : 1, rotate: isDragging ? 5 : 0 }}
                  className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                >
                  <Upload className="w-9 h-9 text-primary" />
                </motion.div>

                <div className="text-center">
                  <p className="text-xl font-semibold mb-2">
                    {credits === 0
                      ? "Buy credits to analyze"
                      : isDragging ? "Drop to analyze" : "Drop your video here"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {credits === 0
                      ? "You need credits to run an analysis — 1 credit per 10 seconds"
                      : "or click to browse — MP4, MOV, AVI, WebM supported"}
                  </p>
                </div>

                {/* Credit cost hint */}
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-primary" />
                    Client-side compression
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-primary" />
                    Frame-level analysis
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-primary" />
                    1 credit / 10 s of video
                  </span>
                </div>
              </motion.div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                data-testid="input-file-upload"
              />
            </motion.div>
          )}

          {/* PROCESSING: ffmpeg frame extraction — radial progress */}
          {step === "processing" && (
            <motion.div
              key="extracting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-8"
            >
              <div className="relative">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                  <motion.circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - progress / 100) }}
                    style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.6))" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-mono font-bold text-primary">{progress}%</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold mb-2">Extracting frames…</p>
                <p className="text-muted-foreground text-sm">Adaptive sampling client-side</p>
              </div>
            </motion.div>
          )}

          {/* UPLOADING / ANALYZING: skeleton that mirrors results layout */}
          {(step === "uploading" || step === "analyzing") && (
            <motion.div
              key="skeleton-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <AnalysisSkeleton
                label={step === "uploading" ? "Sending frames to AI…" : "Scoring pacing, visual hooks & captions…"}
              />
            </motion.div>
          )}

          {/* DONE: Results */}
          {step === "done" && analysis && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{analysis.filename}</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {analysis.durationSeconds}s &middot; {analysis.frameCount} frames analyzed
                  </p>
                </div>
                <button
                  onClick={resetAnalyzer}
                  data-testid="button-analyze-another"
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50 hover:text-primary transition-colors"
                >
                  Analyze another
                </button>
              </div>

              {/* Score Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-8"
              >
                <div className="grid grid-cols-4 gap-8 items-center">
                  <div className="col-span-1 flex justify-center">
                    <RadialProgress
                      score={analysis.overallScore}
                      label="Overall"
                      size={160}
                      strokeWidth={10}
                      isMain
                    />
                  </div>
                  <div className="col-span-3 grid grid-cols-3 gap-6">
                    <RadialProgress score={analysis.pacingScore} label="Pacing" size={120} strokeWidth={8} />
                    <RadialProgress score={analysis.visualHookScore} label="Visual Hook" size={120} strokeWidth={8} />
                    <RadialProgress score={analysis.captionReadabilityScore} label="Captions" size={120} strokeWidth={8} />
                  </div>
                </div>
              </motion.div>

              {/* Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-6"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Summary
                </h3>
                <p className="text-foreground leading-relaxed" data-testid="text-summary">
                  {analysis.summary}
                </p>
              </motion.div>

              {/* Feedback Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-3 gap-4"
              >
                {[
                  { label: "Pacing", feedback: analysis.pacingFeedback, score: analysis.pacingScore, testId: "text-pacing-feedback" },
                  { label: "Visual Hook", feedback: analysis.visualHookFeedback, score: analysis.visualHookScore, testId: "text-visual-hook-feedback" },
                  { label: "Captions", feedback: analysis.captionFeedback, score: analysis.captionReadabilityScore, testId: "text-caption-feedback" },
                ].map(({ label, feedback, score, testId }) => (
                  <div key={label} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
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
                    <p className="text-sm text-foreground/80 leading-relaxed" data-testid={testId}>
                      {feedback}
                    </p>
                  </div>
                ))}
              </motion.div>

              {/* Transcript (collapsible) */}
              {analysis.transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="glass-card overflow-hidden"
                >
                  <button
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    onClick={() => setTranscriptOpen(!transcriptOpen)}
                    data-testid="button-toggle-transcript"
                  >
                    <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Transcript
                    </span>
                    {transcriptOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <AnimatePresence>
                    {transcriptOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 border-t border-border/50">
                          <p className="text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap pt-4" data-testid="text-transcript">
                            {analysis.transcript}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Premium Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {analysis.isPremiumUnlocked ? (
                  <div className="space-y-4">
                    {analysis.professionalAdvice && (
                      <div className="glass-card-bright p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <h3 className="text-sm font-semibold uppercase tracking-wider">
                            Professional Editing Advice
                          </h3>
                        </div>
                        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap" data-testid="text-professional-advice">
                          {analysis.professionalAdvice}
                        </p>
                      </div>
                    )}
                    {analysis.visualHeatmap && (
                      <div className="glass-card-bright p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h3 className="text-sm font-semibold uppercase tracking-wider">
                            Visual Attention Heatmap
                          </h3>
                        </div>
                        <p className="text-foreground/80 text-sm leading-relaxed font-mono whitespace-pre-wrap" data-testid="text-visual-heatmap">
                          {analysis.visualHeatmap}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden">
                    <div className="blur-sm pointer-events-none select-none p-6 space-y-4 glass-card">
                      <div className="h-4 bg-white/10 rounded w-3/4" />
                      <div className="h-4 bg-white/10 rounded w-full" />
                      <div className="h-4 bg-white/10 rounded w-5/6" />
                      <div className="h-4 bg-white/10 rounded w-2/3" />
                      <div className="h-4 bg-white/10 rounded w-4/5" />
                      <div className="h-4 bg-white/10 rounded w-full" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
                      <div className="glass-card-bright rounded-2xl px-8 py-8 flex flex-col items-center gap-5 w-full max-w-md">
                        <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-center">
                          <h3 className="font-semibold text-lg mb-1">Unlock Full Analysis</h3>
                          <p className="text-muted-foreground text-sm">
                            Get professional editing advice and visual attention heatmap for this video.
                          </p>
                        </div>
                        <div className="flex items-baseline gap-1 text-primary">
                          <span className="text-3xl font-bold">$10</span>
                          <span className="text-muted-foreground text-sm">one-time</span>
                        </div>
                        <div className="w-full" data-testid="container-paypal">
                          <PaypalButton analysisId={analysis.id} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Buy Credits Modal */}
      <BuyCreditsModal
        open={showBuyCredits}
        onClose={() => { setShowBuyCredits(false); setPendingFile(null); }}
        onPurchased={handleCreditsPurchased}
        currentCredits={credits}
        userId={userId ?? ""}
      />
    </div>
  );
}
