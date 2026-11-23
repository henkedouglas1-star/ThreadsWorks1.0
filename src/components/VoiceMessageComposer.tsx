import React, { useRef } from "react";
import { Send } from "lucide-react";
import { useVoiceToText, type UseVoiceToTextOptions } from "../hooks/useVoiceToText";
import { VoiceInputStatusPanel, VoiceToTextButton } from "./VoiceToTextButton";

export interface VoiceMessageComposerProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmit: (message: string) => void;
  placeholder?: string;
  submitLabel?: string;
  fieldLabel?: string;
  disabled?: boolean;
  rows?: number;
  inputId?: string;
  micButtonId?: string;
  submitButtonId?: string;
  /** Optional voice engine options (e.g. language or test factory injection) */
  voiceOptions?: Pick<
    UseVoiceToTextOptions,
    "lang" | "continuous" | "speechRecognitionFactory" | "targetWindow"
  >;
}

/**
 * Reusable voice-enabled message composer designed for ThreadGuide AI and
 * conversational input surfaces across ThreadsWorks.
 *
 * Strictly guarantees:
 * - Speech recognition populates the editable text field.
 * - Recognition end NEVER auto-submits the message; explicit user confirmation
 *   (clicking Send or pressing Enter) is always required.
 * - Full keyboard typing remains intact even when voice recognition is unavailable.
 */
export const VoiceMessageComposer: React.FC<VoiceMessageComposerProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask ThreadGuide how something works, report a problem, or share an idea...",
  submitLabel = "Send",
  fieldLabel = "ThreadGuide message",
  disabled = false,
  rows = 2,
  inputId = "threadguide-message-input",
  micButtonId = "threadguide-voice-btn",
  submitButtonId = "threadguide-send-btn",
  voiceOptions,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const voice = useVoiceToText({
    value,
    onChange,
    inputRef: textareaRef,
    disabled,
    ...voiceOptions,
  });

  const trimmed = value.trim();
  const canSubmit = !disabled && trimmed.length > 0;

  const handleExplicitSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    if (voice.isListening) {
      voice.stopListening();
    }
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleExplicitSubmit();
    }
  };

  return (
    <form onSubmit={handleExplicitSubmit} className="space-y-2" data-voice-composer="threadguide">
      <div className="rounded-xl border border-border-primary bg-bg-input p-2.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/20 transition">
        <textarea
          ref={textareaRef}
          id={inputId}
          rows={rows}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={fieldLabel}
          className="w-full resize-none bg-transparent text-sm text-text-primary placeholder-text-muted outline-none leading-relaxed font-sans"
        />

        <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-border-secondary">
          <VoiceToTextButton
            id={micButtonId}
            voice={voice}
            fieldLabel={fieldLabel}
            variant="compact"
            disabled={disabled}
          />

          <button
            id={submitButtonId}
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-1.5 text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{submitLabel}</span>
          </button>
        </div>
      </div>

      <VoiceInputStatusPanel voice={voice} />
    </form>
  );
};

export default VoiceMessageComposer;
