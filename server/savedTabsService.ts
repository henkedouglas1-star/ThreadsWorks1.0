import { SavedCreatorTab, UserProfile } from "../src/types";
import { updateGenerationIntelligenceSnapshot } from "./generationIntelligenceService";

export class SavedTabError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode: number = 400, code: string = "SAVED_TAB_ERROR") {
    super(message);
    this.name = "SavedTabError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Creates a clean, empty or initialized default tab structure for a user.
 */
export function buildDefaultSavedTab(userId: string, existingProfile?: Partial<UserProfile> | null): SavedCreatorTab {
  return {
    id: "default",
    userId,
    name: "Main Brand",
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    myVoice: {
      writingStyle: existingProfile?.writingStyle || "",
      tone: existingProfile?.creatorIdentity?.tone || "",
      rawVoice: existingProfile?.rawVoice || "",
      creatorIdentity: existingProfile?.creatorIdentity || undefined,
    },
    myBusiness: {
      offer: existingProfile?.offer || "",
      audience: existingProfile?.audience || "",
      desiredResult: existingProfile?.desiredResult || "",
      rawBusinessText: existingProfile?.rawBusinessText || "",
      offerIntelligence: existingProfile?.offerIntelligence || undefined,
      buyerIntelligence: existingProfile?.buyerIntelligence || undefined,
    },
    contentInstructions: existingProfile?.customInstruction || "",
    ctaConfig: {
      ctaPreferences: existingProfile?.ctaPreferences || "",
      contentDestinations: existingProfile?.contentDestinations || [],
      activeCta: null,
    },
    generationPreferences: {
      threadLength: "auto",
      sentencesPerPart: "auto",
      postsToCreate: "1",
      activeCategory: "attention",
    },
    contentPillars: existingProfile?.contentPillars || [],
    activeIdea: null,
    rawCreatorThought: "",
  };
}

/**
 * Retrieves all saved tabs belonging exclusively to the authenticated user.
 */
export async function getUserSavedTabs(serverDb: any, userId: string): Promise<SavedCreatorTab[]> {
  if (!userId || userId === "anonymous") {
    throw new SavedTabError("Authenticated user is required to access saved tabs.", 401, "UNAUTHORIZED");
  }

  if (!serverDb) {
    // In offline or non-firestore test mode, return initial default tab
    return [buildDefaultSavedTab(userId)];
  }

  try {
    const tabsRef = serverDb.collection("users").doc(userId).collection("saved_tabs");
    const snapshot = await tabsRef.get();

    if (snapshot.empty) {
      // Seed initial default tab for this user from their existing profile doc
      let userProfile: any = null;
      try {
        const userDoc = await serverDb.collection("users").doc(userId).get();
        if (userDoc.exists) {
          userProfile = userDoc.data();
        }
      } catch (_) {}

      const defaultTab = buildDefaultSavedTab(userId, userProfile);
      try {
        await tabsRef.doc("default").set(defaultTab);
      } catch (_) {}
      return [defaultTab];
    }

    const tabs: SavedCreatorTab[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data() as SavedCreatorTab;
      // Strict ownership check: Document data must match authenticated userId
      if (data.userId === userId) {
        tabs.push({ ...data, id: doc.id });
      }
    });

    if (tabs.length === 0) {
      const defaultTab = buildDefaultSavedTab(userId);
      try {
        await tabsRef.doc("default").set(defaultTab);
      } catch (_) {}
      return [defaultTab];
    }

    return tabs;
  } catch (err: any) {
    console.warn(`[SAVED_TABS] Database query note for user ${userId}: ${err?.message || err}. Serving isolated default tab.`);
    return [buildDefaultSavedTab(userId)];
  }
}

// In-memory session cache for saved creator tabs to eliminate redundant Firestore reads during sessions
const savedTabsCache = new Map<string, { tab: SavedCreatorTab; expiresAt: number }>();
const SAVED_TAB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateSavedTabCache(userId: string, tabId?: string): void {
  if (!userId) return;
  if (tabId) {
    savedTabsCache.delete(`${userId}_${tabId}`);
  } else {
    for (const key of savedTabsCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        savedTabsCache.delete(key);
      }
    }
  }
}

/**
 * Retrieves a single saved tab strictly scoped by authenticated userId and tabId.
 * If the tab does not exist or does not belong to the user, strictly errors without falling back.
 */
