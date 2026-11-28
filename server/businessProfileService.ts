import {
  BILLING_AUTHORITY_NOTICE,
  DEFAULT_BUSINESS_ID,
  buildContentPaysUsFounderProfileDraft,
  createEmptyBusinessProfile,
  hydrateBusinessProfileFromLegacyUserProfile,
  projectBusinessProfileToLegacyUserPatch,
  validateAndSanitizeBusinessProfileInput,
  type BusinessProfileRecord
} from "../src/types/businessProfile";

export class BusinessProfileValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(errors[0] || "Invalid business profile data.");
    this.name = "BusinessProfileValidationError";
    this.errors = errors;
  }
}

export class BusinessProfileAccessError extends Error {
  constructor(message = "Access denied: business profile does not belong to the authenticated user.") {
    super(message);
    this.name = "BusinessProfileAccessError";
  }
}

export function getBusinessProfileDocId(userId: string, businessId: string = DEFAULT_BUSINESS_ID): string {
  const safeBiz = /^[a-zA-Z0-9_-]{1,64}$/.test(businessId) ? businessId : DEFAULT_BUSINESS_ID;
  return `${userId}__${safeBiz}`;
}

function hasMeaningfulBusinessProfileData(record: BusinessProfileRecord): boolean {
  const cp = record.creatorProfile;
  const bp = record.businessProfile;
  const ta = record.targetAudience;
  return Boolean(
    record.creatorContext ||
      cp.creatorName ||
      cp.professionalBackground ||
      cp.expertise ||
      cp.writingVoice ||
      bp.businessName ||
      bp.website ||
      bp.mission ||
      bp.businessDescription ||
      bp.positioning ||
      bp.businessModel ||
      ta.idealCustomers ||
      ta.customerProblems ||
      ta.desiredOutcomes ||
      record.productsAndOffers.length > 0
  );
}

/**
 * Loads the authenticated member's business-scoped profile from `business_profiles/{uid}__{businessId}`.
 * Falls back cleanly to hydrating from legacy `users/{uid}` fields so existing customer data
 * is always preserved without writing synthetic defaults or founder information.
 */
export async function loadBusinessProfile(
  db: any,
  userId: string,
  businessId: string = DEFAULT_BUSINESS_ID
): Promise<{
  profile: BusinessProfileRecord;
  source: "business_profile" | "legacy_user_profile" | "empty";
  hasSavedBusinessProfile: boolean;
}> {
  if (!userId || userId === "anonymous") {
    return {
      profile: createEmptyBusinessProfile(userId || "anonymous", businessId),
      source: "empty",
      hasSavedBusinessProfile: false
    };
  }

  const docId = getBusinessProfileDocId(userId, businessId);
  const [bizSnap, userSnap] = await Promise.all([
    db.collection("business_profiles").doc(docId).get().catch(() => ({ exists: false })),
    db.collection("users").doc(userId).get().catch(() => ({ exists: false }))
  ]);

  const legacyData = userSnap?.exists ? (userSnap.data() || {}) : null;

  if (bizSnap?.exists) {
    const raw = bizSnap.data() || {};
    if (raw.userId && raw.userId !== userId) {
      throw new BusinessProfileAccessError();
    }
    const base = createEmptyBusinessProfile(userId, businessId);
    const hydratedLegacy = legacyData
      ? hydrateBusinessProfileFromLegacyUserProfile(userId, legacyData, businessId)
      : base;

    const merged: BusinessProfileRecord = {
      ...base,
      id: docId,
      userId,
      businessId: raw.businessId || businessId,
      schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : base.schemaVersion,
      isDefault: raw.isDefault !== undefined ? Boolean(raw.isDefault) : businessId === DEFAULT_BUSINESS_ID,
      provenance: "user_provided_fact",
      creatorProfile: {
        ...hydratedLegacy.creatorProfile,
        ...(raw.creatorProfile || {})
      },
      businessProfile: {
        ...hydratedLegacy.businessProfile,
        ...(raw.businessProfile || {})
      },
      productsAndOffers: Array.isArray(raw.productsAndOffers)
        ? raw.productsAndOffers
        : hydratedLegacy.productsAndOffers,
      targetAudience: {
        ...hydratedLegacy.targetAudience,
        ...(raw.targetAudience || {})
      },
      creatorContext:
        typeof raw.creatorContext === "string"
          ? raw.creatorContext
          : hydratedLegacy.creatorContext,
      createdAt: typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : base.createdAt,
      updatedAt: typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : base.updatedAt
    };

    return {
      profile: merged,
      source: "business_profile",
      hasSavedBusinessProfile: true
    };
  }

  if (legacyData) {
    const hydrated = hydrateBusinessProfileFromLegacyUserProfile(userId, legacyData, businessId);
    return {
      profile: hydrated,
      source: hasMeaningfulBusinessProfileData(hydrated) ? "legacy_user_profile" : "empty",
      hasSavedBusinessProfile: false
    };
  }

  return {
    profile: createEmptyBusinessProfile(userId, businessId),
    source: "empty",
    hasSavedBusinessProfile: false
  };
}

/**
 * Validates, persists, and backward-compatibly syncs the member's business profile.
 * Strictly enforces owner isolation and rejects any client attempt to assert verified intelligence.
 */
