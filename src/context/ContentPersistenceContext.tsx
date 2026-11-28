import React, { createContext, useContext, useState, useEffect, useRef } from "react";

import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ContentDecision, ContentDestination, StrategicAngle, StrategicHook, StrategicContentUnit } from "../types";
import { db, sanitizeForFirestore } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { usePersistentDraft } from "../utils/usePersistentDraft";

import { CanonicalStage } from "../lib/canonicalContent";
import {
  safeGetLocalStorage,
  safeSetLocalStorage,
  safeRemoveLocalStorage,
} from "../lib/safeStorage";

export interface ActiveIdeaPayload {
  id?: string;
  title: string;
  summary: string;
  originalIdea: string;
  pillarTitle?: string;
  topic?: string;
  targetPlannedDate?: string;
}

export interface GeneratedPost {
  id: string;
  savedRecordId?: string;
  title: string;
  hook: string;
  singlePost: string;
  explanation: string;
  threadParts?: string[];
  pillar?: "attention" | "trust" | "sales" | string;
  pillarTitle?: string;
  topics?: string[];
  stage?: CanonicalStage;
  plannedDate?: string | null;
  sourceIdeaId?: string | null;
  category?: "attention" | "trust" | "sales" | string;
  decision?: ContentDecision;
  cta?: string;
  angle?: string;
  actionType?: string;
  strategicLens?: string;
  centralThesis?: string;
  contentUnitId?: string;
}

interface ContentPersistenceContextType {
  attentionPosts: GeneratedPost[];
  setAttentionPosts: React.Dispatch<React.SetStateAction<GeneratedPost[]>>;
  trustPosts: GeneratedPost[];
  setTrustPosts: React.Dispatch<React.SetStateAction<GeneratedPost[]>>;
  salesPosts: GeneratedPost[];
  setSalesPosts: React.Dispatch<React.SetStateAction<GeneratedPost[]>>;
  customInstruction: string;
  setCustomInstruction: (text: string) => void;
  ctaPreferences: string;
  setCtaPreferences: (text: string) => void;
  contentDestinations: ContentDestination[];
  setContentDestinations: React.Dispatch<React.SetStateAction<ContentDestination[]>>;
  activeCategory: "attention" | "trust" | "sales";
  setActiveCategory: (cat: "attention" | "trust" | "sales" | string) => void;
  simulationWarning: string | null;
  setSimulationWarning: (warning: string | null) => void;
  lockedHook: string | null;
  setLockedHook: (hook: string | null) => void;
  threadLength: string;
  setThreadLength: (length: string) => void;
  sentencesPerPart: string;
  setSentencesPerPart: (count: string) => void;
  postsToCreate: string;
  setPostsToCreate: (count: string) => void;
  activeIdea: ActiveIdeaPayload | null;
  setActiveIdea: (idea: ActiveIdeaPayload | null) => void;
  rawCreatorThought: string;
  setRawCreatorThought: (text: string) => void;
  activeCta: { message: string; linkUrl?: string; angle?: string } | null;
  setActiveCta: (cta: { message: string; linkUrl?: string; angle?: string } | null) => void;
  recentPillarHistory: string[];
  addPillarToHistory: (pillar: string) => void;
  all32Hooks: any[];
  setAll32Hooks: (hooks: any[]) => void;
  areHooksActive: boolean;
  setAreHooksActive: (active: boolean) => void;
  // Strategic Pipeline (1/4/8/16/32 Angles -> Hooks -> Create)
  strategicUnits: StrategicContentUnit[];
  setStrategicUnits: (units: StrategicContentUnit[]) => void;
  activeStrategicAngle: StrategicAngle | null;
  setActiveStrategicAngle: (angle: StrategicAngle | null) => void;
  strategicCreatorRequest: string;
  setStrategicCreatorRequest: (request: string) => void;
  areStrategicUnitsActive: boolean;
  setAreStrategicUnitsActive: (active: boolean) => void;
  clearStrategicPipeline: () => void;
  clearAll: () => void;
}

const ContentPersistenceContext = createContext<ContentPersistenceContextType | undefined>(undefined);

const getStoredUid = (): string | null => {
  if (typeof window === "undefined") return null;
  return auth.currentUser?.uid || null;
};

