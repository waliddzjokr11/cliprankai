import { motion } from "framer-motion";
import {
  Upload,
  Cpu,
  Mic,
  Sparkles,
  Users,
  CheckCircle2,
  Loader2,
  Film,
  X,
} from "lucide-react";
import type { UploadStep } from "@/hooks/useVideoUpload";

interface StepConfig {
  id: UploadStep;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  // Approximate share of total processing time (for smooth progress bar)
  weight: number;
}

const STEPS: StepConfig[] = [
  {
    id: "uploading",
    icon: <Upload className="w-4 h-4" />,
    label: "Uploading video",
    sublabel: "Streaming to server for processing",
    weight: 10,
  },
  {
    id: "extracting",
    icon: <Film className="w-4 h-4" />,
    label: "Extracting frames",
    sublabel: "Hook-zone dense sampling + scene-aware body frames",
    weight: 20,
  },
  {
    id: "transcribing",
    icon: <Mic className="w-4 h-4" />,
    label: "Transcribing audio",
    sublabel: "Full-video speech extraction for caption analysis",
    weight: 15,
  },
  {
    id: "scoring",
    icon: <Sparkles className="w-4 h-4" />,
    label: "Scoring virality",
    sublabel: "Hook · Pacing · Captions · Virality — GPT-4o vision",
    weight: 45,
  },
  {
    id: "researching",
    icon: <Users className="w-4 h-4" />,
    label: "Mapping viral patterns",
    sublabel: "Comparing against top creators in your niche",
    weight: 10,
  },
];

const STEP_ORDER: UploadStep[] = ["uploading", "extracting", "transcribing", "scoring", "researching"];

function getStepIndex(step: UploadStep): number {
  return STEP_ORDER.indexOf(step);
}

// Compute overall progress % using time-weighted step sizes
function computeWeightedProgress(currentStep: UploadStep, stepPct: number): number {
  const idx = getStepIndex(currentStep);
  if (idx < 0) return 0;
  const totalWeight = STEPS.reduce((s, st) => s + st.weight, 0);
  const completedWeight = STEPS.slice(0, idx).reduce((s, st) => s + st.weight, 0);
  const currentStepWeight = STEPS[idx]?.weight ?? 0;
  const fraction = completedWeight + (currentStepWeight * stepPct) / 100;
  return Math.round((fraction / totalWeight) * 100);
}

interface Props {
  currentStep: UploadStep;
  progressPct: number;
  filename?: string;
  onCancel?: () => void;
}

export function AnalysisProgress({ currentStep, progressPct, filename, onCancel }: Props) {
  const currentIdx = Math.max(0, getStepIndex(currentStep));
  const overallPct = computeWeightedProgress(currentStep, progressPct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto w-full"
    >
      {/* Header: filename + cancel */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="text-center flex-1">
          <p className="text-sm text-zinc-500">Analyzing</p>
          <p className="text-white font-semibold mt-0.5 truncate max-w-xs mx-auto">{filename}</p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-zinc-500 hover:text-white hover:border-white/20 transition-colors"
            title="Cancel upload"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-1">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isPending = idx > currentIdx;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              className={`flex items-start gap-4 p-4 rounded-xl transition-colors ${
                isActive ? "bg-white/[0.06] border border-white/10" : "bg-transparent"
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {isDone ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </motion.div>
                ) : isActive ? (
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-indigo-500/20"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div className="relative z-10 text-indigo-400">{step.icon}</div>
                  </div>
                ) : (
                  <div className="w-5 h-5 flex items-center justify-center text-zinc-600">
                    {step.icon}
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      isDone ? "text-emerald-400" : isActive ? "text-white" : "text-zinc-600"
                    }`}
                  >
                    {step.label}
                  </span>
                  {isActive && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin flex-shrink-0" />}
                </div>
                <p className={`text-xs mt-0.5 ${isActive ? "text-zinc-400" : "text-zinc-600"}`}>
                  {step.sublabel}
                </p>

                {/* Upload progress bar */}
                {isActive && step.id === "uploading" && progressPct > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Uploading</span>
                      <span className="font-mono">{progressPct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-indigo-500"
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  </div>
                )}

                {/* Extraction progress bar */}
                {isActive && step.id === "extracting" && progressPct > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Frames extracted</span>
                      <span className="font-mono">{progressPct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-indigo-500"
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                  </div>
                )}

                {/* Scoring dimension chips */}
                {isActive && step.id === "scoring" && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {["Hook", "Pacing", "Captions", "Virality"].map((label, i) => (
                      <motion.span
                        key={label}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 2, delay: i * 0.5, repeat: Infinity, repeatDelay: 1.5 }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                      >
                        {label}
                      </motion.span>
                    ))}
                  </div>
                )}

                {/* Platform badges for researching step */}
                {isActive && step.id === "researching" && (
                  <div className="flex gap-1 mt-2">
                    {["TikTok", "Reels", "Shorts"].map((platform, i) => (
                      <motion.span
                        key={platform}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.3 }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400"
                      >
                        {platform}
                      </motion.span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Time-weighted overall progress bar */}
      <div className="mt-6">
        <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
          <span>{STEPS[currentIdx]?.label}</span>
          <span>{overallPct}% complete</span>
        </div>
      </div>
    </motion.div>
  );
}
