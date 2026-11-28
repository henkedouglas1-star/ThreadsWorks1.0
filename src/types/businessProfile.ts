import type { UserProfile } from "../types";
import type { IntelligenceDomain } from "./sharedIntelligence";

export type BusinessStage =
  | ""
  | "idea"
  | "pre_launch"
  | "early_traction"
  | "growing"
  | "scaling";

export type OfferAvailabilityStatus =
  | "available"
  | "planned"
  | "in_development"
  | "archived";

export type OfferBillingFrequency =
  | "one_time"
  | "monthly"
  | "annual"
  | "commission"
  | "platform_fee"
  | "free"
  | "custom";

export interface CreatorProfileFields {
  creatorName: string;
  professionalBackground: string;
  expertise: string;
  experience: string;
  personality: string;
  writingVoice: string;
  communicationPreferences: string;
  wordsToAvoid: string;
  defaultCta: string;
}

export interface BusinessIdentityFields {
  businessName: string;
  website: string;
  industry: string;
  mission: string;
  vision: string;
  businessDescription: string;
  positioning: string;
  businessModel: string;
  revenueStreams: string;
  competitiveAdvantages: string;
  currentBusinessStage: BusinessStage;
  shortTermObjectives: string;
  longTermObjectives: string;
  ecosystemSummary: string;
}

export interface BusinessOfferItem {
  id: string;
  name: string;
  description: string;
  targetCustomer: string;
  problemsSolved: string;
  benefits: string;
  pricing: string;
  billingFrequency: OfferBillingFrequency;
  salesUrl: string;
  availabilityStatus: OfferAvailabilityStatus;
  affiliateEligible: boolean;
  affiliateTerms?: string;
}

export interface TargetAudienceFields {
  idealCustomers: string;
  customerProblems: string;
  desiredOutcomes: string;
  buyingMotivations: string;
  commonObjections: string;
  preferredCommunicationChannels: string;
}

/**
 * Business-scoped record stored in `business_profiles/{userId}__{businessId}`.
 * Designed to support multiple businesses per authenticated member in the future
 * while remaining simple and single-business (`businessId = "primary"`) today.
 *
 * All member-edited business fields carry explicit `user_provided_fact` provenance
 * and NEVER authorize billing changes, payment activation, or unavailable features.
 */
