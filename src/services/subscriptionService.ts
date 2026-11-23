import { auth, db, withTimeout, handleFirestoreError, OperationType } from "../firebase";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";

export interface SubscriptionData {
  subscriptionStatus?: string;
  subscriptionTier?: string;
  billingInterval?: string;
  subscriptionActive?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  lastPaymentDate?: string;
  nextBillingDate?: string;
  createdAt?: any;
  updatedAt?: any;
}

// In-memory cache to prevent duplicate getDoc queries across components
const subscriptionCache = new Map<string, { data: SubscriptionData | null; expiresAt: number }>();
const inFlightSubscriptionRequests = new Map<string, Promise<SubscriptionData | null>>();
const SUBSCRIPTION_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export class SubscriptionService {
  /**
   * Clears subscription cache for a given user or all users.
   */
  static invalidateCache(userId?: string) {
    if (userId) {
      subscriptionCache.delete(userId);
    } else {
      subscriptionCache.clear();
    }
  }

  /**
   * Retrieves the current user's subscription fields from Firestore with caching & deduplication.
   */
  static async getCurrentSubscription(): Promise<SubscriptionData | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const uid = currentUser.uid;
    const cached = subscriptionCache.get(uid);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    if (inFlightSubscriptionRequests.has(uid)) {
      return inFlightSubscriptionRequests.get(uid)!;
    }

    const fetchPromise = (async () => {
      try {
        const docRef = doc(db, "users", uid);
        const docSnap = await withTimeout(getDoc(docRef), 5000);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const subData: SubscriptionData = {
            subscriptionStatus: data.subscriptionStatus || "inactive",
            subscriptionTier: data.subscriptionTier || "free",
            billingInterval: data.billingInterval || null,
            subscriptionActive: !!data.subscriptionActive,
            stripeCustomerId: data.stripeCustomerId || null,
            stripeSubscriptionId: data.stripeSubscriptionId || null,
            stripePriceId: data.stripePriceId || null,
            currentPeriodEnd: data.currentPeriodEnd || null,
            cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
            lastPaymentDate: data.lastPaymentDate || null,
            nextBillingDate: data.nextBillingDate || null,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
          };
          subscriptionCache.set(uid, { data: subData, expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS });
          return subData;
        }
        subscriptionCache.set(uid, { data: null, expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS });
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
      return null;
    })().finally(() => {
      inFlightSubscriptionRequests.delete(uid);
    });

    inFlightSubscriptionRequests.set(uid, fetchPromise);
    return fetchPromise;
  }

  /**
   * Refreshes the subscription by force-fetching from the server instead of cache.
   */
  static async refreshSubscription(): Promise<SubscriptionData | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const uid = currentUser.uid;
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await withTimeout(getDocFromServer(docRef), 5000);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const subData: SubscriptionData = {
          subscriptionStatus: data.subscriptionStatus || "inactive",
          subscriptionTier: data.subscriptionTier || "free",
          billingInterval: data.billingInterval || null,
          subscriptionActive: !!data.subscriptionActive,
          stripeCustomerId: data.stripeCustomerId || null,
          stripeSubscriptionId: data.stripeSubscriptionId || null,
          stripePriceId: data.stripePriceId || null,
          currentPeriodEnd: data.currentPeriodEnd || null,
          cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
          lastPaymentDate: data.lastPaymentDate || null,
          nextBillingDate: data.nextBillingDate || null,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
        subscriptionCache.set(uid, { data: subData, expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS });
        return subData;
      }
      subscriptionCache.set(uid, { data: null, expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS });
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }
    return null;
  }

  /**
   * Checks if the current user has an active subscription.
   */
  static async hasActiveSubscription(): Promise<boolean> {
    const sub = await this.getCurrentSubscription();
    return !!sub?.subscriptionActive;
  }

  /**
   * Retrieves the current user's billing interval.
   */
  static async getBillingInterval(): Promise<string | null> {
    const sub = await this.getCurrentSubscription();
    return sub?.billingInterval || null;
  }

  /**
   * Retrieves the current user's subscription tier.
   */
  static async getSubscriptionTier(): Promise<string> {
    const sub = await this.getCurrentSubscription();
    return sub?.subscriptionTier || "free";
  }
}
