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
} from "lucide-react";
import type { UploadStep } from "@/hooks/useVideoUpload";

interface StepConfig {
  id: UploadStep;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
}

const STEPS: StepConfig[] = [
  {
    id: "uploading",
    icon: <Upload className="w-4 h-4" />,
    label: "Uploading video",
    sublabel: "Streaming to server for processing",
  },
  {
    id: "extracting",
    icon: <Film className="w-4 h-4" />,
    label: "Extracting frames",
    sublabel: "Server sampling 1 frame every 3 seconds",
  },
  {
    id: "transcribing",
    icon: <Mic className="w-4 h-4" />,
    label: "Transcribing audio",
    sublabel: "Extracting speech for caption analysis",
  },
  {
    id: "scoring",
    icon: <Sparkles className="w-4 h-4" />,
    label: "Scoring virality",
    sublabel: "Hook · Pacing · Captions · Platform signals",
  },
  {
    id: "researching",
    icon: <Users className="w-4 h-4" />,
    label: "Mapping viral patterns",
    sublabel: "Comparing to top creators in your niche",
  },
];

// Steps that appear in progress order
const STEP_ORDER: UploadStep[] = ["uploading", "extracting", "transcribing", "scoring", "researching"];

function getStepIndex(step: UploadStep): number {
  return STEP_ORDER.indexOf(step);
}

interface Props {
  currentStep: UploadStep;
  progressPct: number;
  filename?: string;
}

export function AnalysisProgress({ currentStep, progressPct, filename }: Props) {
  const currentIdx = Math.max(0, getStepIndex(currentStep));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto"
    >
      {filename && (
        <div className="mb-8 text-center">
          <p className="text-sm text-zinc-500">Analyzing</p>
          <p className="text-white font-semibold mt-0.5 truncate max-w-xs mx-auto">{filename}</p>
        </div>
      )}

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
              {/* Icon column */}
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

              {/* Text column */}
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

                {/* Frame extraction progress bar */}
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

                {/* Animated sub-dots for scoring step */}
                {isActive && step.id === "scoring" && (
                  <div className="flex gap-1 mt-2">
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

                {/* Animated platform badges for researching step */}
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

      {/* Overall animated progress bar */}
      <div className="mt-6">
        <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            animate={{ width: `${Math.round(((currentIdx + 1) / STEPS.length) * 100)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
          <span>Step {currentIdx + 1} of {STEPS.length}</span>
          <span>{Math.round(((currentIdx + 1) / STEPS.length) * 100)}% complete</span>
        </div>
      </div>
    </motion.div>
  );
}