export interface BusinessProfileRecord {
  id: string;
  userId: string;
  businessId: string;
  schemaVersion: number;
  isDefault: boolean;
  provenance: "user_provided_fact";
  creatorProfile: CreatorProfileFields;
  businessProfile: BusinessIdentityFields;
  productsAndOffers: BusinessOfferItem[];
  targetAudience: TargetAudienceFields;
  /** Backward-compatible natural-language Creator Context preserved from ThreadsWorks */
  creatorContext: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfileValidationResult {
  valid: boolean;
  errors: string[];
  record?: BusinessProfileRecord;
}

export const DEFAULT_BUSINESS_ID = "primary";
export const BUSINESS_PROFILE_SCHEMA_VERSION = 1;

export const ALLOWED_BUSINESS_STAGES: readonly BusinessStage[] = [
  "",
  "idea",
  "pre_launch",
  "early_traction",
  "growing",
  "scaling"
];

export const ALLOWED_OFFER_AVAILABILITY_STATUSES: readonly OfferAvailabilityStatus[] = [
  "available",
  "planned",
  "in_development",
  "archived"
];

export const ALLOWED_OFFER_BILLING_FREQUENCIES: readonly OfferBillingFrequency[] = [
  "one_time",
  "monthly",
  "annual",
  "commission",
  "platform_fee",
  "free",
  "custom"
];

/**
 * Fields that direct client writes are strictly forbidden from asserting on business profiles.
 */
export const FORBIDDEN_CLIENT_VERIFIED_FIELDS: readonly string[] = [
  "verifiedMetrics",
  "verifiedTransactions",
  "verifiedRevenueCents",
  "verifiedSalesCount",
  "verificationStatus",
  "verificationTier",
  "billingEntitlements",
  "subscriptionStatus",
  "isPro",
  "stripeCustomerId"
];

export const BILLING_AUTHORITY_NOTICE =
  "Business profile pricing, planned offers, and program terms are descriptive context for your workspace and AI tools only. Live subscription prices, billing entitlements, payment processing, and feature availability remain governed exclusively by the platform billing catalog and verified integrations.";

export interface AppBusinessContextSpec {
  appId: string;
  domains: IntelligenceDomain[];
  sections: Array<"creator" | "business" | "availableOffers" | "plannedOffers" | "audience" | "objectives" | "performance">;
  purpose: string;
}

/**
 * Task-scoped Business Context routing map for all 20 ContentPaysUs applications.
 * Ensures every application pulls only relevant business context for its workflow.
 */
export const APP_BUSINESS_CONTEXT_CONFIG: Record<string, AppBusinessContextSpec> = {
  creatorworks: {
    appId: "creatorworks",
    domains: ["identity", "business", "audience", "projects"],
    sections: ["creator", "business", "audience", "objectives"],
    purpose: "Develop and refine brand positioning, creator story, voice, and business identity."
  },
  demandworks: {
    appId: "demandworks",
    domains: ["identity", "business", "audience", "projects"],
    sections: ["business", "audience", "availableOffers", "plannedOffers", "objectives"],
    purpose: "Research buyer problems, demand signals, and positioning gaps for the business."
  },
  offerworks: {
    appId: "offerworks",
    domains: ["identity", "business", "audience", "products", "projects"],
    sections: ["business", "availableOffers", "plannedOffers", "audience", "objectives"],
    purpose: "Architect offers, pricing structure, guarantees, and objection handling."
  },
  productworks: {
    appId: "productworks",
    domains: ["identity", "business", "audience", "products", "projects"],
    sections: ["creator", "business", "availableOffers", "plannedOffers", "audience"],
    purpose: "Build digital products, playbooks, and grounded promotion assets aligned with business offers."
  },
  threadsworks: {
    appId: "threadsworks",
    domains: ["identity", "business", "audience", "content", "performance", "products"],
    sections: ["creator", "business", "availableOffers", "plannedOffers", "audience", "performance"],
    purpose: "Generate voice-accurate Threads content grounded in business context without overriding explicit instructions."
  },
  contentworks: {
    appId: "contentworks",
    domains: ["identity", "business", "audience", "content", "products", "projects"],
    sections: ["creator", "business", "availableOffers", "plannedOffers", "audience"],
    purpose: "Repurpose and plan multi-platform content consistent with brand voice and active offerings."
  },
  funnelworks: {
    appId: "funnelworks",
    domains: ["identity", "business", "audience", "products", "projects"],
    sections: ["business", "availableOffers", "plannedOffers", "audience", "objectives"],
    purpose: "Design opt-ins, landing pages, and conversion paths grounded in real offers."
  },
  salesworks: {
    appId: "salesworks",
    domains: ["identity", "business", "audience", "products", "projects"],
    sections: ["creator", "business", "availableOffers", "audience", "objectives"],
    purpose: "Guide consultative sales conversations, objection handling, and CRM follow-ups."
  },
  storeworks: {
    appId: "storeworks",
    domains: ["business", "products", "audience", "projects"],
    sections: ["business", "availableOffers", "plannedOffers", "audience"],
    purpose: "Organize storefront listings, pricing copy, and product descriptions."
  },
  deliveryworks: {
    appId: "deliveryworks",
    domains: ["identity", "business", "products", "audience", "projects"],
    sections: ["creator", "business", "availableOffers", "audience"],
    purpose: "Structure customer onboarding, course delivery, and digital download instructions."
  },
  communityworks: {
    appId: "communityworks",
    domains: ["identity", "business", "audience", "projects"],
    sections: ["creator", "business", "audience"],
    purpose: "Support authentic peer networking and community discussions grounded in creator expertise."
  },
  meetingworks: {
    appId: "meetingworks",
    domains: ["identity", "business", "audience", "products", "projects"],
    sections: ["creator", "business", "availableOffers", "audience", "objectives"],
    purpose: "Prepare discovery call agendas, session notes, and follow-up summaries."
  },
  proofworks: {
    appId: "proofworks",
    domains: ["business", "audience", "products", "performance", "projects"],
    sections: ["business", "availableOffers", "audience", "performance"],
    purpose: "Structure verified and evidence-supported customer outcomes without inventing proof."
  },
  teamworks: {
    appId: "teamworks",
    domains: ["business", "projects"],
    sections: ["business", "objectives"],
    purpose: "Align collaborators, roles, SOPs, and task approvals with business objectives."
  },
  affiliateworks: {
    appId: "affiliateworks",
    domains: ["business", "products", "audience", "projects"],
    sections: ["business", "availableOffers", "plannedOffers", "audience"],
    purpose: "Draft partner enablement kits and referral messaging respecting available vs planned programs."
  },
  growthworks: {
    appId: "growthworks",
    domains: ["identity", "business", "audience", "performance", "projects"],
    sections: ["business", "availableOffers", "plannedOffers", "audience", "objectives", "performance"],
    purpose: "Review real performance signals against business objectives and identify next actions."
  },
  automationworks: {
    appId: "automationworks",
    domains: ["business", "products", "projects"],
    sections: ["business", "availableOffers", "objectives"],
    purpose: "Design safe, approval-gated workflow sequences connected to real creator assets."
  },
  financeworks: {
    appId: "financeworks",
    domains: ["business", "products", "performance", "projects"],
    sections: ["business", "availableOffers", "plannedOffers", "objectives", "performance"],
    purpose: "Organize real revenue, expenses, and pricing economics without fabricating financial figures."
  },
  adsworks: {
    appId: "adsworks",
    domains: ["identity", "business", "audience", "products", "performance", "projects"],
    sections: ["creator", "business", "availableOffers", "audience", "objectives"],
    purpose: "Draft compliant ad angles and creative briefs strictly for available offers."
  },
  projectz: {
    appId: "projectz",
    domains: ["identity", "business", "audience", "projects"],
    sections: ["business", "audience", "objectives"],
    purpose: "Run isolated hypothetical experiments without mutating production business intelligence."
  }
};

export function createEmptyBusinessProfile(
  userId: string,
  businessId: string = DEFAULT_BUSINESS_ID
): BusinessProfileRecord {
  const now = new Date().toISOString();
  return {
    id: `${userId}__${businessId}`,
    userId,
    businessId,
    schemaVersion: BUSINESS_PROFILE_SCHEMA_VERSION,
    isDefault: businessId === DEFAULT_BUSINESS_ID,
    provenance: "user_provided_fact",
    creatorProfile: {
      creatorName: "",
      professionalBackground: "",
      expertise: "",
      experience: "",
      personality: "",
      writingVoice: "",
      communicationPreferences: "",
      wordsToAvoid: "",
      defaultCta: ""
    },
    businessProfile: {
      businessName: "",
      website: "",
      industry: "",
      mission: "",
      vision: "",
      businessDescription: "",
      positioning: "",
      businessModel: "",
      revenueStreams: "",
      competitiveAdvantages: "",
      currentBusinessStage: "",
      shortTermObjectives: "",
      longTermObjectives: "",
      ecosystemSummary: ""
    },
    productsAndOffers: [],
    targetAudience: {
      idealCustomers: "",
      customerProblems: "",
      desiredOutcomes: "",
      buyingMotivations: "",
      commonObjections: "",
      preferredCommunicationChannels: ""
    },
    creatorContext: "",
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Validates that a URL is empty or uses http/https protocol only.
 */
export function isSafeHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

/**
 * Validates and sanitizes incoming BusinessProfile payloads.
 * Strictly blocks any client attempt to assert verified platform data or transaction status.
 */
export function validateAndSanitizeBusinessProfileInput(
  rawInput: unknown,
  userId: string,
  requestedBusinessId?: string
): BusinessProfileValidationResult {
  const errors: string[] = [];

  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return { valid: false, errors: ["Authenticated userId is required."] };
  }

  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return { valid: false, errors: ["Business profile payload must be an object."] };
  }

  const input = rawInput as Record<string, any>;

  // Block direct client assignment of verified intelligence / billing fields
  if (input.provenance !== undefined && input.provenance !== "user_provided_fact") {
    errors.push(
      'Direct client writes may only set provenance to "user_provided_fact". Verified platform intelligence is server-managed.'
    );
  }

  for (const forbiddenKey of FORBIDDEN_CLIENT_VERIFIED_FIELDS) {
    if (input[forbiddenKey] !== undefined) {
      errors.push(`Field "${forbiddenKey}" cannot be set directly by client writes.`);
    }
  }

  const rawBizId = cleanStr(requestedBusinessId || input.businessId || DEFAULT_BUSINESS_ID, 64);
  const safeBusinessId = /^[a-zA-Z0-9_-]{1,64}$/.test(rawBizId) ? rawBizId : "";
  if (!safeBusinessId) {
    errors.push("businessId must contain only letters, numbers, hyphens, or underscores (max 64 chars).");
  }

  const cp = (input.creatorProfile && typeof input.creatorProfile === "object" ? input.creatorProfile : {}) as Record<string, any>;
  const bp = (input.businessProfile && typeof input.businessProfile === "object" ? input.businessProfile : {}) as Record<string, any>;
  const ta = (input.targetAudience && typeof input.targetAudience === "object" ? input.targetAudience : {}) as Record<string, any>;

  const website = cleanStr(bp.website, 300);
  if (website && !isSafeHttpUrl(website)) {
    errors.push("Business website must be a valid http:// or https:// URL.");
  }

  const rawStage = typeof bp.currentBusinessStage === "string" ? bp.currentBusinessStage.trim() : "";
  if (rawStage && !(ALLOWED_BUSINESS_STAGES as readonly string[]).includes(rawStage)) {
    errors.push(`Invalid currentBusinessStage "${rawStage}".`);
  }

  const rawOffers = Array.isArray(input.productsAndOffers) ? input.productsAndOffers : [];
  if (rawOffers.length > 25) {
    errors.push("You may store up to 25 products or offers per business profile.");
  }

  const sanitizedOffers: BusinessOfferItem[] = [];
  for (let i = 0; i < Math.min(rawOffers.length, 25); i++) {
    const item = rawOffers[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`Offer at index ${i} must be an object.`);
      continue;
    }

    // Reject verified status spoofing inside offer items too
    if ((item as any).verificationStatus === "transaction_verified" || (item as any).provenance === "verified_platform_data") {
      errors.push(`Offer at index ${i} cannot directly assign verified platform or transaction status.`);
      continue;
    }

    const name = cleanStr((item as any).name, 160);
    if (!name) {
      errors.push(`Offer #${i + 1} requires a product or service name.`);
      continue;
    }

    const salesUrl = cleanStr((item as any).salesUrl, 300);
    if (salesUrl && !isSafeHttpUrl(salesUrl)) {
      errors.push(`Offer "${name}" has an invalid Sales URL. Use http:// or https://.`);
      continue;
    }

    const rawAvailability = cleanStr((item as any).availabilityStatus || "available", 40);
    if (!(ALLOWED_OFFER_AVAILABILITY_STATUSES as readonly string[]).includes(rawAvailability)) {
      errors.push(`Offer "${name}" has invalid availabilityStatus "${rawAvailability}".`);
      continue;
    }

    const rawFreq = cleanStr((item as any).billingFrequency || "one_time", 40);
    if (!(ALLOWED_OFFER_BILLING_FREQUENCIES as readonly string[]).includes(rawFreq)) {
      errors.push(`Offer "${name}" has invalid billingFrequency "${rawFreq}".`);
      continue;
    }

    const rawOfferId = cleanStr((item as any).id, 64);
    const id = rawOfferId && /^[a-zA-Z0-9_-]{1,64}$/.test(rawOfferId) ? rawOfferId : `offer_${i + 1}`;

    sanitizedOffers.push({
      id,
      name,
      description: cleanStr((item as any).description, 1200),
      targetCustomer: cleanStr((item as any).targetCustomer, 400),
      problemsSolved: cleanStr((item as any).problemsSolved, 800),
      benefits: cleanStr((item as any).benefits, 800),
      pricing: cleanStr((item as any).pricing, 120),
      billingFrequency: rawFreq as OfferBillingFrequency,
      salesUrl,
      availabilityStatus: rawAvailability as OfferAvailabilityStatus,
      affiliateEligible: Boolean((item as any).affiliateEligible),
      affiliateTerms: cleanStr((item as any).affiliateTerms, 300)
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const now = new Date().toISOString();
  const createdAt = cleanStr(input.createdAt, 64) || now;

  const record: BusinessProfileRecord = {
    id: `${userId}__${safeBusinessId}`,
    userId,
    businessId: safeBusinessId,
    schemaVersion: BUSINESS_PROFILE_SCHEMA_VERSION,
    isDefault: safeBusinessId === DEFAULT_BUSINESS_ID,
    provenance: "user_provided_fact",
    creatorProfile: {
      creatorName: cleanStr(cp.creatorName, 140),
      professionalBackground: cleanStr(cp.professionalBackground, 1200),
      expertise: cleanStr(cp.expertise, 800),
      experience: cleanStr(cp.experience, 1000),
      personality: cleanStr(cp.personality, 600),
      writingVoice: cleanStr(cp.writingVoice, 800),
      communicationPreferences: cleanStr(cp.communicationPreferences, 800),
      wordsToAvoid: cleanStr(cp.wordsToAvoid, 400),
      defaultCta: cleanStr(cp.defaultCta, 400)
    },
    businessProfile: {
      businessName: cleanStr(bp.businessName, 160),
      website,
      industry: cleanStr(bp.industry, 160),
      mission: cleanStr(bp.mission, 600),
      vision: cleanStr(bp.vision, 600),
      businessDescription: cleanStr(bp.businessDescription, 1500),
      positioning: cleanStr(bp.positioning, 800),
      businessModel: cleanStr(bp.businessModel, 800),
      revenueStreams: cleanStr(bp.revenueStreams, 800),
      competitiveAdvantages: cleanStr(bp.competitiveAdvantages, 800),
      currentBusinessStage: rawStage as BusinessStage,
      shortTermObjectives: cleanStr(bp.shortTermObjectives, 800),
      longTermObjectives: cleanStr(bp.longTermObjectives, 800),
      ecosystemSummary: cleanStr(bp.ecosystemSummary, 400)
    },
    productsAndOffers: sanitizedOffers,
    targetAudience: {
      idealCustomers: cleanStr(ta.idealCustomers, 800),
      customerProblems: cleanStr(ta.customerProblems, 1000),
      desiredOutcomes: cleanStr(ta.desiredOutcomes, 1000),
      buyingMotivations: cleanStr(ta.buyingMotivations, 800),
      commonObjections: cleanStr(ta.commonObjections, 800),
      preferredCommunicationChannels: cleanStr(ta.preferredCommunicationChannels, 400)
    },
    creatorContext: cleanStr(input.creatorContext, 6000),
    createdAt,
    updatedAt: now
  };

  return { valid: true, errors: [], record };
}

/**
 * Hydrates a BusinessProfileRecord from legacy ThreadsWorks `users/{uid}` fields
 * so existing customers retain 100% of their Creator Context, offers, audience,
 * writing style, and creator identity without manual re-entry.
 */
export function hydrateBusinessProfileFromLegacyUserProfile(
  userId: string,
  legacy: Partial<UserProfile> & Record<string, any> | null | undefined,
  businessId: string = DEFAULT_BUSINESS_ID
): BusinessProfileRecord {
  const base = createEmptyBusinessProfile(userId, businessId);
  if (!legacy) return base;

  const ci = (legacy.creatorIdentity || {}) as Record<string, any>;
  const oi = (legacy.offerIntelligence || {}) as Record<string, any>;
  const bi = (legacy.buyerIntelligence || {}) as Record<string, any>;
  const firstBuyer = Array.isArray(bi.buyers) ? bi.buyers[0] || {} : {};
  const firstDestination = Array.isArray(legacy.contentDestinations) ? legacy.contentDestinations[0] : null;

  base.creatorContext = cleanStr(legacy.customInstruction || legacy.rawVoice || "", 6000);

  base.creatorProfile = {
    creatorName: cleanStr(legacy.displayName || ci.creatorName || "", 140),
    professionalBackground: cleanStr(ci.whatYoureKnownFor || ci.yourPerspective || "", 1200),
    expertise: cleanStr(ci.yourExpertise || ci.whatYouTalkAbout || "", 800),
    experience: cleanStr(ci.yourExperiences || "", 1000),
    personality: cleanStr(ci.personality || ci.yourHumor || "", 600),
    writingVoice: cleanStr(legacy.writingStyle || ci.writingStyle || ci.tone || "", 800),
    communicationPreferences: cleanStr(
      [ci.wordsYouUse ? `Use: ${ci.wordsYouUse}` : "", ci.howYouThink || ""].filter(Boolean).join(" | "),
      800
    ),
    wordsToAvoid: cleanStr(ci.wordsYouAvoid || "", 400),
    defaultCta: cleanStr(legacy.ctaPreferences || "", 400)
  };

  const legacyWebsite = cleanStr(firstDestination?.url || oi.offers?.[0]?.purchasePath || "", 300);

  base.businessProfile = {
    businessName: cleanStr(oi.primaryOfferName || "", 160),
    website: isSafeHttpUrl(legacyWebsite) ? legacyWebsite : "",
    industry: cleanStr(legacy.niche || "", 160),
    mission: cleanStr(ci.whatYouBelieve || "", 600),
    vision: cleanStr(ci.whatYouWantPeopleToRemember || "", 600),
    businessDescription: cleanStr(legacy.rawBusinessText || "", 1500),
    positioning: cleanStr(legacy.positioning || oi.uniqueMechanism || "", 800),
    businessModel: cleanStr(legacy.businessModel || "", 800),
    revenueStreams: "",
    competitiveAdvantages: cleanStr(oi.uniqueMechanism || "", 800),
    currentBusinessStage: "",
    shortTermObjectives: cleanStr(legacy.commercialObjective || "", 800),
    longTermObjectives: "",
    ecosystemSummary: ""
  };

  // Migrate legacy offers cleanly into productsAndOffers
  const offers: BusinessOfferItem[] = [];
  if (Array.isArray(oi.offers) && oi.offers.length > 0) {
    oi.offers.forEach((o: any, idx: number) => {
      const name = cleanStr(o?.name || (idx === 0 ? legacy.offer : ""), 160);
      if (!name) return;
      const salesUrl = cleanStr(o?.purchasePath || "", 300);
      offers.push({
        id: cleanStr(o?.id, 64) || `legacy_offer_${idx + 1}`,
        name,
        description: cleanStr(o?.description || "", 1200),
        targetCustomer: cleanStr(o?.audience || legacy.audience || "", 400),
        problemsSolved: cleanStr(o?.problemSolved || "", 800),
        benefits: cleanStr(o?.benefits || legacy.desiredResult || "", 800),
        pricing: cleanStr(o?.price || "", 120),
        billingFrequency: "one_time",
        salesUrl: isSafeHttpUrl(salesUrl) ? salesUrl : "",
        availabilityStatus: "available",
        affiliateEligible: false,
        affiliateTerms: ""
      });
    });
  } else if (typeof legacy.offer === "string" && legacy.offer.trim()) {
    offers.push({
      id: "legacy_primary_offer",
      name: cleanStr(legacy.offer, 160),
      description: cleanStr(legacy.rawBusinessText || "", 1200),
      targetCustomer: cleanStr(legacy.audience || "", 400),
      problemsSolved: "",
      benefits: cleanStr(legacy.desiredResult || "", 800),
      pricing: "",
      billingFrequency: "one_time",
      salesUrl: isSafeHttpUrl(legacyWebsite) ? legacyWebsite : "",
      availabilityStatus: "available",
      affiliateEligible: false,
      affiliateTerms: ""
    });
  }
  base.productsAndOffers = offers;

  base.targetAudience = {
    idealCustomers: cleanStr(legacy.audience || ci.whoYouHelp || firstBuyer.name || "", 800),
    customerProblems: cleanStr(firstBuyer?.problems?.rootProblem || "", 1000),
    desiredOutcomes: cleanStr(legacy.desiredResult || ci.whatYouHelpThemDo || "", 1000),
    buyingMotivations: cleanStr(firstBuyer?.desires?.primaryDesire || "", 800),
    commonObjections: cleanStr(
      Array.isArray(firstBuyer?.objections) ? firstBuyer.objections.join("; ") : firstBuyer?.objections || "",
      800
    ),
    preferredCommunicationChannels: ""
  };

  if (typeof legacy.createdAt === "string" && legacy.createdAt) {
    base.createdAt = legacy.createdAt;
  }
  if (typeof legacy.updatedAt === "string" && legacy.updatedAt) {
    base.updatedAt = legacy.updatedAt;
  }

  return base;
}

/**
 * Projects a saved BusinessProfileRecord onto backward-compatible legacy `users/{uid}` fields
 * so existing ThreadsWorks components and endpoints continue working seamlessly without
 * overwriting unrelated account/subscription fields.
 */
export function projectBusinessProfileToLegacyUserPatch(
  record: BusinessProfileRecord
): Record<string, any> {
  const availableOffers = record.productsAndOffers.filter((o) => o.availabilityStatus === "available");
  const primaryOffer = availableOffers[0] || record.productsAndOffers[0] || null;

  const summaryParts = [
    record.businessProfile.businessName,
    record.businessProfile.positioning || record.businessProfile.businessDescription,
    primaryOffer ? `${primaryOffer.name}${primaryOffer.pricing ? ` (${primaryOffer.pricing})` : ""}` : "",
    record.businessProfile.website
  ].filter(Boolean);

  return {
    offer: primaryOffer?.name || record.businessProfile.businessName || "",
    audience: record.targetAudience.idealCustomers || "",
    desiredResult: record.targetAudience.desiredOutcomes || primaryOffer?.benefits || "",
    writingStyle: record.creatorProfile.writingVoice || "Direct, practical, conversational",
    customInstruction: record.creatorContext || "",
    rawVoice: record.creatorContext || "",
    rawBusinessText: summaryParts.join(" | ").slice(0, 2000),
    ctaPreferences: record.creatorProfile.defaultCta || "",
    positioning: record.businessProfile.positioning || "",
    businessModel: record.businessProfile.businessModel || "",
    commercialObjective: record.businessProfile.shortTermObjectives || record.businessProfile.mission || "",
    creatorIdentity: {
      creatorName: record.creatorProfile.creatorName,
      personality: record.creatorProfile.personality,
      yourExpertise: record.creatorProfile.expertise,
      yourExperiences: record.creatorProfile.experience,
      whatYoureKnownFor: record.creatorProfile.professionalBackground,
      writingStyle: record.creatorProfile.writingVoice,
      wordsYouAvoid: record.creatorProfile.wordsToAvoid,
      whoYouHelp: record.targetAudience.idealCustomers,
      whatYouHelpThemDo: record.targetAudience.desiredOutcomes,
      whatYouBelieve: record.businessProfile.mission,
      whatYouWantPeopleToRemember: record.businessProfile.vision
    },
    offerIntelligence: {
      primaryOfferName: record.businessProfile.businessName || primaryOffer?.name || "",
      uniqueMechanism: record.businessProfile.competitiveAdvantages || record.businessProfile.positioning || "",
      offers: record.productsAndOffers.map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description,
        price: o.pricing,
        purchasePath: o.salesUrl,
        availabilityStatus: o.availabilityStatus,
        billingFrequency: o.billingFrequency,
        affiliateEligible: o.affiliateEligible
      }))
    },
    buyerIntelligence: {
      buyers: [
        {
          id: "primary",
          name: record.targetAudience.idealCustomers,
          problems: {
            rootProblem: record.targetAudience.customerProblems
          },
          desires: {
            primaryDesire: record.targetAudience.buyingMotivations || record.targetAudience.desiredOutcomes
          },
          objections: record.targetAudience.commonObjections
        }
      ]
    },
    updatedAt: record.updatedAt
  };
}

