import { GoogleGenAI, Type } from "@google/genai";
import { callGenerateContentWithRetry } from "./geminiClient";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  initializeFirestore as initializeClientFirestore,
  doc as clientDoc,
  getDoc as clientGetDoc,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  collection as clientCollection,
  query as clientQuery,
  where as clientWhere,
  getDocs as clientGetDocs,
  limit as clientLimit
} from "firebase/firestore";
import fs from "fs";
import path from "path";
import {
  PartnerProfile,
  CommissionRecord,
  PayoutRecord,
  PartnerCustomer,
  PartnerProgramConfig,
  PayoutMethod,
  PromoAngle,
  PromoContentType,
  PartnerAuditLog,
  PartnerNotification
} from "../src/types/partner";

// Initialize Firebase Admin for Firestore operations
let firebaseConfig: any = null;
let firebaseProjectId = "studio-6594275665-9cb0f";
let databaseId = "(default)";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    firebaseConfig = config;
    if (config.projectId) firebaseProjectId = config.projectId;
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
  }
} catch (e) {
  console.error("[PARTNER_SERVICE_INIT] Failed to read firebase-applet-config.json", e);
}

const adminApp = getApps().length === 0
  ? initializeApp({ projectId: firebaseProjectId })
  : getApp();

let db: any = null;
try {
  db = getFirestore(adminApp, databaseId);
} catch (err) {
  console.warn("[PARTNER_SERVICE_INIT] Firestore Admin DB not available:", err);
}

let clientDb: any = null;
if (firebaseConfig) {
  try {
    const clientApp = initializeClientApp(firebaseConfig);
    clientDb = initializeClientFirestore(clientApp, {
      experimentalForceLongPolling: true,
    }, databaseId || "default");
  } catch (clientErr) {
    console.warn("[PARTNER_SERVICE_INIT] Client DB init note:", clientErr);
  }
}

function isPermissionOrQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err);
  const code = err.code;
  return (
    code === 7 ||
    code === "permission-denied" ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("Missing or insufficient permissions") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded")
  );
}

export const DEFAULT_PROGRAM_CONFIG: PartnerProgramConfig = {
  productName: "ThreadsWorks",
  productPrice: 7.00,
  yearlyPrice: 59.00,
  commissionRate: 0.50, // 50% recurring commission
  minimumPayout: 25.00, // $25 minimum threshold
  attributionCookieDays: 60,
  canonicalProductUrl: "https://threadsworks.com",
  selfReferralAllowed: false
};

// In-memory fallback caches if Firestore is in simulated sandbox mode
const memoryPartners = new Map<string, PartnerProfile>();
const memoryCommissions = new Map<string, CommissionRecord[]>();
const memoryPayouts = new Map<string, PayoutRecord[]>();
const memoryCustomers = new Map<string, PartnerCustomer[]>();
const memoryAuditLogs: PartnerAuditLog[] = [];
const memoryNotifications = new Map<string, PartnerNotification[]>();
let dynamicProgramConfig: PartnerProgramConfig = { ...DEFAULT_PROGRAM_CONFIG };

export function getProgramConfig(): PartnerProgramConfig {
  return dynamicProgramConfig;
}

export async function updateProgramConfigWithAudit(
  newConfig: Partial<PartnerProgramConfig>,
  adminId: string = "system",
  adminEmail?: string
): Promise<PartnerProgramConfig> {
  const previous = { ...dynamicProgramConfig };
  dynamicProgramConfig = { ...dynamicProgramConfig, ...newConfig };
  
  await recordAdminAuditLog({
    action: "program_config_updated",
    adminId,
    adminEmail,
    details: `Updated partner program config: ${JSON.stringify(newConfig)}`,
    previousValue: previous,
    newValue: dynamicProgramConfig
  });

  return dynamicProgramConfig;
}

export function updateProgramConfig(newConfig: Partial<PartnerProgramConfig>): PartnerProgramConfig {
  dynamicProgramConfig = { ...dynamicProgramConfig, ...newConfig };
  return dynamicProgramConfig;
}

/**
 * Record a traceable administrative audit log
 */
export async function recordAdminAuditLog(params: {
  action: string;
  adminId: string;
  adminEmail?: string;
  targetPartnerId?: string;
  targetPayoutId?: string;
  targetCommissionId?: string;
  amount?: number;
  details: string;
  previousValue?: any;
  newValue?: any;
}): Promise<PartnerAuditLog> {
  const log: PartnerAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action: params.action,
    adminId: params.adminId,
    adminEmail: params.adminEmail || "",
    targetPartnerId: params.targetPartnerId,
    targetPayoutId: params.targetPayoutId,
    targetCommissionId: params.targetCommissionId,
    amount: params.amount,
    details: params.details,
    previousValue: params.previousValue,
    newValue: params.newValue,
    timestamp: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection("partner_audit_logs").doc(log.id).set(log);
    } catch (err: any) {
      console.warn("[AUDIT_LOG] Firestore write error:", err.message);
    }
  }

  memoryAuditLogs.unshift(log);
  if (memoryAuditLogs.length > 500) memoryAuditLogs.pop();
  return log;
}

/**
 * Retrieve administrative audit logs
 */
export async function adminGetAuditLogs(limitCount: number = 100): Promise<PartnerAuditLog[]> {
  if (db) {
    try {
      const q = await db.collection("partner_audit_logs")
        .orderBy("timestamp", "desc")
        .limit(limitCount)
        .get();
      return q.docs.map((d: any) => d.data() as PartnerAuditLog);
    } catch (err: any) {
      console.warn("[AUDIT_LOG] Error fetching audit logs from firestore:", err.message);
    }
  }
  return memoryAuditLogs.slice(0, limitCount);
}

/**
 * Dispatch an in-app milestone notification to a partner
 */
export async function createPartnerNotification(
  partnerId: string,
  type: "referral_signup" | "commission_earned" | "payout_threshold_reached" | "payout_paid" | "payout_rejected" | "account_notice",
  title: string,
  message: string,
  amount?: number
): Promise<PartnerNotification> {
  const notification: PartnerNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    partnerId,
    type,
    title,
    message,
    amount,
    read: false,
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection("partner_notifications").doc(notification.id).set(notification);
    } catch (err: any) {
      console.warn("[NOTIFICATION] Firestore write error:", err.message);
    }
  }

  const list = memoryNotifications.get(partnerId) || [];
  list.unshift(notification);
  if (list.length > 50) list.pop();
  memoryNotifications.set(partnerId, list);

  return notification;
}

/**
 * Retrieve notifications for a partner
 */
export async function getPartnerNotifications(partnerId: string): Promise<PartnerNotification[]> {
  if (db) {
    try {
      const q = await db.collection("partner_notifications")
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .limit(30)
        .get();
      return q.docs.map((d: any) => d.data() as PartnerNotification);
    } catch (err: any) {
      console.warn("[NOTIFICATION] Error fetching notifications:", err.message);
    }
  }
  return memoryNotifications.get(partnerId) || [];
}

/**
 * Mark a partner notification as read
 */
