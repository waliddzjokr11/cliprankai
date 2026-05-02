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
          setProgress(Math.round(Math.min(p * 100, 99)));
        });
        await ffmpegRef.current.load();
      }

      const ffmpeg = ffmpegRef.current;
      const fileName = "input.mp4";
      await ffmpeg.writeFile(fileName, await fetchFile(file));

      // Get exact duration via HTMLVideoElement
      const actualDuration = await new Promise<number>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.onerror = () => resolve(30); // fallback
        video.src = URL.createObjectURL(file);
      });

      // Extract 1 JPG every 60 frames (fast — only a handful of frames per clip)
      // -vsync vfr ensures no duplicate frames when the filter skips
      await ffmpeg.exec([
        "-i", fileName,
        "-vf", "select='not(mod(n\\,60))',scale=320:-1",
        "-vsync", "vfr",
        "-q:v", "3",
        "frame_%03d.jpg",
      ]);

      const frames: string[] = [];
      let i = 1;
      while (frames.length < 20) {
        const frameName = `frame_${i.toString().padStart(3, "0")}.jpg`;
        try {
          const data = await ffmpeg.readFile(frameName);
          const base64 = btoa(
            new Uint8Array(data as Uint8Array).reduce(
              (acc, byte) => acc + String.fromCharCode(byte),
              ""
            )
          );
          frames.push(base64);
          i++;
        } catch {
          break; // no more frames
        }
      }

      setProgress(100);
      const fingerprint = await getFingerprint(file);

      return {
        frames,
        audioBase64: null,
        fingerprint,
        durationSeconds: Math.round(actualDuration),
      };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { processVideo, isProcessing, progress };
}
