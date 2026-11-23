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
  resolveAppScreen,
} from "../src/lib/authContract";
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
    const [authPortalMode, setAuthPortalMode] = useState<"signin" | "signup" | null>(null);
    const [activeTab, setActiveTab] = useState<string>("engine");

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
        setAuthPortalMode(null);
      };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Mirrors App.tsx authenticated root redirect without mutating unauthenticated '/'
    useEffect(() => {
      if (authStatus !== "authenticated" || !user) return;
      if (currentPath === "/" || currentPath === "") {
        setCurrentPath("/create");
        setActiveTab("engine");
        if (window.location.pathname !== "/create") {
          window.history.replaceState(null, "", "/create");
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
      isPublicMarketingRoute: Boolean(publicMarketingRoute),
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
