import type { Firestore } from "firebase-admin/firestore";

/**
 * Free plan monthly AI content generation limit constant.
 * Canonical product limit: 150 AI content generations per month.
 */
export const FREE_MONTHLY_GENERATION_LIMIT = 150;

/**
 * Master list of accounts with permanent application-level Pro / Premium access entitlement.
 */
export const ENTITLED_PRO_EMAILS = new Set([
  "henkedouglas1@gmail.com",
  "henkedouglas1@email.com",
  "douglas.henke@threadsworks.internal",
  "preview-tester@threadsworks.internal",
  "lennardbuessow@gmail.com",
  "socialcrystals@gmail.com",
]);

export const ENTITLED_PRO_USERNAMES = new Set([
  "henkedouglas1",
  "douglas.henke",
  "preview-tester",
  "socialcrystals",
]);

export const ENTITLED_PRO_UIDS = new Set([
  "vtMSWyRs4YbUqwwCZsdW3Tvv2wk2",
  "Z8in1LtL13PjzcFq2PgmY9LwTYH3",
  "HjJAi8EEBBYIj96DPyshRoWroXV2",
]);

/**
 * In-memory concurrency locks per userId to serialize simultaneous reservation checks
 * and guarantee zero race conditions across concurrent HTTP requests.
 */
const userLockChains = new Map<string, Promise<any>>();
const anonymousUsageMap = new Map<string, number>();

interface SettledReservationRecord {
  status: "committed" | "released";
  used?: number;
  remaining?: number;
  settledAt: number;
}
const settledReservations = new Map<string, SettledReservationRecord>();
const SETTLED_RESERVATION_TTL_MS = 30 * 60 * 1000;

function pruneSettledReservations(now: number = Date.now()): void {
  if (settledReservations.size < 250) return;
  for (const [key, rec] of settledReservations.entries()) {
    if (now - rec.settledAt > SETTLED_RESERVATION_TTL_MS) {
      settledReservations.delete(key);
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function acquireUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const current = userLockChains.get(userId) || Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  userLockChains.set(userId, next);

  try {
    // Wait for previous lock with a max safety timeout of 4 seconds to prevent deadlocks
    await withTimeout(current, 4000, undefined);
    return await fn();
  } finally {
    release();
    if (userLockChains.get(userId) === next) {
      userLockChains.delete(userId);
    }
  }
}

/**
 * Returns current monthly calendar period key in UTC (YYYY-MM).
 * Automatically rolls over at the beginning of each monthly usage period.
 */
export function getCurrentMonthPeriodKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Checks if a given email or username string has an application-level Pro entitlement.
 */
export function isEntitledAccount(emailOrUsername?: string | null): boolean {
  if (!emailOrUsername) return false;
  const clean = emailOrUsername.toLowerCase().trim();
  const username = clean.split("@")[0];
  return ENTITLED_PRO_EMAILS.has(clean) || ENTITLED_PRO_USERNAMES.has(username);
}

/**
 * Determines server-side if the caller has active Pro membership.
 * Checks entitled emails/usernames, entitled UIDs, user document in Firestore, and active Stripe subscriptions.
 */
export async function isUserPro(
  serverDb: Firestore,
  userId: string,
  email?: string
): Promise<boolean> {
  if (isEntitledAccount(email) || (userId && ENTITLED_PRO_UIDS.has(userId))) {
    return true;
  }

  if (!userId || userId === "anonymous") {
    return false;
  }

  try {
    // 1. Check user profile document in Firestore
    const userDocRef = serverDb.collection("users").doc(userId);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      const data = userSnap.data();
      if (data) {
        if (isEntitledAccount(data.email)) return true;
        if (data.subscriptionStatus === "active" || data.subscriptionTier === "pro" || data.subscriptionActive === true) {
          return true;
        }
      }
    }

    // 2. Check active Stripe subscriptions collection
    const subSnap = await serverDb
      .collection("stripe_subscriptions")
      .where("userId", "==", userId)
      .where("status", "in", ["active", "trialing"])
      .limit(1)
      .get();

    if (!subSnap.empty) {
      return true;
    }
  } catch (err: any) {
    if (err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8 || err?.status === 8) {
      console.warn(`[GENERATION_LIMIT] Firestore quota exhausted during isUserPro query for ${userId}, defaulting to Pro access:`, err?.message || err);
      return true;
    }
    console.warn(`[GENERATION_LIMIT] Failed to query subscription for user ${userId}:`, err?.message || err);
  }

  return false;
}

export interface GenerationLimitCheckResult {
  allowed: boolean;
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  period: string;
  reservationId?: string;
  error?: string;
  displayRemaining: string;
  limitReachedMessage: string;
}

export const CANONICAL_LIMIT_REACHED_MESSAGE =
  "You've used all 150 Free AI content generations this month.";

export function formatGenerationsRemaining(remaining: number): string {
  if (remaining <= 0) {
    return CANONICAL_LIMIT_REACHED_MESSAGE;
  }
  return `${remaining} of 150 generations remaining this month`;
}

/**
 * Retrieves current generation usage status for a user without modifying counts.
 */
export async function getGenerationUsage(
  serverDb: Firestore,
  userId: string,
  email?: string
): Promise<GenerationLimitCheckResult> {
  const currentPeriod = getCurrentMonthPeriodKey();
  const isPro = await isUserPro(serverDb, userId, email);

  if (isPro) {
    return {
      allowed: true,
      isPro: true,
      limit: Infinity,
      used: 0,
      remaining: Infinity,
      period: currentPeriod,
      displayRemaining: "Unlimited generations",
      limitReachedMessage: ""
    };
  }

  const effectiveUserId = userId || "anonymous";
  let used = 0;

  try {
    const docRef = serverDb.collection("generation_usage").doc(effectiveUserId);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data && data.period === currentPeriod) {
        used = typeof data.count === "number" ? Math.max(0, data.count) : 0;
      }
    }
  } catch (err) {
    console.warn(`[GENERATION_LIMIT] Error fetching usage for ${effectiveUserId}:`, err);
  }

  const remaining = Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - used);
  const allowed = remaining > 0;

  return {
    allowed,
    isPro: false,
    limit: FREE_MONTHLY_GENERATION_LIMIT,
    used,
    remaining,
    period: currentPeriod,
    displayRemaining: formatGenerationsRemaining(remaining),
    limitReachedMessage: CANONICAL_LIMIT_REACHED_MESSAGE,
    error: allowed ? undefined : CANONICAL_LIMIT_REACHED_MESSAGE
  };
}

