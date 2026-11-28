import "./setupDom";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React, { act, useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";

import {
  AUTH_SIGNOUT_EVENT,
  AuthUserLike,
  configureAuthPersistenceWithFallback,
  createInitialAuthSessionState,
  getAuthPortalModeFromSearch,
  getSafePostAuthRedirectFromSearch,
  isContentPaysUsInfoPath,
  isContentPaysUsPublicPath,
  reduceAuthSession,
  resolveAppScreen,
} from "../src/lib/authContract";
import {
  clearAuthDiagnosticsForTests,
  getAuthDiagnosticsSnapshot,
  logAuthDiagnostic,
} from "../src/lib/authDiagnostics";
import {
  createPreviewAuthHandoffStore,
  isPreviewAuthHandoffEnvironment,
  sha256Hex,
} from "../server/previewAuthHandoff";
import { useAuthSession, type AuthSessionAdapter } from "../src/hooks/useAuthSession";
import AuthScreen, { type AuthScreenActions } from "../src/components/AuthScreen";
import { getPublicMarketingRoute, normalizeMarketingPath } from "../src/marketing/marketingRoutes";

// Enable React 19 act() support in Node + happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

interface MockFirebaseAuthHarness {
  currentUser: AuthUserLike | null;
  listeners: Set<{
    onNext: (user: AuthUserLike | null) => void;
    onError: (err: unknown) => void;
  }>;
  emitUser: (user: AuthUserLike | null) => void;
  emitRawObserverEvent: (user: AuthUserLike | null) => void;
  emitError: (err: unknown) => void;
  signOut: () => Promise<void>;
  createAdapter: (overrides?: Partial<AuthSessionAdapter>) => AuthSessionAdapter;
}

function createMockFirebaseAuthHarness(initialUser: AuthUserLike | null = null): MockFirebaseAuthHarness {
  const harness: MockFirebaseAuthHarness = {
    currentUser: initialUser,
    listeners: new Set(),
    emitUser(user) {
      harness.currentUser = user;
      for (const listener of Array.from(harness.listeners)) {
        listener.onNext(user);
      }
    },
    // Emits an observer callback WITHOUT modifying currentUser (simulates delayed/stale observer ticks)
    emitRawObserverEvent(user) {
      for (const listener of Array.from(harness.listeners)) {
        listener.onNext(user);
      }
    },
    emitError(err) {
      for (const listener of Array.from(harness.listeners)) {
        listener.onError(err);
      }
    },
    async signOut() {
      harness.currentUser = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AUTH_SIGNOUT_EVENT));
      }
      for (const listener of Array.from(harness.listeners)) {
        listener.onNext(null);
      }
    },
    createAdapter(overrides = {}) {
      return {
        getCurrentUser: () => harness.currentUser,
        subscribeAuthState: (onNext, onError) => {
          const entry = { onNext, onError };
          harness.listeners.add(entry);
          return () => {
            harness.listeners.delete(entry);
          };
        },
        initTimeoutMs: 5000,
        recentSignInGraceMs: 4000,
        ...overrides,
      };
    },
  };
  return harness;
}

interface MountedHarness {
  window: Window;
  container: HTMLElement;
  root: Root;
  historyCalls: Array<{ method: "pushState" | "replaceState"; url: string }>;
  unmount: () => Promise<void>;
}

async function mountTestApp(options: {
  initialUrl?: string;
  adapter: AuthSessionAdapter;
  authActions: AuthScreenActions;
  onSignOut: () => Promise<void>;
  blockBrowserStorage?: boolean;
}): Promise<MountedHarness> {
  const domWindow = new Window({ url: options.initialUrl || "https://preview.local/create" });
  const historyCalls: Array<{ method: "pushState" | "replaceState"; url: string }> = [];

  const origPushState = domWindow.history.pushState.bind(domWindow.history);
  const origReplaceState = domWindow.history.replaceState.bind(domWindow.history);
  domWindow.history.pushState = (data: any, unused: string, url?: string | URL | null) => {
    historyCalls.push({ method: "pushState", url: String(url || "") });
    return origPushState(data, unused, url);
  };
  domWindow.history.replaceState = (data: any, unused: string, url?: string | URL | null) => {
    historyCalls.push({ method: "replaceState", url: String(url || "") });
    return origReplaceState(data, unused, url);
  };

  if (options.blockBrowserStorage) {
    const denyStorage = () => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    };
    Object.defineProperty(domWindow, "localStorage", {
      configurable: true,
      get: denyStorage,
    });
    Object.defineProperty(domWindow, "sessionStorage", {
      configurable: true,
      get: denyStorage,
    });
  }

  // Bind happy-dom globals for React 19 + AuthScreen + useAuthSession
  (globalThis as any).window = domWindow;
  (globalThis as any).document = domWindow.document;
  (globalThis as any).HTMLElement = domWindow.HTMLElement;
  (globalThis as any).HTMLInputElement = domWindow.HTMLInputElement;
  (globalThis as any).HTMLTextAreaElement = domWindow.HTMLTextAreaElement;
  (globalThis as any).Element = domWindow.Element;
  (globalThis as any).Node = domWindow.Node;
  (globalThis as any).Event = domWindow.Event;
  (globalThis as any).InputEvent = domWindow.InputEvent;
  (globalThis as any).CustomEvent = domWindow.CustomEvent;
  (globalThis as any).PopStateEvent = domWindow.PopStateEvent;
  (globalThis as any).MutationObserver = domWindow.MutationObserver;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: domWindow.navigator,
  });

  function ObservableAuthShell() {
    const {
      status: authStatus,
      user,
      authError,
      profile,
      notifyLoginSuccess,
    } = useAuthSession(options.adapter);

    const [currentPath, setCurrentPath] = useState<string>(() =>
      normalizeMarketingPath(window.location.pathname)
    );
    const [authPortalMode, setAuthPortalMode] = useState<"signin" | "signup" | null>(() =>
      getAuthPortalModeFromSearch(window.location.search)
    );
    const [activeTab, setActiveTab] = useState<string>(() =>
      normalizeMarketingPath(window.location.pathname) === "/workspace" ? "apps" : "engine"
    );

    const navigateTab = (tab: string) => {
      const map: Record<string, string> = {
        engine: "/create",
        apps: "/apps",
        calendar: "/calendar",
        analytics: "/analytics",
        profile: "/profile",
      };
      const nextPath = map[tab] || "/create";
      setActiveTab(tab);
      setCurrentPath(nextPath);
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath);
      }
    };

    useEffect(() => {
      const handlePopState = () => {
        const path = normalizeMarketingPath(window.location.pathname);
        setCurrentPath(path);
        setAuthPortalMode(getAuthPortalModeFromSearch(window.location.search));
      };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Mirrors App.tsx authenticated root redirect without mutating unauthenticated '/' or '/workspace'
    useEffect(() => {
      if (authStatus !== "authenticated" || !user) return;
      if (currentPath === "/" || currentPath === "") {
        const safeNext = getSafePostAuthRedirectFromSearch(window.location.search);
        const target = safeNext || "/create";
        setCurrentPath(target);
        setActiveTab(target === "/workspace" ? "apps" : "engine");
        if (`${window.location.pathname}${window.location.search}` !== target) {
          window.history.replaceState(null, "", target);
        }
      }
    }, [authStatus, user, currentPath]);

    const publicMarketingRoute = useMemo(
      () => getPublicMarketingRoute(currentPath),
      [currentPath]
    );

    const screen = resolveAppScreen({
      authStatus,
      user,
      handshakeStatus: null,
      isPublicMarketingRoute: Boolean(publicMarketingRoute) || isContentPaysUsPublicPath(currentPath),
      authPortalMode,
    });

    if (screen === "marketing") {
      return React.createElement(
        "div",
        { id: "marketing-screen" },
        React.createElement(
          "button",
          {
            id: "marketing-signin-btn",
            type: "button",
            onClick: () => setAuthPortalMode("signin"),
          },
          "Sign In"
        )
      );
    }

    if (screen === "loading") {
      return React.createElement(
        "div",
        { id: "auth-loading-screen" },
        "Loading ThreadsWorks session..."
      );
    }

    if (screen === "auth" || !user) {
      return React.createElement(AuthScreen, {
        initialMode: authPortalMode || "signin",
        externalError: authError,
        authActions: options.authActions,
        onSuccess: (authenticatedUser) => {
          notifyLoginSuccess(authenticatedUser);
          setAuthPortalMode(null);
        },
      });
    }

    return React.createElement(
      "div",
      { id: "workspace-dashboard", "data-uid": user.uid, "data-tab": activeTab },
      React.createElement("span", { id: "workspace-user-email" }, user.email || ""),
      React.createElement("span", { id: "workspace-profile-uid" }, profile?.uid || ""),
      React.createElement(
        "nav",
        { id: "workspace-nav" },
        React.createElement("button", { id: "nav-engine", type: "button", onClick: () => navigateTab("engine") }, "Content"),
        React.createElement("button", { id: "nav-apps", type: "button", onClick: () => navigateTab("apps") }, "Workspace"),
        React.createElement("button", { id: "nav-calendar", type: "button", onClick: () => navigateTab("calendar") }, "Calendar"),
        React.createElement("button", { id: "nav-analytics", type: "button", onClick: () => navigateTab("analytics") }, "Analytics"),
        React.createElement("button", { id: "nav-profile", type: "button", onClick: () => navigateTab("profile") }, "Profile")
      ),
      React.createElement(
        "button",
        {
          id: "topnav-logout-button",
          type: "button",
          onClick: () => {
            void options.onSignOut();
          },
        },
        "Logout"
      )
    );
  }

  const rawContainer = domWindow.document.createElement("div");
  domWindow.document.body.appendChild(rawContainer);
  const container = rawContainer as unknown as HTMLDivElement;
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(ObservableAuthShell));
  });

  return {
    window: domWindow,
    container,
    root,
    historyCalls,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      await domWindow.happyDOM.close();
    },
  };
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const inputProto = (globalThis as any).window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(inputProto, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(input, value);
  } else {
    input.value = value;
  }
  const DomEvent = (globalThis as any).window.Event;
  input.dispatchEvent(new DomEvent("input", { bubbles: true }));
  input.dispatchEvent(new DomEvent("change", { bubbles: true }));
}

