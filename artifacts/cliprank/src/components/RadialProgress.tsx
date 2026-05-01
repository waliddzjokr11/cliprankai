import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface RadialProgressProps {
  score: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  isMain?: boolean;
}

export function RadialProgress({ 
  score, 
  label, 
  size = 120, 
  strokeWidth = 8,
  className,
  isMain = false
}: RadialProgressProps) {
  const progressValue = useMotionValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = useTransform(progressValue, [0, 100], [circumference, 0]);
  
  const displayScore = useTransform(progressValue, (latest) => Math.round(latest));
  
  useEffect(() => {
    const controls = animate(progressValue, score, {
      duration: 2,
      ease: "easeOut",
      delay: 0.2
    });
    return controls.stop;
  }, [score, progressValue]);

  const getColor = (s: number) => {
    if (s >= 70) return "stroke-emerald-400";
    if (s >= 40) return "stroke-amber-400";
    return "stroke-rose-500";
  };
  
  const getGlow = (s: number) => {
    if (s >= 70) return "drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]";
    if (s >= 40) return "drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]";
    return "drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]";
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-white/10 fill-none"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={cn("fill-none transition-colors duration-1000", getColor(score), getGlow(score))}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ strokeDasharray: circumference, strokeDashoffset }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono">
          <motion.span className={cn("font-bold text-white", isMain ? "text-4xl" : "text-2xl")}>
            {displayScore}
          </motion.span>
        </div>
      </div>
      <span className={cn("text-sm font-medium uppercase tracking-wider text-muted-foreground", isMain && "text-base")}>
        {label}
      </span>
    </div>
  );
}