export async function markPartnerNotificationRead(partnerId: string, notificationId: string): Promise<void> {
  if (db) {
    try {
      await db.collection("partner_notifications").doc(notificationId).update({ read: true });
    } catch (err: any) {
      console.warn("[NOTIFICATION] Error marking notification as read:", err.message);
    }
  }

  const list = memoryNotifications.get(partnerId);
  if (list) {
    const item = list.find(n => n.id === notificationId);
    if (item) item.read = true;
  }
}

/**
 * Generate a clean, brand-friendly unique referral code
 */
function sanitizeReferralCode(rawString: string): string {
  const clean = rawString
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 14);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return clean ? `${clean}_${randomSuffix}` : `tw_${randomSuffix}`;
}

/**
 * Build the canonical referral URL for a given partner code
 */
export function buildReferralUrl(referralCode: string, origin?: string): string {
  const base = origin || dynamicProgramConfig.canonicalProductUrl;
  const cleanBase = base.replace(/\/+$/, "");
  return `${cleanBase}/?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * Retrieve a partner profile by their Firebase User ID
 */
export async function getPartnerByUserId(userId: string, origin?: string): Promise<PartnerProfile | null> {
  if (!userId) return null;

  if (db) {
    try {
      const docSnap = await db.collection("partners").doc(userId).get();
      if (docSnap.exists) {
        const data = docSnap.data() as PartnerProfile;
        data.referralUrl = buildReferralUrl(data.referralCode, origin);
        return data;
      }
    } catch (err: any) {
      if (!isPermissionOrQuotaError(err)) {
        console.warn(`[PARTNER_SERVICE] Error fetching partner for user ${userId}:`, err.message);
      }
    }
  }

  if (clientDb) {
    try {
      const ref = clientDoc(clientDb, "partners", userId);
      const docSnap = await clientGetDoc(ref);
      if (docSnap.exists()) {
        const data = docSnap.data() as PartnerProfile;
        data.referralUrl = buildReferralUrl(data.referralCode, origin);
        return data;
      }
    } catch (clientErr: any) {
      if (!isPermissionOrQuotaError(clientErr)) {
        console.warn(`[PARTNER_SERVICE] Client DB error fetching partner for user ${userId}:`, clientErr.message);
      }
    }
  }

  const memory = memoryPartners.get(userId);
  if (memory) {
    memory.referralUrl = buildReferralUrl(memory.referralCode, origin);
    return memory;
  }
  return null;
}

/**
 * Retrieve a partner profile by their unique referral code
 */
export async function getPartnerByReferralCode(referralCode: string): Promise<PartnerProfile | null> {
  if (!referralCode) return null;
  const cleanCode = referralCode.trim().toLowerCase();

  if (db) {
    try {
      const q = await db.collection("partners")
        .where("referralCode", "==", cleanCode)
        .limit(1)
        .get();
      if (!q.empty) {
        return q.docs[0].data() as PartnerProfile;
      }
    } catch (err: any) {
      console.warn(`[PARTNER_SERVICE] Error querying partner by referral code ${referralCode}:`, err.message);
    }
  }

  for (const partner of memoryPartners.values()) {
    if (partner.referralCode.toLowerCase() === cleanCode) {
      return partner;
    }
  }
  return null;
}

/**
 * Self-serve instant activation: Creates a new partner account immediately.
 * Zero approval queue, zero manual steps.
 */
export async function createPartnerProfile(
  userId: string,
  email: string,
  name?: string,
  origin?: string
): Promise<PartnerProfile> {
  const existing = await getPartnerByUserId(userId, origin);
  if (existing) {
    return existing;
  }

  const baseIdentifier = name || email.split("@")[0] || "creator";
  const referralCode = sanitizeReferralCode(baseIdentifier);
  const now = new Date().toISOString();

  const newPartner: PartnerProfile = {
    id: userId,
    userId,
    email: email || "",
    name: name || email.split("@")[0] || "ThreadsWorks Creator",
    status: "active",
    referralCode,
    referralUrl: buildReferralUrl(referralCode, origin),
    commissionRate: dynamicProgramConfig.commissionRate,
    totalClicks: 0,
    totalSignups: 0,
    totalCustomers: 0,
    activeCustomers: 0,
    monthlyRecurringCommission: 0,
    totalEarned: 0,
    pendingBalance: 0,
    payableBalance: 0,
    paidBalance: 0,
    createdAt: now,
    updatedAt: now
  };

  if (db) {
    try {
      await db.collection("partners").doc(userId).set(newPartner);
      // Also index by referral code
      await db.collection("partner_codes").doc(referralCode).set({
        partnerId: userId,
        userId,
        email,
        createdAt: now
      });
      console.log(`[PARTNER_SERVICE] Created new partner profile in Firestore for user ${userId} with code ${referralCode}`);
    } catch (err: any) {
      console.warn("[PARTNER_SERVICE] Firestore partner creation warning:", err.message);
    }
  }

  memoryPartners.set(userId, newPartner);
  return newPartner;
}

/**
 * Record a referral click event and increment partner statistics
 */
export async function recordReferralClick(
  referralCode: string,
  meta: { ip?: string; userAgent?: string; landingPath?: string; referrer?: string }
): Promise<{ success: boolean; partnerId?: string; referralCode?: string }> {
  const partner = await getPartnerByReferralCode(referralCode);
  if (!partner || partner.status !== "active") {
    return { success: false };
  }

  const now = new Date().toISOString();
  const clickId = `click_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (db) {
    try {
      await db.collection("referral_clicks").doc(clickId).set({
        id: clickId,
        partnerId: partner.id,
        referralCode: partner.referralCode,
        landingPath: meta.landingPath || "/",
        referrer: meta.referrer || "",
        userAgent: meta.userAgent || "",
        timestamp: now
      });

      // Increment click counter
      await db.collection("partners").doc(partner.id).update({
        totalClicks: FieldValue.increment(1),
        updatedAt: now
      });
    } catch (err: any) {
      console.warn("[PARTNER_SERVICE] Firestore click record warning:", err.message);
    }
  }

  // Update in-memory
  const mem = memoryPartners.get(partner.id);
  if (mem) {
    mem.totalClicks = (mem.totalClicks || 0) + 1;
    mem.updatedAt = now;
  }

  return { success: true, partnerId: partner.id, referralCode: partner.referralCode };
}

/**
 * Attribute a newly registered user to a referring partner
 */
