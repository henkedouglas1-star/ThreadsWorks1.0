import { useState, useEffect, useCallback, useRef } from "react";
import { auth, db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { isEntitledAccount } from "../utils/contentLimit";

export const FREE_MONTHLY_GENERATION_LIMIT = 150;
export const CANONICAL_LIMIT_REACHED_MESSAGE =
  "You've used all 150 Free AI content generations this month.";

export function formatGenerationsRemaining(remaining: number): string {
  if (remaining <= 0) {
    return CANONICAL_LIMIT_REACHED_MESSAGE;
  }
  return `${remaining} of 150 generations remaining this month`;
}

export function getCurrentMonthPeriodKey(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface GenerationUsageState {
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  period: string;
  isLimitReached: boolean;
  displayMessage: string;
  loading: boolean;
}

// In-memory cache for fast synchronous access
let cachedUsage: {
  userId: string;
  used: number;
  remaining: number;
  period: string;
  isPro: boolean;
} = {
  userId: "",
  used: 0,
  remaining: 150,
  period: getCurrentMonthPeriodKey(),
  isPro: false,
};

// Initialize cache from localStorage
try {
  const stored = localStorage.getItem("tw_generation_usage");
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.period === getCurrentMonthPeriodKey()) {
      cachedUsage = parsed;
    }
  }
} catch (_) {}

export function getCachedGenerationUsage() {
  const currentPeriod = getCurrentMonthPeriodKey();
  if (cachedUsage.period !== currentPeriod) {
    cachedUsage = {
      userId: cachedUsage.userId,
      used: 0,
      remaining: 150,
      period: currentPeriod,
      isPro: cachedUsage.isPro,
    };
  }
  return cachedUsage;
}

export function updateLocalGenerationUsage(used: number, remaining?: number) {
  const currentPeriod = getCurrentMonthPeriodKey();
  const safeUsed = Math.max(0, Math.min(150, used));
  const safeRemaining = typeof remaining === "number" ? Math.max(0, remaining) : Math.max(0, 150 - safeUsed);

  cachedUsage = {
    ...cachedUsage,
    used: safeUsed,
    remaining: safeRemaining,
    period: currentPeriod,
  };

  try {
    localStorage.setItem("tw_generation_usage", JSON.stringify(cachedUsage));
  } catch (_) {}

  // Dispatch custom window event for instant component synchronization
  try {
    window.dispatchEvent(new CustomEvent("tw:generation-usage-updated", { detail: cachedUsage }));
  } catch (_) {}
}

/**
 * Fetch generation usage from server.
 */
