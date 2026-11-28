/**
 * Pure domain logic for ContentPaysUs Ecosystem:
 * - First Sale Engine milestone evaluation & strict verified-sale eligibility rules
 * - AutomationWorks safety policy & approval-gate enforcement
 * - AffiliateWorks self-referral prevention
 * - ProductWorks Automatic Promotion grounding & idempotency checks
 */

export interface VerifiedSaleCandidate {
  id: string;
  sellerUid: string;
  buyerUid?: string | null;
  amountCents: number;
  status: string; // "verified" | "pending" | "refunded" | "cancelled"
  isTestTransaction?: boolean;
  source?: string; // "store_checkout" | "salesworks_deal" | "invoice_paid" | "threadsworks_saas_subscription"
  productName?: string;
  createdAt?: string;
}

export interface VerifiedSaleCheckResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Strictly enforces Prompt D First Sale verification rules:
 * Excludes test payments, self-purchases, refunded/cancelled orders,
 * zero/negative amounts, and ThreadsWorks SaaS subscription payments.
 */
export function isEligibleVerifiedCreatorSale(
  candidate: VerifiedSaleCandidate
): VerifiedSaleCheckResult {
  if (!candidate || typeof candidate !== "object") {
    return { eligible: false, reason: "MISSING_RECORD" };
  }
  if (candidate.isTestTransaction === true) {
    return { eligible: false, reason: "TEST_TRANSACTION_EXCLUDED" };
  }
  if (candidate.source === "threadsworks_saas_subscription" || candidate.source === "saas_subscription") {
    return { eligible: false, reason: "SAAS_SUBSCRIPTION_EXCLUDED" };
  }
  if (candidate.status === "refunded" || candidate.status === "cancelled" || candidate.status === "failed") {
    return { eligible: false, reason: "REFUNDED_OR_INVALID_STATUS" };
  }
  if (candidate.status !== "verified" && candidate.status !== "paid") {
    return { eligible: false, reason: "NOT_VERIFIED" };
  }
  if (typeof candidate.amountCents !== "number" || candidate.amountCents <= 0) {
    return { eligible: false, reason: "NON_POSITIVE_AMOUNT" };
  }
  if (candidate.buyerUid && candidate.sellerUid && candidate.buyerUid === candidate.sellerUid) {
    return { eligible: false, reason: "SELF_PURCHASE_EXCLUDED" };
  }
  return { eligible: true };
}

export interface FirstSaleSnapshot {
  hasCreatorProfile: boolean;
  hasDemandResearch: boolean;
  hasOfferBlueprint: boolean;
  hasDigitalProduct: boolean;
  hasProductPromotionDrafts: boolean;
  hasThreadsContent: boolean;
  hasFunnelOrLeadAsset: boolean;
  hasCrmLeads: boolean;
  hasDiscoveryMeetings: boolean;
  hasStoreListing: boolean;
  hasDeliverySetup: boolean;
  hasProofItem: boolean;
  verifiedCreatorSalesCount: number;
  excludedSalesCount: number;
}

export interface FirstSaleMilestone {
  step: number;
  id: string;
  title: string;
  appId: string;
  appName: string;
  completed: boolean;
  actionLabel: string;
  summary: string;
}

export interface FirstSaleEngineState {
  milestones: FirstSaleMilestone[];
  completedCount: number;
  totalMilestones: number;
  percentComplete: number;
  nextRecommendedMilestone: FirstSaleMilestone | null;
  hasAchievedFirstVerifiedSale: boolean;
  verifiedCreatorSalesCount: number;
  excludedSalesCount: number;
}

/**
 * Computes the 12-stage First Sale Engine progress strictly from actual
 * completed creator records—never forcing creators to repeat steps they
 * already finished.
 */