export async function getSingleSavedTab(
  serverDb: any,
  userId: string,
  tabId: string
): Promise<SavedCreatorTab> {
  if (!userId || userId === "anonymous") {
    throw new SavedTabError("Authenticated user is required to access saved tab.", 401, "UNAUTHORIZED");
  }
  if (!tabId || typeof tabId !== "string" || tabId.trim() === "") {
    throw new SavedTabError("A valid savedTabId is required.", 400, "INVALID_TAB_ID");
  }

  const cleanTabId = tabId.trim();
  const cacheKey = `${userId}_${cleanTabId}`;
  const now = Date.now();
  const cached = savedTabsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.tab;
  }

  if (!serverDb) {
    if (cleanTabId === "default") {
      const defaultTab = buildDefaultSavedTab(userId);
      savedTabsCache.set(cacheKey, { tab: defaultTab, expiresAt: now + SAVED_TAB_CACHE_TTL_MS });
      return defaultTab;
    }
    throw new SavedTabError(
      `Saved tab "${cleanTabId}" was not found or does not belong to the authenticated user.`,
      404,
      "SAVED_TAB_NOT_FOUND"
    );
  }

  try {
    const tabDocRef = serverDb.collection("users").doc(userId).collection("saved_tabs").doc(cleanTabId);
    const docSnap = await tabDocRef.get();

    if (!docSnap.exists) {
      // If default tab was requested and doesn't exist yet, seed it safely
      if (cleanTabId === "default") {
        let userProfile: any = null;
        try {
          const userDoc = await serverDb.collection("users").doc(userId).get();
          if (userDoc.exists) userProfile = userDoc.data();
        } catch (_) {}
        const defaultTab = buildDefaultSavedTab(userId, userProfile);
        try {
          await tabDocRef.set(defaultTab);
        } catch (_) {}
        savedTabsCache.set(cacheKey, { tab: defaultTab, expiresAt: now + SAVED_TAB_CACHE_TTL_MS });
        return defaultTab;
      }

      // STRICT ISOLATION REQUIREMENT:
      // If a requested saved tab does not belong to the authenticated user or doesn't exist:
      // DO NOT FALL BACK.
      // DO NOT LOAD ANOTHER TAB.
      // DO NOT LOAD DEFAULT CREATOR DATA.
      // DO NOT GENERATE USING ANOTHER CONFIGURATION.
      throw new SavedTabError(
        `Saved tab "${cleanTabId}" was not found for authenticated user "${userId}". Fallbacks are strictly prohibited to prevent configuration contamination.`,
        404,
        "SAVED_TAB_NOT_FOUND"
      );
    }

    const data = docSnap.data() as SavedCreatorTab;
    if (data.userId !== userId) {
      throw new SavedTabError(
        `Cross-user access denied. Saved tab "${cleanTabId}" does not belong to user "${userId}".`,
        403,
        "FORBIDDEN_TAB_MISMATCH"
      );
    }

    const result = { ...data, id: docSnap.id };
    savedTabsCache.set(cacheKey, { tab: result, expiresAt: now + SAVED_TAB_CACHE_TTL_MS });
    return result;
  } catch (err: any) {
    if (err instanceof SavedTabError) throw err;
    console.warn(`[SAVED_TABS] Database query note for tab ${cleanTabId} user ${userId}: ${err?.message || err}`);
    if (cleanTabId === "default") {
      const defaultTab = buildDefaultSavedTab(userId);
      savedTabsCache.set(cacheKey, { tab: defaultTab, expiresAt: now + SAVED_TAB_CACHE_TTL_MS });
      return defaultTab;
    }
    throw new SavedTabError(`Saved tab "${cleanTabId}" was not found for authenticated user "${userId}".`, 404, "SAVED_TAB_NOT_FOUND");
  }
}

/**
 * Creates a brand new, isolated saved tab for the authenticated user.
 */