export async function attributeUserToPartner(
  userId: string,
  userEmail: string,
  referralCode: string
): Promise<{ success: boolean; partnerId?: string }> {
  const partner = await getPartnerByReferralCode(referralCode);
  if (!partner || partner.status !== "active") {
    return { success: false };
  }

  // Self-referral protection if configured
  if (!dynamicProgramConfig.selfReferralAllowed && (partner.userId === userId || partner.email.toLowerCase() === userEmail.toLowerCase())) {
    console.log(`[PARTNER_SERVICE] Self-referral ignored for partner ${partner.id} and user ${userId}`);
    return { success: false };
  }

  const now = new Date().toISOString();
  const customerId = `cust_${partner.id}_${userId}`;

  const partnerCustomer: PartnerCustomer = {
    id: customerId,
    partnerId: partner.id,
    partnerReferralCode: partner.referralCode,
    userId,
    userEmail,
    subscriptionStatus: "free",
    billingCycle: "monthly",
    attributedAt: now,
    totalCommissionGenerated: 0,
    status: "active"
  };

  if (db) {
    try {
      // 1. Link customer to partner
      await db.collection("partner_customers").doc(customerId).set(partnerCustomer, { merge: true });

      // 2. Attach referral metadata to the user's document
      await db.collection("users").doc(userId).set({
        referredBy: partner.id,
        referralCode: partner.referralCode,
        referredAt: now
      }, { merge: true });

      // 3. Increment signups count on partner doc
      await db.collection("partners").doc(partner.id).update({
        totalSignups: FieldValue.increment(1),
        updatedAt: now
      });
    } catch (err: any) {
      console.warn("[PARTNER_SERVICE] Firestore attribution error:", err.message);
    }
  }

  const mem = memoryPartners.get(partner.id);
  if (mem) {
    mem.totalSignups = (mem.totalSignups || 0) + 1;
  }

  const custArr = memoryCustomers.get(partner.id) || [];
  custArr.push(partnerCustomer);
  memoryCustomers.set(partner.id, custArr);

  // Send in-app notification to the partner
  createPartnerNotification(
    partner.id,
    "referral_signup",
    "New Referral Signup",
    `A new user (${userEmail.replace(/^(.{2})(.*)(@.*)$/, "$1***$3")}) just signed up using your link! You will earn 50% recurring commission once they subscribe.`,
    0
  ).catch(e => console.warn("[NOTIFICATION] Error creating signup notif:", e));

  return { success: true, partnerId: partner.id };
}

/**
 * Handle Stripe `invoice.paid` event to automatically calculate and record 50% recurring commissions.
 * Fully idempotent to prevent duplicate commission credits.
 */
export async function processStripeInvoiceCommission(invoice: any): Promise<{ created: boolean; commission?: CommissionRecord; error?: string }> {
  if (!invoice || !invoice.id) {
    return { created: false, error: "Invalid invoice object" };
  }

  const amountPaidCents = invoice.amount_paid || 0;
  if (amountPaidCents <= 0) {
    console.log(`[PARTNER_COMMISSION] Invoice ${invoice.id} has 0 amount paid, skipping commission.`);
    return { created: false };
  }

  const invoiceId = invoice.id;
  const commissionId = `comm_${invoiceId}`;

  // 1. Check idempotency: Ensure this invoice was not already processed for commission
  if (db) {
    try {
      const existingComm = await db.collection("commissions").doc(commissionId).get();
      if (existingComm.exists) {
        console.log(`[PARTNER_COMMISSION] Commission for invoice ${invoiceId} already exists. Skipping.`);
        return { created: false, commission: existingComm.data() as CommissionRecord };
      }

      // Secondary check by transactionReference
      const existingByRef = await db.collection("commissions")
        .where("transactionReference", "==", invoiceId)
        .limit(1)
        .get();
      if (!existingByRef.empty) {
        console.log(`[PARTNER_COMMISSION] Commission with ref ${invoiceId} already exists. Skipping.`);
        return { created: false, commission: existingByRef.docs[0].data() as CommissionRecord };
      }
    } catch (err: any) {
      console.warn("[PARTNER_COMMISSION] Error checking existing commission:", err.message);
    }
  }

  // Check in-memory list for idempotency
  for (const comms of memoryCommissions.values()) {
    const existing = comms.find(c => c.id === commissionId || c.transactionReference === invoiceId || c.stripeInvoiceId === invoiceId);
    if (existing) {
      console.log(`[PARTNER_COMMISSION] In-memory commission found for invoice ${invoiceId}. Skipping.`);
      return { created: false, commission: existing };
    }
  }

  // 2. Identify the referred user / customer and their associated partner
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  const customerEmail = invoice.customer_email || "";
  let partnerId: string | null = null;
  let partnerReferralCode = "";
  let userId: string = "";

  // Strategy A: Check invoice lines / subscription metadata
  if (invoice.subscription_details?.metadata?.partnerId) {
    partnerId = invoice.subscription_details.metadata.partnerId;
    partnerReferralCode = invoice.subscription_details.metadata.referralCode || "";
  }

  // Strategy B: Query partner_customers by stripeCustomerId or stripeSubscriptionId
  if (!partnerId && db && customerId) {
    try {
      const custQuery = await db.collection("partner_customers")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();
      if (!custQuery.empty) {
        const d = custQuery.docs[0].data();
        partnerId = d.partnerId;
        partnerReferralCode = d.partnerReferralCode || "";
        userId = d.userId;
      }
    } catch (err: any) {
      console.warn("[PARTNER_COMMISSION] Error querying partner_customers by stripeCustomerId:", err.message);
    }
  }

  // Strategy C: Query user document from stripe_customers mapping
  if (!partnerId && db && customerId) {
    try {
      const custDoc = await db.collection("stripe_customers").doc(customerId).get();
      if (custDoc.exists) {
        const uId = custDoc.data()?.userId;
        if (uId) {
          userId = uId;
          const userDoc = await db.collection("users").doc(uId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            partnerId = userData?.referredBy || null;
            partnerReferralCode = userData?.referralCode || "";
          }
        }
      }
    } catch (err: any) {
      console.warn("[PARTNER_COMMISSION] Error resolving partner from user doc:", err.message);
    }
  }

  if (!partnerId) {
    console.log(`[PARTNER_COMMISSION] Invoice ${invoiceId} (Customer ${customerId}) has no attributed partner. No commission generated.`);
    return { created: false };
  }

  // 3. Verify the partner is active
  const partner = await getPartnerByUserId(partnerId);
  if (!partner || partner.status !== "active") {
    console.log(`[PARTNER_COMMISSION] Partner ${partnerId} not found or suspended. Skipping commission.`);
    return { created: false, error: "Partner inactive or suspended" };
  }

  // 4. Calculate commission dynamically: gross amount * 50%
  const grossAmount = amountPaidCents / 100; // e.g. $7.00
  const rate = partner.commissionRate || dynamicProgramConfig.commissionRate || 0.50; // 0.50
  const commissionAmount = Number((grossAmount * rate).toFixed(2)); // e.g. $3.50
  const currency = (invoice.currency || "usd").toLowerCase();
  const now = new Date().toISOString();
  const prevPayable = partner.payableBalance || 0;

  const commissionRecord: CommissionRecord = {
    id: commissionId,
    partnerId: partner.id,
    partnerReferralCode: partnerReferralCode || partner.referralCode,
    customerId: userId || customerId,
    customerEmail: customerEmail || "",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId || "",
    stripeInvoiceId: invoiceId,
    transactionReference: invoiceId,
    grossAmount,
    commissionRate: rate,
    commissionAmount,
    currency,
    status: "approved", // Automatically approved and payable
    reason: `50% recurring affiliate commission for ThreadsWorks subscription payment (Invoice ${invoiceId})`,
    createdAt: now,
    approvedAt: now,
    payableAt: now
  };

  // 5. Store commission and update partner balances
  if (db) {
    try {
      // Save commission document
      await db.collection("commissions").doc(commissionId).set(commissionRecord);

      // Update partner balances and active customer count
      await db.collection("partners").doc(partner.id).update({
        totalEarned: FieldValue.increment(commissionAmount),
        payableBalance: FieldValue.increment(commissionAmount),
        totalCustomers: FieldValue.increment(1),
        updatedAt: now
      });

      // Update or create partner_customers relationship
      const partnerCustRef = db.collection("partner_customers").doc(`cust_${partner.id}_${userId || customerId}`);
      await partnerCustRef.set({
        partnerId: partner.id,
        partnerReferralCode: partner.referralCode,
        userId: userId || customerId,
        userEmail: customerEmail,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId || "",
        subscriptionStatus: "active",
        lastCommissionAt: now,
        totalCommissionGenerated: FieldValue.increment(commissionAmount),
        status: "active",
        updatedAt: now
      }, { merge: true });

      console.log(`[PARTNER_COMMISSION] Successfully credited 50% commission of $${commissionAmount} to Partner ${partner.id} for Invoice ${invoiceId}`);
    } catch (err: any) {
      console.error("[PARTNER_COMMISSION] Error persisting commission:", err);
      return { created: false, error: err.message };
    }
  }

  // Update in-memory state
  const commList = memoryCommissions.get(partner.id) || [];
  commList.unshift(commissionRecord);
  memoryCommissions.set(partner.id, commList);

  const mem = memoryPartners.get(partner.id);
  if (mem) {
    mem.totalEarned = Number(((mem.totalEarned || 0) + commissionAmount).toFixed(2));
    mem.payableBalance = Number(((mem.payableBalance || 0) + commissionAmount).toFixed(2));
    mem.activeCustomers = (mem.activeCustomers || 0) + 1;
    mem.monthlyRecurringCommission = Number((mem.activeCustomers * 3.50).toFixed(2));
    mem.updatedAt = now;
  }

  // Dispatch milestone notification
  createPartnerNotification(
    partner.id,
    "commission_earned",
    "New 50% Recurring Commission!",
    `You just earned $${commissionAmount.toFixed(2)} USD from a ThreadsWorks subscriber.`,
    commissionAmount
  ).catch(e => console.warn("[NOTIFICATION] Error creating commission notif:", e));

  const newPayable = prevPayable + commissionAmount;
  if (prevPayable < 25.00 && newPayable >= 25.00) {
    createPartnerNotification(
      partner.id,
      "payout_threshold_reached",
      "Payout Threshold Unlocked!",
      `Congratulations! You've crossed the $25.00 minimum threshold (Current balance: $${newPayable.toFixed(2)}). You can now request your payout.`,
      newPayable
    ).catch(e => console.warn("[NOTIFICATION] Error creating threshold notif:", e));
  }

  return { created: true, commission: commissionRecord };
}