async function flushMicrotasks() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

test("1. Authentication state during loading cleanly distinguishes loading, unauthenticated, and authenticated screens", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter(),
    authActions: {},
    onSignOut: firebase.signOut,
  });

  try {
    // Initially loading while Firebase Auth observer has not resolved
    assert.ok(app.container.querySelector("#auth-loading-screen"), "Must render loading screen while resolving auth");
    assert.equal(app.container.querySelector("#workspace-dashboard"), null, "Must never mount dashboard while loading");
    assert.equal(app.container.querySelector("#auth-card"), null, "Must not render auth card while loading protected route");

    // Firebase resolves unauthenticated
    await act(async () => {
      firebase.emitUser(null);
    });

    assert.equal(app.container.querySelector("#auth-loading-screen"), null);
    assert.ok(app.container.querySelector("#auth-card"), "Must transition cleanly to login screen once unauthenticated");
    assert.equal(app.container.querySelector("#workspace-dashboard"), null);
  } finally {
    await app.unmount();
  }
});

test("2. Successful Google popup authentication transitions from AuthScreen to dashboard", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const googleUser: AuthUserLike = { uid: "google-uid-1", email: "creator@threadsworks.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter({
      fetchProfile: async (uid, email) => ({
        uid,
        email,
        offer: "Threads Strategy",
        audience: "Creators",
        desiredResult: "Growth",
        writingStyle: "Direct",
      }),
    }),
    authActions: {
      waitForPersistence: async () => ({ mode: "local" }),
      signInWithGooglePopup: async () => {
        firebase.currentUser = googleUser;
        return { user: googleUser };
      },
      ensureGoogleProfile: async () => {},
    },
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(null);
    });
    const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement | null;
    assert.ok(googleBtn, "Google sign-in button must be rendered on AuthScreen");

    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();

    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Successful Google sign-in must transition immediately to the workspace dashboard");
    assert.equal(dashboard.getAttribute("data-uid"), "google-uid-1");
    assert.equal(app.container.querySelector("#workspace-user-email")?.textContent, "creator@threadsworks.com");
    assert.equal(app.container.querySelector("#auth-card"), null, "AuthScreen must unmount after login");
  } finally {
    await app.unmount();
  }
});

test("3. Successful Email/Password authentication transitions from AuthScreen to dashboard", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const emailUser: AuthUserLike = { uid: "email-uid-2", email: "founder@example.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter(),
    authActions: {
      waitForPersistence: async () => ({ mode: "local" }),
      signInWithEmail: async (email, password) => {
        assert.equal(email, "founder@example.com");
        assert.equal(password, "StrongPass123!");
        firebase.currentUser = emailUser;
        return { user: emailUser };
      },
    },
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(null);
    });

    const emailInput = app.container.querySelector("#auth-email-input") as HTMLInputElement;
    const passwordInput = app.container.querySelector("#auth-password-input") as HTMLInputElement;
    const form = app.container.querySelector("form") as HTMLFormElement;
    assert.ok(emailInput && passwordInput && form);

    await act(async () => {
      setReactInputValue(emailInput, "founder@example.com");
      setReactInputValue(passwordInput, "StrongPass123!");
    });

    await act(async () => {
      const DomEvent = (globalThis as any).window.Event;
      form.dispatchEvent(new DomEvent("submit", { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Successful Email/Password sign-in must transition to dashboard");
    assert.equal(dashboard.getAttribute("data-uid"), "email-uid-2");
    assert.equal(app.container.querySelector("#workspace-user-email")?.textContent, "founder@example.com");
  } finally {
    await app.unmount();
  }
});

test("4. Initial Firebase session restoration opens dashboard directly without flashing login", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const restoredUser: AuthUserLike = { uid: "restored-uid-3", email: "returning@threadsworks.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter(),
    authActions: {},
    onSignOut: firebase.signOut,
  });

  try {
    assert.ok(app.container.querySelector("#auth-loading-screen"));
    assert.equal(app.container.querySelector("#auth-card"), null);

    await act(async () => {
      firebase.emitUser(restoredUser);
    });
    await flushMicrotasks();

    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Restored session must open dashboard directly");
    assert.equal(dashboard.getAttribute("data-uid"), "restored-uid-3");
    assert.equal(app.container.querySelector("#auth-card"), null);
  } finally {
    await app.unmount();
  }
});

