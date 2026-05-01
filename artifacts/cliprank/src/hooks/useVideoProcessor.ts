import { useState, useCallback, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export interface ProcessorResult {
  frames: string[];
  audioBase64: string | null;
  fingerprint: string;
  durationSeconds: number;
}

export function useVideoProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const getFingerprint = async (file: File): Promise<string> => {
    const arrayBuffer = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const processVideo = useCallback(async (file: File): Promise<ProcessorResult> => {
    setIsProcessing(true);
    setProgress(0);
    try {
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
        ffmpegRef.current.on("progress", ({ progress: p }) => {
          setProgress(Math.round(p * 100));
        });
        await ffmpegRef.current.load();
      }
      
      const ffmpeg = ffmpegRef.current;
      const fileName = "input.mp4";
      await ffmpeg.writeFile(fileName, await fetchFile(file));
      
      // Calculate duration manually since ffprobe output parsing is complex here
      const durationSeconds = Math.max(1, Math.round(file.size / (1024 * 1024 * 2))); // Very rough estimate just for fallback if needed. In reality, would parse from ffmpeg output, but for now we'll do this. Let's actually use HTMLVideoElement to get exact duration.
      
      const actualDuration = await new Promise<number>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.src = URL.createObjectURL(file);
      });

      // Extract 1 frame every 2 seconds
      await ffmpeg.exec([
        "-i", fileName,
        "-vf", "fps=1/2,scale=320:-1", // Extract 1 frame per 2 sec, resize width to 320 to keep size small
        "-q:v", "2",
        "frame_%03d.jpg"
      ]);

      const frames: string[] = [];
      let i = 1;
      while (frames.length < 20) {
        const frameName = `frame_${i.toString().padStart(3, "0")}.jpg`;
        try {
          const data = await ffmpeg.readFile(frameName);
          const base64 = btoa(
            new Uint8Array(data as Uint8Array).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          frames.push(base64);
          i++;
        } catch (e) {
          break; // No more frames
        }
      }
      
      const fingerprint = await getFingerprint(file);
      
      return {
        frames,
        audioBase64: null, // Audio extraction can be added later if really needed
        fingerprint,
        durationSeconds: Math.round(actualDuration),
      };
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  }, []);

  return { processVideo, isProcessing, progress };
}