/**
 * Handle subscription cancellation or update: syncs active subscriber count and estimated MRR
 */
export async function handleSubscriptionStatusChange(
  subscription: any,
  status: "canceled" | "active" | "past_due"
) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  if (db && customerId) {
    try {
      const q = await db.collection("partner_customers")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

      if (!q.empty) {
        const docRef = q.docs[0].ref;
        const data = q.docs[0].data();
        const partnerId = data.partnerId;

        await docRef.update({
          subscriptionStatus: status,
          status: status === "active" ? "active" : "inactive",
          updatedAt: new Date().toISOString()
        });

        // Recalculate partner active customers & MRR
        const activeCustsQuery = await db.collection("partner_customers")
          .where("partnerId", "==", partnerId)
          .where("subscriptionStatus", "==", "active")
          .get();

        const activeCount = activeCustsQuery.size;
        const newMrr = Number((activeCount * 3.50).toFixed(2));

        await db.collection("partners").doc(partnerId).update({
          activeCustomers: activeCount,
          monthlyRecurringCommission: newMrr,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.warn("[PARTNER_SERVICE] Subscription status sync error:", err.message);
    }
  }
}

/**
 * Retrieve the full list of commissions for a given partner
 */
export async function getPartnerCommissions(partnerId: string): Promise<CommissionRecord[]> {
  if (db) {
    try {
      const q = await db.collection("commissions")
        .where("partnerId", "==", partnerId)
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      return q.docs.map((d: any) => d.data() as CommissionRecord);
    } catch (err: any) {
      console.warn(`[PARTNER_SERVICE] Error fetching commissions for partner ${partnerId}:`, err.message);
    }
  }

  return memoryCommissions.get(partnerId) || [];
}

/**
 * Retrieve all payouts for a given partner
 */
export async function getPartnerPayouts(partnerId: string): Promise<PayoutRecord[]> {
  if (db) {
    try {
      const q = await db.collection("payouts")
        .where("partnerId", "==", partnerId)
        .orderBy("requestedAt", "desc")
        .limit(100)
        .get();
      return q.docs.map((d: any) => d.data() as PayoutRecord);
    } catch (err: any) {
      console.warn(`[PARTNER_SERVICE] Error fetching payouts for partner ${partnerId}:`, err.message);
    }
  }

  return memoryPayouts.get(partnerId) || [];
}

/**
 * Request a payout from the partner's payable balance
 */
export async function requestPayout(
  partnerId: string,
  method: PayoutMethod
): Promise<{ success: boolean; payout?: PayoutRecord; error?: string }> {
  const partner = await getPartnerByUserId(partnerId);
  if (!partner) {
    return { success: false, error: "Partner profile not found." };
  }

  if (partner.status !== "active") {
    return { success: false, error: "Your partner account is currently suspended." };
  }

  const minThreshold = dynamicProgramConfig.minimumPayout || 25.00;
  if (partner.payableBalance < minThreshold) {
    return {
      success: false,
      error: `Your payable balance ($${partner.payableBalance.toFixed(2)}) is below the minimum payout threshold of $${minThreshold.toFixed(2)}.`
    };
  }

  if (!method || !method.type || !method.details) {
    return { success: false, error: "Please provide valid payout details (e.g. PayPal email or Wise account)." };
  }

  // Guard against duplicate / rapid repeated payout requests (30-second debounce)
  const existingPayouts = await getPartnerPayouts(partner.id);
  const recentPending = existingPayouts.find(p => {
    if (p.status !== "pending") return false;
    const diffMs = Date.now() - new Date(p.requestedAt).getTime();
    return diffMs < 30000; // within 30 seconds
  });

  if (recentPending) {
    return {
      success: false,
      error: "A payout request was recently submitted. Please wait a moment before requesting again."
    };
  }

  const requestedAmount = partner.payableBalance;
  const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newPayout: PayoutRecord = {
    id: payoutId,
    partnerId: partner.id,
    partnerEmail: partner.email,
    amount: requestedAmount,
    currency: "usd",
    status: "pending",
    payoutMethod: method,
    provider: method.type,
    requestedAt: now,
    notes: `Requested $${requestedAmount.toFixed(2)} payout via ${method.type.toUpperCase()}`
  };

  if (db) {
    try {
      // 1. Record payout document
      await db.collection("payouts").doc(payoutId).set(newPayout);

      // 2. Deduct from payable balance and move to pending balance atomically
      await db.collection("partners").doc(partner.id).update({
        payableBalance: 0,
        pendingBalance: FieldValue.increment(requestedAmount),
        payoutMethod: method,
        updatedAt: now
      });
    } catch (err: any) {
      console.error("[PARTNER_SERVICE] Error creating payout request:", err);
      return { success: false, error: "Failed to create payout request." };
    }
  }

  // Update in-memory
  const payouts = memoryPayouts.get(partner.id) || [];
  payouts.unshift(newPayout);
  memoryPayouts.set(partner.id, payouts);

  if (partner) {
    partner.pendingBalance += requestedAmount;
    partner.payableBalance = 0;
    partner.payoutMethod = method;
  }

  createPartnerNotification(
    partner.id,
    "payout_threshold_reached",
    "Payout Request Submitted",
    `Your payout request for $${requestedAmount.toFixed(2)} USD via ${method.type.toUpperCase()} has been received and is pending processing.`,
    requestedAmount
  ).catch(e => console.warn("[NOTIFICATION] Error creating payout notif:", e));

  return { success: true, payout: newPayout };
}

/**
 * Update partner payout method settings
 */
export async function updatePartnerPayoutMethod(
  partnerId: string,
  method: PayoutMethod
): Promise<{ success: boolean; error?: string }> {
  if (!method || !method.type || !method.details) {
    return { success: false, error: "Invalid payout method details." };
  }

  const now = new Date().toISOString();
  if (db) {
    try {
      await db.collection("partners").doc(partnerId).update({
        payoutMethod: method,
        updatedAt: now
      });
    } catch (err: any) {
      console.warn("[PARTNER_SERVICE] Error updating payout method:", err.message);
    }
  }

  const mem = memoryPartners.get(partnerId);
  if (mem) {
    mem.payoutMethod = method;
    mem.updatedAt = now;
  }

  return { success: true };
}

/**
 * Admin: Retrieve all partners across the platform
 */
export async function adminGetAllPartners(): Promise<PartnerProfile[]> {
  if (db) {
    try {
      const q = await db.collection("partners").orderBy("createdAt", "desc").limit(200).get();
      return q.docs.map((d: any) => d.data() as PartnerProfile);
    } catch (err: any) {
      console.warn("[ADMIN_PARTNER] Error getting all partners:", err.message);
    }
  }
  return Array.from(memoryPartners.values());
}

/**
 * Admin: Suspend or Reinstate a Partner
 */
export async function adminSetPartnerStatus(
  partnerId: string,
  status: "active" | "suspended",
  adminId: string = "system",
  adminEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  const partner = await getPartnerByUserId(partnerId);
  const prevStatus = partner?.status || "active";

  if (db) {
    try {
      await db.collection("partners").doc(partnerId).update({
        status,
        updatedAt: now
      });
    } catch (err: any) {
      console.error("[ADMIN_PARTNER] Error updating partner status:", err);
      return { success: false, error: err.message };
    }
  }

  const mem = memoryPartners.get(partnerId);
  if (mem) {
    mem.status = status;
    mem.updatedAt = now;
  }

  await recordAdminAuditLog({
    action: status === "suspended" ? "partner_suspended" : "partner_reinstated",
    adminId,
    adminEmail,
    targetPartnerId: partnerId,
    details: `Admin changed partner status from '${prevStatus}' to '${status}'`,
    previousValue: { status: prevStatus },
    newValue: { status }
  });

  createPartnerNotification(
    partnerId,
    "account_notice",
    status === "suspended" ? "Partner Account Suspended" : "Partner Account Active",
    status === "suspended"
      ? "Your partner account has been suspended by administration. Referral links will temporarily not track commissions."
      : "Your partner account is active and ready to earn 50% recurring commissions."
  ).catch(e => console.warn("[NOTIFICATION] Error creating status notif:", e));

  return { success: true };
}

/**
 * Admin: Process / Confirm a Payout Request (mark as paid or rejected)
 */
export async function adminProcessPayout(
  payoutId: string,
  action: "paid" | "rejected",
  providerReference?: string,
  rejectionReason?: string,
  adminId: string = "system",
  adminEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  let payout: PayoutRecord | null = null;

  if (db) {
    try {
      const snap = await db.collection("payouts").doc(payoutId).get();
      if (snap.exists) {
        payout = snap.data() as PayoutRecord;
      }
    } catch (err: any) {
      console.warn("[ADMIN_PARTNER] Error fetching payout:", err.message);
    }
  }

  if (!payout) {
    for (const list of memoryPayouts.values()) {
      const found = list.find(p => p.id === payoutId);
      if (found) { payout = found; break; }
    }
  }

  if (!payout) {
    return { success: false, error: "Payout record not found." };
  }

  const partnerId = payout.partnerId;
  const amount = payout.amount;
  const prevPayoutStatus = payout.status;

  if (action === "paid") {
    payout.status = "paid";
    payout.processedAt = now;
    payout.providerReference = providerReference || `MANUAL_REF_${Date.now()}`;

    if (db) {
      await db.collection("payouts").doc(payoutId).update({
        status: "paid",
        processedAt: now,
        providerReference: payout.providerReference
      });

      // Move from pending to paid balance
      await db.collection("partners").doc(partnerId).update({
        pendingBalance: FieldValue.increment(-amount),
        paidBalance: FieldValue.increment(amount),
        updatedAt: now
      });
    }

    const memPartner = memoryPartners.get(partnerId);
    if (memPartner) {
      memPartner.pendingBalance = Math.max(0, memPartner.pendingBalance - amount);
      memPartner.paidBalance += amount;
    }

    await recordAdminAuditLog({
      action: "payout_marked_paid",
      adminId,
      adminEmail,
      targetPartnerId: partnerId,
      targetPayoutId: payoutId,
      amount,
      details: `Payout of $${amount.toFixed(2)} marked as PAID via ${payout.providerReference}`,
      previousValue: { status: prevPayoutStatus },
      newValue: { status: "paid", providerReference: payout.providerReference }
    });

    createPartnerNotification(
      partnerId,
      "payout_paid",
      "Payout Sent!",
      `Your payout of $${amount.toFixed(2)} USD has been sent via ${payout.payoutMethod?.type?.toUpperCase() || "PAYOUT"} (Ref: ${payout.providerReference}).`,
      amount
    ).catch(e => console.warn("[NOTIFICATION] Error creating payout paid notif:", e));

  } else {
    // Rejected: return funds to payableBalance
    payout.status = "rejected";
    payout.failureReason = rejectionReason || "Payout request rejected by administrator.";
    payout.processedAt = now;

    if (db) {
      await db.collection("payouts").doc(payoutId).update({
        status: "rejected",
        failureReason: payout.failureReason,
        processedAt: now
      });

      await db.collection("partners").doc(partnerId).update({
        pendingBalance: FieldValue.increment(-amount),
        payableBalance: FieldValue.increment(amount),
        updatedAt: now
      });
    }

    const memPartner = memoryPartners.get(partnerId);
    if (memPartner) {
      memPartner.pendingBalance = Math.max(0, memPartner.pendingBalance - amount);
      memPartner.payableBalance += amount;
    }

    await recordAdminAuditLog({
      action: "payout_rejected",
      adminId,
      adminEmail,
      targetPartnerId: partnerId,
      targetPayoutId: payoutId,
      amount,
      details: `Payout of $${amount.toFixed(2)} REJECTED. Reason: ${payout.failureReason}`,
      previousValue: { status: prevPayoutStatus },
      newValue: { status: "rejected", failureReason: payout.failureReason }
    });

    createPartnerNotification(
      partnerId,
      "payout_rejected",
      "Payout Request Update",
      `Your payout request for $${amount.toFixed(2)} was not processed. Funds have been returned to your payable balance. Reason: ${payout.failureReason}`,
      amount
    ).catch(e => console.warn("[NOTIFICATION] Error creating payout rejected notif:", e));
  }

  return { success: true };
}

/**
 * AI Promotional Content Generator for ThreadsWorks Partners.
 * Generates verified, authentic Threads-native copy calibrated around ThreadsWorks facts:
 * - $7/month recurring price
 * - 50% recurring affiliate commissions ($3.50/mo per subscriber)
 * - Surgical DNA Voice matching, calendar scheduling, Meta Threads 1-click publishing
 * - Zero fluff, punchy, high-conversion frameworks
 */
export async function generatePromoContentAI(
  ai: GoogleGenAI,
  angle: PromoAngle,
  contentType: PromoContentType,
  options?: {
    audience?: string;
    tone?: string;
    isDirectSell?: boolean;
    customNote?: string;
    referralLink?: string;
  }
): Promise<{
  title: string;
  hook: string;
  body: string;
  fullThread: string[];
  ctaText: string;
  suggestedDisclosure: string;
  angleExplanation: string;
}> {
  const targetAudience = options?.audience || "ambitious creators, coaches, and digital entrepreneurs";
  const tone = options?.tone || "Authoritative, conversational, punchy, direct";
  const sellMode = options?.isDirectSell ? "Direct, high-conviction recommendation" : "Value-first soft sell with natural conversational hand-raiser";
  const referralLink = options?.referralLink || "https://threadsworks.com/?ref=YOUR_LINK";

  const prompt = `
You are the ThreadsWorks Partner Hub AI Content Assistant.
Your objective is to craft high-converting, authentic, Threads-native promotional content that an affiliate partner can post directly to Meta Threads to recommend ThreadsWorks.

=============================================================
AUTHORITATIVE THREADSWORKS PRODUCT TRUTH (DO NOT INVENT DETAILS):
=============================================================
- **Product Name**: ThreadsWorks
- **What It Does**: The surgical content generation engine, calendar scheduler, and 1-click publishing platform built exclusively for Meta Threads.
- **Key Features**:
  1. Deep Creator Voice & DNA matching (captures authentic cognition, beliefs, worldview, vocabulary, and tone).
  2. Multi-part Thread Synthesizer (crafts punchy, scroll-stopping threads with strict character & sentence density limits).
  3. Direct Meta Threads API 1-Click Publishing & Scheduling.
  4. Content Ideas Vault & Pillar Strategy Orchestrator.
- **Pricing**: Simple, transparent creator pricing of exactly **$7/month** (or $59/year).
- **Affiliate Program Fact**: 50% recurring commission on every active referral ($3.50/mo).
- **Anti-Slop Strict Directive**: No corporate hype, no fake urgency, no cheesy buzzwords (e.g. "revolutionize", "delve", "game-changer", "buckle up"). Write like a savvy digital entrepreneur sharing a genuine operational breakthrough with their peers.

=============================================================
CAMPAIGN CONFIGURATION:
=============================================================
- **Promotion Angle**: "${angle}" (e.g. Problem-aware, Educational, Personal experience, Product demo, Workflow improvement, Creator productivity, Content consistency, Soft sell, Direct recommendation).
- **Content Type**: "${contentType}" (e.g. Threads post, Hook breakdown, Reply starter, Demo breakdown, Story post, Soft CTA, Direct CTA, Objection response).
- **Target Audience**: "${targetAudience}"
- **Tone**: "${tone}"
- **Sell Strategy**: "${sellMode}"
${options?.customNote ? `- **Custom Partner Context / Experience**: "${options.customNote}"` : ""}

=============================================================
OUTPUT FORMAT REQUIREMENT (Return strictly JSON):
=============================================================
Return a JSON object with:
- "title": Short descriptive title for the post
- "hook": The 1-line scroll-stopping first sentence (max 14 words)
- "body": The complete main post body formatted with double line breaks for mobile readability
- "fullThread": Array of 2 to 4 sequential thread parts (if multi-part thread is appropriate, otherwise single item matching body)
- "ctaText": The exact natural call-to-action to drop in the post or comments (referencing the partner link: "${referralLink}")
- "suggestedDisclosure": Clean, FTC-compliant affiliate disclosure (e.g., "#partner", "affiliate link: [link]", or "Full disclosure: I earn a referral commission if you subscribe.")
- "angleExplanation": 1 sentence explaining why this angle converts for this audience
`;

  try {
    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      optimizationTaskId: "PARTNER_PROMO_GENERATE",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            hook: { type: Type.STRING },
            body: { type: Type.STRING },
            fullThread: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            ctaText: { type: Type.STRING },
            suggestedDisclosure: { type: Type.STRING },
            angleExplanation: { type: Type.STRING }
          },
          required: ["title", "hook", "body", "fullThread", "ctaText", "suggestedDisclosure", "angleExplanation"]
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      return parsed;
    }
  } catch (err: any) {
    console.warn("[PARTNER_AI] AI promo generation error, utilizing high-converting template fallback:", err.message);
  }

  // Fallback high-converting templates based on angle
  return getFallbackPromoContent(angle, contentType, referralLink);
}