export async function createSavedTab(
  serverDb: any,
  userId: string,
  name: string,
  initialData?: Partial<SavedCreatorTab>
): Promise<SavedCreatorTab> {
  if (!userId || userId === "anonymous") {
    throw new SavedTabError("Authenticated user is required to create a saved tab.", 401, "UNAUTHORIZED");
  }

  const cleanName = (name || "").trim() || "New Saved Tab";
  const tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newTab: SavedCreatorTab = {
    id: tabId,
    userId,
    name: cleanName,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    myVoice: {
      writingStyle: initialData?.myVoice?.writingStyle || "",
      tone: initialData?.myVoice?.tone || "",
      rawVoice: initialData?.myVoice?.rawVoice || "",
      creatorIdentity: initialData?.myVoice?.creatorIdentity || undefined,
    },
    myBusiness: {
      offer: initialData?.myBusiness?.offer || "",
      audience: initialData?.myBusiness?.audience || "",
      desiredResult: initialData?.myBusiness?.desiredResult || "",
      rawBusinessText: initialData?.myBusiness?.rawBusinessText || "",
      offerIntelligence: initialData?.myBusiness?.offerIntelligence || undefined,
      buyerIntelligence: initialData?.myBusiness?.buyerIntelligence || undefined,
    },
    contentInstructions: initialData?.contentInstructions || "",
    ctaConfig: {
      ctaPreferences: initialData?.ctaConfig?.ctaPreferences || "",
      contentDestinations: initialData?.ctaConfig?.contentDestinations || [],
      activeCta: null,
    },
    generationPreferences: {
      threadLength: initialData?.generationPreferences?.threadLength || "auto",
      sentencesPerPart: initialData?.generationPreferences?.sentencesPerPart || "auto",
      postsToCreate: initialData?.generationPreferences?.postsToCreate || "1",
      activeCategory: initialData?.generationPreferences?.activeCategory || "attention",
    },
    contentPillars: initialData?.contentPillars || [],
    activeIdea: null,
    rawCreatorThought: "",
  };

  if (serverDb) {
    await serverDb
      .collection("users")
      .doc(userId)
      .collection("saved_tabs")
      .doc(tabId)
      .set(newTab);
  }

  return newTab;
}

/**
 * Updates an existing saved tab strictly verifying ownership.
 */
export async function updateSavedTab(
  serverDb: any,
  userId: string,
  tabId: string,
  updates: Partial<SavedCreatorTab>
): Promise<SavedCreatorTab> {
  const existingTab = await getSingleSavedTab(serverDb, userId, tabId);

  const updated: SavedCreatorTab = {
    ...existingTab,
    ...updates,
    id: existingTab.id,
    userId: existingTab.userId, // Ownership cannot be mutated
    updatedAt: new Date().toISOString(),
    myVoice: {
      ...existingTab.myVoice,
      ...(updates.myVoice || {}),
    },
    myBusiness: {
      ...existingTab.myBusiness,
      ...(updates.myBusiness || {}),
    },
    ctaConfig: {
      ...existingTab.ctaConfig,
      ...(updates.ctaConfig || {}),
    },
    generationPreferences: {
      ...existingTab.generationPreferences,
      ...(updates.generationPreferences || {}),
    },
  };

  if (serverDb) {
    await serverDb
      .collection("users")
      .doc(userId)
      .collection("saved_tabs")
      .doc(tabId)
      .set(updated, { merge: true });

    // Update compact Generation Intelligence Snapshot with meaningful context changes
    try {
      await updateGenerationIntelligenceSnapshot(serverDb, userId, tabId, {
        summarizedCreatorContext: {
          offer: updated.myBusiness?.offer || "",
          audience: updated.myBusiness?.audience || "",
          desiredResult: updated.myBusiness?.desiredResult || "",
          writingStyle: updated.myVoice?.writingStyle || "",
          customInstruction: updated.contentInstructions || "",
          wordsToAvoid: updated.myVoice?.creatorIdentity?.wordsYouAvoid || "",
          voiceNotes: updated.myVoice?.rawVoice || "",
          businessConcept: updated.myBusiness?.rawBusinessText || ""
        },
        approvedOffers: updated.myBusiness?.offer ? [{ offer: updated.myBusiness.offer, pricePoint: (updated.myBusiness.offerIntelligence as any)?.pricePoint }] : [],
        approvedLinks: (updated.ctaConfig?.contentDestinations || []).map((d: any) => typeof d === "string" ? d : (d?.url || d?.link)).filter(Boolean)
      });
    } catch (_) {}
  }

  invalidateSavedTabCache(userId, tabId);
  return updated;
}

/**
 * Deletes a saved tab. Default tab cannot be deleted.
 */
export async function deleteSavedTab(
  serverDb: any,
  userId: string,
  tabId: string
): Promise<boolean> {
  if (tabId === "default") {
    throw new SavedTabError("The default tab cannot be deleted.", 400, "CANNOT_DELETE_DEFAULT_TAB");
  }

  // Verify ownership before deleting
  await getSingleSavedTab(serverDb, userId, tabId);

  if (serverDb) {
    await serverDb
      .collection("users")
      .doc(userId)
      .collection("saved_tabs")
      .doc(tabId)
      .delete();
  }

  invalidateSavedTabCache(userId, tabId);
  return true;
}

