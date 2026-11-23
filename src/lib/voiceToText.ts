/**
 * ThreadsWorks — Shared Voice-to-Text Core Utilities
 *
 * Framework-agnostic browser speech recognition detection, error classification,
 * duplicate-resistant transcript extraction, and cursor-aware text insertion.
 *
 * Privacy & security guarantees:
 * - Uses browser-native Web Speech API (SpeechRecognition / webkitSpeechRecognition) only.
 * - Never uploads raw audio to ThreadsWorks or third-party transcription servers.
 * - Never starts recording automatically; requires explicit user interaction.
 * - Does not persist transcripts separately from the text field the creator submits.
 */

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence?: number;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onstart: ((event?: unknown) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event?: unknown) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type VoiceErrorCode =
  | "unsupported"
  | "insecure-context"
  | "permission-denied"
  | "no-microphone"
  | "no-speech"
  | "network"
  | "interrupted"
  | "language-not-supported"
  | "unknown";

export interface VoiceErrorState {
  code: VoiceErrorCode;
  title: string;
  message: string;
  canRetry: boolean;
}

export interface VoiceSupportResult {
  supported: boolean;
  apiName: "SpeechRecognition" | "webkitSpeechRecognition" | null;
  constructor: SpeechRecognitionConstructor | null;
  reason: string | null;
  errorCode: VoiceErrorCode | null;
}

export interface TextInsertionResult {
  nextValue: string;
  nextCursorPos: number;
  insertedStart: number;
  insertedEnd: number;
  insertedText: string;
}

export interface IncrementalTranscriptState {
  /** Highest result index already committed as final in the active session */
  nextFinalIndex: number;
  /** Normalized last committed final segment for mobile duplicate-emission guards */
  lastCommittedNormalized: string;
}

export interface ParsedSpeechResult {
  newFinalSegments: string[];
  interimTranscript: string;
  nextState: IncrementalTranscriptState;
}

export const VOICE_PRIVACY_NOTICE =
  "Voice-to-text uses your browser's built-in speech recognition, which may send audio to your browser vendor's speech service to transcribe it. ThreadsWorks never records in the background and does not store raw audio.";

export const VOICE_UNSUPPORTED_MESSAGE =
  "Voice-to-text isn't supported in this browser. You can keep typing normally, or switch to a supported browser like Chrome, Edge, or Safari.";

export const VOICE_INSECURE_CONTEXT_MESSAGE =
  "Microphone access requires a secure HTTPS connection (or localhost). Typing remains fully available.";

/**
 * Checks whether the current window environment is a secure context
 * (or localhost) where browser microphone permissions can be granted.
 */
export function isSecureSpeechContext(targetWindow?: Record<string, any> | null): boolean {
  const win = targetWindow ?? (typeof window !== "undefined" ? (window as Record<string, any>) : null);
  if (!win) return false;
  if (typeof win.isSecureContext === "boolean") {
    return win.isSecureContext;
  }
  const protocol = String(win.location?.protocol || "").toLowerCase();
  const hostname = String(win.location?.hostname || "").toLowerCase();
  if (protocol === "https:") return true;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return true;
  return false;
}

/**
 * Detects browser Web Speech API support safely without triggering permissions.
 */
export function detectVoiceRecognitionSupport(
  targetWindow?: Record<string, any> | null
): VoiceSupportResult {
  const win = targetWindow ?? (typeof window !== "undefined" ? (window as Record<string, any>) : null);
  if (!win) {
    return {
      supported: false,
      apiName: null,
      constructor: null,
      reason: VOICE_UNSUPPORTED_MESSAGE,
      errorCode: "unsupported",
    };
  }

  if (!isSecureSpeechContext(win)) {
    return {
      supported: false,
      apiName: null,
      constructor: null,
      reason: VOICE_INSECURE_CONTEXT_MESSAGE,
      errorCode: "insecure-context",
    };
  }

  if (typeof win.SpeechRecognition === "function") {
    return {
      supported: true,
      apiName: "SpeechRecognition",
      constructor: win.SpeechRecognition as SpeechRecognitionConstructor,
      reason: null,
      errorCode: null,
    };
  }

  if (typeof win.webkitSpeechRecognition === "function") {
    return {
      supported: true,
      apiName: "webkitSpeechRecognition",
      constructor: win.webkitSpeechRecognition as SpeechRecognitionConstructor,
      reason: null,
      errorCode: null,
    };
  }

  return {
    supported: false,
    apiName: null,
    constructor: null,
    reason: VOICE_UNSUPPORTED_MESSAGE,
    errorCode: "unsupported",
  };
}