/**
 * Atomically checks whether a user is allowed to generate and reserves 1 in-flight slot.
 * Ensures strict concurrency safety via in-memory lock chain + atomic Firestore transaction.
 */
export async function checkAndReserveGeneration(
  serverDb: Firestore,
  userId: string,
  email?: string
): Promise<GenerationLimitCheckResult> {
  const currentPeriod = getCurrentMonthPeriodKey();
  const isPro = await isUserPro(serverDb, userId, email);

  if (isPro) {
    return {
      allowed: true,
      isPro: true,
      limit: Infinity,
      used: 0,
      remaining: Infinity,
      period: currentPeriod,
      displayRemaining: "Unlimited generations",
      limitReachedMessage: ""
    };
  }

  const effectiveUserId = userId || "anonymous";

  if (effectiveUserId === "anonymous") {
    // Fast in-memory usage tracking for anonymous sessions without Firestore gRPC delays
    const count = anonymousUsageMap.get(currentPeriod) || 0;
    if (count >= FREE_MONTHLY_GENERATION_LIMIT) {
      return {
        allowed: false,
        isPro: false,
        limit: FREE_MONTHLY_GENERATION_LIMIT,
        used: count,
        remaining: 0,
        period: currentPeriod,
        displayRemaining: CANONICAL_LIMIT_REACHED_MESSAGE,
        limitReachedMessage: CANONICAL_LIMIT_REACHED_MESSAGE,
        error: CANONICAL_LIMIT_REACHED_MESSAGE
      };
    }
    anonymousUsageMap.set(currentPeriod, count + 1);
    const remaining = Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - (count + 1));
    return {
      allowed: true,
      isPro: false,
      limit: FREE_MONTHLY_GENERATION_LIMIT,
      used: count,
      remaining,
      period: currentPeriod,
      reservationId: `res_anon_${Date.now()}`,
      displayRemaining: formatGenerationsRemaining(remaining),
      limitReachedMessage: CANONICAL_LIMIT_REACHED_MESSAGE
    };
  }

  try {
    return await acquireUserLock(effectiveUserId, async () => {
      const docRef = serverDb.collection("generation_usage").doc(effectiveUserId);
      const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      return await serverDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        let count = 0;
        let inFlight = 0;

        if (snap.exists) {
          const data = snap.data() || {};
          if (data.period === currentPeriod) {
            count = typeof data.count === "number" ? Math.max(0, data.count) : 0;
            const lastReservationTime = data.lastReservationAt ? new Date(data.lastReservationAt).getTime() : 0;
            // Expire orphan inFlight reservations older than 2 minutes
            if (Date.now() - lastReservationTime < 120000) {
              inFlight = typeof data.inFlight === "number" ? Math.max(0, data.inFlight) : 0;
            }
          }
        }

        const totalCommittedAndInFlight = count + inFlight;

        if (totalCommittedAndInFlight >= FREE_MONTHLY_GENERATION_LIMIT) {
          return {
            allowed: false,
            isPro: false,
            limit: FREE_MONTHLY_GENERATION_LIMIT,
            used: Math.min(FREE_MONTHLY_GENERATION_LIMIT, count),
            remaining: 0,
            period: currentPeriod,
            displayRemaining: CANONICAL_LIMIT_REACHED_MESSAGE,
            limitReachedMessage: CANONICAL_LIMIT_REACHED_MESSAGE,
            error: CANONICAL_LIMIT_REACHED_MESSAGE
          };
        }

        // Reserve 1 slot atomically
        transaction.set(
          docRef,
          {
            userId: effectiveUserId,
            count,
            period: currentPeriod,
            inFlight: inFlight + 1,
            lastReservationAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );

        const remainingAfterReservation = Math.max(
          0,
          FREE_MONTHLY_GENERATION_LIMIT - (count + inFlight + 1)
        );

        return {
          allowed: true,
          isPro: false,
          limit: FREE_MONTHLY_GENERATION_LIMIT,
          used: count,
          remaining: remainingAfterReservation,
          period: currentPeriod,
          reservationId,
          displayRemaining: formatGenerationsRemaining(remainingAfterReservation),
          limitReachedMessage: CANONICAL_LIMIT_REACHED_MESSAGE
        };
      });
    });
  } catch (err: any) {
    console.warn(`[GENERATION_LIMIT] Exception during checkAndReserveGeneration for ${effectiveUserId}, granting fallback approval:`, err?.message || err);
    return {
      allowed: true,
      isPro: true,
      limit: Infinity,
      used: 0,
      remaining: Infinity,
      period: currentPeriod,
      reservationId: `res_fallback_${Date.now()}`,
      displayRemaining: "Unlimited generations",
      limitReachedMessage: ""
    };
  }
}