export function sanitizePillarObject(pillar: any): any {
  if (!pillar) return undefined;
  if (typeof pillar === "string") {
    const cleanStr = pillar
      .replace(/\bPILLAR\s*\d+\s*(?:Active\s*Focus)?/gi, "")
      .replace(/\bActive\s*Focus\b/gi, "")
      .replace(/\bStrategic\s*Filter\b/gi, "")
      .replace(/\bActive\s*Content\s*Pillar:\s*/gi, "")
      .replace(/\bPillar\s*Title:\s*/gi, "")
      .replace(/\bPillar\s*Description:\s*/gi, "")
      .replace(/\bContent\s*Pillar:\s*/gi, "")
      .trim();
    if (!cleanStr) return undefined;
    return { title: cleanStr, description: "" };
  }
  if (typeof pillar === "object") {
    const title = (pillar.title || pillar.name || "")
      .replace(/\bPILLAR\s*\d+\s*(?:Active\s*Focus)?/gi, "")
      .replace(/\bActive\s*Focus\b/gi, "")
      .replace(/\bStrategic\s*Filter\b/gi, "")
      .replace(/\bActive\s*Content\s*Pillar:\s*/gi, "")
      .replace(/\bPillar\s*Title:\s*/gi, "")
      .replace(/\bPillar\s*Description:\s*/gi, "")
      .replace(/\bContent\s*Pillar:\s*/gi, "")
      .trim();
    const description = (pillar.description || "")
      .replace(/\bPILLAR\s*\d+\s*(?:Active\s*Focus)?/gi, "")
      .replace(/\bActive\s*Focus\b/gi, "")
      .replace(/\bStrategic\s*Filter\b/gi, "")
      .replace(/\bActive\s*Content\s*Pillar:\s*/gi, "")
      .replace(/\bPillar\s*Title:\s*/gi, "")
      .replace(/\bPillar\s*Description:\s*/gi, "")
      .replace(/\bContent\s*Pillar:\s*/gi, "")
      .trim();
    if (!title && !description) return undefined;
    return {
      ...pillar,
      title: title || "Core Strategy",
      description
    };
  }
  return undefined;
}

/**
 * Centralized Resolution of Creator Context for Content Generation.
 * Guarantees:
 * ONE AUTHENTICATED USER + ONE SELECTED SAVED TAB = ONE ISOLATED CREATOR CONTEXT
 *
 * Never mixes, combines, inherits, leaks, caches, or reuses creator configuration
 * from another saved tab or another user.
 */
