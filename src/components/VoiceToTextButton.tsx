import React, { useState } from "react";
import { Mic, MicOff, Square, RotateCcw, Undo2, AlertCircle, X, Info } from "lucide-react";
import type { UseVoiceToTextReturn } from "../hooks/useVoiceToText";

export interface VoiceToTextButtonProps {
  voice: UseVoiceToTextReturn;
  /** Accessible label describing what field dictation targets */
  fieldLabel?: string;
  /** Visual density: toolbar (with text label) or compact (icon-first for narrow rows/chat composers) */
  variant?: "toolbar" | "compact";
  /** Optional HTML id for testing and accessibility */
  id?: string;
  disabled?: boolean;
  /** Optional callback when unsupported notice is toggled */
  onUnsupportedClick?: () => void;
}

/**
 * Shared microphone trigger button for ThreadsWorks text fields.
 * Follows ThreadsWorks Light & Dark Mode semantic design tokens.
 */
export const VoiceToTextButton: React.FC<VoiceToTextButtonProps> = ({
  voice,
  fieldLabel = "text field",
  variant = "toolbar",
  id,
  disabled = false,
  onUnsupportedClick,
}) => {
  const isListening = voice.isListening;
  const isUnsupported = !voice.isSupported;

  const handleClick = () => {
    if (disabled) return;
    if (isUnsupported) {
      if (onUnsupportedClick) {
        onUnsupportedClick();
      } else {
        // Trigger unsupported error explanation cleanly in the status panel
        voice.startListening();
      }
      return;
    }
    voice.toggleListening();
  };

  const ariaLabel = isUnsupported
    ? `Voice input unavailable for ${fieldLabel}`
    : isListening
    ? `Stop voice input for ${fieldLabel}`
    : `Start voice input for ${fieldLabel}`;

  const title = isUnsupported
    ? voice.unsupportedReason || "Voice input is not supported in this browser"
    : isListening
    ? "Stop listening"
    : "Speak instead of typing";

  if (variant === "compact") {
    return (
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-pressed={isListening}
        title={title}
        data-voice-state={isUnsupported ? "unsupported" : isListening ? "listening" : "idle"}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
          isListening
            ? "border-status-danger-border bg-status-danger-bg text-status-danger-text shadow-xs"
            : isUnsupported
            ? "border-border-primary bg-bg-app text-text-muted hover:text-text-secondary"
            : "border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong"
        }`}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 dark:bg-red-400" />
            </span>
            <Square className="h-3 w-3 fill-current shrink-0" />
            <span>Stop</span>
          </>
        ) : isUnsupported ? (
          <MicOff className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Speak</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-pressed={isListening}
      title={title}
      data-voice-state={isUnsupported ? "unsupported" : isListening ? "listening" : "idle"}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
        isListening
          ? "border-status-danger-border bg-status-danger-bg text-status-danger-text shadow-xs"
          : isUnsupported
          ? "border-border-primary bg-bg-app text-text-muted hover:text-text-secondary"
          : "border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong"
      }`}
    >
      {isListening ? (
        <>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 dark:bg-red-400" />
          </span>
          <Square className="h-3 w-3 fill-current shrink-0" />
          <span>Stop Listening</span>
        </>
      ) : isUnsupported ? (
        <>
          <MicOff className="h-3.5 w-3.5 shrink-0" />
          <span>Voice Unavailable</span>
        </>
      ) : (
        <>
          <Mic className="h-3.5 w-3.5 shrink-0" />
          <span>Speak</span>
        </>
      )}
    </button>
  );
};

export interface VoiceInputStatusPanelProps {
  voice: UseVoiceToTextReturn;
  /** Optional className for spacing adjustment */
  className?: string;
}

/**
 * Displays live listening status, interim transcription preview, undo/retry actions,
 * privacy notice, and clear error states directly beneath an attached input field.
 */