test("5. Profile fetch and Firestore ensure failures NEVER force logout or block dashboard access", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const user: AuthUserLike = { uid: "firestore-fail-uid-4", email: "resilient@threadsworks.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter({
      ensureProfile: async () => {
        throw new Error("PERMISSION_DENIED: Firestore unavailable");
      },
      fetchProfile: async () => {
        throw new Error("RESOURCE_EXHAUSTED: Quota exceeded");
      },
    }),
    authActions: {
      waitForPersistence: async () => ({ mode: "local" }),
      signInWithGooglePopup: async () => {
        firebase.currentUser = user;
        return { user };
      },
      ensureGoogleProfile: async () => {
        throw new Error("Firestore offline");
      },
    },
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(null);
    });

    const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();

    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Dashboard must remain mounted even when Firestore profile sync rejects");
    assert.equal(dashboard.getAttribute("data-uid"), "firestore-fail-uid-4");
    assert.equal(app.container.querySelector("#workspace-profile-uid")?.textContent, "firestore-fail-uid-4");
    assert.equal(app.container.querySelector("#auth-card"), null, "Profile errors must never kick user back to login");
  } finally {
    await app.unmount();
  }
});

test("6. Browser persistence & storage unavailable in embedded preview still allows Google login -> dashboard", async () => {
  // Part A: Verify ordered persistence fallback local -> session -> memory never throws
  const attempted: string[] = [];
  const result = await configureAuthPersistenceWithFallback(
    {},
    async (_auth, persistence) => {
      attempted.push(persistence);
      if (persistence !== "MEMORY") {
        throw new Error(`auth/operation-not-supported-in-this-environment (${persistence})`);
      }
    },
    { local: "LOCAL", session: "SESSION", memory: "MEMORY" }
  );
  assert.deepEqual(attempted, ["LOCAL", "SESSION", "MEMORY"]);
  assert.equal(result.mode, "memory");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.errors.length, 2);

  // Part B: Mount real UI with window.localStorage & window.sessionStorage throwing SecurityError
  const firebase = createMockFirebaseAuthHarness(null);
  const previewUser: AuthUserLike = { uid: "preview-iframe-uid-5", email: "iframe@threadsworks.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    blockBrowserStorage: true,
    adapter: firebase.createAdapter(),
    authActions: {
      waitForPersistence: async () => result,
      signInWithGooglePopup: async () => {
        firebase.currentUser = previewUser;
        return { user: previewUser };
      },
      ensureGoogleProfile: async () => {},
    },
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(null);
    });

    const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    assert.ok(googleBtn);

    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();

    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Blocked iframe storage must NOT crash auth or return user to login");
    assert.equal(dashboard.getAttribute("data-uid"), "preview-iframe-uid-5");
    assert.equal(app.container.querySelector("#auth-card"), null);
  } finally {
    await app.unmount();
  }
});

test("7. Delayed stale null callbacks and duplicate auth callbacks do NOT bounce user back to login", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const user: AuthUserLike = { uid: "race-uid-6", email: "norace@threadsworks.com" };
  let profileFetchCount = 0;

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter({
      fetchProfile: async (uid, email) => {
        profileFetchCount += 1;
        return { uid, email, offer: "", audience: "", desiredResult: "", writingStyle: "" };
      },
    }),
    authActions: {
      waitForPersistence: async () => ({ mode: "memory" }),
      signInWithGooglePopup: async () => {
        firebase.currentUser = user;
        return { user };
      },
      ensureGoogleProfile: async () => {},
    },
    onSignOut: firebase.signOut,
  });

  try {
    // First transition to login screen
    await act(async () => {
      firebase.emitUser(null);
    });

    // Click Google Sign-In
    const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();
    assert.ok(app.container.querySelector("#workspace-dashboard"), "User must reach dashboard");

    // Simulate a delayed stale onAuthStateChanged(null) arriving right after popup login while Firebase holds currentUser
    await act(async () => {
      firebase.emitRawObserverEvent(null);
    });
    await flushMicrotasks();
    assert.ok(
      app.container.querySelector("#workspace-dashboard"),
      "Delayed stale null callback must NOT bounce authenticated user back to login"
    );
    assert.equal(app.container.querySelector("#auth-card"), null);

    // Simulate duplicate onAuthStateChanged(user) emissions
    await act(async () => {
      firebase.emitUser(user);
      firebase.emitUser(user);
    });
    await flushMicrotasks();
    assert.ok(app.container.querySelector("#workspace-dashboard"));
    assert.equal(profileFetchCount, 1, "Duplicate observer emissions for same uid must not spam profile fetches");
  } finally {
    await app.unmount();
  }
});

test("8. Correct sign-out behavior returns to login screen and supports subsequent re-login", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const user: AuthUserLike = { uid: "logout-uid-7", email: "cycle@threadsworks.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter(),
    authActions: {
      waitForPersistence: async () => ({ mode: "local" }),
      signInWithGooglePopup: async () => {
        firebase.currentUser = user;
        return { user };
      },
      ensureGoogleProfile: async () => {},
    },
    onSignOut: firebase.signOut,
  });

  try {
    // Initial login
    await act(async () => {
      firebase.emitUser(user);
    });
    await flushMicrotasks();
    assert.ok(app.container.querySelector("#workspace-dashboard"));

    // Click Logout button
    const logoutBtn = app.container.querySelector("#topnav-logout-button") as HTMLButtonElement;
    assert.ok(logoutBtn);
    await act(async () => {
      logoutBtn.click();
    });
    await flushMicrotasks();

    assert.equal(app.container.querySelector("#workspace-dashboard"), null, "Dashboard must unmount after sign-out");
    assert.ok(app.container.querySelector("#auth-card"), "Sign-out must return cleanly to login screen");

    // Subsequent re-login works cleanly
    const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();

    const dashboardAfterRelogin = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboardAfterRelogin, "Subsequent sign-in after logout must reach dashboard");
    assert.equal(dashboardAfterRelogin.getAttribute("data-uid"), "logout-uid-7");
  } finally {
    await app.unmount();
  }
});