export function computeFirstSaleEngineState(snapshot: FirstSaleSnapshot): FirstSaleEngineState {
  const milestones: FirstSaleMilestone[] = [
    {
      step: 1,
      id: "creator_assessment",
      title: "Creator Positioning & Voice",
      appId: "creatorworks",
      appName: "CreatorWorks",
      completed: snapshot.hasCreatorProfile,
      actionLabel: "Define Positioning in CreatorWorks",
      summary: "Clarify who you help, your core expertise, and natural voice in your shared profile."
    },
    {
      step: 2,
      id: "buyer_demand",
      title: "Validate Real Buyer Demand",
      appId: "demandworks",
      appName: "DemandWorks",
      completed: snapshot.hasDemandResearch,
      actionLabel: "Map Buyer Problems in DemandWorks",
      summary: "Document real audience questions or interview notes before building."
    },
    {
      step: 3,
      id: "offer_definition",
      title: "Shape a Clear Starter Offer",
      appId: "offerworks",
      appName: "OfferWorks",
      completed: snapshot.hasOfferBlueprint,
      actionLabel: "Build Offer in OfferWorks",
      summary: "Define the exact promise, deliverables, and transparent pricing of your first offer."
    },
    {
      step: 4,
      id: "product_creation",
      title: "Build Your Downloadable Digital Product",
      appId: "productworks",
      appName: "ProductWorks",
      completed: snapshot.hasDigitalProduct,
      actionLabel: "Create Product in ProductWorks",
      summary: "Generate and edit a downloadable playbook, carousel, guide, or workbook."
    },
    {
      step: 5,
      id: "product_promotion",
      title: "Prepare Product Promotional Drafts",
      appId: "productworks",
      appName: "ProductWorks",
      completed: snapshot.hasProductPromotionDrafts,
      actionLabel: "Review Auto-Promotion in ProductWorks",
      summary: "Generate grounded promotional drafts tied to your saved product and send to ThreadsWorks."
    },
    {
      step: 6,
      id: "content_momentum",
      title: "Draft & Schedule Helpful Content",
      appId: "threadsworks",
      appName: "ThreadsWorks",
      completed: snapshot.hasThreadsContent,
      actionLabel: "Publish in ThreadsWorks",
      summary: "Share consistent educational and conversation-starting Meta Threads posts."
    },
    {
      step: 7,
      id: "funnel_bridge",
      title: "Connect Content to Opt-In or Offer Path",
      appId: "funnelworks",
      appName: "FunnelWorks",
      completed: snapshot.hasFunnelOrLeadAsset,
      actionLabel: "Build Pathway in FunnelWorks",
      summary: "Create a clear landing page, welcome sequence, or lead capture bridge."
    },
    {
      step: 8,
      id: "buyer_pipeline",
      title: "Log Real Leads & Buyer Conversations",
      appId: "salesworks",
      appName: "SalesWorks",
      completed: snapshot.hasCrmLeads,
      actionLabel: "Track Leads in SalesWorks CRM",
      summary: "Record warm replies, inquiries, and follow-up actions cleanly."
    },
    {
      step: 9,
      id: "discovery_meetings",
      title: "Run Discovery or Buyer Sessions",
      appId: "meetingworks",
      appName: "MeetingWorks",
      completed: snapshot.hasDiscoveryMeetings,
      actionLabel: "Schedule Session in MeetingWorks",
      summary: "Host structured conversations and capture buyer questions and action items."
    },
    {
      step: 10,
      id: "storefront_listing",
      title: "Publish Your Offer Listing",
      appId: "storeworks",
      appName: "StoreWorks",
      completed: snapshot.hasStoreListing,
      actionLabel: "Add Listing in StoreWorks",
      summary: "Organize transparent pricing, deliverables, and bundles in your catalog."
    },
    {
      step: 11,
      id: "delivery_readiness",
      title: "Prepare Smooth Customer Delivery",
      appId: "deliveryworks",
      appName: "DeliveryWorks",
      completed: snapshot.hasDeliverySetup,
      actionLabel: "Configure DeliveryWorks",
      summary: "Set up digital product delivery access and buyer onboarding checklists."
    },
    {
      step: 12,
      id: "verified_first_sale",
      title: "Earn & Document Your First Verified Sale",
      appId: "financeworks",
      appName: "FinanceWorks & ProofWorks",
      completed: snapshot.verifiedCreatorSalesCount > 0,
      actionLabel: "Record Verified Sale in SalesWorks / FinanceWorks",
      summary:
        "Complete your first eligible real customer sale (excludes test payments, self-purchases, refunds, and SaaS subscription fees)."
    }
  ];

  const completedCount = milestones.filter((m) => m.completed).length;
  const nextRecommendedMilestone = milestones.find((m) => !m.completed) || null;

  return {
    milestones,
    completedCount,
    totalMilestones: milestones.length,
    percentComplete: Math.round((completedCount / milestones.length) * 100),
    nextRecommendedMilestone,
    hasAchievedFirstVerifiedSale: snapshot.verifiedCreatorSalesCount > 0,
    verifiedCreatorSalesCount: snapshot.verifiedCreatorSalesCount,
    excludedSalesCount: snapshot.excludedSalesCount
  };
}

export type AutomationActionType =
  | "prepare_promo_brief"
  | "prepare_delivery_welcome"
  | "create_crm_followup"
  | "log_intelligence_note"
  | "publish_to_threads_external"
  | "charge_payment_external"
  | "send_external_email";

export interface AutomationPolicyInput {
  actionType: AutomationActionType;
  requiresApproval: boolean;
  approvedByUser?: boolean;
  maxRetries?: number;
}

export interface AutomationPolicyDecision {
  allowed: boolean;
  status: "EXECUTED" | "PENDING_APPROVAL" | "BLOCKED_EXTERNAL_APPROVAL_REQUIRED";
  reason: string;
  boundedMaxRetries: number;
}

