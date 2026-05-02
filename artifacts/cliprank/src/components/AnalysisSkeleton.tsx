import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-white/[0.06]", className)}>
      <motion.div
        className="absolute inset-0 -translate-x-full"
        animate={{ translateX: ["−100%", "100%"] }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 0.2,
        }}
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.07) 60%, transparent 100%)",
        }}
      />
    </div>
  );
}

function SkeletonCircle({ size, strokeWidth = 8 }: { size: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference * 0.75 }}
            animate={{ strokeDashoffset: [circumference * 0.75, circumference * 0.25, circumference * 0.75] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Shimmer className="w-8 h-4 rounded" />
        </div>
      </div>
      <Shimmer className="w-14 h-3 rounded" />
    </div>
  );
}

export function AnalysisSkeleton({ label }: { label: string }) {
  return (
    <motion.div
      key="skeleton"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-6 w-48 rounded-lg" />
          <Shimmer className="h-4 w-32 rounded" />
        </div>
        <Shimmer className="h-9 w-32 rounded-lg" />
      </div>

      {/* Score grid skeleton */}
      <div className="glass-card p-8">
        <div className="grid grid-cols-4 gap-8 items-center">
          <div className="col-span-1 flex justify-center">
            <SkeletonCircle size={160} strokeWidth={10} />
          </div>
          <div className="col-span-3 grid grid-cols-3 gap-6 justify-items-center">
            <SkeletonCircle size={120} />
            <SkeletonCircle size={120} />
            <SkeletonCircle size={120} />
          </div>
        </div>
      </div>

      {/* Summary skeleton */}
      <div className="glass-card p-6 space-y-3">
        <Shimmer className="h-3 w-20 rounded" />
        <Shimmer className="h-4 w-full rounded" />
        <Shimmer className="h-4 w-5/6 rounded" />
        <Shimmer className="h-4 w-4/5 rounded" />
      </div>

      {/* Feedback cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Shimmer className="h-3 w-16 rounded" />
              <Shimmer className="h-4 w-12 rounded" />
            </div>
            <Shimmer className="h-3 w-full rounded" />
            <Shimmer className="h-3 w-4/5 rounded" />
            <Shimmer className="h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>

      {/* Processing label */}
      <motion.p
        className="text-center text-sm text-muted-foreground"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.p>
    </motion.div>
  );
}
