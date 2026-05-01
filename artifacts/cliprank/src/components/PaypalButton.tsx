import { useEffect, useRef } from "react";
import { useCreatePaypalOrder, useCapturePaypalOrder, useUnlockPremium } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAnalysisQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface PaypalButtonProps {
  analysisId: string;
}

export function PaypalButton({ analysisId }: PaypalButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createOrder = useCreatePaypalOrder();
  const captureOrder = useCapturePaypalOrder();
  const unlockPremium = useUnlockPremium();

  useEffect(() => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
    if (!clientId) {
      if (containerRef.current) {
        containerRef.current.innerHTML = "<div class='text-sm text-destructive border border-destructive/50 p-4 rounded-md bg-destructive/10'>PayPal not configured</div>";
      }
      return;
    }

    if (!document.getElementById("paypal-sdk")) {
      const script = document.createElement("script");
      script.id = "paypal-sdk";
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.async = true;
      script.onload = renderButton;
      document.body.appendChild(script);
    } else if ((window as any).paypal) {
      renderButton();
    }

    function renderButton() {
      if (!containerRef.current || containerRef.current.hasChildNodes()) return;
      
      try {
        (window as any).paypal.Buttons({
          style: {
            layout: "horizontal",
            color: "gold",
            shape: "rect",
            label: "paypal",
          },
          createOrder: async () => {
            const result = await createOrder.mutateAsync({ data: { analysisId } });
            return result.orderId;
          },
          onApprove: async (data: any) => {
            try {
              await captureOrder.mutateAsync({ data: { orderId: data.orderID, analysisId } });
              await unlockPremium.mutateAsync({ 
                id: analysisId, 
                data: { paypalOrderId: data.orderID } 
              });
              
              queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) });
              
              toast({
                title: "Premium Unlocked",
                description: "Full professional analysis is now available.",
              });
            } catch (err) {
              toast({
                title: "Payment Capture Failed",
                description: "There was an issue processing your payment.",
                variant: "destructive",
              });
            }
          },
          onError: (err: any) => {
            console.error(err);
            toast({
              title: "Payment Error",
              description: "An error occurred with PayPal.",
              variant: "destructive",
            });
          }
        }).render(containerRef.current);
      } catch (err) {
        console.error("PayPal render error", err);
      }
    }
  }, [analysisId, createOrder, captureOrder, unlockPremium, queryClient, toast]);

  return (
    <div className="w-full max-w-sm mx-auto min-h-[45px]" ref={containerRef}></div>
  );
}