test("9. No infinite login/dashboard redirects when starting on '/' marketing page -> login -> dashboard -> logout", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const user: AuthUserLike = { uid: "redirect-uid-8", email: "noroute-loop@threadsworks.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/",
    adapter: firebase.createAdapter(),
    authActions: {
      waitForPersistence: async () => ({ mode: "local" }),
      signInWithGooglePopup: async () => {
        firebase.currentUser = user;
        return { user };
      },
      ensureGoogleProfile: async () => {},
    },
    onSignOut: firebase.signOut,
  });

  try {
    // Unauthenticated on '/' should NOT rewrite URL or loop
    await act(async () => {
      firebase.emitUser(null);
    });
    assert.ok(app.container.querySelector("#marketing-screen"));
    assert.equal(app.historyCalls.length, 0, "Unauthenticated '/' must not mutate history state");

    // Open sign-in portal from marketing page
    const signInBtn = app.container.querySelector("#marketing-signin-btn") as HTMLButtonElement;
    await act(async () => {
      signInBtn.click();
    });
    assert.ok(app.container.querySelector("#auth-card"));

    // Authenticate with Google
    const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();

    assert.ok(app.container.querySelector("#workspace-dashboard"));
    assert.equal(app.window.location.pathname, "/create");
    assert.equal(app.historyCalls.length, 1, "Authenticated '/' -> '/create' must trigger exactly one replaceState");

    // Sign out lands on '/create' AuthScreen (not looping back to '/')
    const logoutBtn = app.container.querySelector("#topnav-logout-button") as HTMLButtonElement;
    await act(async () => {
      logoutBtn.click();
    });
    await flushMicrotasks();

    assert.ok(app.container.querySelector("#auth-card"));
    assert.equal(app.historyCalls.length, 1, "Sign-out must not cause extra redirect loops");
  } finally {
    await app.unmount();
  }
});

test("10. Authenticated user remains authenticated across tab navigation and browser popstate events", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const user: AuthUserLike = { uid: "nav-uid-9", email: "navigator@threadsworks.com" };

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter(),
    authActions: {},
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(user);
    });
    await flushMicrotasks();

    for (const [btnId, expectedTab, expectedPath] of [
      ["#nav-apps", "apps", "/apps"],
      ["#nav-calendar", "calendar", "/calendar"],
      ["#nav-analytics", "analytics", "/analytics"],
      ["#nav-profile", "profile", "/profile"],
      ["#nav-engine", "engine", "/create"],
    ] as const) {
      const btn = app.container.querySelector(btnId) as HTMLButtonElement;
      assert.ok(btn, `Expected nav button ${btnId}`);
      await act(async () => {
        btn.click();
      });
      const dashboard = app.container.querySelector("#workspace-dashboard");
      assert.ok(dashboard, `User must remain authenticated after navigating to ${expectedTab}`);
      assert.equal(dashboard.getAttribute("data-uid"), "nav-uid-9");
      assert.equal(dashboard.getAttribute("data-tab"), expectedTab);
      assert.equal(app.window.location.pathname, expectedPath);
    }

    // Browser back/forward popstate event must never drop authentication
    await act(async () => {
      app.window.history.pushState(null, "", "/calendar");
      app.window.dispatchEvent(new app.window.PopStateEvent("popstate"));
    });
    await flushMicrotasks();
    assert.ok(app.container.querySelector("#workspace-dashboard"), "PopState navigation must preserve authentication");
    assert.equal(app.container.querySelector("#auth-card"), null);
  } finally {
    await app.unmount();
  }
});

test("11. Genuine Firebase authentication failures render observable errors and never fake login success", async () => {
  const firebase = createMockFirebaseAuthHarness(null);

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter(),
    authActions: {
      waitForPersistence: async () => ({ mode: "local" }),
      signInWithGooglePopup: async () => {
        const err: any = new Error("Firebase: Error (auth/unauthorized-domain).");
        err.code = "auth/unauthorized-domain";
        throw err;
      },
      signInWithEmail: async () => {
        const err: any = new Error("Firebase: Error (auth/invalid-credential).");
        err.code = "auth/invalid-credential";
        throw err;
      },
    },
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(null);
    });

    // Google failure shows actionable unauthorized-domain message
    const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();

    const googleAlert = app.container.querySelector("#auth-error-banner");
    assert.ok(googleAlert, "Google auth failure must render observable alert banner");
    assert.match(googleAlert.textContent || "", /not authorized for Google Sign-In/i);
    assert.equal(app.container.querySelector("#workspace-dashboard"), null, "Failed auth must never open dashboard");

    // Email failure shows actionable credential message
    const emailInput = app.container.querySelector("#auth-email-input") as HTMLInputElement;
    const passwordInput = app.container.querySelector("#auth-password-input") as HTMLInputElement;
    const form = app.container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      setReactInputValue(emailInput, "wrong@example.com");
      setReactInputValue(passwordInput, "wrongpass");
    });
    await act(async () => {
      const DomEvent = (globalThis as any).window.Event;
      form.dispatchEvent(new DomEvent("submit", { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const emailAlert = app.container.querySelector("#auth-error-banner");
    assert.ok(emailAlert);
    assert.match(emailAlert.textContent || "", /Invalid email or password/i);
    assert.equal(app.container.querySelector("#workspace-dashboard"), null);
  } finally {
    await app.unmount();
  }
});

test("12. Protected Authentication Contract lock: production files enforce authoritative auth, persistence fallback, safe storage, and CI gating", () => {
  const rootDir = process.cwd();
  const firebaseSrc = fs.readFileSync(path.join(rootDir, "src", "firebase.ts"), "utf8");
  const appSrc = fs.readFileSync(path.join(rootDir, "src", "App.tsx"), "utf8");
  const authScreenSrc = fs.readFileSync(path.join(rootDir, "src", "components", "AuthScreen.tsx"), "utf8");
  const pkgSrc = fs.readFileSync(path.join(rootDir, "package.json"), "utf8");
  const ciSrc = fs.readFileSync(path.join(rootDir, ".github", "workflows", "threadsworks-validation.yml"), "utf8");

  // firebase.ts must use ordered non-IndexedDB persistence fallbacks + popup resolver
  assert.match(firebaseSrc, /initializeAuth\(/, "firebase.ts must initialize Auth with explicit persistence hierarchy");
  assert.match(firebaseSrc, /browserLocalPersistence/, "firebase.ts must include browserLocalPersistence");
  assert.match(firebaseSrc, /browserSessionPersistence/, "firebase.ts must include browserSessionPersistence");
  assert.match(firebaseSrc, /inMemoryPersistence/, "firebase.ts must include inMemoryPersistence fallback");
  assert.match(firebaseSrc, /browserPopupRedirectResolver/, "firebase.ts must configure browserPopupRedirectResolver");
  assert.match(firebaseSrc, /export const authPersistenceReady/, "firebase.ts must export authPersistenceReady");

  // App.tsx must route through useAuthSession + resolveAppScreen (no competing ad-hoc userRef overwrite)
  assert.match(appSrc, /useAuthSession\(/, "App.tsx must use authoritative useAuthSession hook");
  assert.match(appSrc, /resolveAppScreen\(/, "App.tsx must use resolveAppScreen to prevent redirect loops");
  assert.doesNotMatch(appSrc, /userRef\.current\s*=\s*firebaseUser/, "App.tsx must not clobber userRef before null-guard checks");

  // AuthScreen.tsx must await bounded persistence and format errors observably
  assert.match(authScreenSrc, /waitBoundedPersistence/, "AuthScreen must wait for bounded persistence resolution");
  assert.match(authScreenSrc, /formatFirebaseAuthError/, "AuthScreen must use formatFirebaseAuthError");
  assert.match(authScreenSrc, /id="auth-error-banner"/, "AuthScreen must render observable error banner");

  // package.json and CI must lock test:auth as a blocking validation command
  assert.match(pkgSrc, /"test:auth"\s*:\s*"tsx --test tests\/authRegression\.test\.ts"/);
  assert.match(ciSrc, /npm run test:auth/, "CI validation workflow must execute npm run test:auth");
});

test("13. Delayed Firebase authStateReady initialization never triggers premature redirect to login", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const restoredUser: AuthUserLike = { uid: "delayed-uid-13", email: "delayed@threadsworks.com" };
  let resolveReady!: () => void;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const app = await mountTestApp({
    initialUrl: "https://preview.local/apps",
    adapter: firebase.createAdapter({
      waitForAuthStateReady: () => readyPromise,
    }),
    authActions: {},
    onSignOut: firebase.signOut,
  });

  try {
    // Still initializing before authStateReady settles
    assert.ok(app.container.querySelector("#auth-loading-screen"), "Must hold loading screen during delayed init");
    assert.equal(app.container.querySelector("#auth-card"), null, "Must never flash login before authStateReady");

    // Premature transient null emitted before authStateReady settles must NOT route to login
    await act(async () => {
      firebase.emitRawObserverEvent(null);
    });
    await flushMicrotasks();
    assert.ok(app.container.querySelector("#auth-loading-screen"), "Transient startup null must not redirect to login");
    assert.equal(app.container.querySelector("#auth-card"), null);

    // Firebase finishes restoring user and settles authStateReady
    await act(async () => {
      firebase.currentUser = restoredUser;
      resolveReady();
      await readyPromise;
    });
    await flushMicrotasks();

    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Restored session after delayed authStateReady must open workspace");
    assert.equal(dashboard.getAttribute("data-uid"), "delayed-uid-13");
    assert.equal(app.window.location.pathname, "/apps", "Intended destination /apps must be preserved");
  } finally {
    await app.unmount();
  }
});

test("14. Popup cancellation and popup blocking produce recoverable errors and allow immediate retry", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const recoveredUser: AuthUserLike = { uid: "retry-uid-14", email: "retry@threadsworks.com" };
  let attempt = 0;

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter(),
    authActions: {
      signInWithGooglePopup: async () => {
        attempt += 1;
        if (attempt === 1) {
          const err: any = new Error("Firebase: Error (auth/popup-closed-by-user).");
          err.code = "auth/popup-closed-by-user";
          throw err;
        }
        if (attempt === 2) {
          const err: any = new Error("Firebase: Error (auth/popup-blocked).");
          err.code = "auth/popup-blocked";
          throw err;
        }
        firebase.currentUser = recoveredUser;
        return { user: recoveredUser };
      },
      ensureGoogleProfile: async () => {},
    },
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(null);
    });

    // Attempt 1: Popup canceled by user
    let googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();
    assert.match(app.container.querySelector("#auth-error-banner")?.textContent || "", /canceled/i);
    assert.equal(app.container.querySelector("#workspace-dashboard"), null);

    // Attempt 2: Popup blocked by browser
    googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();
    assert.match(app.container.querySelector("#auth-error-banner")?.textContent || "", /popup was blocked/i);
    assert.equal(app.container.querySelector("#workspace-dashboard"), null);

    // Attempt 3: User retries and succeeds cleanly
    googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
    await act(async () => {
      googleBtn.click();
    });
    await flushMicrotasks();
    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Retry after popup cancel/block must succeed and enter workspace");
    assert.equal(dashboard.getAttribute("data-uid"), "retry-uid-14");
  } finally {
    await app.unmount();
  }
});

