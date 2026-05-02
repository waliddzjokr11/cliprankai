import { useState, useEffect, useCallback } from "react";
import { useGetUserCredits, useInitUser, useCaptureCreditOrder, useCreateCreditOrder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const USER_ID_KEY = "cliprank_user_id";

function getOrCreateUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export const userId = getOrCreateUserId();

export function useCredits() {
  const queryClient = useQueryClient();
  const initUser = useInitUser();

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initUser.mutateAsync({ data: { userId } }).then(() => {
      setInitialized(true);
    }).catch(() => {
      setInitialized(true);
    });
  }, []);

  const { data, refetch } = useGetUserCredits(userId, {
    query: {
      enabled: initialized,
      queryKey: ["userCredits", userId],
      staleTime: 0,
    },
  });

  const credits = data?.credits ?? null;

  const creditsRequired = useCallback((durationSeconds: number) => {
    return Math.ceil(durationSeconds / 10);
  }, []);

  const hasEnoughCredits = useCallback(
    (durationSeconds: number) => {
      if (credits === null) return true; // optimistic while loading
      return credits >= creditsRequired(durationSeconds);
    },
    [credits, creditsRequired]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["userCredits", userId] });
  }, [queryClient]);

  return { credits, creditsRequired, hasEnoughCredits, refetch: invalidate, initialized };
}

export function usePurchaseCredits() {
  const createOrder = useCreateCreditOrder();
  const captureOrder = useCaptureCreditOrder();

  const purchase = useCallback(
    async (credits: 50 | 150 | 500, onSuccess: (newBalance: number) => void) => {
      const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
      if (!clientId) throw new Error("PayPal not configured");

      const createOrderFn = async () => {
        const result = await createOrder.mutateAsync({
          data: { userId, credits },
        });
        return result.orderId;
      };

      const onApprove = async (data: { orderID: string }) => {
        const result = await captureOrder.mutateAsync({
          data: { orderId: data.orderID, userId, credits },
        });
        onSuccess(result.newBalance);
      };

      return { createOrderFn, onApprove };
    },
    [createOrder, captureOrder]
  );

  return { purchase, isLoading: createOrder.isPending || captureOrder.isPending };
}
