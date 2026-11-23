export type PartnerStatus = "active" | "suspended";

export type CommissionStatus = "pending" | "approved" | "payable" | "paid" | "reversed" | "rejected";

export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "rejected";

export type PayoutMethodType = "paypal" | "wise" | "bank" | "bank_wire";

export interface PayoutMethod {
  type: PayoutMethodType;
  details: any; // e.g. paypal email, wise email/tag, bank account info, or object
  accountName?: string;
  notes?: string;
  email?: string;
  accountNumber?: string;
  updatedAt?: string;
}

export interface PartnerProfile {
  id: string; // usually matching user.uid or partner_xxx
  userId: string;
  email: string;
  userEmail?: string;
  name?: string;
  status: PartnerStatus;
  referralCode: string;
  referralUrl: string;
  commissionRate: number; // default 0.50 (50%)
  payoutMethod?: PayoutMethod;
  totalClicks: number;
  totalSignups: number;
  totalCustomers: number;
  activeCustomers: number;
  monthlyRecurringCommission: number; // activeCustomers * ($7 * commissionRate)
  totalEarned: number;
  pendingBalance: number;
  payableBalance: number;
  paidBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerCustomer {
  id: string;
  partnerId: string;
  partnerReferralCode: string;
  userId: string;
  userEmail: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: "active" | "canceled" | "past_due" | "free" | "trialing";
  billingCycle: "monthly" | "yearly";
  attributedAt: string;
  lastCommissionAt?: string;
  totalCommissionGenerated: number;
  status: "active" | "inactive";
}

export interface CommissionRecord {
  id: string;
  partnerId: string;
  partnerReferralCode: string;
  customerId: string;
  customerEmail: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  stripeChargeId?: string;
  transactionReference: string; // Stripe invoice ID or charge ID
  grossAmount: number; // e.g. 7.00
  commissionRate: number; // 0.50
  commissionAmount: number; // 3.50
  currency: string;
  status: CommissionStatus;
  reason?: string;
  createdAt: string;
  approvedAt?: string;
  payableAt?: string;
  paidAt?: string;
  reversedAt?: string;
  payoutId?: string;
}

export interface PayoutRecord {
  id: string;
  partnerId: string;
  partnerEmail: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  payoutMethod: PayoutMethod;
  provider: string; // e.g. "paypal", "manual_transfer", "wise"
  providerReference?: string;
  requestedAt: string;
  createdAt?: string;
  processedAt?: string;
  failureReason?: string;
  commissionIds?: string[];
  notes?: string;
}

export interface PartnerPerformanceMetrics {
  totalClicks: number;
  totalSignups: number;
  payingCustomers: number;
  activeReferrals: number;
  conversionRate: number; // (payingCustomers / clicks) * 100
  revenueGenerated: number; // total gross revenue
  commissionsGenerated: number; // total commissions
  monthlyRecurringCommission: number; // current active MRR
  timeframeData?: {
    date: string;
    clicks: number;
    signups: number;
    conversions: number;
    commission: number;
  }[];
}

export interface PartnerProgramConfig {
  productName: string;
  productPrice: number; // 7.00
  yearlyPrice: number; // 59.00
  commissionRate: number; // 0.50
  minimumPayout: number; // 25.00
  attributionCookieDays: number; // 60
  canonicalProductUrl: string;
  selfReferralAllowed: boolean;
}

export type PromoAngle =
  | "problem-aware"
  | "educational"
  | "personal-experience"
  | "product-demonstration"
  | "before-after"
  | "workflow-improvement"
  | "creator-productivity"
  | "content-consistency"
  | "content-organization"
  | "ai-assisted"
  | "soft-sell"
  | "direct-recommendation";

export type PromoContentType =
  | "threads-post"
  | "hook"
  | "reply"
  | "conversation-starter"
  | "demo-breakdown"
  | "story-post"
  | "soft-cta"
  | "direct-cta"
  | "objection-response";

export interface PartnerAuditLog {
  id: string;
  action: string; // e.g. "payout_processed", "partner_status_updated", "commission_adjusted", "payout_rejected"
  adminId: string;
  adminEmail?: string;
  targetPartnerId?: string;
  targetPayoutId?: string;
  targetCommissionId?: string;
  amount?: number;
  details: string;
  previousValue?: any;
  newValue?: any;
  timestamp: string;
  createdAt?: string;
}

export interface PartnerNotification {
  id: string;
  partnerId: string;
  type: "referral_signup" | "commission_earned" | "commission_approved" | "payout_threshold_reached" | "payout_paid" | "payout_rejected" | "account_notice";
  title: string;
  message: string;
  amount?: number;
  read: boolean;
  isRead?: boolean;
  createdAt: string;
}