/**
 * Maps browser SpeechRecognitionErrorEvent codes and runtime exceptions
 * into clear, actionable messages while keeping text typing uninterrupted.
 */
export function classifyVoiceError(rawError?: string | null, rawMessage?: string | null): VoiceErrorState {
  const normalized = String(rawError || "").trim().toLowerCase();

  switch (normalized) {
    case "not-allowed":
    case "service-not-allowed":
    case "permission-denied":
      return {
        code: "permission-denied",
        title: "Microphone permission blocked",
        message:
          "Microphone access was denied. Allow microphone access in your browser site settings and tap Retry, or keep typing.",
        canRetry: true,
      };
    case "audio-capture":
    case "no-microphone":
      return {
        code: "no-microphone",
        title: "No microphone available",
        message:
          "No working microphone was detected or it is busy in another app. Check your device audio settings or keep typing.",
        canRetry: true,
      };
    case "no-speech":
      return {
        code: "no-speech",
        title: "No speech detected",
        message:
          "No voice input was heard before timing out. Tap the microphone to try again, or keep typing.",
        canRetry: true,
      };
    case "network":
      return {
        code: "network",
        title: "Speech service unavailable",
        message:
          "Your browser couldn't reach its speech recognition service. Check your internet connection and retry, or keep typing.",
        canRetry: true,
      };
    case "aborted":
    case "interrupted":
      return {
        code: "interrupted",
        title: "Voice input interrupted",
        message:
          "Listening stopped before completion. Your existing text was preserved—tap the microphone to continue speaking.",
        canRetry: true,
      };
    case "language-not-supported":
      return {
        code: "language-not-supported",
        title: "Language not supported",
        message:
          "Your browser does not support speech recognition for the selected language. Typing remains available.",
        canRetry: false,
      };
    case "unsupported":
      return {
        code: "unsupported",
        title: "Voice input unavailable",
        message: VOICE_UNSUPPORTED_MESSAGE,
        canRetry: false,
      };
    case "insecure-context":
      return {
        code: "insecure-context",
        title: "Secure connection required",
        message: VOICE_INSECURE_CONTEXT_MESSAGE,
        canRetry: false,
      };
    default:
      return {
        code: "unknown",
        title: "Voice input couldn't continue",
        message:
          rawMessage && rawMessage.trim().length > 0
            ? `${rawMessage.trim()} Your text is safe—tap Retry or keep typing.`
            : "Speech recognition encountered an unexpected error. Your text is safe—tap Retry or keep typing.",
        canRetry: true,
      };
  }
}

export function createInitialTranscriptState(): IncrementalTranscriptState {
  return {
    nextFinalIndex: 0,
    lastCommittedNormalized: "",
  };
}