export async function saveBusinessProfile(
  db: any,
  userId: string,
  rawInput: unknown,
  businessId: string = DEFAULT_BUSINESS_ID
): Promise<{
  profile: BusinessProfileRecord;
  legacySynced: boolean;
  billingAuthorityNotice: string;
}> {
  if (!userId || userId === "anonymous") {
    throw new BusinessProfileAccessError("Authentication required to save business profile.");
  }

  // Prevent explicit cross-account userId spoofing in payload
  if (
    rawInput &&
    typeof rawInput === "object" &&
    "userId" in (rawInput as Record<string, unknown>) &&
    typeof (rawInput as Record<string, unknown>).userId === "string" &&
    (rawInput as Record<string, unknown>).userId !== "" &&
    (rawInput as Record<string, unknown>).userId !== userId
  ) {
    throw new BusinessProfileAccessError();
  }

  const validation = validateAndSanitizeBusinessProfileInput(rawInput, userId, businessId);
  if (!validation.valid || !validation.record) {
    throw new BusinessProfileValidationError(validation.errors);
  }

  const record = validation.record;
  const docId = getBusinessProfileDocId(userId, record.businessId);
  const ref = db.collection("business_profiles").doc(docId);

  const existingSnap = await ref.get().catch(() => ({ exists: false }));
  if (existingSnap?.exists) {
    const existingData = existingSnap.data() || {};
    if (existingData.userId && existingData.userId !== userId) {
      throw new BusinessProfileAccessError();
    }
    if (typeof existingData.createdAt === "string" && existingData.createdAt) {
      record.createdAt = existingData.createdAt;
    }
  }

  await ref.set(record, { merge: false });

  // Backward-compatible projection onto users/{uid} (merge: true preserves subscription, email, uid, etc.)
  let legacySynced = false;
  try {
    const legacyPatch = projectBusinessProfileToLegacyUserPatch(record);
    await db.collection("users").doc(userId).set(legacyPatch, { merge: true });
    legacySynced = true;
  } catch (err) {
    console.warn("[BUSINESS_PROFILE] Legacy user projection sync skipped:", err);
  }

  return {
    profile: record,
    legacySynced,
    billingAuthorityNotice: BILLING_AUTHORITY_NOTICE
  };
}

/**
 * Syncs approved CreatorWorks brand identity / positioning / audience / voice outputs
 * into the member's business profile while keeping clear role separation:
 * CreatorWorks develops -> Hub stores/manages -> Shared Intelligence retrieves.
 */
export async function syncCreatorWorksToBusinessProfile(
  db: any,
  userId: string,
  sections: Record<string, unknown>,
  businessId: string = DEFAULT_BUSINESS_ID
): Promise<BusinessProfileRecord> {
  const { profile } = await loadBusinessProfile(db, userId, businessId);
  const next: BusinessProfileRecord = {
    ...profile,
    creatorProfile: { ...profile.creatorProfile },
    businessProfile: { ...profile.businessProfile },
    targetAudience: { ...profile.targetAudience },
    productsAndOffers: [...profile.productsAndOffers],
    updatedAt: new Date().toISOString()
  };

  if (typeof sections.positioningStatement === "string" && sections.positioningStatement.trim()) {
    next.businessProfile.positioning = sections.positioningStatement.trim().slice(0, 800);
  }
  if (typeof sections.brandStory === "string" && sections.brandStory.trim() && !next.creatorProfile.professionalBackground) {
    next.creatorProfile.professionalBackground = sections.brandStory.trim().slice(0, 1200);
  }
  if (typeof sections.audienceSummary === "string" && sections.audienceSummary.trim()) {
    next.targetAudience.idealCustomers = sections.audienceSummary.trim().slice(0, 800);
  }
  if (typeof sections.voiceSummary === "string" && sections.voiceSummary.trim()) {
    next.creatorProfile.writingVoice = sections.voiceSummary.trim().slice(0, 800);
  }
  if (typeof sections.mission === "string" && sections.mission.trim()) {
    next.businessProfile.mission = sections.mission.trim().slice(0, 600);
  }

  const saved = await saveBusinessProfile(db, userId, next, businessId);
  return saved.profile;
}

/**
 * Non-email Founder Business Profile preset capability check.
 * NEVER uses hardcoded email addresses and NEVER introduces auth bypasses.
 * Checks ONLY:
 * 1. Verified Firebase custom claims (`founder === true` or `admin === true`)
 * 2. Server-configured UID allowlist (`CONTENTPAYSUS_FOUNDER_UIDS`, comma-separated UIDs)
 * 3. Server-side Firestore `roles/{uid}` document with `{ role: "founder" }`
 */
export async function checkFounderPresetCapability(
  db: any,
  caller: { uid: string; claims?: Record<string, unknown> }
): Promise<boolean> {
  if (!caller?.uid) return false;

  if (caller.claims?.founder === true || caller.claims?.admin === true) {
    return true;
  }

  const envUids = String(process.env.CONTENTPAYSUS_FOUNDER_UIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (envUids.includes(caller.uid)) {
    return true;
  }

  try {
    const roleSnap = await db.collection("roles").doc(caller.uid).get();
    if (roleSnap?.exists) {
      const role = String(roleSnap.data()?.role || "").toLowerCase();
      if (role === "founder" || role === "admin") {
        return true;
      }
    }
  } catch {
    // Fail closed if roles collection cannot be read
  }

  return false;
}

/**
 * Builds the non-authoritative ContentPaysUs Founder Business Profile draft
 * ONLY after capability verification. Never auto-saves and never modifies billing.
 */
export async function getFounderBusinessProfilePreset(
  db: any,
  caller: { uid: string; claims?: Record<string, unknown> }
): Promise<{
  preset: BusinessProfileRecord;
  disclaimer: string;
}> {
  const allowed = await checkFounderPresetCapability(db, caller);
  if (!allowed) {
    throw new BusinessProfileAccessError(
      "Founder business profile preset requires verified founder role configuration."
    );
  }

  const { profile: existing } = await loadBusinessProfile(db, caller.uid, DEFAULT_BUSINESS_ID);
  const preset = buildContentPaysUsFounderProfileDraft(caller.uid, existing);

  return {
    preset,
    disclaimer: BILLING_AUTHORITY_NOTICE
  };
}
