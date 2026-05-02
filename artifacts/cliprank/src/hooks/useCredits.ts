import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/react";
import {
  useGetUserCredits,
  useInitUser,
  useCaptureCreditOrder,
  useCreateCreditOrder,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useCredits() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const initUser = useInitUser();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    initUser.mutateAsync({ data: { userId } })
      .then(() => setInitialized(true))
      .catch(() => setInitialized(true));
  }, [isLoaded, userId]);

  const { data, refetch } = useGetUserCredits(userId ?? "", {
    query: {
      enabled: initialized && !!userId,
      queryKey: ["userCredits", userId ?? ""],
      staleTime: 0,
    },
  });

  const credits = data?.credits ?? null;

  const creditsRequired = useCallback((durationSeconds: number) => {
    return Math.ceil(durationSeconds / 10);
  }, []);

  const hasEnoughCredits = useCallback(
    (durationSeconds: number) => {
      if (credits === null) return true;
      return credits >= creditsRequired(durationSeconds);
    },
    [credits, creditsRequired]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["userCredits", userId ?? ""] });
  }, [queryClient, userId]);

  return { userId, credits, creditsRequired, hasEnoughCredits, refetch: invalidate, initialized };
}

export function usePurchaseCredits() {
  const createOrder = useCreateCreditOrder();
  const captureOrder = useCaptureCreditOrder();

  return {
    createOrder,
    captureOrder,
    isLoading: createOrder.isPending || captureOrder.isPending,
  };
}
