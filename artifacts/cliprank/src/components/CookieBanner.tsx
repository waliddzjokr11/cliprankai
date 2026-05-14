import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "cliprank_cookie_consent";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

function loadGA4(measurementId: string) {
  if (!measurementId || document.getElementById("ga4-script")) return;
  const script = document.createElement("script");
  script.id = "ga4-script";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });
}

export function initAnalyticsIfConsented() {
  const consent = localStorage.getItem(CONSENT_KEY);
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  if (consent === "accepted" && measurementId) loadGA4(measurementId);
}

export function trackEvent(name: string, params?: Record<string, any>) {
  if (typeof window.gtag === "function") window.gtag("event", name, params);
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem(CONSENT_KEY);
    if (!existing) setVisible(true);
    else if (existing === "accepted") initAnalyticsIfConsented();
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    initAnalyticsIfConsented();
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[100]"
        >
          <div className="bg-[#141414] border border-white/[0.1] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <Cookie className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white mb-1">Cookie preferences</p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We use cookies for authentication (required) and anonymous analytics (optional) to improve the product.{" "}
                  <a href="/cookies" className="text-indigo-400 hover:underline">Cookie policy</a>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={decline}
                className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-xs font-medium text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
              >
                Decline optional
              </button>
              <button
                onClick={accept}
                className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
              >
                Accept all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