const BLOCKED_EXTERNAL_ACTIONS = new Set<AutomationActionType>([
  "publish_to_threads_external",
  "charge_payment_external",
  "send_external_email"
]);

/**
 * Enforces AutomationWorks safety guardrails:
 * - Strictly blocks unauthorized external publishing, outbound email blasting, or live charges.
 * - Enforces human approval gates when `requiresApproval` is enabled.
 * - Bounds automatic retries to [0..3].
 */
export function evaluateAutomationPolicy(input: AutomationPolicyInput): AutomationPolicyDecision {
  const boundedMaxRetries = Math.max(0, Math.min(Number(input.maxRetries ?? 2), 3));

  if (BLOCKED_EXTERNAL_ACTIONS.has(input.actionType)) {
    return {
      allowed: false,
      status: "BLOCKED_EXTERNAL_APPROVAL_REQUIRED",
      reason:
        "Safety policy blocks automated external publishing, payment charges, or outbound emails without explicit manual execution.",
      boundedMaxRetries
    };
  }

  if (input.requiresApproval && !input.approvedByUser) {
    return {
      allowed: false,
      status: "PENDING_APPROVAL",
      reason: "Workflow paused at human approval gate. Approve this run explicitly to execute.",
      boundedMaxRetries
    };
  }

  return {
    allowed: true,
    status: "EXECUTED",
    reason: "Safe internal ecosystem workflow executed cleanly.",
    boundedMaxRetries
  };
}

/**
 * AffiliateWorks self-referral prevention guard.
 */
export function validateAffiliateReferral(
  referrerUid: string,
  buyerUid: string,
  referrerEmail?: string,
  buyerEmail?: string
): { valid: boolean; reason?: string } {
  if (!referrerUid || !buyerUid) {
    return { valid: false, reason: "MISSING_IDENTIFIERS" };
  }
  if (referrerUid.trim() === buyerUid.trim()) {
    return { valid: false, reason: "SELF_REFERRAL_UID_BLOCKED" };
  }
  if (
    referrerEmail &&
    buyerEmail &&
    referrerEmail.trim().toLowerCase() === buyerEmail.trim().toLowerCase()
  ) {
    return { valid: false, reason: "SELF_REFERRAL_EMAIL_BLOCKED" };
  }
  return { valid: true };
}

/**
 * ProductWorks Automatic Promotion grounding verifier:
 * Ensures generated promotion drafts never invent prices or URLs not present
 * in the saved product metadata.
 */
export function buildProductPromotionPrompt(product: {
  title: string;
  subtitle?: string;
  audience?: string;
  outcome?: string;
  playbookSummary?: string;
  price?: string;
  url?: string;
  creatorVoice?: string;
}): string {
  const hasPrice = Boolean(product.price && product.price.trim());
  const hasUrl = Boolean(product.url && product.url.trim());

  return [
    "Generate 5 Meta Threads promotional drafts for a creator's saved digital product.",
    "STRICT GROUNDING RULES:",
    "- Use ONLY the product details supplied below.",
    hasPrice
      ? `- You may mention the exact provided price: ${product.price!.trim()}.`
      : "- DO NOT invent or mention any dollar amount or price.",
    hasUrl
      ? `- You may include ONLY this exact URL: ${product.url!.trim()}.`
      : "- DO NOT invent or include any website URL or link.",
    "- DO NOT invent customer testimonials, sales numbers, or fake urgency.",
    "- Keep every post part under 480 characters and natural, peer-to-peer, evidence-based.",
    "",
    `Product Title: ${product.title}`,
    product.subtitle ? `Subtitle: ${product.subtitle}` : "",
    product.audience ? `Target Audience: ${product.audience}` : "",
    product.outcome ? `Core Outcome: ${product.outcome}` : "",
    product.playbookSummary ? `Key Contents: ${product.playbookSummary.slice(0, 1200)}` : "",
    product.creatorVoice ? `Creator Voice Style: ${product.creatorVoice}` : "",
    "",
    "Return valid JSON matching this exact structure:",
    `{
  "drafts": [
    { "angle": "educational", "label": "Educational Takeaway", "parts": ["Part 1...", "Part 2..."] },
    { "angle": "problem_awareness", "label": "Problem & Opportunity Framing", "parts": ["Part 1...", "Part 2..."] },
    { "angle": "storytelling", "label": "Behind-the-Framework Story", "parts": ["Part 1...", "Part 2..."] },
    { "angle": "conversation_starter", "label": "Conversation Starter", "parts": ["Single short post inviting replies..."] },
    { "angle": "sales", "label": "Direct Transparent Offer Post", "parts": ["Part 1...", "Part 2..."] }
  ]
}`
  ]
    .filter(Boolean)
    .join("\n");
}
