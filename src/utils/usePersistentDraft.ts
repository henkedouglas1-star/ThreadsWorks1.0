import { useState, useEffect, useRef } from "react";
import { auth } from "../firebase";

/**
 * A reusable hook to automatically persist and restore transient user inputs/state.
 * Drafts are strictly scoped by user ID, feature key, and field key to prevent collisions
 * and ensure complete isolation between authenticated accounts.
 */
export function usePersistentDraft<T>(
  featureKey: string,
  fieldKey: string,
  defaultValue: T
): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);

  // Monitor Firebase authentication state to dynamically re-scope the storage key
  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
  }, []);

  const userId = currentUser?.uid || "anonymous";
  const storageKey = `threadsworks:draft:${userId}:${featureKey}:${fieldKey}`;

  // Eagerly read the initial value from localStorage if available, ensuring zero-flash hydration
  const [state, setStateState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) return JSON.parse(saved);
      return defaultValue;
    } catch (e) {
      console.warn(`[PersistentDraft] Error reading key "${storageKey}":`, e);
      return defaultValue;
    }
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  // Re-hydrate the state strictly for the active user (logout/login/account switch)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const targetVal = JSON.parse(saved);
        if (JSON.stringify(stateRef.current) !== JSON.stringify(targetVal)) {
          setStateState(targetVal);
        }
      } else if (JSON.stringify(stateRef.current) !== JSON.stringify(defaultValueRef.current)) {
        setStateState(defaultValueRef.current);
      }
    } catch (e) {
      console.warn(`[PersistentDraft] Error re-hydrating key "${storageKey}":`, e);
      setStateState(defaultValueRef.current);
    }
  }, [userId, storageKey]);

  // Synchronize state value to browser localStorage
  const setState = (valueOrUpdater: T | ((prev: T) => T)) => {
    setStateState((prev) => {
      const next = typeof valueOrUpdater === "function"
        ? (valueOrUpdater as (p: T) => T)(prev)
        : valueOrUpdater;
      
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn(`[PersistentDraft] Error writing key "${storageKey}":`, e);
        }
      }
      return next;
    });
  };

  // Explicitly clear the draft when requested by completed workflows or intentional UI reset actions
  const clearDraft = () => {
    setStateState(defaultValue);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn(`[PersistentDraft] Error deleting key "${storageKey}":`, e);
      }
    }
  };

  return [state, setState, clearDraft];
}
