import { auth } from "../firebase";
import {
  PartnerProfile,
  CommissionRecord,
  PayoutRecord,
  PartnerPerformanceMetrics,
  PartnerProgramConfig,
  PayoutMethod,
  PromoAngle,
  PromoContentType,
  PartnerAuditLog,
  PartnerNotification
} from "../types/partner";

async function getAuthHeaders(): Promise<HeadersInit> {
  const currentUser = auth.currentUser;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.warn("[PARTNER_CLIENT] Error acquiring ID token:", e);
    }
  }
  return headers;
}

export async function fetchProgramConfig(): Promise<PartnerProgramConfig> {
  const res = await fetch("/api/partner/config");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load program config");
  return data.config;
}
export const fetchPartnerProgramConfig = fetchProgramConfig;

export async function fetchMyPartnerProfile(): Promise<PartnerProfile | null> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/me", { headers });
  if (res.status === 401) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch partner profile");
  return data.partner;
}

export async function joinPartnerProgram(name?: string): Promise<PartnerProfile> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/join", {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to activate partner account");
  return data.partner;
}

export async function trackReferralClick(
  referralCode: string,
  landingPath?: string,
  referrer?: string
): Promise<{ success: boolean; partnerId?: string; referralCode?: string }> {
  try {
    const res = await fetch("/api/partner/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referralCode,
        landingPath: landingPath || window.location.pathname,
        referrer: referrer || document.referrer,
      }),
    });
    return await res.json();
  } catch (err) {
    console.warn("[PARTNER_CLIENT] Click tracking network error:", err);
    return { success: false };
  }
}

export async function attributeUserToReferral(referralCode: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/partner/attribute", {
      method: "POST",
      headers,
      body: JSON.stringify({ referralCode }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.warn("[PARTNER_CLIENT] Attribution network error:", err);
    return false;
  }
}

export async function fetchPartnerPerformance(): Promise<PartnerPerformanceMetrics> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/performance", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load performance metrics");
  return data.metrics;
}

export async function fetchPartnerCommissions(): Promise<CommissionRecord[]> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/commissions", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load commissions ledger");
  return data.commissions || [];
}

export async function fetchPartnerPayouts(): Promise<{
  payouts: PayoutRecord[];
  payableBalance: number;
  pendingBalance: number;
  paidBalance: number;
  minimumPayout: number;
  payoutMethod: PayoutMethod | null;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/payouts", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load payouts");
  return data;
}

export async function submitPayoutRequest(payoutMethod?: PayoutMethod): Promise<PayoutRecord> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/request-payout", {
    method: "POST",
    headers,
    body: JSON.stringify({ payoutMethod }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to submit payout request");
  return data.payout;
}

export async function updatePayoutMethodSetting(payoutMethod: PayoutMethod): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/update-payout-method", {
    method: "POST",
    headers,
    body: JSON.stringify({ payoutMethod }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update payout method");
}

export async function generatePromoContent(params: {
  angle: PromoAngle;
  contentType: PromoContentType;
  audience?: string;
  tone?: string;
  isDirectSell?: boolean;
  customNote?: string;
  referralLink?: string;
}): Promise<{
  title: string;
  hook: string;
  body: string;
  fullThread: string[];
  ctaText: string;
  suggestedDisclosure: string;
  angleExplanation: string;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/generate-promo-content", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate promotional content");
  return data.content;
}

export async function fetchPartnerNotifications(): Promise<PartnerNotification[]> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/notifications", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load notifications");
  return data.notifications || [];
}

export async function markPartnerNotificationAsRead(notificationId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/notifications/mark-read", {
    method: "POST",
    headers,
    body: JSON.stringify({ notificationId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to mark notification read");
}

// Admin API
export async function adminFetchAllPartners(): Promise<PartnerProfile[]> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/admin/partners", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin: Failed to fetch partners");
  return data.partners || [];
}

export async function adminFetchAuditLogs(): Promise<PartnerAuditLog[]> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/admin/audit-logs", { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin: Failed to fetch audit logs");
  return data.auditLogs || [];
}

export async function adminUpdateProgramConfig(config: Partial<PartnerProgramConfig>): Promise<PartnerProgramConfig> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/admin/config", {
    method: "POST",
    headers,
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin: Failed to update program config");
  return data.config;
}

export async function adminUpdatePartnerStatus(partnerId: string, status: "active" | "suspended"): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/admin/partner-status", {
    method: "POST",
    headers,
    body: JSON.stringify({ partnerId, status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin: Failed to update partner status");
}

export async function adminProcessPayoutRequest(
  payoutId: string,
  action: "paid" | "rejected",
  providerReference?: string,
  rejectionReason?: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/partner/admin/process-payout", {
    method: "POST",
    headers,
    body: JSON.stringify({ payoutId, action, providerReference, rejectionReason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin: Failed to process payout");
}