export const VoiceInputStatusPanel: React.FC<VoiceInputStatusPanelProps> = ({
  voice,
  className = "",
}) => {
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);

  const hasContent =
    voice.isListening ||
    Boolean(voice.interimTranscript) ||
    Boolean(voice.error) ||
    voice.canUndoLastDictation ||
    showPrivacyInfo;

  if (!hasContent) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`} data-voice-status-panel="true">
      {/* Active Listening & Live Interim Preview */}
      {voice.isListening && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-brand-border bg-brand-surface/70 dark:bg-purple-950/30 px-3.5 py-2.5 text-xs space-y-1.5 animate-fade-in"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-brand-text-strong">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 dark:bg-red-400" />
              </span>
              <span>Listening... Speak naturally. Tap Stop when done.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrivacyInfo((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                aria-label="Voice privacy information"
              >
                <Info className="h-3 w-3" />
                <span>Privacy</span>
              </button>
              <button
                type="button"
                onClick={voice.stopListening}
                className="inline-flex items-center gap-1 rounded-md border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[11px] font-bold text-status-danger-text cursor-pointer"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          </div>

          {voice.interimTranscript && (
            <p
              data-voice-interim-preview="true"
              className="text-xs italic text-text-secondary bg-bg-card/80 border border-border-primary rounded-lg px-2.5 py-1.5 leading-relaxed"
            >
              “{voice.interimTranscript}”
            </p>
          )}

          <p className="text-[11px] text-text-muted leading-snug">
            {voice.privacyNotice}
          </p>
        </div>
      )}

      {/* Post-Dictation Controls: Undo Last Dictation / Dictate More / Privacy */}
      {!voice.isListening && voice.canUndoLastDictation && !voice.error && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-primary bg-bg-app px-3 py-2 text-[11px]"
        >
          <span className="text-text-secondary font-medium">
            Voice transcription added. Review or edit your text before submitting.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={voice.clearLastDictation}
              className="inline-flex items-center gap-1 rounded-md border border-border-primary bg-bg-card hover:bg-bg-card-hover px-2 py-1 text-[11px] font-bold text-text-secondary hover:text-text-primary transition cursor-pointer"
            >
              <Undo2 className="h-3 w-3" />
              <span>Clear Dictation</span>
            </button>
            {voice.isSupported && (
              <button
                type="button"
                onClick={voice.retryListening}
                className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-brand-surface hover:bg-brand-surface-hover px-2 py-1 text-[11px] font-bold text-brand-text-strong transition cursor-pointer"
              >
                <Mic className="h-3 w-3" />
                <span>Speak More</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPrivacyInfo((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary cursor-pointer"
              title="Voice privacy notice"
              aria-label="Toggle voice privacy notice"
            >
              <Info className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Explicit Privacy Disclosure Box (when toggled outside active listening) */}
      {!voice.isListening && showPrivacyInfo && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-status-info-border bg-status-info-bg px-3 py-2 text-[11px] text-status-info-text">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{voice.privacyNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPrivacyInfo(false)}
            className="p-0.5 hover:opacity-80 cursor-pointer shrink-0"
            aria-label="Close voice privacy notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Clear Error & Fallback Banner */}
      {voice.error && (
        <div
          role="alert"
          data-voice-error-code={voice.error.code}
          className="rounded-xl border border-status-danger-border bg-status-danger-bg px-3.5 py-2.5 text-xs text-status-danger-text space-y-2 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-text-primary">{voice.error.title}</p>
                <p className="text-[11px] text-status-danger-text leading-relaxed">
                  {voice.error.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={voice.dismissError}
              className="p-1 rounded hover:bg-red-600/10 text-status-danger-text cursor-pointer shrink-0"
              aria-label="Dismiss voice input error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {voice.error.canRetry && voice.isSupported && (
            <div className="flex items-center gap-2 pl-6">
              <button
                type="button"
                onClick={voice.retryListening}
                className="inline-flex items-center gap-1 rounded-lg border border-status-danger-border bg-bg-card hover:bg-bg-card-hover px-2.5 py-1 text-[11px] font-bold text-text-primary transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Retry Voice Input</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
