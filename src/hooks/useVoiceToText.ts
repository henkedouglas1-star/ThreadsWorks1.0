import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  classifyVoiceError,
  createInitialTranscriptState,
  detectVoiceRecognitionSupport,
  extractIncrementalTranscript,
  IncrementalTranscriptState,
  insertTranscriptAtCursor,
  removeDictatedSegment,
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
  VOICE_PRIVACY_NOTICE,
  VoiceErrorState,
} from "../lib/voiceToText";

export interface UseVoiceToTextOptions {
  /** Controlled text value of the attached input/textarea */
  value: string;
  /** Controlled updater for the attached input/textarea */
  onChange: (nextValue: string) => void;
  /** Optional ref to the input/textarea for cursor-aware insertion and focus restoration */
  inputRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  /** BCP-47 language tag (defaults to browser language or en-US) */
  lang?: string;
  /** Keep listening across pauses until user stops (default: true) */
  continuous?: boolean;
  /** Disable microphone activation */
  disabled?: boolean;
  /** Optional factory override for unit/integration testing */
  speechRecognitionFactory?: () => SpeechRecognitionLike | null;
  /** Optional window override for browser capability testing */
  targetWindow?: Record<string, any> | null;
}

export interface UseVoiceToTextReturn {
  isSupported: boolean;
  unsupportedReason: string | null;
  isListening: boolean;
  interimTranscript: string;
  lastDictatedText: string;
  canUndoLastDictation: boolean;
  error: VoiceErrorState | null;
  privacyNotice: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  retryListening: () => void;
  clearLastDictation: () => void;
  dismissError: () => void;
}

interface LastDictationRange {
  text: string;
  start: number;
  end: number;
}

/**
 * Reusable React hook attaching browser Voice-to-Text dictation to any controlled
 * text field or textarea without affecting typing, submitting, or app-wide state.
 *
 * Guarantees:
 * - Never activates microphone automatically on mount.
 * - Never auto-submits forms or messages when recognition ends.
 * - Prevents duplicate sessions on rapid clicks and cleans up resources on unmount.
 * - Preserves existing text and inserts at cursor position without silent overwrites.
 */
