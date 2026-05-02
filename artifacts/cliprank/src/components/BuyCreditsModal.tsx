import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Star, Crown } from "lucide-react";
import { userId } from "@/hooks/useCredits";
import { useCreateCreditOrder, useCaptureCreditOrder } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface Tier {
  credits: 50 | 150 | 500;
  price: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    credits: 50,
    price: "$9.99",
    label: "Starter",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    credits: 150,
    price: "$19.99",
    label: "Creator",
    icon: <Star className="w-5 h-5" />,
    badge: "Most Popular",
    highlight: true,
  },
  {
    credits: 500,
    price: "$49.99",
    label: "Pro",
    icon: <Crown className="w-5 h-5" />,
    badge: "Best Value",
  },
];

interface BuyCreditsModalProps {
  open: boolean;
  onClose: () => void;
  onPurchased: (newBalance: number) => void;
  currentCredits: number | null;
}

function TierPaypalButton({
  tier,
  onPurchased,
  onClose,
}: {
  tier: Tier;
  onPurchased: (n: number) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const { toast } = useToast();
  const createOrder = useCreateCreditOrder();
  const captureOrder = useCaptureCreditOrder();

  const renderButton = useCallback(() => {
    if (!containerRef.current || rendered.current) return;
    if (!(window as any).paypal) return;
    rendered.current = true;

    try {
      (window as any).paypal
        .Buttons({
          style: { layout: "horizontal", color: "gold", shape: "rect", label: "pay", height: 40 },
          createOrder: async () => {
            const result = await createOrder.mutateAsync({
              data: { userId, credits: tier.credits },
            });
            return result.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              const result = await captureOrder.mutateAsync({
                data: { orderId: data.orderID, userId, credits: tier.credits },
              });
              toast({
                title: "Credits Added!",
                description: `${tier.credits} credits added. New balance: ${result.newBalance}`,
              });
              onPurchased(result.newBalance);
              onClose();
            } catch {
              toast({
                title: "Payment Failed",
                description: "Could not process your payment. Please try again.",
                variant: "destructive",
              });
            }
          },
          onError: () => {
            toast({
              title: "PayPal Error",
              description: "An error occurred. Please try again.",
              variant: "destructive",
            });
          },
        })
        .render(containerRef.current);
    } catch (err) {
      console.error("PayPal render error", err);
    }
  }, [tier.credits, createOrder, captureOrder, toast, onPurchased, onClose]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
    if (!clientId) {
      if (containerRef.current) {
        containerRef.current.innerHTML =
          "<p class='text-xs text-destructive text-center py-2'>PayPal not configured</p>";
      }
      return;
    }

    if (!(window as any).paypal && !document.getElementById("paypal-sdk")) {
      const script = document.createElement("script");
      script.id = "paypal-sdk";
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.async = true;
      script.onload = renderButton;
      document.body.appendChild(script);
    } else if ((window as any).paypal) {
      renderButton();
    } else {
      const existing = document.getElementById("paypal-sdk");
      if (existing) existing.addEventListener("load", renderButton);
    }
  }, [renderButton]);

  return <div ref={containerRef} className="min-h-[44px] mt-3" />;
}

export function BuyCreditsModal({ open, onClose, onPurchased, currentCredits }: BuyCreditsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden"
              initial={{ y: 40, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top gradient bar */}
              <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-blue-500" />

              <div className="p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Buy Credits</h2>
                    <p className="text-muted-foreground text-sm">
                      1 credit = 10 seconds of video processed
                      {currentCredits !== null && (
                        <span className="ml-2 text-primary font-medium">
                          · Current balance: {currentCredits} credits
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tiers */}
                <div className="grid grid-cols-3 gap-4">
                  {TIERS.map((tier) => (
                    <div
                      key={tier.credits}
                      className={`relative rounded-xl border p-5 flex flex-col gap-2 transition-colors ${
                        tier.highlight
                          ? "border-primary/60 bg-primary/5"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      {tier.badge && (
                        <div
                          className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                            tier.highlight
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70"
                          }`}
                        >
                          {tier.badge}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-primary">
                        {tier.icon}
                        <span className="font-semibold text-sm text-white">{tier.label}</span>
                      </div>

                      <div>
                        <span className="text-3xl font-bold">{tier.price}</span>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <span className="text-white font-semibold">{tier.credits}</span> credits
                        <div className="text-xs mt-0.5">
                          ≈ {Math.floor((tier.credits * 10) / 60)} min of video
                        </div>
                      </div>

                      <TierPaypalButton
                        tier={tier}
                        onPurchased={onPurchased}
                        onClose={onClose}
                      />
                    </div>
                  ))}
                </div>

                <p className="text-center text-xs text-muted-foreground mt-6">
                  Credits never expire · Secure payment via PayPal
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
