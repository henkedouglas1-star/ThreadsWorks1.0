import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from "firebase/auth";
import { initializeFirestore, memoryLocalCache, doc, getDoc, setDoc, setLogLevel, Timestamp } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import {
  configureAuthPersistenceWithFallback,
  type AuthPersistenceMode,
  type AuthPersistenceResult,
} from "./lib/authContract";
import {
  detectEmbeddedPreviewContext,
  logAuthDiagnostic,
  maskUidForDiagnostics,
} from "./lib/authDiagnostics";
import { isBrowserStorageAvailable } from "./lib/safeStorage";

// Silence internal Firestore SDK diagnostic logs
setLogLevel("silent");

// Filter out internal benign BloomFilter SDK notices and closing IDBDatabase events from console logging methods
if (typeof window !== "undefined") {
  const isBenignSystemError = (...args: any[]) => {
    try {
      const msg = args.map((a) => {
        if (a === null || a === undefined) return "";
        if (typeof a === "object") {
          return (a.name || "") + " " + (a.message || "") + " " + (a.stack || "") + " " + JSON.stringify(a);
        }
        return String(a);
      }).join(" ");
      return msg.includes("BloomFilter") || 
             msg.includes("BloomFilterError") || 
             msg.includes("Invalid hash count") || 
             msg.includes("Applying bloom filter failed") ||
             msg.includes("database connection is closing") ||
             msg.includes("Failed to execute 'transaction' on 'IDBDatabase'") ||
             msg.includes("IDBDatabase");
    } catch {
      return false;
    }
  };

  const origError = console.error;
  console.error = (...args: any[]) => {
    if (isBenignSystemError(...args)) return;
    origError.apply(console, args);
  };

  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (isBenignSystemError(...args)) return;
    origWarn.apply(console, args);
  };

  // Intercept window unhandled rejection and error events for closing IDBDatabase connections
  window.addEventListener("error", (event) => {
    const errorMsg = event.message || (event.error && (event.error.message || String(event.error))) || "";
    if (
      errorMsg.includes("database connection is closing") ||
      errorMsg.includes("Failed to execute 'transaction' on 'IDBDatabase'") ||
      errorMsg.includes("IDBDatabase")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reasonMsg = event.reason?.message || String(event.reason || "");
    if (
      reasonMsg.includes("database connection is closing") ||
      reasonMsg.includes("Failed to execute 'transaction' on 'IDBDatabase'") ||
      reasonMsg.includes("IDBDatabase")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

const previewContext = detectEmbeddedPreviewContext();
logAuthDiagnostic("firebase_init_start", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  inIframe: previewContext.inIframe,
  isCrossOriginParent: previewContext.isCrossOriginParent,
  hostname: previewContext.hostname,
});

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

interface ResolvedPersistenceHierarchy {
  persistences: Array<
    typeof browserLocalPersistence | typeof browserSessionPersistence | typeof inMemoryPersistence
  >;
  selectedMode: AuthPersistenceMode;
  fallbackUsed: boolean;
  localAvailable: boolean;
  sessionAvailable: boolean;
  errors: string[];
}

/**
 * Synchronously probes browser storage BEFORE initializing Firebase Auth so
 * initializeAuth() receives only verified working storage layers in priority order
 * (local -> session -> in-memory) and NEVER needs a redundant async setPersistence()
 * mutation at startup that can race onAuthStateChanged or signInWithPopup.
 */
function resolveVerifiedPersistenceHierarchy(): ResolvedPersistenceHierarchy {
  if (typeof window === "undefined") {
    return {
      persistences: [inMemoryPersistence],
      selectedMode: "memory",
      fallbackUsed: false,
      localAvailable: false,
      sessionAvailable: false,
      errors: [],
    };
  }

  const localAvailable = isBrowserStorageAvailable("local");
  const sessionAvailable = isBrowserStorageAvailable("session");
  const errors: string[] = [];
  const persistences: ResolvedPersistenceHierarchy["persistences"] = [];

  if (localAvailable && browserLocalPersistence) {
    persistences.push(browserLocalPersistence);
  } else {
    errors.push("local: browser localStorage unavailable or blocked in this window");
  }

  if (sessionAvailable && browserSessionPersistence) {
    persistences.push(browserSessionPersistence);
  } else {
    errors.push("session: browser sessionStorage unavailable or blocked in this window");
  }

  // Always retain in-memory persistence as the final guaranteed fallback
  if (inMemoryPersistence) {
    persistences.push(inMemoryPersistence);
  }

  const selectedMode: AuthPersistenceMode =
    localAvailable && browserLocalPersistence
      ? "local"
      : sessionAvailable && browserSessionPersistence
      ? "session"
      : "memory";

  return {
    persistences,
    selectedMode,
    fallbackUsed: selectedMode !== "local",
    localAvailable,
    sessionAvailable,
    errors,
  };
}

const initialPersistenceResolution = resolveVerifiedPersistenceHierarchy();

/**
 * Initialize a single authoritative Firebase Auth instance without IndexedDB persistence
 * (which frequently stalls or closes in cross-origin preview iframes like Google AI Studio)
 * and with verified ordered persistence fallback:
 * browserLocalPersistence -> browserSessionPersistence -> inMemoryPersistence.
 */
function createAuthoritativeAuth(): Auth {
  if (typeof window === "undefined") {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: initialPersistenceResolution.persistences,
      ...(browserPopupRedirectResolver
        ? { popupRedirectResolver: browserPopupRedirectResolver }
        : {}),
    });
  } catch {
    // Auth was already initialized for this Firebase app instance (e.g. module reload)
    return getAuth(app);
  }
}

const authInstanceId = `auth_inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
export const auth: Auth = createAuthoritativeAuth();
export const resolvedAuthPersistenceMode: AuthPersistenceMode =
  initialPersistenceResolution.selectedMode;

export function getFirebaseAuthDiagnosticsMeta() {
  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    firebaseAppCount: getApps().length,
    authInstanceId,
    persistenceMode: initialPersistenceResolution.selectedMode,
    fallbackUsed: initialPersistenceResolution.fallbackUsed,
    localStorageAvailable: initialPersistenceResolution.localAvailable,
    sessionStorageAvailable: initialPersistenceResolution.sessionAvailable,
    hasLiveCurrentUser: Boolean(auth.currentUser?.uid),
    liveCurrentUserUidHint: maskUidForDiagnostics(auth.currentUser?.uid),
  };
}

logAuthDiagnostic("persistence_resolved", {
  mode: initialPersistenceResolution.selectedMode,
  fallbackUsed: initialPersistenceResolution.fallbackUsed,
  localAvailable: initialPersistenceResolution.localAvailable,
  sessionAvailable: initialPersistenceResolution.sessionAvailable,
  firebaseAppCount: getApps().length,
  authInstanceId,
  inIframe: previewContext.inIframe,
  errorCount: initialPersistenceResolution.errors.length,
});

/**
 * Explicit helper for changing Auth persistence with ordered fallback.
 * Not invoked automatically at module startup (initializeAuth already sets the
 * verified hierarchy once) so startup never races signInWithPopup or wipes a session.
 */
export function configureAuthPersistence(authInstance: Auth = auth): Promise<AuthPersistenceResult> {
  return configureAuthPersistenceWithFallback(authInstance, setPersistence, {
    local: browserLocalPersistence,
    session: browserSessionPersistence,
    memory: inMemoryPersistence,
  });
}

// Resolves once Firebase Auth completes its own initial persistence hydration via authStateReady()
// without mutating persistence mid-session or throwing when browser storage is blocked.
export const authPersistenceReady: Promise<AuthPersistenceResult> =
  typeof window !== "undefined"
    ? (typeof (auth as any).authStateReady === "function"
        ? auth.authStateReady()
        : Promise.resolve()
      )
        .then(() => {
          const result: AuthPersistenceResult = {
            mode: initialPersistenceResolution.selectedMode,
            fallbackUsed: initialPersistenceResolution.fallbackUsed,
            errors: initialPersistenceResolution.errors,
          };
          logAuthDiagnostic("firebase_init_complete", {
            persistenceMode: result.mode,
            fallbackUsed: result.fallbackUsed,
            hasInitialUser: Boolean(auth.currentUser?.uid),
            uidHint: maskUidForDiagnostics(auth.currentUser?.uid),
          });
          return result;
        })
        .catch((err) => {
          const msg = err?.code || err?.message || String(err);
          const result: AuthPersistenceResult = {
            mode: "memory",
            fallbackUsed: true,
            errors: [...initialPersistenceResolution.errors, `authStateReady: ${msg}`],
          };
          logAuthDiagnostic(
            "firebase_init_complete",
            {
              persistenceMode: result.mode,
              fallbackUsed: true,
              authStateReadyError: msg,
              hasInitialUser: Boolean(auth.currentUser?.uid),
            },
            { category: "firebase_session_persistence_failure", level: "warn" }
          );
          return result;
        })
    : Promise.resolve({ mode: "memory", fallbackUsed: false, errors: [] });

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: memoryLocalCache(),
}, (firebaseConfig as any).firestoreDatabaseId || "(default)");

/**
 * Ensures a base user and settings profile exist in Firestore for Google authenticated users
 */
export async function ensureGoogleUserProfile(user: any) {
  if (!user || !user.uid) return;
  try {
    const docRef = doc(db, "users", user.uid);
    let docSnap: any = null;
    try {
      docSnap = await withTimeout(getDoc(docRef), 3000, true);
    } catch (getErr) {
      console.warn("Could not check existing Firestore profile:", getErr);
    }
    const snapExists = Boolean(docSnap && typeof docSnap.exists === "function" && docSnap.exists());
    if (!snapExists) {
      try {
        const defaultProfile = {
          uid: user.uid,
          email: user.email || "",
          offer: "",
          audience: "",
          desiredResult: "",
          writingStyle: "Direct, practical, conversational",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await withTimeout(setDoc(docRef, defaultProfile), 3000, true);
        await withTimeout(setDoc(doc(db, "settings", user.uid), {
          offer: "",
          audience: "",
          desiredResult: "",
          writingStyle: "Direct, practical, conversational"
        }), 3000, true);
      } catch (dbErr) {
        console.warn("Could not initialize default profile in Firestore:", dbErr);
      }
    }
  } catch (err) {
    console.warn("ensureGoogleUserProfile error:", err);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded = 
    errMsg.includes("Quota limit exceeded") ||
    errMsg.includes("quota metric") ||
    errMsg.includes("Free daily read units") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.includes("resource-exhausted") ||
    errMsg.includes("exceeded quota");

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaExceeded) {
    console.warn("[FIRESTORE_OFFLINE_FALLBACK] Free daily read quota reached; using local storage offline fallback for:", path);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

/**
 * Recursively strips undefined fields from an object or array before persisting to Firestore.
 * Firestore rejects documents containing undefined fields.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== "object") {
    return data;
  }
  // Preserve Date instances
  if (data instanceof Date) {
    return data;
  }
  // Preserve Firestore Timestamp instances or duck-typed Timestamps
  if (
    data instanceof Timestamp ||
    typeof (data as any).toMillis === "function" ||
    typeof (data as any).toDate === "function" ||
    (data as any).constructor?.name === "Timestamp" ||
    (data as any)._nanoseconds !== undefined
  ) {
    return data;
  }
  // Reconstruct Timestamp if it is a plain serialized timestamp object
  if (
    typeof (data as any).seconds === "number" &&
    typeof (data as any).nanoseconds === "number" &&
    Object.keys(data).length <= 2
  ) {
    return new Timestamp((data as any).seconds, (data as any).nanoseconds) as any;
  }
  // Preserve Firestore FieldValue sentinels (e.g. serverTimestamp, deleteField, etc.)
  if (
    (data as any)._methodName ||
    (data as any).constructor?.name === "FieldValue" ||
    typeof (data as any).isEqual === "function"
  ) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

/**
 * Promise timeout race wrapper to prevent Firestore operations from hanging indefinitely in offline/iframe proxies.
 */
export async function withTimeout<T>(promise: Promise<T>, ms = 4000, resolveOnTimeout = false): Promise<T> {
  let timeoutId: any;
  const timeoutMs = ms > 0 ? ms : 4000;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (resolveOnTimeout) {
        console.warn(`Firestore operation timed out after ${timeoutMs}ms, resolving with fallback.`);
        resolve(null as any);
      } else {
        reject(new Error(`Firestore database connection timed out after ${timeoutMs}ms (offline fallbacks active).`));
      }
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