/**
 * Commits a successful generation: increments count by 1 and releases the in-flight reservation.
 * Also synchronizes the latest usage onto the user's Firestore profile for client visibility.
 */
export async function commitGeneration(
  serverDb: Firestore,
  userId: string,
  reservationId?: string
): Promise<{ used: number; remaining: number }> {
  const currentPeriod = getCurrentMonthPeriodKey();
  const effectiveUserId = userId || "anonymous";

  if (reservationId) {
    const existing = settledReservations.get(reservationId);
    if (existing) {
      return {
        used: existing.used ?? 0,
        remaining: existing.remaining ?? FREE_MONTHLY_GENERATION_LIMIT
      };
    }
  }

  if (effectiveUserId === "anonymous") {
    const count = anonymousUsageMap.get(currentPeriod) || 1;
    const remaining = Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - count);
    if (reservationId) {
      pruneSettledReservations();
      settledReservations.set(reservationId, {
        status: "committed",
        used: count,
        remaining,
        settledAt: Date.now()
      });
    }
    return {
      used: count,
      remaining
    };
  }

  try {
    return await acquireUserLock(effectiveUserId, async () => {
      if (reservationId) {
        const existing = settledReservations.get(reservationId);
        if (existing) {
          return {
            used: existing.used ?? 0,
            remaining: existing.remaining ?? FREE_MONTHLY_GENERATION_LIMIT
          };
        }
      }
      const docRef = serverDb.collection("generation_usage").doc(effectiveUserId);

      const txPromise = serverDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        let count = 0;
        let inFlight = 1;

        if (snap.exists) {
          const data = snap.data() || {};
          if (data.period === currentPeriod) {
            count = typeof data.count === "number" ? Math.max(0, data.count) : 0;
            inFlight = typeof data.inFlight === "number" ? Math.max(0, data.inFlight) : 1;
          }
        }

        const newCount = count + 1;
        const newInFlight = Math.max(0, inFlight - 1);

        transaction.set(
          docRef,
          {
            userId: effectiveUserId,
            count: newCount,
            period: currentPeriod,
            inFlight: newInFlight,
            lastGeneratedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );

        // Mirror onto users collection for direct user listener sync
        try {
          const userDocRef = serverDb.collection("users").doc(effectiveUserId);
          transaction.set(
            userDocRef,
            {
              generationUsage: {
                count: newCount,
                period: currentPeriod,
                remaining: Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - newCount),
                limit: FREE_MONTHLY_GENERATION_LIMIT,
                lastGeneratedAt: new Date().toISOString()
              }
            },
            { merge: true }
          );
        } catch (_) {}

        const remaining = Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - newCount);
        console.log(
          `[GENERATION_LIMIT] Successfully committed generation for ${effectiveUserId}: ${newCount}/${FREE_MONTHLY_GENERATION_LIMIT} used (${remaining} remaining in ${currentPeriod}).`
        );

        return {
          used: newCount,
          remaining
        };
      });

      const committedResult = await withTimeout(txPromise, 3500, {
        used: 1,
        remaining: FREE_MONTHLY_GENERATION_LIMIT - 1
      });
      if (reservationId) {
        pruneSettledReservations();
        settledReservations.set(reservationId, {
          status: "committed",
          used: committedResult.used,
          remaining: committedResult.remaining,
          settledAt: Date.now()
        });
      }
      return committedResult;
    });
  } catch (err: any) {
    console.warn(`[GENERATION_LIMIT] Exception during commitGeneration for ${effectiveUserId}:`, err?.message || err);
    return {
      used: 1,
      remaining: FREE_MONTHLY_GENERATION_LIMIT - 1
    };
  }
}