function normalizeForDedupe(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Extracts newly finalized speech segments and live interim text from a
 * SpeechRecognitionEvent while preventing duplicates from:
 * 1. Re-emitted finalized indices in cumulative result lists
 * 2. Interim results later promoted to final results
 * 3. Mobile Chrome continuous-mode duplicate consecutive final bursts
 */
export function extractIncrementalTranscript(
  event: SpeechRecognitionEventLike,
  prevState: IncrementalTranscriptState
): ParsedSpeechResult {
  const results = event?.results;
  if (!results || typeof results.length !== "number" || results.length === 0) {
    return {
      newFinalSegments: [],
      interimTranscript: "",
      nextState: prevState,
    };
  }

  let nextFinalIndex = prevState.nextFinalIndex;
  let lastCommittedNormalized = prevState.lastCommittedNormalized;
  const newFinalSegments: string[] = [];
  const interimParts: string[] = [];

  const startIndex = Math.max(0, typeof event.resultIndex === "number" ? event.resultIndex : 0);

  for (let i = startIndex; i < results.length; i++) {
    const result = results[i];
    if (!result || result.length === 0) continue;
    const alt = result[0];
    const rawText = typeof alt?.transcript === "string" ? alt.transcript : "";
    const cleaned = rawText.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    if (result.isFinal) {
      // Never re-commit a finalized index we already processed
      if (i < nextFinalIndex) {
        continue;
      }
      nextFinalIndex = i + 1;

      const normalized = normalizeForDedupe(cleaned);
      // Guard against consecutive identical final emissions (known Android Chrome quirk)
      if (normalized && normalized === lastCommittedNormalized) {
        continue;
      }

      // Guard against cumulative prefix re-emission where engine sends "hello world" right after "hello"
      if (
        lastCommittedNormalized &&
        normalized.startsWith(`${lastCommittedNormalized} `) &&
        cleaned.length > lastCommittedNormalized.length
      ) {
        const delta = cleaned.slice(lastCommittedNormalized.length).trim();
        if (delta) {
          newFinalSegments.push(delta);
          lastCommittedNormalized = normalized;
        }
        continue;
      }

      newFinalSegments.push(cleaned);
      lastCommittedNormalized = normalized;
    } else {
      interimParts.push(cleaned);
    }
  }

  return {
    newFinalSegments,
    interimTranscript: interimParts.join(" ").trim(),
    nextState: {
      nextFinalIndex,
      lastCommittedNormalized,
    },
  };
}

/**
 * Inserts recognized speech at the cursor position (or appends at the end)
 * without overwriting existing text. Handles clean spacing automatically.
 */
export function insertTranscriptAtCursor(
  currentValue: string,
  transcript: string,
  cursorStart?: number | null,
  cursorEnd?: number | null
): TextInsertionResult {
  const existing = typeof currentValue === "string" ? currentValue : "";
  const cleanedTranscript = String(transcript || "").replace(/\s+/g, " ").trim();

  if (!cleanedTranscript) {
    const fallbackCursor =
      typeof cursorStart === "number" && cursorStart >= 0
        ? Math.min(cursorStart, existing.length)
        : existing.length;
    return {
      nextValue: existing,
      nextCursorPos: fallbackCursor,
      insertedStart: fallbackCursor,
      insertedEnd: fallbackCursor,
      insertedText: "",
    };
  }

  // Never overwrite selected text silently: if a range is selected, insert at the end of selection
  // unless both start and end are null/undefined (append at end).
  const hasExplicitStart =
    typeof cursorStart === "number" && Number.isFinite(cursorStart) && cursorStart >= 0;
  const hasExplicitEnd =
    typeof cursorEnd === "number" && Number.isFinite(cursorEnd) && cursorEnd >= 0;

  let insertIndex = existing.length;
  if (hasExplicitStart) {
    const clampedStart = Math.min(cursorStart!, existing.length);
    const clampedEnd = hasExplicitEnd ? Math.min(Math.max(cursorEnd!, clampedStart), existing.length) : clampedStart;
    // Preserve any highlighted text rather than overwriting without confirmation
    insertIndex = clampedEnd;
  }

  const before = existing.slice(0, insertIndex);
  const after = existing.slice(insertIndex);

  const needsLeadingSpace =
    before.length > 0 && !/\s$/.test(before) && !/^[,.;:!?)]/.test(cleanedTranscript);
  const needsTrailingSpace =
    after.length > 0 && !/^\s/.test(after) && !/^[,.;:!?)]/.test(after);

  const insertedText = `${needsLeadingSpace ? " " : ""}${cleanedTranscript}${needsTrailingSpace ? " " : ""}`;
  const nextValue = `${before}${insertedText}${after}`;
  const insertedStart = before.length;
  const insertedEnd = insertedStart + insertedText.length;

  return {
    nextValue,
    nextCursorPos: insertedEnd,
    insertedStart,
    insertedEnd,
    insertedText,
  };
}

/**
 * Removes only a previously inserted dictation segment if it still exists
 * verbatim at the tracked range (or trailing end), preserving manual edits.
 */
export function removeDictatedSegment(
  currentValue: string,
  insertedText: string,
  insertedStart: number,
  insertedEnd: number
): string | null {
  if (!insertedText) return null;

  if (
    insertedStart >= 0 &&
    insertedEnd <= currentValue.length &&
    currentValue.slice(insertedStart, insertedEnd) === insertedText
  ) {
    const before = currentValue.slice(0, insertedStart);
    const after = currentValue.slice(insertedEnd);
    return `${before}${after}`.replace(/ {2,}/g, " ");
  }

  // Fallback: if user edited elsewhere before clearing, remove the exact last occurrence if unambiguous
  const lastIdx = currentValue.lastIndexOf(insertedText.trim());
  if (lastIdx >= 0) {
    const targetLen = insertedText.trim().length;
    const before = currentValue.slice(0, lastIdx).replace(/[ \t]+$/, "");
    const after = currentValue.slice(lastIdx + targetLen).replace(/^[ \t]+/, "");
    if (before && after) {
      return `${before} ${after}`;
    }
    return `${before}${after}`;
  }

  return null;
}