export function useVoiceToText(options: UseVoiceToTextOptions): UseVoiceToTextReturn {
  const {
    value,
    onChange,
    inputRef,
    lang,
    continuous = true,
    disabled = false,
    speechRecognitionFactory,
    targetWindow,
  } = options;

  const support = useMemo(() => {
    if (speechRecognitionFactory) {
      return {
        supported: true,
        apiName: "SpeechRecognition" as const,
        constructor: null,
        reason: null,
        errorCode: null,
      };
    }
    return detectVoiceRecognitionSupport(targetWindow);
  }, [speechRecognitionFactory, targetWindow]);

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<VoiceErrorState | null>(null);
  const [lastDictation, setLastDictation] = useState<LastDictationRange | null>(null);

  // Refs prevent stale closures and avoid re-creating handlers when value changes
  const valueRef = useRef(value);
  valueRef.current = value;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionIdRef = useRef(0);
  const isListeningRef = useRef(false);
  const userStoppedRef = useRef(false);
  const transcriptStateRef = useRef<IncrementalTranscriptState>(createInitialTranscriptState());
  const cursorPosRef = useRef<number | null>(null);
  const sessionDictationRef = useRef<LastDictationRange | null>(null);
  const isMountedRef = useRef(true);

  const detachAndReleaseRecognition = useCallback((mode: "stop" | "abort") => {
    const instance = recognitionRef.current;
    if (!instance) return;

    recognitionRef.current = null;
    instance.onstart = null;
    instance.onresult = null;
    instance.onerror = null;
    instance.onend = null;

    try {
      if (mode === "abort") {
        instance.abort();
      } else {
        instance.stop();
      }
    } catch {
      // Ignore already-stopped / invalid state errors from browser engines
    }
  }, []);

  // Always clean up active microphone session immediately on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sessionIdRef.current += 1;
      isListeningRef.current = false;
      detachAndReleaseRecognition("abort");
    };
  }, [detachAndReleaseRecognition]);

  const stopListening = useCallback(() => {
    userStoppedRef.current = true;
    const activeInstance = recognitionRef.current;

    if (!activeInstance && !isListeningRef.current) {
      return;
    }

    // Invalidate session immediately so late errors/interims cannot corrupt state
    sessionIdRef.current += 1;
    isListeningRef.current = false;

    detachAndReleaseRecognition("stop");

    if (isMountedRef.current) {
      setIsListening(false);
      setInterimTranscript("");
    }
  }, [detachAndReleaseRecognition]);

  const startListening = useCallback(() => {
    if (disabled) return;

    // Prevent duplicate recognition sessions on rapid clicks
    if (isListeningRef.current || recognitionRef.current) {
      return;
    }

    if (!support.supported) {
      setError(classifyVoiceError(support.errorCode || "unsupported", support.reason));
      return;
    }

    let instance: SpeechRecognitionLike | null = null;
    try {
      if (speechRecognitionFactory) {
        instance = speechRecognitionFactory();
      } else if (support.constructor) {
        instance = new support.constructor();
      }
    } catch (initErr: any) {
      setError(classifyVoiceError("unknown", initErr?.message));
      return;
    }

    if (!instance) {
      setError(classifyVoiceError("unsupported"));
      return;
    }

    const activeSessionId = ++sessionIdRef.current;
    userStoppedRef.current = false;
    transcriptStateRef.current = createInitialTranscriptState();
    sessionDictationRef.current = null;

    // Capture current cursor position from the attached input if focused/available
    const el = inputRef?.current;
    if (el && typeof el.selectionStart === "number") {
      const selEnd = typeof el.selectionEnd === "number" ? el.selectionEnd : el.selectionStart;
      // Preserve selected text: insert after selection end rather than overwriting
      cursorPosRef.current = Math.max(el.selectionStart, selEnd);
    } else {
      cursorPosRef.current = valueRef.current.length;
    }

    const resolvedLang =
      lang ||
      (typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US");

    instance.continuous = continuous;
    instance.interimResults = true;
    instance.lang = resolvedLang;
    if ("maxAlternatives" in instance) {
      instance.maxAlternatives = 1;
    }

    recognitionRef.current = instance;
    isListeningRef.current = true;
    setError(null);
    setInterimTranscript("");
    setIsListening(true);

    instance.onstart = () => {
      if (!isMountedRef.current || sessionIdRef.current !== activeSessionId) return;
      isListeningRef.current = true;
      setIsListening(true);
    };

    instance.onresult = (event: SpeechRecognitionEventLike) => {
      if (!isMountedRef.current || sessionIdRef.current !== activeSessionId) return;

      const parsed = extractIncrementalTranscript(event, transcriptStateRef.current);
      transcriptStateRef.current = parsed.nextState;
      setInterimTranscript(parsed.interimTranscript);

      if (parsed.newFinalSegments.length > 0) {
        const joinedChunk = parsed.newFinalSegments.join(" ").trim();
        if (joinedChunk) {
          const currentText = valueRef.current;
          const insertAt =
            cursorPosRef.current !== null
              ? Math.min(cursorPosRef.current, currentText.length)
              : currentText.length;

          const insertion = insertTranscriptAtCursor(currentText, joinedChunk, insertAt, insertAt);

          if (insertion.nextValue !== currentText) {
            valueRef.current = insertion.nextValue;
            cursorPosRef.current = insertion.nextCursorPos;

            // Track contiguous dictated range for clean "Undo Dictation" support
            const prevRange = sessionDictationRef.current;
            const nextRange: LastDictationRange =
              prevRange && prevRange.end === insertion.insertedStart
                ? {
                    text: prevRange.text + insertion.insertedText,
                    start: prevRange.start,
                    end: insertion.insertedEnd,
                  }
                : {
                    text: insertion.insertedText,
                    start: insertion.insertedStart,
                    end: insertion.insertedEnd,
                  };

            sessionDictationRef.current = nextRange;
            setLastDictation(nextRange);
            onChangeRef.current(insertion.nextValue);

            // Restore caret position asynchronously after React commits value
            const targetEl = inputRef?.current;
            if (targetEl && typeof targetEl.setSelectionRange === "function") {
              const pos = insertion.nextCursorPos;
              queueMicrotask(() => {
                if (isMountedRef.current && inputRef?.current === targetEl) {
                  try {
                    if (document.activeElement === targetEl) {
                      targetEl.setSelectionRange(pos, pos);
                    }
                  } catch {
                    // Ignore selection errors on non-focusable or unmounted inputs
                  }
                }
              });
            }
          }
        }
      }
    };

    instance.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (!isMountedRef.current || sessionIdRef.current !== activeSessionId) return;

      // Ignore "aborted" when triggered intentionally by user stop
      if (event?.error === "aborted" && userStoppedRef.current) {
        return;
      }

      const classified = classifyVoiceError(event?.error, event?.message);
      isListeningRef.current = false;
      detachAndReleaseRecognition("abort");
      setIsListening(false);
      setInterimTranscript("");
      setError(classified);
    };

    instance.onend = () => {
      if (!isMountedRef.current || sessionIdRef.current !== activeSessionId) return;

      isListeningRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript("");
    };

    try {
      instance.start();
    } catch (startErr: any) {
      isListeningRef.current = false;
      detachAndReleaseRecognition("abort");
      setIsListening(false);
      setInterimTranscript("");
      const errName = String(startErr?.name || "").toLowerCase();
      if (errName === "notallowederror" || errName === "securityerror") {
        setError(classifyVoiceError("not-allowed", startErr?.message));
      } else {
        setError(classifyVoiceError("unknown", startErr?.message));
      }
    }
  }, [continuous, detachAndReleaseRecognition, disabled, inputRef, lang, speechRecognitionFactory, support]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current || recognitionRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const retryListening = useCallback(() => {
    setError(null);
    if (isListeningRef.current || recognitionRef.current) {
      stopListening();
    }
    startListening();
  }, [startListening, stopListening]);

  const clearLastDictation = useCallback(() => {
    if (!lastDictation) return;
    const updated = removeDictatedSegment(
      valueRef.current,
      lastDictation.text,
      lastDictation.start,
      lastDictation.end
    );
    if (updated !== null) {
      valueRef.current = updated;
      onChangeRef.current(updated);
    }
    sessionDictationRef.current = null;
    setLastDictation(null);
  }, [lastDictation]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  // Automatically clear the undo affordance if the user cleared the whole field manually
  const canUndoLastDictation = Boolean(
    lastDictation &&
      lastDictation.text.trim().length > 0 &&
      value.includes(lastDictation.text.trim())
  );

  return {
    isSupported: support.supported,
    unsupportedReason: support.reason,
    isListening,
    interimTranscript,
    lastDictatedText: lastDictation?.text.trim() || "",
    canUndoLastDictation,
    error,
    privacyNotice: VOICE_PRIVACY_NOTICE,
    startListening,
    stopListening,
    toggleListening,
    retryListening,
    clearLastDictation,
    dismissError,
  };
}
