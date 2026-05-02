import { useEffect } from "react";

const SITE = "ClipRank AI";

export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE}` : SITE;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", description);
    }
    return () => {
      document.title = `${SITE} — Viral Video Score for TikTok, Reels & Shorts`;
    };
  }, [title, description]);
}
