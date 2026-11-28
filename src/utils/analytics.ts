/**
 * Centralized Google Analytics 4 (GA4) Utility & Event Tracker
 * Default Production Measurement ID: G-YCBF49G2KY
 */

const PRODUCTION_MEASUREMENT_ID = "G-YCBF49G2KY";
const processedTransactions = new Set<string>();
let isInitialized = false;

export function getMeasurementId(): string {
  const envId = (import.meta as any).env?.VITE_GA_TRACKING_ID;
  if (envId && typeof envId === "string" && envId.trim() !== "" && envId !== "G-XXXXXXXXXX" && envId !== "YOUR_GA_ID") {
    let formatted = envId.trim();
    if (!formatted.startsWith("G-") && !formatted.startsWith("GTM-") && !formatted.startsWith("UA-")) {
      formatted = "G-" + formatted;
    }
    return formatted;
  }
  return PRODUCTION_MEASUREMENT_ID;
}

export function shouldInitializeAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  if ((import.meta as any).env?.MODE === "test" || (import.meta as any).env?.VITEST) {
    return true;
  }
  const hostname = window.location.hostname || "";
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".run.app") ||
    hostname.includes("ais-dev") ||
    hostname.includes("ais-pre")
  ) {
    return false;
  }
  const isThreadsworksDomain = hostname === "threadsworks.com" || hostname === "www.threadsworks.com" || hostname.endsWith("threadsworks.com");
  const hasValidEnvOverride = Boolean((import.meta as any).env?.VITE_GA_TRACKING_ID && (import.meta as any).env?.VITE_GA_TRACKING_ID.trim() !== "" && (import.meta as any).env?.VITE_GA_TRACKING_ID !== "G-XXXXXXXXXX");

  return isThreadsworksDomain || hasValidEnvOverride || (import.meta as any).env?.PROD;
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
      send_page_view: true
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
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null) continue;
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("email") ||
      lowerKey.includes("password") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("key") ||
      lowerKey.includes("auth") ||
      lowerKey.includes("credential") ||
      lowerKey.includes("content") ||
      lowerKey.includes("text")
    ) {
      continue;
    }
    if (typeof val === "string") {
      sanitized[key] = val.slice(0, 200);
    } else if (typeof val === "number" || typeof val === "boolean") {
      sanitized[key] = val;
    } else {
      sanitized[key] = String(val).slice(0, 100);
    }
  }
  return sanitized;
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
    if (typeof window === "undefined") return;
    let gtag = (window as any).gtag;
    if (typeof gtag !== "function") {
      initGoogleAnalytics();
      gtag = (window as any).gtag;
      if (typeof gtag !== "function") return;
    }

    if (eventName === "purchase") {
      const txId = params.transaction_id;
      if (txId && processedTransactions.has(txId)) {
        console.warn(`Duplicate purchase event prevented for transaction_id: ${txId}`);
        return;
      }
      if (txId) {
        processedTransactions.add(txId);
      }
      if (params.value === undefined || params.value <= 0) {
        console.warn("Purchase event missing valid transaction value.");
        return;
      }
    }

    const cleanParams = sanitizeParams(params);
    gtag("event", eventName, cleanParams);
  } catch (err) {
    console.warn(`Analytics event tracking failed (${eventName}):`, err);
  }
}
