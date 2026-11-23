/**
 * Safe browser storage helpers for embedded preview iframes (e.g. Google AI Studio)
 * where third-party storage partitioning or sandbox restrictions can cause
 * window.localStorage / window.sessionStorage access itself to throw SecurityError.
 */

export function safeGetLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveLocalStorage(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeGetSessionStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetSessionStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveSessionStorage(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function isBrowserStorageAvailable(kind: "local" | "session" = "local"): boolean {
  if (typeof window === "undefined") return false;
  const probeKey = "__threadsworks_storage_probe__";
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    store.setItem(probeKey, "1");
    store.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}