/**
 * Robust fallback promotional copy if AI is offline
 */
function getFallbackPromoContent(
  angle: PromoAngle,
  contentType: PromoContentType,
  referralLink: string
) {
  const templates: Record<string, { title: string; hook: string; body: string; fullThread: string[]; ctaText: string; suggestedDisclosure: string; angleExplanation: string }> = {
    "problem-aware": {
      title: "The Silent Bottleneck in Threads Consistency",
      hook: "Most creators fail on Threads because drafting high-conviction posts takes 45 minutes each.",
      body: `Most creators fail on Threads because drafting high-conviction posts takes 45 minutes each.\n\nYou sit staring at a blank screen wondering what angle to take.\n\nThen you end up posting a generic tip that gets 0 replies.\n\nThe fix is not working harder.\nIt is using an engine that actually understands your voice and offer.\n\nThreadsWorks costs $7/mo and cuts drafting time down to 90 seconds.\n\nLink in bio / reply 'LINK' below and I will send over my referral link.\n\n#partner`,
      fullThread: [
        "Most creators fail on Threads because drafting high-conviction posts takes 45 minutes each.",
        "When you try to write from scratch every morning, decision fatigue kills your momentum by Wednesday.",
        "The creators winning right now have an automated workflow that turns raw thoughts into calibrated threads in 90 seconds.",
        `I use ThreadsWorks for this ($7/month). It has replaced my entire writing bottleneck.\n\nCheck it out here: ${referralLink}\n\n(Full disclosure: I earn a referral commission if you join).`
      ],
      ctaText: `Grab ThreadsWorks for $7/month here: ${referralLink}`,
      suggestedDisclosure: "Affiliate disclosure: I receive a commission if you subscribe through my link.",
      angleExplanation: "Addresses the #1 pain point of creators (blank-page fatigue) and presents ThreadsWorks as the obvious $7 operational fix."
    },
    "educational": {
      title: "The Anatomy of a High-Authority Threads Post",
      hook: "Every high-converting Threads post follows the same 3-part psychological framework:",
      body: `Every high-converting Threads post follows the same 3-part psychological framework:\n\n1. Counter-intuitive Hook (Interrupt the scroll)\n2. Mechanism Breakdown (Explain the 'why' with zero fluff)\n3. Conversational Hand-raiser (Prompt replies, not just passive likes)\n\nI used to spend an hour engineering these.\n\nNow I run my ideas through ThreadsWorks ($7/mo) which structures them automatically into this exact framework.\n\nLink: ${referralLink}\n\n#affiliate`,
      fullThread: [
        "Every high-converting Threads post follows the same 3-part psychological framework:",
        "1. Counter-intuitive Hook: Stop the scroll by challenging common wisdom.\n2. Mechanism Breakdown: Show the exact steps or logic.",
        "3. Conversational CTA: Ask a targeted question that sparks natural peer-to-peer discussions.",
        `ThreadsWorks formats your raw ideas directly into this structure in seconds. Costs $7/month:\n\n${referralLink}\n\n#partner`
      ],
      ctaText: `Test the framework with ThreadsWorks: ${referralLink}`,
      suggestedDisclosure: "#partner — I receive a referral commission if you join.",
      angleExplanation: "Educates creators on proven copywriting frameworks while demonstrating how ThreadsWorks automates the execution."
    },
    "personal-experience": {
      title: "How I Eliminated Decision Fatigue on Threads",
      hook: "I almost gave up on Meta Threads because writing 3 fresh posts every day was burning me out.",
      body: `I almost gave up on Meta Threads because writing 3 fresh posts every day was burning me out.\n\nThe game changed when I started using ThreadsWorks to calibrate my creator Voice DNA.\n\nInstead of writing from scratch, I drop in 1 rough thought and it turns it into 5 punchy thread options in my exact voice.\n\nIt is $7/month and has saved me 10+ hours a week.\n\nCheck it out here: ${referralLink}\n\n#partner`,
      fullThread: [
        "I almost gave up on Meta Threads because writing 3 fresh posts every day was burning me out.",
        "The problem wasn't ideas—it was translating my thoughts into punchy, mobile-readable formats without sounding robotic.",
        "ThreadsWorks solved this by matching my exact tone and vocabulary.",
        `If you are building an audience on Threads, it is the best $7/month you will spend:\n\n${referralLink}\n\n(Affiliate link: I earn a referral commission).`
      ],
      ctaText: `See how ThreadsWorks works ($7/mo): ${referralLink}`,
      suggestedDisclosure: "Affiliate disclosure: I earn a recurring commission if you subscribe using my link.",
      angleExplanation: "Builds high empathy through personal vulnerability and transparent experience."
    },
    "product-demo": {
      title: "From Raw Voice Note to Scheduled Thread in 90 Seconds",
      hook: "Watch how simple it is to turn a 15-second thought into a published Threads post:",
      body: `Watch how simple it is to turn a 15-second thought into a published Threads post with ThreadsWorks:\n\n1. Type or paste your core observation.\n2. Select your calibrated Voice DNA & content pillar.\n3. Hit generate — get 5 punchy hook & thread variations.\n4. Click 1 button to schedule directly to Meta Threads.\n\nTransparent pricing: $7/month.\n\nGrab your link here: ${referralLink}\n\n#affiliate`,
      fullThread: [
        "Watch how simple it is to turn a 15-second thought into a published Threads post with ThreadsWorks:",
        "Step 1: Input your core insight or observation.\nStep 2: Let the AI match your authentic cognitive style and perspective.",
        "Step 3: Pick the highest-impact variation and schedule it directly to Meta Threads with 1 click.",
        `No copying and pasting. Pure operational speed for $7/mo:\n\n${referralLink}\n\n#partner`
      ],
      ctaText: `Try ThreadsWorks demo ($7/mo): ${referralLink}`,
      suggestedDisclosure: "#partner — I earn a 50% affiliate commission on subscriptions.",
      angleExplanation: "Removes uncertainty by walking through the exact step-by-step product interaction."
    },
    "workflow-improvement": {
      title: "My 3-Step Daily Threads Content Stack",
      hook: "How I schedule 5 high-authority Threads posts daily in under 10 minutes:",
      body: `How I schedule 5 high-authority Threads posts daily in under 10 minutes:\n\n1. Capture 1 raw observation during the day.\n2. Feed it into ThreadsWorks with my custom Voice DNA enabled.\n3. Review the 5 generated variations, pick the sharpest hook, and queue it on the calendar.\n\nNo overthinking. No generic AI fluff.\n\nBest $7/mo I spend on software: ${referralLink}\n\n#affiliate`,
      fullThread: [
        "How I schedule 5 high-authority Threads posts daily in under 10 minutes:",
        "1. Capture 1 raw thought.\nInstead of writing full essays, I write down 1 sentence about what happened in my business.",
        "2. Pass it through ThreadsWorks.\nIt maps the thought against my audience, offer, and content pillars without sounding like a generic robot.",
        `3. Queue directly to Meta Threads with 1 click.\n\nAt $7/month, it is a complete no-brainer for serious creators.\n\nTry it here: ${referralLink}`
      ],
      ctaText: `Try ThreadsWorks ($7/mo): ${referralLink}`,
      suggestedDisclosure: "#partner — I earn a 50% recurring referral commission.",
      angleExplanation: "Demonstrates a concrete, friction-free daily workflow that makes publishing 5 posts/day feel effortless."
    },
    "creator-productivity": {
      title: "How Top Creators Publish 5x More with Zero Burnout",
      hook: "The difference between creators who burn out on Threads and those who scale is leverage.",
      body: `The difference between creators who burn out on Threads and those who scale is leverage.\n\nManual writing creates an operational ceiling.\nUsing generic AI makes you look like spam.\n\nThreadsWorks provides surgical leverage: your authentic voice, powered by calibrated frameworks and 1-click scheduling.\n\nAll for $7/month.\n\nUnlock your creator leverage: ${referralLink}\n\n#partner`,
      fullThread: [
        "The difference between creators who burn out on Threads and those who scale is leverage.",
        "You don't need to spend 2 hours a day writing tweets or threads.",
        "You need a calibrated system that extracts your ideas and structures them for maximum engagement in minutes.",
        `Check out ThreadsWorks ($7/month):\n\n${referralLink}\n\n#affiliate`
      ],
      ctaText: `Scale your Threads workflow ($7/mo): ${referralLink}`,
      suggestedDisclosure: "Affiliate disclosure: I receive a commission if you join through this link.",
      angleExplanation: "Appeals to ambitious creators seeking operational leverage and efficiency."
    },
    "content-consistency": {
      title: "The Simple Fix for Inconsistent Posting on Threads",
      hook: "You don't have an idea problem. You have an execution friction problem.",
      body: `You don't have an idea problem. You have an execution friction problem.\n\nWhen posting to Threads requires opening 4 tools, writing from scratch, and manually copying text, you will skip days when life gets busy.\n\nThreadsWorks eliminates the friction: idea capture, voice-DNA thread generation, and direct publishing in one tab.\n\nOnly $7/month.\n\nLink: ${referralLink}\n\n#partner`,
      fullThread: [
        "You don't have an idea problem. You have an execution friction problem.",
        "When your publishing workflow has too many steps, consistency falls apart the moment you get busy.",
        "ThreadsWorks makes posting as easy as dropping 1 bullet point and clicking 'Queue'.",
        `Stay consistent on Threads for $7/month:\n\n${referralLink}\n\n#affiliate`
      ],
      ctaText: `Fix your posting consistency: ${referralLink}`,
      suggestedDisclosure: "#partner — I earn a commission if you subscribe.",
      angleExplanation: "Reframes inconsistency as a tooling problem that can be immediately resolved."
    },
    "soft-sell": {
      title: "A Quick Tool Recommendation for Threads Creators",
      hook: "Quick recommendation for anyone building an audience on Meta Threads right now:",
      body: `Quick recommendation for anyone building an audience on Meta Threads right now:\n\nIf you want a clean tool that generates punchy threads in your authentic tone and schedules them directly, take a look at ThreadsWorks.\n\nIt is built specifically for Threads (not Twitter re-hashes) and is only $7/mo.\n\nLink here: ${referralLink}\n\n#partner`,
      fullThread: [
        "Quick recommendation for anyone building an audience on Meta Threads right now:",
        "Most social tools treat Threads as an afterthought, repurposing Twitter character formats that don't perform.",
        "ThreadsWorks is built specifically for the Meta Threads algorithm and creator tone.",
        `Costs $7/month. Check it out here: ${referralLink}\n\n#affiliate`
      ],
      ctaText: `Check out ThreadsWorks: ${referralLink}`,
      suggestedDisclosure: "#partner — referral link.",
      angleExplanation: "Low-pressure, high-trust recommendation that feels like a peer passing along a secret weapon."
    },
    "direct-recommendation": {
      title: "Why ThreadsWorks is My #1 Recommended Tool for 2026",
      hook: "If I could only keep ONE software tool for social media growth, it would be ThreadsWorks.",
      body: `If I could only keep ONE software tool for social media growth, it would be ThreadsWorks.\n\nHere is why:\n- Captures your true voice (zero generic AI slop)\n- Multi-part thread synthesizer with scroll-stopping hooks\n- 1-click scheduling straight to Meta Threads\n- Unbeatable creator pricing: $7/month\n\nGrab it here: ${referralLink}\n\n#partner`,
      fullThread: [
        "If I could only keep ONE software tool for social media growth, it would be ThreadsWorks.",
        "1. Voice DNA: It writes the way you think, not like a corporate press release.\n2. Built for Threads: Optimized for conversation, replies, and reach.",
        "3. Transparent pricing: $7/month flat.",
        `Get started here: ${referralLink}\n\n(Full disclosure: I earn a referral commission).`
      ],
      ctaText: `Get ThreadsWorks ($7/mo): ${referralLink}`,
      suggestedDisclosure: "Affiliate disclosure: I earn a 50% commission on subscriptions through this link.",
      angleExplanation: "High-conviction endorsement ideal for warm audiences looking for authoritative guidance."
    },
    "objection-response": {
      title: "Isn't AI Writing on Threads Generic?",
      hook: "'Most AI content on Threads sounds generic and robotic.' I 100% agreed—until I tested ThreadsWorks.",
      body: `'Most AI content on Threads sounds generic and robotic.' I 100% agreed—until I tested ThreadsWorks.\n\nGeneric tools output fluffy lists that get ignored.\n\nThreadsWorks is different because it uses Voice DNA calibration—training the model on your exact cognitive beliefs, phrasing, and vocabulary.\n\nThe output reads like you wrote it on your best day.\n\nAt $7/mo, it pays for itself in 1 post.\n\nTry it here: ${referralLink}\n\n#partner`,
      fullThread: [
        "'Most AI content on Threads sounds generic and robotic.' I 100% agreed—until I tested ThreadsWorks.",
        "Generic LLM prompts create fluff that destroys creator credibility.",
        "ThreadsWorks solves this by anchoring generations in your authentic Voice DNA and proprietary frameworks.",
        `See the difference for $7/month:\n\n${referralLink}\n\n#affiliate`
      ],
      ctaText: `Test Voice DNA on ThreadsWorks: ${referralLink}`,
      suggestedDisclosure: "#partner — I receive a referral commission if you join.",
      angleExplanation: "Directly dismantles the primary objection ('AI slop') by highlighting Voice DNA calibration."
    },
    "price-anchor": {
      title: "The $7/Month Growth Stack",
      hook: "Most social media software costs $49 to $99/month. ThreadsWorks is $7.",
      body: `Most social media software costs $49 to $99/month. ThreadsWorks is $7.\n\nAnd it is built exclusively for Meta Threads:\n- Voice DNA matching\n- Scroll-stopping thread synthesizer\n- Calendar & 1-click scheduling\n\nLess than the price of two coffees for an entire month of high-authority content.\n\nCheck it out: ${referralLink}\n\n#partner`,
      fullThread: [
        "Most social media software costs $49 to $99/month. ThreadsWorks is $7.",
        "You don't need an overpriced enterprise suite with 50 bloated features you never touch.",
        "You need a razor-sharp engine that generates high-converting threads and queues them with 1 click.",
        `Start using ThreadsWorks for $7/month:\n\n${referralLink}\n\n#affiliate`
      ],
      ctaText: `Grab ThreadsWorks for $7/mo: ${referralLink}`,
      suggestedDisclosure: "#partner — affiliate link.",
      angleExplanation: "Anchors against expensive enterprise tools ($49–$99) to make $7 feel like an undeniable bargain."
    },
    "time-saver": {
      title: "How to Reclaim 8 Hours a Week on Social Media",
      hook: "If you spend more than 15 minutes a day drafting Threads posts, you are losing 8 hours a week.",
      body: `If you spend more than 15 minutes a day drafting Threads posts, you are losing 8 hours a week.\n\nThreadsWorks automates the friction:\n1. Input raw idea\n2. Get 5 calibrated thread options\n3. Schedule with 1 click\n\nCosts $7/month and pays for itself on day one.\n\nLink: ${referralLink}\n\n#partner`,
      fullThread: [
        "If you spend more than 15 minutes a day drafting Threads posts, you are losing 8 hours a week.",
        "Your time is best spent engaging with your community and serving clients, not staring at a blank composer.",
        "ThreadsWorks condenses an entire week of Threads drafting into a single 15-minute block.",
        `Save 8 hours a week with ThreadsWorks ($7/mo):\n\n${referralLink}\n\n#affiliate`
      ],
      ctaText: `Save 8 hours/week with ThreadsWorks: ${referralLink}`,
      suggestedDisclosure: "#partner — I earn a 50% commission on subscriptions.",
      angleExplanation: "Quantifies the exact time ROI (8 hours saved per week) for $7/month."
    }
  };

  return templates[angle] || templates["problem-aware"];
}