test("15. Authoritative reducer protects authenticating state and preserves authenticated session on backend API errors", () => {
  // Starts in initializing state
  let state = createInitialAuthSessionState(null);
  assert.equal(state.status, "initializing");
  assert.equal(
    resolveAppScreen({
      authStatus: state.status,
      user: state.user,
      handshakeStatus: null,
      isPublicMarketingRoute: false,
      authPortalMode: null,
    }),
    "loading"
  );

  // Interactive Google sign-in enters authenticating state
  state = reduceAuthSession(state, { type: "AUTH_START", method: "google" });
  assert.equal(state.status, "authenticating");

  // Stale observer null during active popup MUST NOT clear authenticating state
  state = reduceAuthSession(state, {
    type: "OBSERVER_NULL",
    liveCurrentUser: null,
    recentSignInActive: false,
    authStateReady: true,
  });
  assert.equal(state.status, "authenticating", "In-flight authenticating popup must ignore stale observer null");

  // Firebase confirms authenticated user
  const realUser: AuthUserLike = { uid: "auth-uid-15", email: "creator@threadsworks.com" };
  state = reduceAuthSession(state, { type: "OBSERVER_USER", user: realUser });
  assert.equal(state.status, "authenticated");
  assert.equal(state.user?.uid, "auth-uid-15");

  // Rule B & F: Backend 401/403 authorization error MUST NOT log out the user or bounce to login
  state = reduceAuthSession(state, {
    type: "BACKEND_AUTH_ERROR",
    message: "Backend rejected request (403).",
  });
  assert.equal(state.status, "authenticated", "Backend API error must preserve authenticated status");
  assert.equal(state.user?.uid, "auth-uid-15", "Backend API error must keep active Firebase user");
  assert.equal(state.backendAuthError, "Backend rejected request (403).");
  assert.equal(
    resolveAppScreen({
      authStatus: state.status,
      user: state.user,
      handshakeStatus: null,
      isPublicMarketingRoute: false,
      authPortalMode: null,
    }),
    "workspace",
    "Backend API error must keep user inside workspace rather than looping to login"
  );
});

test("16. Stale asynchronous profile fetches from a prior session epoch cannot overwrite a newer authenticated user", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const userA: AuthUserLike = { uid: "user-A", email: "a@threadsworks.com" };
  const userB: AuthUserLike = { uid: "user-B", email: "b@threadsworks.com" };

  let resolveUserAProfile!: (value: any) => void;
  const userAProfilePromise = new Promise<any>((resolve) => {
    resolveUserAProfile = resolve;
  });

  const app = await mountTestApp({
    initialUrl: "https://preview.local/create",
    adapter: firebase.createAdapter({
      fetchProfile: async (uid, email) => {
        if (uid === "user-A") {
          return userAProfilePromise;
        }
        return {
          uid,
          email,
          offer: "User B Offer",
          audience: "Creators",
          desiredResult: "Growth",
          writingStyle: "Direct",
        };
      },
    }),
    authActions: {},
    onSignOut: firebase.signOut,
  });

  try {
    // Sign in as user A (slow profile fetch still pending)
    await act(async () => {
      firebase.emitUser(userA);
    });
    await flushMicrotasks();
    assert.equal(app.container.querySelector("#workspace-dashboard")?.getAttribute("data-uid"), "user-A");

    // Sign out and immediately sign in as user B
    await act(async () => {
      await firebase.signOut();
    });
    await act(async () => {
      firebase.emitUser(userB);
    });
    await flushMicrotasks();
    assert.equal(app.container.querySelector("#workspace-dashboard")?.getAttribute("data-uid"), "user-B");
    assert.equal(app.container.querySelector("#workspace-profile-uid")?.textContent, "user-B");

    // Now resolve the stale profile request from user A
    await act(async () => {
      resolveUserAProfile({
        uid: "user-A",
        email: "a@threadsworks.com",
        offer: "STALE OFFER",
        audience: "Stale",
        desiredResult: "Stale",
        writingStyle: "Stale",
      });
      await userAProfilePromise;
    });
    await flushMicrotasks();

    // User B's session and profile must remain completely intact
    assert.equal(app.container.querySelector("#workspace-dashboard")?.getAttribute("data-uid"), "user-B");
    assert.equal(app.container.querySelector("#workspace-profile-uid")?.textContent, "user-B");
  } finally {
    await app.unmount();
  }
});