/**
 * Explicit opt-in Founder Business Profile template for ContentPaysUs.
 *
 * IMPORTANT:
 * - NEVER auto-populated onto ordinary customer accounts.
 * - NEVER grants billing entitlements, changes Stripe pricing, or activates planned features.
 * - Strictly distinguishes `available` vs `planned` offerings.
 */
export function buildContentPaysUsFounderProfileDraft(
  userId: string,
  existing?: Partial<BusinessProfileRecord> | null
): BusinessProfileRecord {
  const base = createEmptyBusinessProfile(userId, DEFAULT_BUSINESS_ID);
  const now = new Date().toISOString();

  return {
    ...base,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    creatorProfile: {
      ...base.creatorProfile,
      ...(existing?.creatorProfile || {})
    },
    businessProfile: {
      businessName: "ContentPaysUs",
      website: "https://threadsworks.com",
      industry: "Creator Economy Software & Education",
      mission: "Help 1,000 creators achieve their first verified sale.",
      vision: "A unified AI-powered creator business ecosystem where one identity and shared intelligence layer power sustainable creator businesses.",
      businessDescription:
        "ContentPaysUs is an AI-powered creator business ecosystem hosted at ThreadsWorks.com, uniting 20 interconnected applications and practical creator education.",
      positioning:
        "One connected creator business ecosystem combining ThreadsWorks and 19 specialized business applications backed by Shared Intelligence.",
      businessModel:
        "AI-powered creator business infrastructure, education, subscriptions, affiliate distribution and commerce.",
      revenueStreams:
        "ThreadsWorks Pro subscriptions (available); ContentPaysClub, ContentPaysBundle, Affiliate Program, and Creator Commerce platform fee (planned).",
      competitiveAdvantages:
        "Unified creator identity, Shared Intelligence across 20 interconnected applications, and grounded first-sale workflows.",
      currentBusinessStage: "early_traction",
      shortTermObjectives:
        "Grow ThreadsWorks Pro adoption and help early creators achieve their first verified sale.",
      longTermObjectives:
        "Help 1,000 creators achieve their first verified sale and scale sustainable businesses across all 20 ContentPaysUs applications.",
      ecosystemSummary: "20 interconnected applications."
    },
    productsAndOffers: [
      {
        id: "threadsworks_pro",
        name: "ThreadsWorks Pro",
        description:
          "Live flagship Threads content creation, scheduling, analytics, and creator intelligence subscription inside ContentPaysUs.",
        targetCustomer: "Creators, digital entrepreneurs, and solo founders growing an audience on Threads",
        problemsSolved:
          "Inconsistent posting, generic AI content that misses creator voice, and disconnected content-to-business workflows.",
        benefits:
          "Voice-accurate Threads content generation, scheduling, analytics, and connected workspace tools.",
        pricing: "$7/month",
        billingFrequency: "monthly",
        salesUrl: "https://threadsworks.com",
        availabilityStatus: "available",
        affiliateEligible: true,
        affiliateTerms: "Eligible under planned ContentPaysUs Affiliate Program once activated."
      },
      {
        id: "contentpaysclub",
        name: "ContentPaysClub",
        description:
          "Planned weekly premium business courses and practical creator business education.",
        targetCustomer: "Creators building repeatable digital offers and audience monetization",
        problemsSolved: "Lack of structured, practical business execution guidance for solo creators.",
        benefits: "Planned weekly premium business courses and actionable creator frameworks.",
        pricing: "$29/month",
        billingFrequency: "monthly",
        salesUrl: "",
        availabilityStatus: "planned",
        affiliateEligible: true,
        affiliateTerms: "Planned 50% recurring commission on qualifying directly referred subscriptions."
      },
      {
        id: "contentpaysbundle",
        name: "ContentPaysBundle",
        description:
          "Planned all-in-one access to all 20 ContentPaysUs applications and premium ContentPaysClub education.",
        targetCustomer: "Full-stack creators running their brand, offers, products, sales, and growth in one system",
        problemsSolved: "Tool fragmentation, disconnected context, and stacked SaaS costs across creator workflows.",
        benefits: "Planned unified access to all 20 interconnected applications plus premium Club education.",
        pricing: "$100/month",
        billingFrequency: "monthly",
        salesUrl: "",
        availabilityStatus: "planned",
        affiliateEligible: true,
        affiliateTerms: "Planned 50% recurring commission on qualifying directly referred subscriptions."
      },
      {
        id: "contentpaysus_affiliate_program",
        name: "ContentPaysUs Affiliate Program",
        description:
          "Planned recurring affiliate distribution program rewarding creators for directly referred qualifying subscriptions.",
        targetCustomer: "Creators, partners, and educators recommending ContentPaysUs tools",
        problemsSolved: "Low one-time payouts and opaque referral attribution in creator software programs.",
        benefits: "Planned 50% recurring commissions on qualifying directly referred subscriptions.",
        pricing: "50% recurring commission (planned)",
        billingFrequency: "commission",
        salesUrl: "",
        availabilityStatus: "planned",
        affiliateEligible: true,
        affiliateTerms: "Planned 50% recurring commissions on qualifying directly referred subscriptions."
      },
      {
        id: "creator_commerce",
        name: "Creator Commerce",
        description:
          "Planned native creator storefront checkout and digital commerce processing inside ContentPaysUs.",
        targetCustomer: "Creators selling digital products, courses, and offers directly to their audience",
        problemsSolved: "Complex multi-tool checkout wiring and disconnected sales tracking.",
        benefits: "Planned streamlined creator commerce with a 5% platform fee on qualifying processed creator sales.",
        pricing: "5% platform fee on qualifying processed creator sales (planned)",
        billingFrequency: "platform_fee",
        salesUrl: "",
        availabilityStatus: "planned",
        affiliateEligible: false,
        affiliateTerms: ""
      },
      {
        id: "customer_acquisition_funnel",
        name: "Customer Acquisition Funnel",
        description:
          "Planned guided entry funnel introducing creators to ContentPaysUs and ThreadsWorks.",
        targetCustomer: "New creators discovering ContentPaysUs from Threads and partner referrals",
        problemsSolved: "Unclear starting point for turning social content into a first verified sale.",
        benefits: "Planned structured onboarding funnel at https://threadsworks.com/start.",
        pricing: "Free entry funnel (planned)",
        billingFrequency: "free",
        salesUrl: "https://threadsworks.com/start",
        availabilityStatus: "planned",
        affiliateEligible: false,
        affiliateTerms: ""
      }
    ],
    targetAudience: {
      idealCustomers:
        "Creators, digital entrepreneurs, coaches, and solo founders turning expertise and social content into verified sales.",
      customerProblems:
        "Posting consistently without clear monetization, repeating business context across disconnected tools, and struggling to achieve a first verified online sale.",
      desiredOutcomes:
        "Achieve a first verified sale and build a repeatable, sustainable creator business from one connected workspace.",
      buyingMotivations:
        "Speed to first verified sale, authentic voice preservation, practical execution tools, and unified business intelligence.",
      commonObjections:
        "Skepticism of generic AI tools, tool fatigue from managing separate apps, and uncertainty about whether a small audience can generate sales.",
      preferredCommunicationChannels: "Threads, email, creator communities, and interactive web workspace"
    },
    creatorContext: existing?.creatorContext || ""
  };
}