export async function resolveCreatorContextForGeneration(
  serverDb: any,
  userId: string,
  selectedSavedTabId?: string,
  requestOverrides?: {
    offer?: string;
    audience?: string;
    desiredResult?: string;
    writingStyle?: string;
    customInstruction?: string;
    ctaPreferences?: string;
    contentDestinations?: any[];
    creatorIdentity?: any;
    rawVoice?: string;
    rawBusinessText?: string;
    offerIntelligence?: any;
    buyerIntelligence?: any;
    activeCta?: any;
    activePillar?: any;
  }
): Promise<{
  tab: SavedCreatorTab | null;
  offer: string;
  audience: string;
  desiredResult: string;
  writingStyle: string;
  customInstruction: string;
  ctaPreferences: string;
  contentDestinations: any[];
  creatorIdentity?: any;
  rawVoice?: string;
  rawBusinessText?: string;
  offerIntelligence?: any;
  buyerIntelligence?: any;
  activeCta?: any;
  activePillar?: any;
}> {
  // If an authenticated user and tabId are provided, load the database configuration for that exact tab
  if (userId && userId !== "anonymous" && selectedSavedTabId) {
    let tab: SavedCreatorTab | null = null;
    try {
      tab = await getSingleSavedTab(serverDb, userId, selectedSavedTabId);
    } catch (err: any) {
      if (err?.code === "FORBIDDEN_TAB_MISMATCH") throw err;
      console.warn(`[SAVED_TABS] Tab "${selectedSavedTabId}" load note for user "${userId}": ${err?.message || err}. Utilizing provided request context.`);
      if (selectedSavedTabId === "default") {
        tab = buildDefaultSavedTab(userId);
      }
    }

    if (tab) {
      return {
        tab,
        offer: (requestOverrides?.offer || tab.myBusiness?.offer || "").trim(),
        audience: (requestOverrides?.audience || tab.myBusiness?.audience || "").trim(),
        desiredResult: (requestOverrides?.desiredResult || tab.myBusiness?.desiredResult || "").trim(),
        writingStyle: (requestOverrides?.writingStyle || tab.myVoice?.writingStyle || "").trim(),
        customInstruction: (requestOverrides?.customInstruction || tab.contentInstructions || "").trim(),
        ctaPreferences: (requestOverrides?.ctaPreferences || tab.ctaConfig?.ctaPreferences || "").trim(),
        contentDestinations: (Array.isArray(requestOverrides?.contentDestinations) && requestOverrides.contentDestinations.length > 0)
          ? requestOverrides.contentDestinations
          : (tab.ctaConfig?.contentDestinations || []),
        creatorIdentity: requestOverrides?.creatorIdentity || tab.myVoice?.creatorIdentity || undefined,
        rawVoice: requestOverrides?.rawVoice || tab.myVoice?.rawVoice || "",
        rawBusinessText: requestOverrides?.rawBusinessText || tab.myBusiness?.rawBusinessText || "",
        offerIntelligence: requestOverrides?.offerIntelligence || tab.myBusiness?.offerIntelligence || undefined,
        buyerIntelligence: requestOverrides?.buyerIntelligence || tab.myBusiness?.buyerIntelligence || undefined,
        activeCta: requestOverrides?.activeCta ?? tab.ctaConfig?.activeCta ?? null,
        activePillar: sanitizePillarObject(requestOverrides?.activePillar || (tab.contentPillars && tab.contentPillars[0] ? tab.contentPillars[0] : undefined)),
      };
    }
  }

  // If no tabId was explicitly passed, but userId is valid, check default tab
  if (userId && userId !== "anonymous" && !selectedSavedTabId) {
    let tab: SavedCreatorTab | null = null;
    try {
      tab = await getSingleSavedTab(serverDb, userId, "default");
    } catch (err: any) {
      console.warn(`[SAVED_TABS] Default tab load note for user "${userId}": ${err?.message || err}. Serving isolated default tab.`);
      tab = buildDefaultSavedTab(userId);
    }

    if (tab) {
      return {
        tab,
        offer: (requestOverrides?.offer || tab.myBusiness?.offer || "").trim(),
        audience: (requestOverrides?.audience || tab.myBusiness?.audience || "").trim(),
        desiredResult: (requestOverrides?.desiredResult || tab.myBusiness?.desiredResult || "").trim(),
        writingStyle: (requestOverrides?.writingStyle || tab.myVoice?.writingStyle || "").trim(),
        customInstruction: (requestOverrides?.customInstruction || tab.contentInstructions || "").trim(),
        ctaPreferences: (requestOverrides?.ctaPreferences || tab.ctaConfig?.ctaPreferences || "").trim(),
        contentDestinations: (Array.isArray(requestOverrides?.contentDestinations) && requestOverrides.contentDestinations.length > 0)
          ? requestOverrides.contentDestinations
          : (tab.ctaConfig?.contentDestinations || []),
        creatorIdentity: requestOverrides?.creatorIdentity || tab.myVoice?.creatorIdentity || undefined,
        rawVoice: requestOverrides?.rawVoice || tab.myVoice?.rawVoice || "",
        rawBusinessText: requestOverrides?.rawBusinessText || tab.myBusiness?.rawBusinessText || "",
        offerIntelligence: requestOverrides?.offerIntelligence || tab.myBusiness?.offerIntelligence || undefined,
        buyerIntelligence: requestOverrides?.buyerIntelligence || tab.myBusiness?.buyerIntelligence || undefined,
        activeCta: requestOverrides?.activeCta ?? tab.ctaConfig?.activeCta ?? null,
        activePillar: sanitizePillarObject(requestOverrides?.activePillar || (tab.contentPillars && tab.contentPillars[0] ? tab.contentPillars[0] : undefined)),
      };
    }
  }

  // Anonymous or offline mode: strictly use only the requestOverrides provided, never pull cross-user data
  return {
    tab: null,
    offer: (requestOverrides?.offer || "").trim(),
    audience: (requestOverrides?.audience || "").trim(),
    desiredResult: (requestOverrides?.desiredResult || "").trim(),
    writingStyle: (requestOverrides?.writingStyle || "").trim(),
    customInstruction: (requestOverrides?.customInstruction || "").trim(),
    ctaPreferences: (requestOverrides?.ctaPreferences || "").trim(),
    contentDestinations: requestOverrides?.contentDestinations || [],
    creatorIdentity: requestOverrides?.creatorIdentity,
    rawVoice: requestOverrides?.rawVoice || "",
    rawBusinessText: requestOverrides?.rawBusinessText || "",
    offerIntelligence: requestOverrides?.offerIntelligence,
    buyerIntelligence: requestOverrides?.buyerIntelligence,
    activeCta: requestOverrides?.activeCta || null,
    activePillar: sanitizePillarObject(requestOverrides?.activePillar),
  };
}
