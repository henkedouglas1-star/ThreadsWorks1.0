import type { Firestore } from "firebase-admin/firestore";
import { resolveMembershipAccess } from "../src/data/membershipCatalog";
import { MEMBERSHIP_SUBSCRIPTIONS } from "./membershipWebhookService";

export async function readMembershipAccess(db: Firestore, userId: string) {
  if (!userId || userId.includes("/") || userId === "anonymous") throw new Error("Authentication required.");
  const mode = process.env.MEMBERSHIP_STRIPE_MODE;
  if (mode !== "live" && mode !== "test") return { planIds: [] as string[], appIds: [] as string[] };
  // Query only the authenticated owner's server-written records.
  const snapshot = await db.collection(MEMBERSHIP_SUBSCRIPTIONS).where("userId", "==", userId).get();
  const planIds = [...new Set(snapshot.docs.map(doc => doc.data()).filter(data =>
    data.userId === userId && data.active === true && data.status === "active" &&
    data.livemode === (mode === "live") &&
    (data.planId === "contentpaysclub" || data.planId === "contentpaysbundle")
  ).map(data => data.planId as string))].sort();
  return { planIds, appIds: resolveMembershipAccess(planIds) };
}