test("17. Security & GAS Preview invariants: no startup setPersistence race, no iframe signInWithRedirect, and diagnostics redact secrets/emails", () => {
  const rootDir = process.cwd();
  const firebaseSrc = fs.readFileSync(path.join(rootDir, "src", "firebase.ts"), "utf8");
  const authScreenSrc = fs.readFileSync(path.join(rootDir, "src", "components", "AuthScreen.tsx"), "utf8");
  const appSrc = fs.readFileSync(path.join(rootDir, "src", "App.tsx"), "utf8");

  // firebase.ts must NOT run configureAuthPersistence(auth) automatically at module load (races signInWithPopup)
  assert.doesNotMatch(
    firebaseSrc,
    /export const authPersistenceReady[\s\S]*configureAuthPersistence\(auth\)/,
    "firebase.ts must resolve persistence via initializeAuth + authStateReady without a redundant startup setPersistence race"
  );

  // AuthScreen must NEVER silently fall back to signInWithRedirect inside iframes
  assert.doesNotMatch(authScreenSrc, /signInWithRedirect/, "AuthScreen must not call signInWithRedirect inside embedded iframes");

  // App.tsx must sequence authStateReady() into useAuthSession
  assert.match(appSrc, /waitForAuthStateReady/, "App.tsx must wire auth.authStateReady() into useAuthSession");

  // Diagnostics MUST redact JWTs, access tokens, credentials, and full email addresses
  clearAuthDiagnosticsForTests();
  const entry = logAuthDiagnostic("google_popup_complete", {
    idToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature1234567890",
    accessToken: "ya29.secret-oauth-token",
    email: "douglas@threadsworks.com",
    note: "User douglas@threadsworks.com with token eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature1234567890",
    persistenceMode: "local",
  });
  assert.ok(entry, "Diagnostics should record structured entries in dev/test environments");
  const serialized = JSON.stringify(getAuthDiagnosticsSnapshot());
  assert.doesNotMatch(serialized, /douglas@threadsworks\.com/, "Diagnostics must never leak full email addresses");
  assert.doesNotMatch(serialized, /ya29\.secret-oauth-token/, "Diagnostics must never leak OAuth access tokens");
  assert.doesNotMatch(serialized, /signature1234567890/, "Diagnostics must never leak JWT/ID tokens");
  assert.match(serialized, /"persistenceMode":"local"/, "Safe non-sensitive diagnostic fields must be preserved");
});

test("18. AI Studio Preview Google handoff store enforces proof-of-possession, single-use claim, expiry, and production gating", () => {
  let fakeNow = 1_700_000_000_000;
  const store = createPreviewAuthHandoffStore({
    ttlMs: 180_000,
    readyTtlMs: 90_000,
    now: () => fakeNow,
  });

  const handoffId = "a".repeat(48);
  const claimSecret = "b".repeat(48);
  const wrongSecret = "c".repeat(48);
  const claimHash = sha256Hex(claimSecret);

  // Disabled in standalone production without AI Studio preview environment variables
  assert.equal(
    isPreviewAuthHandoffEnvironment({ NODE_ENV: "production" }),
    false,
    "Preview handoff must be disabled in standalone production"
  );
  assert.equal(
    isPreviewAuthHandoffEnvironment({ NODE_ENV: "development" }),
    true,
    "Preview handoff should be enabled in dev/preview environments"
  );

  // Init & pending state
  assert.deepEqual(store.init(handoffId, claimHash), { ok: true });
  assert.deepEqual(store.claim(handoffId, wrongSecret), { status: "forbidden" });
  assert.deepEqual(store.claim(handoffId, claimSecret), { status: "pending" });

  // Complete with verified real OAuth credential
  assert.deepEqual(
    store.complete(handoffId, {
      uid: "real-google-uid-18",
      googleIdToken: "google-id-token-value",
      googleAccessToken: "google-access-token-value",
    }),
    { ok: true }
  );

  // Wrong secret still rejected even when ready
  assert.deepEqual(store.claim(handoffId, wrongSecret), { status: "forbidden" });

  // Valid claim succeeds exactly once and immediately deletes the record
  assert.deepEqual(store.claim(handoffId, claimSecret), {
    status: "ready",
    googleIdToken: "google-id-token-value",
    googleAccessToken: "google-access-token-value",
  });
  assert.deepEqual(
    store.claim(handoffId, claimSecret),
    { status: "expired" },
    "Single-use handoff must not allow replay after claim"
  );

  // Expiry check
  const expiringId = "d".repeat(48);
  const expiringSecret = "e".repeat(48);
  assert.deepEqual(store.init(expiringId, sha256Hex(expiringSecret)), { ok: true });
  fakeNow += 181_000;
  assert.deepEqual(store.claim(expiringId, expiringSecret), { status: "expired" });
});

test("19. Preview handoff resume runner survives React StrictMode mount -> unmount -> remount without double-claiming or dropping the single-use credential", async () => {
  const { attachPreviewHandoffResume } = await import("../src/lib/previewGoogleHandoff");
  const handoffId = "f".repeat(48);
  const claimSecret = "1".repeat(48);
  let pending: { handoffId: string; claimSecret: string; createdAt: number } | null = {
    handoffId,
    claimSecret,
    createdAt: Date.now(),
  };

  let claimCalls = 0;
  let resolveClaim!: (val: any) => void;
  const claimPromise = new Promise<any>((resolve) => {
    resolveClaim = resolve;
  });

  let signInCalls = 0;
  const confirmedUser: AuthUserLike = { uid: "strictmode-uid-19", email: "creator@threadsworks.com" };
  let mount1SuccessUser: AuthUserLike | null = null;
  let mount2SuccessUser: AuthUserLike | null = null;
  const mount2Errors: string[] = [];

  const deps = {
    getPending: () => pending,
    clearPending: () => {
      pending = null;
    },
    claim: async () => {
      claimCalls += 1;
      return claimPromise;
    },
    signInWithGoogleCredential: async (idTok: string | null, accTok: string | null) => {
      signInCalls += 1;
      assert.equal(idTok, "google-id-token-19");
      assert.equal(accTok, "google-access-token-19");
      return confirmedUser;
    },
    pollIntervalMs: 60_000,
  };

  // Mount 1 starts the single-use /claim request
  const detachMount1 = attachPreviewHandoffResume(
    {} as any,
    {
      onSuccess: (u) => {
        mount1SuccessUser = u;
      },
    },
    deps
  );

  // React StrictMode unmounts Mount 1 immediately (while /claim is still in flight)
  detachMount1();

  // React StrictMode mounts Mount 2 immediately afterward
  const detachMount2 = attachPreviewHandoffResume(
    {} as any,
    {
      onSuccess: (u) => {
        mount2SuccessUser = u;
      },
      onError: (msg) => {
        mount2Errors.push(msg);
      },
    },
    deps
  );

  assert.equal(claimCalls, 1, "StrictMode remount must NOT fire a second single-use /claim request");

  // Server resolves the single in-flight /claim with ready credentials
  resolveClaim({
    status: "ready",
    googleIdToken: "google-id-token-19",
    googleAccessToken: "google-access-token-19",
  });

  await flushMicrotasks();
  await new Promise((r) => setTimeout(r, 20));
  detachMount2();

  assert.equal(claimCalls, 1, "Single-use /claim must have been called exactly once");
  assert.equal(signInCalls, 1, "signInWithCredential must complete exactly once despite Mount 1 unmount");
  assert.equal(mount1SuccessUser, null, "Detached Mount 1 callback must not be invoked");
  assert.equal(mount2SuccessUser?.uid, "strictmode-uid-19", "Active Mount 2 callback must receive confirmed user");
  assert.equal(mount2Errors.length, 0, "No errors should be emitted during StrictMode handoff recovery");
  assert.equal(pending, null, "Pending handoff must be cleared once sign-in completes");
});

