import { useState, useCallback, useRef } from "react";

export type UploadStep =
  | "idle"
  | "uploading"
  | "extracting"
  | "transcribing"
  | "scoring"
  | "researching"
  | "done"
  | "error";

export interface UploadProgress {
  step: UploadStep;
  pct: number;
  label: string;
}

export interface UploadResult {
  analysisId: string;
  durationSeconds: number;
}

const STEP_LABELS: Record<UploadStep, string> = {
  idle: "Ready",
  uploading: "Uploading video…",
  extracting: "Extracting frames…",
  transcribing: "Transcribing audio…",
  scoring: "Scoring virality…",
  researching: "Mapping viral patterns…",
  done: "Done",
  error: "Failed",
};

// Max time to wait with no SSE event before treating as stuck (3 min)
const SSE_TIMEOUT_MS = 3 * 60 * 1000;

export function useVideoUpload() {
  const [progress, setProgress] = useState<UploadProgress>({ step: "idle", pct: 0, label: STEP_LABELS.idle });
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const sseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSseTimeout = () => {
    if (sseTimeoutRef.current) {
      clearTimeout(sseTimeoutRef.current);
      sseTimeoutRef.current = null;
    }
  };

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    esRef.current?.close();
    clearSseTimeout();
    setProgress({ step: "idle", pct: 0, label: STEP_LABELS.idle });
    setAnalysisId(null);
    setError(null);
  }, []);

  const upload = useCallback(
    (file: File, userId: string): Promise<UploadResult> => {
      return new Promise((resolve, reject) => {
        reset();
        setProgress({ step: "uploading", pct: 0, label: STEP_LABELS.uploading });

        const formData = new FormData();
        formData.append("video", file);
        formData.append("userId", userId);
        formData.append("filename", file.name);

        const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress({ step: "uploading", pct, label: `Uploading… ${pct}%` });
          }
        };

        xhr.onload = () => {
          if (xhr.status === 402) {
            const body = JSON.parse(xhr.responseText ?? "{}");
            reject({ status: 402, ...body });
            return;
          }
          if (xhr.status !== 200 && xhr.status !== 201) {
            const msg = (() => { try { return JSON.parse(xhr.responseText).error; } catch { return "Upload failed"; } })();
            setError(msg);
            setProgress({ step: "error", pct: 0, label: msg });
            reject(new Error(msg));
            return;
          }

          const { jobId, analysisId: cachedId, durationSeconds } = JSON.parse(xhr.responseText);

          // Cache hit — server returned an existing analysis immediately
          if (cachedId) {
            setAnalysisId(cachedId);
            setProgress({ step: "done", pct: 100, label: STEP_LABELS.done });
            resolve({ analysisId: cachedId, durationSeconds });
            return;
          }

          // Connect to SSE stream
          setProgress({ step: "extracting", pct: 5, label: STEP_LABELS.extracting });
          const es = new EventSource(`${basePath}/api/videos/jobs/${jobId}/stream`);
          esRef.current = es;

          // Watchdog: if no event arrives in SSE_TIMEOUT_MS, fail gracefully
          const resetSseTimeout = () => {
            clearSseTimeout();
            sseTimeoutRef.current = setTimeout(() => {
              es.close();
              const msg = "Processing timed out. Please try again.";
              setError(msg);
              setProgress({ step: "error", pct: 0, label: msg });
              reject(new Error(msg));
            }, SSE_TIMEOUT_MS);
          };
          resetSseTimeout();

          es.onmessage = (e) => {
            // Any message resets the inactivity timer
            resetSseTimeout();
            try {
              const data = JSON.parse(e.data);
              if (data.type === "progress") {
                const s = data.step as UploadStep;
                setProgress({ step: s, pct: data.pct ?? 0, label: data.label ?? STEP_LABELS[s] });
              } else if (data.type === "done") {
                clearSseTimeout();
                es.close();
                setAnalysisId(data.analysisId);
                setProgress({ step: "done", pct: 100, label: STEP_LABELS.done });
                resolve({ analysisId: data.analysisId, durationSeconds: data.durationSeconds ?? 0 });
              } else if (data.type === "error") {
                clearSseTimeout();
                es.close();
                const msg = data.message ?? "Processing failed";
                setError(msg);
                setProgress({ step: "error", pct: 0, label: msg });
                reject(new Error(msg));
              }
            } catch {
              // ignore parse errors
            }
          };

          es.onerror = () => {
            clearSseTimeout();
            es.close();
            const msg = "Connection lost during processing";
            setError(msg);
            setProgress({ step: "error", pct: 0, label: msg });
            reject(new Error(msg));
          };
        };

        xhr.onerror = () => {
          const msg = "Network error during upload";
          setError(msg);
          setProgress({ step: "error", pct: 0, label: msg });
          reject(new Error(msg));
        };

        xhr.open("POST", `${basePath}/api/videos/upload`);
        xhr.send(formData);
      });
    },
    [reset]
  );

  const isActive = progress.step !== "idle" && progress.step !== "done" && progress.step !== "error";

  return { upload, reset, progress, analysisId, error, isActive };
}