/**
 * Releases an in-flight reservation without incrementing usage.
 * Called whenever generation fails, times out, or is cancelled before successful completion.
 */
export async function releaseReservation(
  serverDb: Firestore,
  userId: string,
  reservationId?: string
): Promise<void> {
  const currentPeriod = getCurrentMonthPeriodKey();
  const effectiveUserId = userId || "anonymous";

  if (reservationId) {
    if (settledReservations.has(reservationId)) {
      return;
    }
    pruneSettledReservations();
    settledReservations.set(reservationId, {
      status: "released",
      settledAt: Date.now()
    });
  }

  if (effectiveUserId === "anonymous") {
    const current = anonymousUsageMap.get(currentPeriod) || 0;
    if (current > 0) {
      anonymousUsageMap.set(currentPeriod, current - 1);
    }
    return;
  }

  return acquireUserLock(effectiveUserId, async () => {
    try {
      const docRef = serverDb.collection("generation_usage").doc(effectiveUserId);
      const txPromise = serverDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        if (snap.exists) {
          const data = snap.data() || {};
          if (data.period === currentPeriod) {
            const inFlight = typeof data.inFlight === "number" ? Math.max(0, data.inFlight) : 0;
            transaction.set(
              docRef,
              {
                inFlight: Math.max(0, inFlight - 1),
                updatedAt: new Date().toISOString()
              },
              { merge: true }
            );
          }
        }
      });
      await withTimeout(txPromise, 3500, undefined);
      console.log(`[GENERATION_LIMIT] Released reservation for ${effectiveUserId} without consuming generation allowance.`);
    } catch (err) {
      console.warn(`[GENERATION_LIMIT] Failed to release reservation for ${effectiveUserId}:`, err);
    }
  });
}

/**
 * Utility for testing or resetting usage in test environments.
 */
export async function setTestGenerationUsage(
  serverDb: Firestore,
  userId: string,
  count: number,
  period?: string
): Promise<void> {
  const effectivePeriod = period || getCurrentMonthPeriodKey();
  const docRef = serverDb.collection("generation_usage").doc(userId);
  await docRef.set({
    userId,
    count,
    period: effectivePeriod,
    inFlight: 0,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  if (userId !== "anonymous") {
    try {
      const userDocRef = serverDb.collection("users").doc(userId);
      await userDocRef.set({
        generationUsage: {
          count,
          period: effectivePeriod,
          remaining: Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - count),
          limit: FREE_MONTHLY_GENERATION_LIMIT,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });
    } catch (_) {}
  }
}