test("20. Public website (/), /?auth=signin, /?auth=signup, and protected /workspace routing contract", async () => {
  // Pure route classification checks
  assert.equal(isContentPaysUsPublicPath("/"), true);
  assert.equal(isContentPaysUsPublicPath("/learn"), true);
  assert.equal(isContentPaysUsPublicPath("/applications"), true);
  assert.equal(isContentPaysUsPublicPath("/applications/threadsworks"), true);
  assert.equal(isContentPaysUsPublicPath("/about"), true);
  assert.equal(isContentPaysUsPublicPath("/workspace"), false, "/workspace MUST be a protected route");
  assert.equal(isContentPaysUsInfoPath("/workspace"), false);
  assert.equal(isContentPaysUsInfoPath("/applications/productworks"), true);

  // Query parsing & open-redirect protection
  assert.equal(getAuthPortalModeFromSearch("?auth=signin"), "signin");
  assert.equal(getAuthPortalModeFromSearch("?auth=signup"), "signup");
  assert.equal(getAuthPortalModeFromSearch("?auth=invalid"), null);
  assert.equal(getSafePostAuthRedirectFromSearch("?auth=signin&next=/workspace"), "/workspace");
  assert.equal(getSafePostAuthRedirectFromSearch("?next=https://evil.example/phish"), null);
  assert.equal(getSafePostAuthRedirectFromSearch("?next=//evil.example/phish"), null);
  assert.equal(getSafePostAuthRedirectFromSearch("?next=/"), null);

  // Part A: /?auth=signin opens AuthScreen (not public marketing page) and honors ?next=/workspace
  {
    const firebase = createMockFirebaseAuthHarness(null);
    const signedInUser: AuthUserLike = { uid: "portal-uid-20", email: "creator@threadsworks.com" };
    const app = await mountTestApp({
      initialUrl: "https://threadsworks.com/?auth=signin&next=/workspace",
      adapter: firebase.createAdapter(),
      authActions: {
        waitForPersistence: async () => ({ mode: "local" }),
        signInWithGooglePopup: async () => {
          firebase.currentUser = signedInUser;
          return { user: signedInUser };
        },
        ensureGoogleProfile: async () => {},
      },
      onSignOut: firebase.signOut,
    });
    try {
      // While initializing, /?auth=signin must wait cleanly on loading (never flash public site or wrong auth screen)
      assert.ok(app.container.querySelector("#auth-loading-screen"));
      await act(async () => {
        firebase.emitUser(null);
      });
      assert.ok(app.container.querySelector("#auth-card"), "/?auth=signin must open AuthScreen");
      assert.equal(app.container.querySelector("#marketing-screen"), null);

      const googleBtn = app.container.querySelector("#auth-google-button") as HTMLButtonElement;
      await act(async () => {
        googleBtn.click();
      });
      await flushMicrotasks();

      const dashboard = app.container.querySelector("#workspace-dashboard");
      assert.ok(dashboard, "Signing in via /?auth=signin&next=/workspace must enter workspace");
      assert.equal(app.window.location.pathname, "/workspace");
      assert.equal(dashboard.getAttribute("data-tab"), "apps");
    } finally {
      await app.unmount();
    }
  }

  // Part B: /workspace waits for authStateReady -> directs unauthenticated user to AuthScreen -> returns to /workspace after login
  {
    const firebase = createMockFirebaseAuthHarness(null);
    const workspaceUser: AuthUserLike = { uid: "ws-uid-20", email: "ws@threadsworks.com" };
    let resolveReady!: () => void;
    const readyPromise = new Promise<void>((r) => {
      resolveReady = r;
    });

    const app = await mountTestApp({
      initialUrl: "https://threadsworks.com/workspace",
      adapter: firebase.createAdapter({
        waitForAuthStateReady: () => readyPromise,
      }),
      authActions: {
        waitForPersistence: async () => ({ mode: "local" }),
        signInWithEmail: async () => {
          firebase.currentUser = workspaceUser;
          return { user: workspaceUser };
        },
      },
      onSignOut: firebase.signOut,
    });
    try {
      assert.ok(app.container.querySelector("#auth-loading-screen"), "/workspace must show loading until authStateReady settles");
      assert.equal(app.container.querySelector("#auth-card"), null);

      await act(async () => {
        resolveReady();
        await readyPromise;
        firebase.emitUser(null);
      });
      await flushMicrotasks();

      assert.ok(app.container.querySelector("#auth-card"), "Unauthenticated /workspace must show AuthScreen");
      assert.equal(app.window.location.pathname, "/workspace", "Intended /workspace destination must be preserved");

      const emailInput = app.container.querySelector("#auth-email-input") as HTMLInputElement;
      const passwordInput = app.container.querySelector("#auth-password-input") as HTMLInputElement;
      const form = app.container.querySelector("form") as HTMLFormElement;
      await act(async () => {
        setReactInputValue(emailInput, "ws@threadsworks.com");
        setReactInputValue(passwordInput, "ValidPass123!");
      });
      await act(async () => {
        const DomEvent = (globalThis as any).window.Event;
        form.dispatchEvent(new DomEvent("submit", { bubbles: true, cancelable: true }));
      });
      await flushMicrotasks();

      const dashboard = app.container.querySelector("#workspace-dashboard");
      assert.ok(dashboard, "Authenticating on /workspace must enter the unified workspace");
      assert.equal(dashboard.getAttribute("data-uid"), "ws-uid-20");
      assert.equal(dashboard.getAttribute("data-tab"), "apps");
      assert.equal(app.window.location.pathname, "/workspace", "URL must remain /workspace with zero redirect loops");
      assert.equal(app.historyCalls.length, 0);
    } finally {
      await app.unmount();
    }
  }
});