export async function fetchGenerationUsage(userId?: string): Promise<GenerationUsageState> {
  const effectiveUserId = userId || auth.currentUser?.uid || "anonymous";
  const email = auth.currentUser?.email || "";
  const isEntitled = isEntitledAccount(email);

  try {
    const res = await fetch(`/api/generation-usage?userId=${encodeURIComponent(effectiveUserId)}&email=${encodeURIComponent(email)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.isPro || isEntitled) {
        return {
          isPro: true,
          limit: Infinity,
          used: 0,
          remaining: Infinity,
          period: data.period || getCurrentMonthPeriodKey(),
          isLimitReached: false,
          displayMessage: "Unlimited generations",
          loading: false,
        };
      }

      const used = typeof data.used === "number" ? data.used : 0;
      const remaining = typeof data.remaining === "number" ? data.remaining : Math.max(0, 150 - used);
      updateLocalGenerationUsage(used, remaining);

      return {
        isPro: false,
        limit: 150,
        used,
        remaining,
        period: data.period || getCurrentMonthPeriodKey(),
        isLimitReached: remaining <= 0,
        displayMessage: formatGenerationsRemaining(remaining),
        loading: false,
      };
    }
  } catch (err) {
    console.warn("[GENERATION_USAGE_CLIENT] Failed to fetch server usage:", err);
  }

  // Fallback to cached state
  const cached = getCachedGenerationUsage();
  return {
    isPro: isEntitled || cached.isPro,
    limit: 150,
    used: cached.used,
    remaining: cached.remaining,
    period: cached.period,
    isLimitReached: cached.remaining <= 0,
    displayMessage: formatGenerationsRemaining(cached.remaining),
    loading: false,
  };
}

/**
 * React hook for consuming and observing monthly AI content generation allowance.
 */
export function useGenerationUsage(
  userId?: string,
  subscriptionStatus?: string,
  userEmail?: string
): GenerationUsageState & { refreshUsage: () => Promise<void> } {
  const isPro = subscriptionStatus === "active" || isEntitledAccount(userEmail || auth.currentUser?.email);

  const [state, setState] = useState<GenerationUsageState>(() => {
    if (isPro) {
      return {
        isPro: true,
        limit: Infinity,
        used: 0,
        remaining: Infinity,
        period: getCurrentMonthPeriodKey(),
        isLimitReached: false,
        displayMessage: "Unlimited generations",
        loading: false,
      };
    }
    const cached = getCachedGenerationUsage();
    return {
      isPro: false,
      limit: 150,
      used: cached.used,
      remaining: cached.remaining,
      period: cached.period,
      isLimitReached: cached.remaining <= 0,
      displayMessage: formatGenerationsRemaining(cached.remaining),
      loading: true,
    };
  });

  const effectiveUserId = userId || auth.currentUser?.uid || "anonymous";

  const refreshUsage = useCallback(async () => {
    if (isPro) {
      setState({
        isPro: true,
        limit: Infinity,
        used: 0,
        remaining: Infinity,
        period: getCurrentMonthPeriodKey(),
        isLimitReached: false,
        displayMessage: "Unlimited generations",
        loading: false,
      });
      return;
    }
    const latest = await fetchGenerationUsage(effectiveUserId);
    setState(latest);
  }, [effectiveUserId, isPro]);

  // Real-time Firestore document listener on users/{userId} for usage syncing
  useEffect(() => {
    if (isPro) {
      setState({
        isPro: true,
        limit: Infinity,
        used: 0,
        remaining: Infinity,
        period: getCurrentMonthPeriodKey(),
        isLimitReached: false,
        displayMessage: "Unlimited generations",
        loading: false,
      });
      return;
    }

    // Initial fetch from server
    refreshUsage();

    // Listen for custom window events when generations succeed in other components
    const handleUsageUpdated = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setState((prev) => ({
          ...prev,
          used: detail.used,
          remaining: detail.remaining,
          isLimitReached: detail.remaining <= 0,
          displayMessage: formatGenerationsRemaining(detail.remaining),
          loading: false,
        }));
      }
    };
    window.addEventListener("tw:generation-usage-updated", handleUsageUpdated);

    // If authenticated user, attach real-time Firestore listener to user doc
    let unsubscribe: (() => void) | null = null;
    if (effectiveUserId && effectiveUserId !== "anonymous") {
      try {
        const userRef = doc(db, "users", effectiveUserId);
        unsubscribe = onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data?.generationUsage) {
                const currentPeriod = getCurrentMonthPeriodKey();
                const usage = data.generationUsage;
                if (usage.period === currentPeriod) {
                  const used = typeof usage.count === "number" ? usage.count : 0;
                  const remaining = Math.max(0, 150 - used);
                  updateLocalGenerationUsage(used, remaining);
                  setState({
                    isPro: false,
                    limit: 150,
                    used,
                    remaining,
                    period: currentPeriod,
                    isLimitReached: remaining <= 0,
                    displayMessage: formatGenerationsRemaining(remaining),
                    loading: false,
                  });
                }
              }
            }
          },
          (err) => {
            console.warn("[GENERATION_USAGE_LISTENER] Listener error:", err);
          }
        );
      } catch (_) {}
    }

    return () => {
      window.removeEventListener("tw:generation-usage-updated", handleUsageUpdated);
      if (unsubscribe) unsubscribe();
    };
  }, [effectiveUserId, isPro, refreshUsage]);

  return {
    ...state,
    refreshUsage,
  };
}
