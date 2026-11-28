/**
 * Centralized Google Analytics 4 (GA4) Utility & Event Tracker
 * Default Production Measurement ID: G-YCBF49G2KY
 */

const PRODUCTION_MEASUREMENT_ID = "G-YCBF49G2KY";
let isInitialized = false;

export function getMeasurementId(): string {
  const envId = (import.meta as any).env?.VITE_GA_TRACKING_ID;
  if (typeof envId === "string" && /^G-[A-Z0-9]{10}$/.test(envId.trim()) && envId.trim() !== "G-XXXXXXXXXX") return envId.trim();
  return PRODUCTION_MEASUREMENT_ID;
}

export function shouldInitializeAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return Boolean((import.meta as any).env?.PROD && (hostname === "threadsworks.com" || hostname === "www.threadsworks.com"));
}

export function initGoogleAnalytics(): void {
  if (isInitialized || typeof window === "undefined") return;
  if (!shouldInitializeAnalytics()) return;

  const measurementId = getMeasurementId();
  if (!measurementId) return;

  if (document.querySelector(`script[src*="gtag/js?id=${measurementId}"]`)) {
    isInitialized = true;
    return;
  }

  try {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onerror = () => {
      console.warn("Analytics script failed to load (blocked by privacy settings or ad blocker).");
    };
    document.head.appendChild(script);

    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args);
    }
    (window as any).gtag = gtag;

    gtag("js", new Date());
    gtag("config", measurementId, {
      page_path: window.location.pathname,
      send_page_view: false,
      page_location: window.location.origin + window.location.pathname
    });

    isInitialized = true;
    console.log(`Google Analytics initialized with ID: ${measurementId}`);
  } catch (err) {
    console.warn("Failed to initialize Google Analytics:", err);
  }
}

/**
 * Sanitizes event parameters to strictly prevent PII (emails, tokens, passwords, private content).
 */
function sanitizeParams(params: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  if (typeof params.page_path === "string" && /^\/[a-z0-9/-]*$/i.test(params.page_path)) safe.page_path = params.page_path;
  if (["google", "password", "email"].includes(params.method)) safe.method = params.method;
  if (typeof params.value === "number" && Number.isFinite(params.value) && params.value > 0) safe.value = params.value;
  if (typeof params.currency === "string" && /^[A-Z]{3}$/.test(params.currency)) safe.currency = params.currency;
  if (typeof params.transaction_id === "string" && /^(cs_|pi_|in_)[a-zA-Z0-9_]{8,}$/.test(params.transaction_id)) safe.transaction_id = params.transaction_id;
  return safe;
}

export type AnalyticsEventName =
  | "page_view"
  | "sign_up"
  | "login"
  | "generate_content"
  | "schedule_post"
  | "publish_post"
  | "generate_product"
  | "download_product"
  | "begin_checkout"
  | "purchase";

export interface AnalyticsEventParams {
  page_path?: string;
  page_title?: string;
  method?: string;
  transaction_id?: string;
  value?: number;
  currency?: string;
  items?: any[];
  [key: string]: any;
}

export function trackEvent(eventName: AnalyticsEventName, params: AnalyticsEventParams = {}): void {
  try {
    if (!shouldInitializeAnalytics()) return;
    let gtag = (window as any).gtag;
    if (typeof gtag !== "function") {
      initGoogleAnalytics();
      gtag = (window as any).gtag;
      if (typeof gtag !== "function") return;
    }

    const cleanParams = sanitizeParams(params);
    // Purchase tracking requires a server-verified payment integration; do not emit from unverified client calls.
    if (eventName === "purchase") return;
    if (eventName === "page_view") {
      cleanParams.page_location = window.location.origin + window.location.pathname;
    }
    gtag("event", eventName, cleanParams);
  } catch (err) {
    console.warn(`Analytics event tracking failed (${eventName}):`, err);
  }
}