test("21. Email registration, signup validation recovery, password reset, and double-submit guard", async () => {
  const firebase = createMockFirebaseAuthHarness(null);
  const newUser: AuthUserLike = { uid: "signup-uid-21", email: "newcreator@threadsworks.com" };
  let signUpCalls = 0;
  let resetEmailSentTo = "";

  const app = await mountTestApp({
    initialUrl: "https://threadsworks.com/?auth=signup",
    adapter: firebase.createAdapter(),
    authActions: {
      waitForPersistence: async () => ({ mode: "local" }),
      signUpWithEmail: async (email) => {
        signUpCalls += 1;
        assert.equal(email, "newcreator@threadsworks.com");
        await new Promise((r) => setTimeout(r, 25));
        firebase.currentUser = newUser;
        return { user: newUser };
      },
      initializeSignupProfile: async () => {},
      sendPasswordReset: async (email) => {
        resetEmailSentTo = email;
      },
    },
    onSignOut: firebase.signOut,
  });

  try {
    await act(async () => {
      firebase.emitUser(null);
    });

    // Starts in signup mode from ?auth=signup
    const offerInput = app.container.querySelector("#signup-offer-input") as HTMLInputElement;
    assert.ok(offerInput, "?auth=signup must open AuthScreen directly in Sign Up mode");

    // Incomplete signup validation must show error AND NOT strand buttons in disabled authenticating state
    const emailInput = app.container.querySelector("#auth-email-input") as HTMLInputElement;
    const passwordInput = app.container.querySelector("#auth-password-input") as HTMLInputElement;
    const form = app.container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      setReactInputValue(emailInput, "newcreator@threadsworks.com");
      setReactInputValue(passwordInput, "StrongPass123!");
    });
    await act(async () => {
      const DomEvent = (globalThis as any).window.Event;
      form.dispatchEvent(new DomEvent("submit", { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    assert.match(app.container.querySelector("#auth-error-banner")?.textContent || "", /complete the basic profile fields/i);
    const submitBtnAfterValidation = app.container.querySelector("#auth-submit-button") as HTMLButtonElement;
    assert.equal(submitBtnAfterValidation.disabled, false, "Validation failure must never leave submit button permanently disabled");

    // Test Password Reset flow by toggling to Sign In -> Forgot Password
    const toggleBtn = app.container.querySelector("#auth-toggle-view") as HTMLButtonElement;
    await act(async () => {
      toggleBtn.click();
    });
    const forgotLink = app.container.querySelector("#auth-forgot-password-link") as HTMLButtonElement;
    assert.ok(forgotLink);
    await act(async () => {
      forgotLink.click();
    });
    const resetForm = app.container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      const DomEvent = (globalThis as any).window.Event;
      resetForm.dispatchEvent(new DomEvent("submit", { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();
    assert.equal(resetEmailSentTo, "newcreator@threadsworks.com", "Password reset must invoke sendPasswordReset with trimmed email");

    // Return to Sign In -> switch back to Sign Up, fill all fields, double-submit rapidly
    const backBtn = app.container.querySelector("#forgot-password-back-button") as HTMLButtonElement;
    await act(async () => {
      backBtn.click();
    });
    const toggleBackToSignup = app.container.querySelector("#auth-toggle-view") as HTMLButtonElement;
    await act(async () => {
      toggleBackToSignup.click();
    });

    await act(async () => {
      setReactInputValue(app.container.querySelector("#signup-offer-input") as HTMLInputElement, "Coaching");
      setReactInputValue(app.container.querySelector("#signup-audience-input") as HTMLInputElement, "Founders");
      setReactInputValue(app.container.querySelector("#signup-result-input") as HTMLInputElement, "Consistent leads");
    });

    const signupForm = app.container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      const DomEvent = (globalThis as any).window.Event;
      signupForm.dispatchEvent(new DomEvent("submit", { bubbles: true, cancelable: true }));
      signupForm.dispatchEvent(new DomEvent("submit", { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 50));
    });
    await flushMicrotasks();

    assert.equal(signUpCalls, 1, "Rapid double-submit must execute signUpWithEmail exactly once");
    const dashboard = app.container.querySelector("#workspace-dashboard");
    assert.ok(dashboard, "Completed registration must enter workspace");
    assert.equal(dashboard.getAttribute("data-uid"), "signup-uid-21");
  } finally {
    await app.unmount();
  }
});

test("22. Checkpoint B security & account-switch isolation invariants", () => {
  const rootDir = process.cwd();
  const appSrc = fs.readFileSync(path.join(rootDir, "src", "App.tsx"), "utf8");
  const authScreenSrc = fs.readFileSync(path.join(rootDir, "src", "components", "AuthScreen.tsx"), "utf8");
  const persistenceSrc = fs.readFileSync(path.join(rootDir, "src", "context", "ContentPersistenceContext.tsx"), "utf8");
  const threadsConnSrc = fs.readFileSync(path.join(rootDir, "src", "context", "ThreadsConnectionContext.tsx"), "utf8");
  const draftSrc = fs.readFileSync(path.join(rootDir, "src", "utils", "usePersistentDraft.ts"), "utf8");
  const unifiedWsSrc = fs.readFileSync(path.join(rootDir, "src", "components", "contentpaysus", "ContentPaysUsUnifiedWorkspace.tsx"), "utf8");

  // No mock/hardcoded auth bypass in AuthScreen
  assert.doesNotMatch(authScreenSrc, /preview_test_creator_01/, "AuthScreen must not contain hardcoded fake preview user bypass");
  assert.doesNotMatch(authScreenSrc, /handleInstantPreviewLogin/, "AuthScreen must not include instant fake login bypass");
  assert.match(authScreenSrc, /isEmbeddedIframe/, "Open in New Tab helper must be gated to embedded iframe context");

  // App.tsx routes /workspace to real unified workspace, never static ContentPaysUsWorkspace placeholder
  assert.doesNotMatch(appSrc, /ContentPaysUsWorkspace/, "App.tsx must not trap /workspace on static Phase 1 placeholder");
  assert.match(appSrc, /"\/workspace"\s*:\s*"apps"/, "App.tsx must map /workspace to the unified workspace tab");
  assert.match(appSrc, /getPreviewGoogleBridgeHandoffId\(\)/, "App.tsx must check preview Google bridge before MainApp routing");
  assert.match(appSrc, /key=\{`auth-workspace-\$\{user\.uid\}`\}/, "App.tsx must key workspace panel by user.uid for clean account switch resets");
  assert.doesNotMatch(appSrc, /safeGetLocalStorage\("profile"\)/, "App.tsx must never read unscoped legacy profile key");

  // Contexts & hooks enforce strict UID isolation and stale-async guards
  assert.doesNotMatch(persistenceSrc, /localStorage\.setItem\("threads_custom_instruction",/, "ContentPersistenceContext must not write unscoped custom instruction");
  assert.match(threadsConnSrc, /requestIdRef/, "ThreadsConnectionContext must discard stale async responses across account switches");
  assert.doesNotMatch(draftSrc, /threadsworks:draft:anonymous:/, "usePersistentDraft must not copy anonymous drafts into signed-in accounts");
  assert.match(unifiedWsSrc, /activeUidRef/, "ContentPaysUsUnifiedWorkspace must guard async project mutations by active UID");
});



