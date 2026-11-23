import type { Firestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { ENTITLED_PRO_UIDS, ENTITLED_PRO_EMAILS } from "./generationLimitService";

/**
 * FunnelWorks entitlements are independent of monthly content-generation quotas.
 * All checks fail closed on database errors.
 */
export async function checkFunnelPro(db: Firestore, uid: string, email?: string): Promise<boolean> {
  if (ENTITLED_PRO_UIDS.has(uid) || (!!email && ENTITLED_PRO_EMAILS.has(email.trim().toLowerCase()))) return true;
  const [user, subscriptions] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("stripe_subscriptions").where("userId", "==", uid)
      .where("status", "in", ["active", "trialing"]).limit(1).get()
  ]);
  const profile = user.data();
  if (profile && (typeof profile.email === "string" && ENTITLED_PRO_EMAILS.has(profile.email.trim().toLowerCase()))) return true;
  return !subscriptions.empty || profile?.subscriptionStatus === "active" ||
    profile?.subscriptionActive === true;
}

export async function reserveFunnelGeneration(db: Firestore, uid: string, pro: boolean) {
  const ref = db.collection("funnelworks_usage").doc(uid);
  const reservationId = randomUUID();
  const result = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const now = Date.now();
    const pending = data.pending as { id: string; expiresAt: number } | undefined;
    if (pending && pending.expiresAt > now) return { allowed: false, reason: "IN_PROGRESS" as const };
    if (!pro && data.completed === true) return { allowed: false, reason: "FREE_USED" as const };
    transaction.set(ref, { pending: { id: reservationId, expiresAt: now + 120000 } }, { merge: true });
    return { allowed: true as const, reservationId };
  });
  return result;
}

export async function finishFunnelGeneration(db: Firestore, uid: string, reservationId: string, success: boolean, funnel?: Record<string, unknown>) {
  const ref = db.collection("funnelworks_usage").doc(uid);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.pending?.id !== reservationId) return;
    if (success && funnel) {
      transaction.set(db.collection("funnelworks_projects").doc(uid).collection("projects").doc(reservationId), funnel);
    }
    transaction.set(ref, { pending: null, ...(success ? { completed: true, completedAt: new Date().toISOString() } : {}) }, { merge: true });
  });
}