const getInitialPosts = (category: "attention" | "trust" | "sales"): GeneratedPost[] => {
  if (typeof window === "undefined") return [];
  try {
    const uid = getStoredUid();
    if (!uid) return [];
    const saved = localStorage.getItem(`threads_${category}_posts_${uid}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(`Error reading initial ${category} posts:`, e);
  }
  return [];
};

const getInitialString = (keyPrefix: string, fallback: string = ""): string => {
  if (typeof window === "undefined") return fallback;
  try {
    const uid = getStoredUid();
    if (!uid) return fallback;
    const saved = localStorage.getItem(`${keyPrefix}_${uid}`);
    if (saved !== null) return saved;
    return fallback;
  } catch {
    return fallback;
  }
};

export const ContentPersistenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any>(() => auth.currentUser || null);

  // Initialize state eagerly from localStorage so drafts exist on line 1 of render without empty-flash
  const [attentionPosts, setAttentionPostsState] = useState<GeneratedPost[]>(() => getInitialPosts("attention"));
  const [trustPosts, setTrustPostsState] = useState<GeneratedPost[]>(() => getInitialPosts("trust"));
  const [salesPosts, setSalesPostsState] = useState<GeneratedPost[]>(() => getInitialPosts("sales"));
  const [customInstruction, setCustomInstructionState] = useState<string>(() => getInitialString("threads_custom_instruction", ""));
  const [ctaPreferences, setCtaPreferencesState] = useState<string>(() => getInitialString("threads_cta_preferences", ""));
  const [contentDestinations, setContentDestinationsState] = useState<ContentDestination[]>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return [];
      const saved = localStorage.getItem(`threads_content_destinations_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [activeCategory, setActiveCategoryState] = useState<"attention" | "trust" | "sales">(() => {
    const cat = getInitialString("threads_active_category", "attention");
    return (cat === "trust" || cat === "sales") ? cat : "attention";
  });
  const [simulationWarning, setSimulationWarningState] = useState<string | null>(() => {
    const w = getInitialString("threads_simulation_warning", "");
    return w ? w : null;
  });
  const [lockedHook, setLockedHook] = usePersistentDraft<string | null>("engine", "locked-hook", null);
  // Standard Content Engine always uses automatic length/sentence intelligence; never inherit invisible legacy localStorage overrides.
  const [threadLength, setThreadLengthState] = useState<string>("auto");
  const [sentencesPerPart, setSentencesPerPartState] = useState<string>("auto");
  const [postsToCreate, setPostsToCreateState] = useState<string>(() => {
    const pts = getInitialString("threads_posts_to_create", "1");
    return ["1", "4", "8", "16", "32"].includes(pts) ? pts : "1";
  });
  const [activeIdea, setActiveIdeaState] = useState<ActiveIdeaPayload | null>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return null;
      const saved = localStorage.getItem(`threads_active_idea_${uid}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [rawCreatorThought, setRawCreatorThoughtState] = useState<string>(() => getInitialString("threads_raw_creator_thought", ""));
  const [activeCta, setActiveCtaState] = useState<{ message: string; linkUrl?: string; angle?: string } | null>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return null;
      const saved = localStorage.getItem(`threads_active_cta_${uid}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [recentPillarHistory, setRecentPillarHistoryState] = useState<string[]>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return [];
      const saved = localStorage.getItem(`threads_pillar_history_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [all32Hooks, setAll32HooksState] = useState<any[]>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return [];
      const saved = localStorage.getItem(`threads_all_32_hooks_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const setAll32Hooks = (hooks: any[]) => {
    setAll32HooksState(hooks);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_all_32_hooks_${uid}`, JSON.stringify(hooks));
        setDoc(doc(db, "users", uid), sanitizeForFirestore({ all32Hooks: hooks }), { merge: true }).catch(e => console.warn("Firestore sync failed for all32Hooks:", e));
      } catch (e) {
        console.warn("Failed writing all32Hooks to localStorage:", e);
      }
    }
  };

  const [areHooksActive, setAreHooksActiveState] = useState<boolean>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return false;
      const saved = localStorage.getItem(`threads_are_hooks_active_${uid}`);
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  const setAreHooksActive = (active: boolean) => {
    setAreHooksActiveState(active);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_are_hooks_active_${uid}`, JSON.stringify(active));
      } catch (e) {
        console.warn("Failed writing areHooksActive to localStorage:", e);
      }
    }
  };

  // Strategic Pipeline (1/4/8/16/32 Angles -> Hooks -> Create)
  const [strategicUnits, setStrategicUnitsState] = useState<StrategicContentUnit[]>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return [];
      const saved = localStorage.getItem(`threads_strategic_units_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const setStrategicUnits = (units: StrategicContentUnit[]) => {
    setStrategicUnitsState(units);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_strategic_units_${uid}`, JSON.stringify(units));
        setDoc(doc(db, "users", uid), sanitizeForFirestore({ strategicUnits: units }), { merge: true }).catch(e => console.warn("Firestore sync failed for strategicUnits:", e));
      } catch (e) {
        console.warn("Failed writing strategicUnits to localStorage:", e);
      }
    }
  };

  const [activeStrategicAngle, setActiveStrategicAngleState] = useState<StrategicAngle | null>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return null;
      const saved = localStorage.getItem(`threads_active_strategic_angle_${uid}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const setActiveStrategicAngle = (angle: StrategicAngle | null) => {
    setActiveStrategicAngleState(angle);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        if (angle) {
          localStorage.setItem(`threads_active_strategic_angle_${uid}`, JSON.stringify(angle));
        } else {
          localStorage.removeItem(`threads_active_strategic_angle_${uid}`);
        }
      } catch (e) {
        console.warn("Failed writing activeStrategicAngle to localStorage:", e);
      }
    }
  };

  const [strategicCreatorRequest, setStrategicCreatorRequestState] = useState<string>(() => {
    return getInitialString("threads_strategic_creator_request", "");
  });

  const setStrategicCreatorRequest = (request: string) => {
    setStrategicCreatorRequestState(request);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_strategic_creator_request_${uid}`, request);
      } catch (e) {
        console.warn("Failed writing strategicCreatorRequest to localStorage:", e);
      }
    }
  };

  const [areStrategicUnitsActive, setAreStrategicUnitsActiveState] = useState<boolean>(() => {
    try {
      const uid = getStoredUid();
      if (!uid) return false;
      const saved = localStorage.getItem(`threads_are_strategic_units_active_${uid}`);
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  const setAreStrategicUnitsActive = (active: boolean) => {
    setAreStrategicUnitsActiveState(active);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_are_strategic_units_active_${uid}`, JSON.stringify(active));
      } catch (e) {
        console.warn("Failed writing areStrategicUnitsActive to localStorage:", e);
      }
    }
  };

  const clearStrategicPipeline = () => {
    setStrategicUnitsState([]);
    setActiveStrategicAngleState(null);
    setStrategicCreatorRequestState("");
    setAreStrategicUnitsActiveState(false);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.removeItem(`threads_strategic_units_${uid}`);
        localStorage.removeItem(`threads_active_strategic_angle_${uid}`);
        localStorage.removeItem(`threads_strategic_creator_request_${uid}`);
        localStorage.removeItem(`threads_are_strategic_units_active_${uid}`);
      } catch (e) {
        console.warn("Failed clearing strategic pipeline from localStorage:", e);
      }
    }
  };

  // Track latest references to ensure zero-lag synchronous persistence and beforeunload safety
  const attentionPostsRef = useRef(attentionPosts);
  const trustPostsRef = useRef(trustPosts);
  const salesPostsRef = useRef(salesPosts);
  const activeCategoryRef = useRef(activeCategory);
  const customInstructionRef = useRef(customInstruction);
  const previousUidRef = useRef<string | null>(getStoredUid());

  useEffect(() => {
    customInstructionRef.current = customInstruction;
  }, [customInstruction]);

  useEffect(() => {
    attentionPostsRef.current = attentionPosts;
  }, [attentionPosts]);

  useEffect(() => {
    trustPostsRef.current = trustPosts;
  }, [trustPosts]);

  useEffect(() => {
    salesPostsRef.current = salesPosts;
  }, [salesPosts]);

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  const getEffectiveUid = (): string | null => {
    if (currentUser?.uid) return currentUser.uid;
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    return null;
  };

  // Synchronous, non-blocking post setters that write to localStorage immediately upon dispatch
  const setAttentionPosts: React.Dispatch<React.SetStateAction<GeneratedPost[]>> = (valueOrUpdater) => {
    setAttentionPostsState(prev => {
      const next = typeof valueOrUpdater === "function" 
        ? (valueOrUpdater as (prev: GeneratedPost[]) => GeneratedPost[])(prev) 
        : valueOrUpdater;
      attentionPostsRef.current = next;
      const uid = getEffectiveUid();
      if (uid) {
        try {
          localStorage.setItem(`threads_attention_posts_${uid}`, JSON.stringify(next));
          localStorage.setItem(`threads_drafts_version_${uid}`, Date.now().toString());
        } catch (e) {
          console.warn("LocalStorage sync failed for attention posts:", e);
        }
      }
      return next;
    });
  };

  const setTrustPosts: React.Dispatch<React.SetStateAction<GeneratedPost[]>> = (valueOrUpdater) => {
    setTrustPostsState(prev => {
      const next = typeof valueOrUpdater === "function" 
        ? (valueOrUpdater as (prev: GeneratedPost[]) => GeneratedPost[])(prev) 
        : valueOrUpdater;
      trustPostsRef.current = next;
      const uid = getEffectiveUid();
      if (uid) {
        try {
          localStorage.setItem(`threads_trust_posts_${uid}`, JSON.stringify(next));
          localStorage.setItem(`threads_drafts_version_${uid}`, Date.now().toString());
        } catch (e) {
          console.warn("LocalStorage sync failed for trust posts:", e);
        }
      }
      return next;
    });
  };

  const setSalesPosts: React.Dispatch<React.SetStateAction<GeneratedPost[]>> = (valueOrUpdater) => {
    setSalesPostsState(prev => {
      const next = typeof valueOrUpdater === "function" 
        ? (valueOrUpdater as (prev: GeneratedPost[]) => GeneratedPost[])(prev) 
        : valueOrUpdater;
      salesPostsRef.current = next;
      const uid = getEffectiveUid();
      if (uid) {
        try {
          localStorage.setItem(`threads_sales_posts_${uid}`, JSON.stringify(next));
          localStorage.setItem(`threads_drafts_version_${uid}`, Date.now().toString());
        } catch (e) {
          console.warn("LocalStorage sync failed for sales posts:", e);
        }
      }
      return next;
    });
  };

  // Listen to Auth state and load/reset values accordingly
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const prevUid = previousUidRef.current;
      setCurrentUser(user);
      if (user) {
        const uid = user.uid;
        previousUidRef.current = uid;
        try {
          localStorage.setItem("threads_last_known_uid", uid);
        } catch (_) {}

        try {
          const savedAtt = localStorage.getItem(`threads_attention_posts_${uid}`);
          if (savedAtt) {
            const parsed = JSON.parse(savedAtt);
            if (Array.isArray(parsed)) {
              setAttentionPostsState(parsed);
              attentionPostsRef.current = parsed;
            } else {
              setAttentionPostsState([]);
              attentionPostsRef.current = [];
            }
          } else if (attentionPostsRef.current.length > 0 && prevUid === uid) {
            localStorage.setItem(`threads_attention_posts_${uid}`, JSON.stringify(attentionPostsRef.current));
          } else {
            setAttentionPostsState([]);
            attentionPostsRef.current = [];
          }
        } catch (e) {
          console.warn("Error restoring attention posts:", e);
          setAttentionPostsState([]);
          attentionPostsRef.current = [];
        }

        try {
          const savedTrust = localStorage.getItem(`threads_trust_posts_${uid}`);
          if (savedTrust) {
            const parsed = JSON.parse(savedTrust);
            if (Array.isArray(parsed)) {
              setTrustPostsState(parsed);
              trustPostsRef.current = parsed;
            } else {
              setTrustPostsState([]);
              trustPostsRef.current = [];
            }
          } else if (trustPostsRef.current.length > 0 && prevUid === uid) {
            localStorage.setItem(`threads_trust_posts_${uid}`, JSON.stringify(trustPostsRef.current));
          } else {
            setTrustPostsState([]);
            trustPostsRef.current = [];
          }
        } catch (e) {
          console.warn("Error restoring trust posts:", e);
          setTrustPostsState([]);
          trustPostsRef.current = [];
        }

        try {
          const savedSales = localStorage.getItem(`threads_sales_posts_${uid}`);
          if (savedSales) {
            const parsed = JSON.parse(savedSales);
            if (Array.isArray(parsed)) {
              setSalesPostsState(parsed);
              salesPostsRef.current = parsed;
            } else {
              setSalesPostsState([]);
              salesPostsRef.current = [];
            }
          } else if (salesPostsRef.current.length > 0 && prevUid === uid) {
            localStorage.setItem(`threads_sales_posts_${uid}`, JSON.stringify(salesPostsRef.current));
          } else {
            setSalesPostsState([]);
            salesPostsRef.current = [];
          }
        } catch (e) {
          console.warn("Error restoring sales posts:", e);
          setSalesPostsState([]);
          salesPostsRef.current = [];
        }

        try {
          const savedHooks = localStorage.getItem(`threads_all_32_hooks_${uid}`);
          setAll32HooksState(savedHooks ? JSON.parse(savedHooks) : []);
        } catch { setAll32HooksState([]); }

        try {
          const savedHooksActive = localStorage.getItem(`threads_are_hooks_active_${uid}`);
          setAreHooksActiveState(savedHooksActive !== null ? JSON.parse(savedHooksActive) : false);
        } catch { setAreHooksActiveState(false); }

        try {
          const savedUnits = localStorage.getItem(`threads_strategic_units_${uid}`);
          setStrategicUnitsState(savedUnits ? JSON.parse(savedUnits) : []);
        } catch { setStrategicUnitsState([]); }

        try {
          const savedAngle = localStorage.getItem(`threads_active_strategic_angle_${uid}`);
          setActiveStrategicAngleState(savedAngle ? JSON.parse(savedAngle) : null);
        } catch { setActiveStrategicAngleState(null); }

        setStrategicCreatorRequestState(safeGetLocalStorage(`threads_strategic_creator_request_${uid}`) || "");

        try {
          const savedUnitsActive = localStorage.getItem(`threads_are_strategic_units_active_${uid}`);
          setAreStrategicUnitsActiveState(savedUnitsActive !== null ? JSON.parse(savedUnitsActive) : false);
        } catch { setAreStrategicUnitsActiveState(false); }

        try {
          const savedPillars = localStorage.getItem(`threads_pillar_history_${uid}`);
          setRecentPillarHistoryState(savedPillars ? JSON.parse(savedPillars) : []);
        } catch { setRecentPillarHistoryState([]); }

        try {
          const savedIdea = localStorage.getItem(`threads_active_idea_${uid}`);
          setActiveIdeaState(savedIdea ? JSON.parse(savedIdea) : null);
        } catch { setActiveIdeaState(null); }

        try {
          const savedCta = localStorage.getItem(`threads_active_cta_${uid}`);
          setActiveCtaState(savedCta ? JSON.parse(savedCta) : null);
        } catch { setActiveCtaState(null); }

        setRawCreatorThoughtState(safeGetLocalStorage(`threads_raw_creator_thought_${uid}`) || "");

        let customInst = safeGetLocalStorage(`threads_custom_instruction_${uid}`) || "";
        let savedCtaPrefs = safeGetLocalStorage(`threads_cta_preferences_${uid}`) || "";
        let savedDestinations: ContentDestination[] = [];
        try {
          const rawDest = safeGetLocalStorage(`threads_content_destinations_${uid}`);
          if (rawDest) savedDestinations = JSON.parse(rawDest);
        } catch (_) {}

        if (safeGetLocalStorage(`threads_custom_instruction_${uid}`) === null || safeGetLocalStorage(`threads_cta_preferences_${uid}`) === null || savedDestinations.length === 0) {
          try {
            const cachedProfile = safeGetLocalStorage(`profile_${uid}`);
            if (cachedProfile) {
              const parsed = JSON.parse(cachedProfile);
              if (safeGetLocalStorage(`threads_custom_instruction_${uid}`) === null && parsed?.customInstruction !== undefined && parsed?.customInstruction !== null) {
                customInst = parsed.customInstruction;
              }
              if (safeGetLocalStorage(`threads_cta_preferences_${uid}`) === null && parsed?.ctaPreferences !== undefined && parsed?.ctaPreferences !== null) {
                savedCtaPrefs = parsed.ctaPreferences;
              }
              if (savedDestinations.length === 0 && Array.isArray(parsed?.contentDestinations)) {
                savedDestinations = parsed.contentDestinations;
              }
            }
          } catch (_) {}
        }

        // Idempotent migration of old Creator Memory manual fields into canonical Creator Context & Your Links
        const migrationKey = `threads_memory_migrated_${uid}`;
        if (!safeGetLocalStorage(migrationKey)) {
          try {
            const legacyInst = safeGetLocalStorage(`threads_intelligence_editable-instruction_${uid}`);
            const legacyCta = safeGetLocalStorage(`threads_intelligence_editable-cta_${uid}`);

            if (legacyInst && legacyInst.trim().length > 10) {
              const cleanInst = legacyInst.trim();
              if (!customInst.includes(cleanInst)) {
                customInst = customInst ? `${customInst}\n\n${cleanInst}` : cleanInst;
                safeSetLocalStorage(`threads_custom_instruction_${uid}`, customInst);
              }
            }

            if (legacyCta && legacyCta.trim().length > 3) {
              const cleanCta = legacyCta.trim();
              const urlMatch = cleanCta.match(/https?:\/\/[^\s)]+/i);
              if (urlMatch) {
                const extractedUrl = urlMatch[0];
                const isAlreadySaved = savedDestinations.some(d => d.url.toLowerCase() === extractedUrl.toLowerCase());
                if (!isAlreadySaved) {
                  savedDestinations.push({
                    id: `link_migrated_${Date.now()}`,
                    name: "Primary Offer Link",
                    url: extractedUrl,
                    purpose: cleanCta.replace(extractedUrl, "").trim() || "Migrated from Primary CTA",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  });
                  safeSetLocalStorage(`threads_content_destinations_${uid}`, JSON.stringify(savedDestinations));
                }
              } else if (!customInst.includes(cleanCta)) {
                customInst = customInst ? `${customInst}\n• CTA Directive: ${cleanCta}` : `CTA Directive: ${cleanCta}`;
                safeSetLocalStorage(`threads_custom_instruction_${uid}`, customInst);
              }
            }

            safeRemoveLocalStorage(`threads_intelligence_editable-instruction_${uid}`);
            safeRemoveLocalStorage(`threads_intelligence_editable-cta_${uid}`);
            safeSetLocalStorage(migrationKey, "true");
          } catch (e) {
            console.warn("Legacy memory migration note:", e);
          }
        }
        setCustomInstructionState(customInst);
        customInstructionRef.current = customInst;
        setCtaPreferencesState(savedCtaPrefs);
        setContentDestinationsState(savedDestinations);

        const cat = safeGetLocalStorage(`threads_active_category_${uid}`);
        if (cat === "attention" || cat === "trust" || cat === "sales") {
          setActiveCategoryState(cat);
          activeCategoryRef.current = cat;
        } else {
          setActiveCategoryState("attention");
          activeCategoryRef.current = "attention";
        }

        // Never inherit historical invisible thread-length or sentence-count overrides from localStorage.
        setThreadLengthState("auto");
        setSentencesPerPartState("auto");

        const pts = safeGetLocalStorage(`threads_posts_to_create_${uid}`);
        if (pts && ["1", "4", "8", "16", "32"].includes(pts)) {
          setPostsToCreateState(pts);
        } else {
          setPostsToCreateState("1");
        }

        setSimulationWarningState(safeGetLocalStorage(`threads_simulation_warning_${uid}`) || null);
      } else {
        // Clear all in-memory state on sign-out so no prior account data can leak
        if (prevUid) {
          safeRemoveLocalStorage("threads_last_known_uid");
          safeRemoveLocalStorage("threads_custom_instruction");
          setAttentionPostsState([]);
          setTrustPostsState([]);
          setSalesPostsState([]);
          attentionPostsRef.current = [];
          trustPostsRef.current = [];
          salesPostsRef.current = [];
          setCustomInstructionState("");
          customInstructionRef.current = "";
          setActiveCategoryState("attention");
          activeCategoryRef.current = "attention";
          setThreadLengthState("auto");
          setSentencesPerPartState("auto");
          setPostsToCreateState("1");
          setSimulationWarningState(null);
          setActiveIdeaState(null);
          setRawCreatorThoughtState("");
          setActiveCtaState(null);
          setCtaPreferencesState("");
          setContentDestinationsState([]);
          setRecentPillarHistoryState([]);
          setAll32HooksState([]);
          setAreHooksActiveState(false);
          setStrategicUnitsState([]);
          setActiveStrategicAngleState(null);
          setStrategicCreatorRequestState("");
          setAreStrategicUnitsActiveState(false);
        }
        previousUidRef.current = null;
      }
    });
    return () => unsub();
  }, []);

  // Guarantee persistence before page teardown, unmount, or refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const uid = getEffectiveUid();
      if (!uid) return;
      try {
        localStorage.setItem(`threads_attention_posts_${uid}`, JSON.stringify(attentionPostsRef.current));
        localStorage.setItem(`threads_trust_posts_${uid}`, JSON.stringify(trustPostsRef.current));
        localStorage.setItem(`threads_sales_posts_${uid}`, JSON.stringify(salesPostsRef.current));
        localStorage.setItem(`threads_active_category_${uid}`, activeCategoryRef.current);
      } catch (_) {}
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Multi-tab storage sync listener: synchronize drafts and category when another tab updates them
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      const uid = getEffectiveUid();
      if (!uid || !e.key) return;

      if (e.key === `threads_attention_posts_${uid}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setAttentionPostsState(parsed);
            attentionPostsRef.current = parsed;
          }
        } catch (_) {}
      } else if (e.key === `threads_trust_posts_${uid}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setTrustPostsState(parsed);
            trustPostsRef.current = parsed;
          }
        } catch (_) {}
      } else if (e.key === `threads_sales_posts_${uid}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setSalesPostsState(parsed);
            salesPostsRef.current = parsed;
          }
        } catch (_) {}
      } else if (e.key === `threads_active_category_${uid}` && e.newValue) {
        if (e.newValue === "attention" || e.newValue === "trust" || e.newValue === "sales") {
          setActiveCategoryState(e.newValue);
          activeCategoryRef.current = e.newValue;
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [currentUser]);

  // Synchronize state when custom creator context is updated anywhere in the app
  useEffect(() => {
    const handleContextEvent = (e: any) => {
      const val = typeof e?.detail === "string" ? e.detail : "";
      if (val !== undefined && val !== null && val !== customInstructionRef.current) {
        customInstructionRef.current = val;
        setCustomInstructionState(val);
      }
    };
    window.addEventListener("creator-context-updated", handleContextEvent as EventListener);
    return () => {
      window.removeEventListener("creator-context-updated", handleContextEvent as EventListener);
    };
  }, []);

  const setCustomInstruction = (text: string) => {
    if (customInstructionRef.current === text) {
      return;
    }
    customInstructionRef.current = text;
    setCustomInstructionState(text);
    const uid = getEffectiveUid();
    if (typeof window !== "undefined" && uid) {
      try {
        localStorage.setItem(`threads_custom_instruction_${uid}`, text);
        window.dispatchEvent(new CustomEvent("creator-context-updated", { detail: text }));
      } catch (e) {
        console.warn("LocalStorage sync failed for custom instructions:", e);
      }
    }
  };

  const setCtaPreferences = (text: string) => {
    setCtaPreferencesState(text);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_cta_preferences_${uid}`, text);
      } catch (e) {
        console.warn("LocalStorage sync failed for cta preferences:", e);
      }
    }
  };

  const setContentDestinations: React.Dispatch<React.SetStateAction<ContentDestination[]>> = (valueOrUpdater) => {
    setContentDestinationsState(prev => {
      const next = typeof valueOrUpdater === "function" 
        ? (valueOrUpdater as (prev: ContentDestination[]) => ContentDestination[])(prev) 
        : valueOrUpdater;
      const uid = getEffectiveUid();
      if (uid) {
        try {
          localStorage.setItem(`threads_content_destinations_${uid}`, JSON.stringify(next));
          setDoc(doc(db, "users", uid), sanitizeForFirestore({ contentDestinations: next }), { merge: true }).catch(e => console.warn("Firestore sync failed for contentDestinations:", e));
        } catch (e) {
          console.warn("LocalStorage sync failed for content destinations:", e);
        }
      }
      return next;
    });
  };

  const setRawCreatorThought = (text: string) => {
    setRawCreatorThoughtState(text);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_raw_creator_thought_${uid}`, text);
      } catch (e) {
        console.warn("LocalStorage sync failed for raw creator thought:", e);
      }
    }
  };

  const setActiveCategory = (cat: "attention" | "trust" | "sales" | string) => {
    const safeCat: "attention" | "trust" | "sales" = 
      (cat === "trust" || cat === "sales") ? cat : "attention";
    setActiveCategoryState(safeCat);
    activeCategoryRef.current = safeCat;
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_active_category_${uid}`, safeCat);
      } catch (e) {
        console.warn("LocalStorage sync failed for active category:", e);
      }
    }
  };

  const setSimulationWarning = (warning: string | null) => {
    setSimulationWarningState(warning);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        if (warning) {
          localStorage.setItem(`threads_simulation_warning_${uid}`, warning);
        } else {
          localStorage.removeItem(`threads_simulation_warning_${uid}`);
        }
      } catch (e) {
        console.warn("LocalStorage sync failed for simulation warning:", e);
      }
    }
  };

  // Kept in-memory only for backward compatibility; never persist invisible legacy length overrides to localStorage.
  const setThreadLength = (_length: string) => {
    setThreadLengthState("auto");
  };

  const setSentencesPerPart = (_count: string) => {
    setSentencesPerPartState("auto");
  };

  const setPostsToCreate = (count: string) => {
    setPostsToCreateState(count);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.setItem(`threads_posts_to_create_${uid}`, count);
      } catch (e) {
        console.warn("LocalStorage sync failed for posts to create:", e);
      }
    }
  };

  const setActiveIdea = (idea: ActiveIdeaPayload | null) => {
    setActiveIdeaState(idea);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        if (idea) {
          localStorage.setItem(`threads_active_idea_${uid}`, JSON.stringify(idea));
        } else {
          localStorage.removeItem(`threads_active_idea_${uid}`);
        }
      } catch (e) {
        console.warn("LocalStorage sync failed for active idea:", e);
      }
    }
  };

  const setActiveCta = (cta: { message: string; linkUrl?: string; angle?: string } | null) => {
    setActiveCtaState(cta);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        if (cta) {
          localStorage.setItem(`threads_active_cta_${uid}`, JSON.stringify(cta));
        } else {
          localStorage.removeItem(`threads_active_cta_${uid}`);
        }
      } catch (e) {
        console.warn("LocalStorage sync failed for active CTA:", e);
      }
    }
  };

  const addPillarToHistory = (pillar: string) => {
    if (!pillar) return;
    const cleanPillar = pillar.toLowerCase().trim();
    setRecentPillarHistoryState(prev => {
      const updated = [...prev, cleanPillar].slice(-20); // Keep last 20 records
      const uid = getEffectiveUid();
      if (uid) {
        try {
          localStorage.setItem(`threads_pillar_history_${uid}`, JSON.stringify(updated));
        } catch (e) {
          console.warn("LocalStorage sync failed for pillar history:", e);
        }
      }
      return updated;
    });
  };

  const clearAll = () => {
    setAttentionPostsState([]);
    setTrustPostsState([]);
    setSalesPostsState([]);
    attentionPostsRef.current = [];
    trustPostsRef.current = [];
    salesPostsRef.current = [];
    setCustomInstructionState("");
    setActiveCategoryState("attention");
    activeCategoryRef.current = "attention";
    setThreadLengthState("auto");
    setSentencesPerPartState("auto");
    setPostsToCreateState("1");
    setSimulationWarningState(null);
    setActiveIdeaState(null);
    setRawCreatorThoughtState("");
    setActiveCtaState(null);
    setCtaPreferencesState("");
    setContentDestinationsState([]);
    setRecentPillarHistoryState([]);
    setAll32HooksState([]);
    const uid = getEffectiveUid();
    if (uid) {
      try {
        localStorage.removeItem(`threads_attention_posts_${uid}`);
        localStorage.removeItem(`threads_trust_posts_${uid}`);
        localStorage.removeItem(`threads_sales_posts_${uid}`);
        localStorage.removeItem(`threads_custom_instruction_${uid}`);
        localStorage.removeItem(`threads_cta_preferences_${uid}`);
        localStorage.removeItem(`threads_content_destinations_${uid}`);
        localStorage.removeItem(`threads_raw_creator_thought_${uid}`);
        localStorage.removeItem(`threads_active_category_${uid}`);
        localStorage.removeItem(`threads_thread_length_${uid}`);
        localStorage.removeItem(`threads_sentences_per_part_${uid}`);
        localStorage.removeItem(`threads_posts_to_create_${uid}`);
        localStorage.removeItem(`threads_simulation_warning_${uid}`);
        localStorage.removeItem(`threads_active_idea_${uid}`);
        localStorage.removeItem(`threads_active_cta_${uid}`);
        localStorage.removeItem(`threads_pillar_history_${uid}`);
        localStorage.removeItem(`threads_all_32_hooks_${uid}`);
      } catch (e) {
        console.warn("LocalStorage clear failure:", e);
      }
    }
  };

  return (
    <ContentPersistenceContext.Provider
      value={{
        attentionPosts,
        setAttentionPosts,
        trustPosts,
        setTrustPosts,
        salesPosts,
        setSalesPosts,
        customInstruction,
        setCustomInstruction,
        ctaPreferences,
        setCtaPreferences,
        contentDestinations,
        setContentDestinations,
        activeCategory,
        setActiveCategory,
        simulationWarning,
        setSimulationWarning,
        lockedHook,
        setLockedHook,
        threadLength,
        setThreadLength,
        sentencesPerPart,
        setSentencesPerPart,
        postsToCreate,
        setPostsToCreate,
        activeIdea,
        setActiveIdea,
        rawCreatorThought,
        setRawCreatorThought,
        activeCta,
        setActiveCta,
        recentPillarHistory,
        addPillarToHistory,
        all32Hooks,
        setAll32Hooks,
        areHooksActive,
        setAreHooksActive,
        strategicUnits,
        setStrategicUnits,
        activeStrategicAngle,
        setActiveStrategicAngle,
        strategicCreatorRequest,
        setStrategicCreatorRequest,
        areStrategicUnitsActive,
        setAreStrategicUnitsActive,
        clearStrategicPipeline,
        clearAll,
      }}
    >
      {children}
    </ContentPersistenceContext.Provider>
  );
};

export const useContentPersistence = () => {
  const context = useContext(ContentPersistenceContext);
  if (context === undefined) {
    throw new Error("useContentPersistence must be used within a ContentPersistenceProvider");
  }
  return context;
};
