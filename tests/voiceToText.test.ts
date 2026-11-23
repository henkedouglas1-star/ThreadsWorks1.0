import "./setupDom";
import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";

import {
  classifyVoiceError,
  createInitialTranscriptState,
  detectVoiceRecognitionSupport,
  extractIncrementalTranscript,
  insertTranscriptAtCursor,
  removeDictatedSegment,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
  VOICE_PRIVACY_NOTICE,
} from "../src/lib/voiceToText";
import { useVoiceToText } from "../src/hooks/useVoiceToText";
import { VoiceInputStatusPanel, VoiceToTextButton } from "../src/components/VoiceToTextButton";
import VoiceMessageComposer from "../src/components/VoiceMessageComposer";
import ContentEngineView from "../src/components/ContentEngineView";
import { ContentPersistenceProvider } from "../src/context/ContentPersistenceContext";
import { ThreadsConnectionProvider } from "../src/context/ThreadsConnectionContext";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

class MockSpeechRecognition implements SpeechRecognitionLike {
  continuous = false;
  interimResults = false;
  lang = "en-US";
  maxAlternatives = 1;
  onstart: ((event?: unknown) => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: ((event?: unknown) => void) | null = null;

  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;
  isActive = false;
  throwOnStart: Error | null = null;

  start() {
    this.startCalls += 1;
    if (this.throwOnStart) {
      throw this.throwOnStart;
    }
    this.isActive = true;
    this.onstart?.({});
  }

  stop() {
    this.stopCalls += 1;
    this.isActive = false;
    this.onend?.({});
  }

  abort() {
    this.abortCalls += 1;
    this.isActive = false;
    this.onend?.({});
  }

  emitResults(
    results: Array<{ transcript: string; isFinal: boolean }>,
    resultIndex = 0
  ) {
    const list: any = { length: results.length };
    results.forEach((item, idx) => {
      list[idx] = {
        isFinal: item.isFinal,
        length: 1,
        0: { transcript: item.transcript, confidence: 0.96 },
      };
    });
    this.onresult?.({ resultIndex, results: list });
  }

  emitError(error: string, message?: string) {
    this.isActive = false;
    this.onerror?.({ error, message });
  }

  emitEnd() {
    this.isActive = false;
    this.onend?.({});
  }
}

function createDomEnv(options?: {
  speechApi?: "standard" | "webkit" | "none";
  isSecureContext?: boolean;
}) {
  const domWindow = new Window({ url: "https://threadsworks.app/create" });
  const instances: MockSpeechRecognition[] = [];

  Object.defineProperty(domWindow, "isSecureContext", {
    configurable: true,
    value: options?.isSecureContext ?? true,
  });

  const MockCtor = class extends MockSpeechRecognition {
    constructor() {
      super();
      instances.push(this);
    }
  };

  if (options?.speechApi === "standard") {
    (domWindow as any).SpeechRecognition = MockCtor;
  } else if (options?.speechApi === "webkit") {
    (domWindow as any).webkitSpeechRecognition = MockCtor;
  } else if (options?.speechApi !== "none") {
    (domWindow as any).SpeechRecognition = MockCtor;
  }

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
  (globalThis as any).MutationObserver = domWindow.MutationObserver;
  (globalThis as any).localStorage = domWindow.localStorage;
  (globalThis as any).sessionStorage = domWindow.sessionStorage;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: domWindow.navigator,
  });

  const rawContainer = domWindow.document.createElement("div");
  domWindow.document.body.appendChild(rawContainer);
  const container = rawContainer as unknown as HTMLDivElement;
  const root: Root = createRoot(container);

  const cleanup = async () => {
    await act(async () => {
      root.unmount();
    });
    await domWindow.happyDOM.close();
  };

  return { domWindow, container, root, instances, cleanup };
}

function setTextareaValue(textarea: HTMLTextAreaElement, nextValue: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  nativeSetter?.call(textarea, nextValue);
  textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function VoiceFieldHarness(props: {
  initialValue?: string;
  onSubmit?: (val: string) => void;
  speechRecognitionFactory?: () => SpeechRecognitionLike | null;
  targetWindow?: Record<string, any> | null;
}) {
  const [value, setValue] = useState(props.initialValue || "");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const voice = useVoiceToText({
    value,
    onChange: setValue,
    inputRef: ref,
    speechRecognitionFactory: props.speechRecognitionFactory,
    targetWindow: props.targetWindow,
  });

  return React.createElement(
    "form",
    {
      onSubmit: (e: React.FormEvent) => {
        e.preventDefault();
        props.onSubmit?.(value);
      },
    },
    React.createElement(VoiceToTextButton, {
      id: "harness-mic-btn",
      voice,
      fieldLabel: "test field",
    }),
    React.createElement("textarea", {
      id: "harness-textarea",
      ref,
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value),
    }),
    React.createElement(VoiceInputStatusPanel, { voice }),
    React.createElement("button", { id: "harness-submit-btn", type: "submit" }, "Submit")
  );
}

test("1. Supported browser detection identifies SpeechRecognition and webkitSpeechRecognition", () => {
  const stdWin = {
    isSecureContext: true,
    SpeechRecognition: MockSpeechRecognition,
  };
  const stdRes = detectVoiceRecognitionSupport(stdWin);
  assert.equal(stdRes.supported, true);
  assert.equal(stdRes.apiName, "SpeechRecognition");
  assert.equal(stdRes.reason, null);

  const webkitWin = {
    isSecureContext: true,
    webkitSpeechRecognition: MockSpeechRecognition,
  };
  const webkitRes = detectVoiceRecognitionSupport(webkitWin);
  assert.equal(webkitRes.supported, true);
  assert.equal(webkitRes.apiName, "webkitSpeechRecognition");
  assert.equal(webkitRes.reason, null);
});

test("2. Unsupported browser fallback retains text input and displays clear explanation", async () => {
  const { container, root, cleanup } = createDomEnv({ speechApi: "none" });
  try {
    await act(async () => {
      root.render(React.createElement(VoiceFieldHarness, { initialValue: "Manual note" }));
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    const textarea = container.querySelector("#harness-textarea") as HTMLTextAreaElement;
    assert.ok(micBtn);
    assert.equal(micBtn.getAttribute("data-voice-state"), "unsupported");
    assert.equal(textarea.value, "Manual note");

    // Clicking the unsupported button reveals a clear explanation while typing continues to work
    await act(async () => {
      micBtn.click();
    });

    const alertBox = container.querySelector('[role="alert"]');
    assert.ok(alertBox, "Unsupported fallback explanation should render");
    assert.match(alertBox.textContent || "", /not supported|isn't supported/i);

    await act(async () => {
      setTextareaValue(textarea, "Manual note still editable");
    });
    assert.equal(textarea.value, "Manual note still editable");

    // Insecure context check
    const insecure = detectVoiceRecognitionSupport({
      isSecureContext: false,
      location: { protocol: "http:", hostname: "example.com" },
      SpeechRecognition: MockSpeechRecognition,
    });
    assert.equal(insecure.supported, false);
    assert.equal(insecure.errorCode, "insecure-context");
  } finally {
    await cleanup();
  }
});

test("3. Microphone permission denial shows actionable error and preserves typing", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  try {
    await act(async () => {
      root.render(React.createElement(VoiceFieldHarness, { initialValue: "Draft idea" }));
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    await act(async () => {
      micBtn.click();
    });

    assert.equal(instances.length, 1);
    await act(async () => {
      instances[0].emitError("not-allowed");
    });

    const alertBox = container.querySelector('[data-voice-error-code="permission-denied"]');
    assert.ok(alertBox, "Permission denied alert must be displayed");
    assert.match(alertBox.textContent || "", /permission|denied|microphone access/i);
    assert.equal(micBtn.getAttribute("data-voice-state"), "idle");

    // Typing remains fully functional
    const textarea = container.querySelector("#harness-textarea") as HTMLTextAreaElement;
    assert.equal(textarea.value, "Draft idea");
    await act(async () => {
      setTextareaValue(textarea, "Draft idea typed manually");
    });
    assert.equal(textarea.value, "Draft idea typed manually");
  } finally {
    await cleanup();
  }
});

test("4. Recording start and stop never auto-starts and prevents duplicate sessions on rapid clicks", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  try {
    await act(async () => {
      root.render(React.createElement(VoiceFieldHarness));
    });

    // Must NEVER activate microphone automatically on mount
    assert.equal(instances.length, 0);

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    await act(async () => {
      micBtn.click();
    });

    assert.equal(instances.length, 1);
    assert.equal(instances[0].startCalls, 1);
    assert.equal(micBtn.getAttribute("data-voice-state"), "listening");
    assert.equal(micBtn.getAttribute("aria-pressed"), "true");

    // Privacy notice must be visible while listening
    assert.match(container.textContent || "", /never records in the background/i);
    assert.equal(VOICE_PRIVACY_NOTICE.includes("browser vendor"), true);

    // Stop listening immediately when requested
    await act(async () => {
      micBtn.click();
    });
    assert.equal(instances[0].stopCalls, 1);
    assert.equal(micBtn.getAttribute("data-voice-state"), "idle");
    assert.equal(micBtn.getAttribute("aria-pressed"), "false");
  } finally {
    await cleanup();
  }
});

test("5. Interim and final transcript handling shows live preview and commits only finalized speech", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  try {
    await act(async () => {
      root.render(React.createElement(VoiceFieldHarness));
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    const textarea = container.querySelector("#harness-textarea") as HTMLTextAreaElement;

    await act(async () => {
      micBtn.click();
    });

    // Emit interim transcript
    await act(async () => {
      instances[0].emitResults([{ transcript: "Building consistent", isFinal: false }], 0);
    });

    const preview = container.querySelector('[data-voice-interim-preview="true"]');
    assert.ok(preview, "Interim preview should render while speaking");
    assert.match(preview.textContent || "", /Building consistent/);
    assert.equal(textarea.value, "", "Interim transcript must not commit prematurely");

    // Promote to final transcript
    await act(async () => {
      instances[0].emitResults(
        [{ transcript: "Building consistent engagement on Threads", isFinal: true }],
        0
      );
    });

    assert.equal(textarea.value, "Building consistent engagement on Threads");
    assert.equal(container.querySelector('[data-voice-interim-preview="true"]'), null);

    // Stop preserves finalized transcription
    await act(async () => {
      micBtn.click();
    });
    assert.equal(textarea.value, "Building consistent engagement on Threads");
  } finally {
    await cleanup();
  }
});

test("6. Prevention of duplicate transcription across cumulative events and mobile Chrome bursts", () => {
  let state = createInitialTranscriptState();

  const makeEvent = (
    items: Array<{ transcript: string; isFinal: boolean }>,
    resultIndex: number
  ): SpeechRecognitionEventLike => {
    const list: any = { length: items.length };
    items.forEach((it, i) => {
      list[i] = { isFinal: it.isFinal, length: 1, 0: { transcript: it.transcript } };
    });
    return { resultIndex, results: list };
  };

  // Event 1: interim
  const r1 = extractIncrementalTranscript(
    makeEvent([{ transcript: "Share practical stories", isFinal: false }], 0),
    state
  );
  assert.deepEqual(r1.newFinalSegments, []);
  assert.equal(r1.interimTranscript, "Share practical stories");
  state = r1.nextState;

  // Event 2: index 0 becomes final
  const r2 = extractIncrementalTranscript(
    makeEvent([{ transcript: "Share practical stories", isFinal: true }], 0),
    state
  );
  assert.deepEqual(r2.newFinalSegments, ["Share practical stories"]);
  state = r2.nextState;

  // Event 3: cumulative list re-emits index 0 (already finalized) + new index 1
  const r3 = extractIncrementalTranscript(
    makeEvent(
      [
        { transcript: "Share practical stories", isFinal: true },
        { transcript: "every morning", isFinal: true },
      ],
      0
    ),
    state
  );
  assert.deepEqual(r3.newFinalSegments, ["every morning"]);
  state = r3.nextState;

  // Event 4: mobile Chrome consecutive duplicate final burst at new index
  const r4 = extractIncrementalTranscript(
    makeEvent(
      [
        { transcript: "Share practical stories", isFinal: true },
        { transcript: "every morning", isFinal: true },
        { transcript: "every morning", isFinal: true },
      ],
      2
    ),
    state
  );
  assert.deepEqual(r4.newFinalSegments, []);
  state = r4.nextState;

  // Event 5: mobile prefix expansion re-emission
  const r5 = extractIncrementalTranscript(
    makeEvent(
      [
        { transcript: "Share practical stories", isFinal: true },
        { transcript: "every morning", isFinal: true },
        { transcript: "every morning", isFinal: true },
        { transcript: "every morning at 9am", isFinal: true },
      ],
      3
    ),
    state
  );
  assert.deepEqual(r5.newFinalSegments, ["at 9am"]);
});

test("7. Existing text preservation, cursor insertion without overwrite, and clear last dictation", async () => {
  // Unit check: never overwrite highlighted selection; inserts cleanly after selection
  const inserted = insertTranscriptAtCursor("Keep this text.", "added via voice", 0, 9);
  assert.equal(inserted.nextValue, "Keep this added via voice text.");

  // Unit check: removing last dictated segment restores original text cleanly
  const undone = removeDictatedSegment(
    inserted.nextValue,
    inserted.insertedText,
    inserted.insertedStart,
    inserted.insertedEnd
  );
  assert.equal(undone, "Keep this text.");

  // Full component check
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  try {
    await act(async () => {
      root.render(
        React.createElement(VoiceFieldHarness, { initialValue: "Existing creator notes." })
      );
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    const textarea = container.querySelector("#harness-textarea") as HTMLTextAreaElement;

    await act(async () => {
      micBtn.click();
    });
    await act(async () => {
      instances[0].emitResults([{ transcript: "Focus on authentic hooks.", isFinal: true }], 0);
      instances[0].emitEnd();
    });

    assert.equal(textarea.value, "Existing creator notes. Focus on authentic hooks.");

    // Clear Dictation removes ONLY the dictated segment and preserves existing text
    const clearBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      /Clear Dictation/i.test(b.textContent || "")
    );
    assert.ok(clearBtn, "Clear Dictation control should appear after voice input");
    await act(async () => {
      clearBtn.click();
    });
    assert.equal(textarea.value, "Existing creator notes.");
  } finally {
    await cleanup();
  }
});

test("8. Manual transcript editing allows creator to edit and expand dictated text freely", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  try {
    await act(async () => {
      root.render(React.createElement(VoiceFieldHarness));
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    const textarea = container.querySelector("#harness-textarea") as HTMLTextAreaElement;

    await act(async () => {
      micBtn.click();
    });
    await act(async () => {
      instances[0].emitResults([{ transcript: "Write about audience retention", isFinal: true }], 0);
      micBtn.click();
    });

    assert.equal(textarea.value, "Write about audience retention");

    // Creator manually edits and expands the transcription
    await act(async () => {
      setTextareaValue(
        textarea,
        "Write about audience retention for solo creators using 3-part threads."
      );
    });
    assert.equal(
      textarea.value,
      "Write about audience retention for solo creators using 3-part threads."
    );
  } finally {
    await cleanup();
  }
});

test("9. Recognition error recovery handles silence, network, and interrupted sessions with clean retry", async () => {
  // Classify all common browser speech error codes cleanly
  assert.equal(classifyVoiceError("no-speech").canRetry, true);
  assert.equal(classifyVoiceError("network").canRetry, true);
  assert.equal(classifyVoiceError("audio-capture").canRetry, true);
  assert.equal(classifyVoiceError("aborted").canRetry, true);

  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  try {
    await act(async () => {
      root.render(React.createElement(VoiceFieldHarness, { initialValue: "Saved intro." }));
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    const textarea = container.querySelector("#harness-textarea") as HTMLTextAreaElement;

    await act(async () => {
      micBtn.click();
    });
    await act(async () => {
      instances[0].emitError("no-speech");
    });

    assert.ok(container.querySelector('[data-voice-error-code="no-speech"]'));
    assert.equal(textarea.value, "Saved intro.");

    // Retry starts a fresh session and succeeds
    const retryBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      /Retry Voice Input/i.test(b.textContent || "")
    );
    assert.ok(retryBtn, "Retry button should render for retryable errors");

    await act(async () => {
      retryBtn.click();
    });
    assert.equal(instances.length, 2);
    assert.equal(container.querySelector('[role="alert"]'), null);

    await act(async () => {
      instances[1].emitResults([{ transcript: "Recovered smoothly.", isFinal: true }], 0);
    });
    assert.equal(textarea.value, "Saved intro. Recovered smoothly.");
  } finally {
    await cleanup();
  }
});

test("10. Resource cleanup aborts active session and ignores late events on unmount", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  try {
    await act(async () => {
      root.render(React.createElement(VoiceFieldHarness));
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    await act(async () => {
      micBtn.click();
    });

    const activeInstance = instances[0];
    assert.equal(activeInstance.isActive, true);

    await act(async () => {
      root.unmount();
    });

    assert.equal(activeInstance.abortCalls, 1, "Unmount must immediately abort active recognition");
    assert.equal(activeInstance.onresult, null, "Event handlers must be detached on unmount");
    assert.equal(activeInstance.onerror, null);
    assert.equal(activeInstance.onend, null);
  } finally {
    await cleanup();
  }
});

test("11. Content Engine integration transcribes spoken idea into existing input without auto-generating", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  const originalFetch = globalThis.fetch;
  let generationFetchCalls = 0;

  (globalThis as any).fetch = async (url: string) => {
    if (String(url).includes("generate-posts-batch")) {
      generationFetchCalls += 1;
    }
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      text: async () => JSON.stringify({ connected: false }),
      json: async () => ({ connected: false }),
    };
  };

  try {
    await act(async () => {
      root.render(
        React.createElement(
          ThreadsConnectionProvider,
          null,
          React.createElement(
            ContentPersistenceProvider,
            null,
            React.createElement(ContentEngineView, {
              profile: {
                uid: "test-creator-1",
                email: "creator@example.com",
                customInstruction: "Practical Threads strategy for small creators.",
              } as any,
              onNavigateToTab: () => {},
              subscriptionStatus: "active",
            })
          )
        )
      );
    });

    const micBtn = container.querySelector("#content-engine-voice-btn") as HTMLButtonElement;
    const topicInput = container.querySelector("#generation-topic-input") as HTMLTextAreaElement;
    const createBtn = container.querySelector("#create-content-btn") as HTMLButtonElement;
    const postsSelect = container.querySelector("#setting-posts-to-create") as HTMLSelectElement;

    assert.ok(micBtn, "Content Engine microphone button must be rendered");
    assert.ok(topicInput, "Content Engine topic textarea must be rendered");
    assert.ok(createBtn, "Existing Create Content button must remain intact");
    assert.ok(postsSelect, "Existing How Many Posts selector (including 8 posts) must remain intact");
    assert.ok(
      Array.from(postsSelect.options).some((opt) => opt.value === "8"),
      "8-post generation option must be preserved"
    );

    // Tap microphone and speak the example idea
    await act(async () => {
      micBtn.click();
    });
    assert.equal(instances.length, 1);

    const spokenIdea =
      "I want to write about how small creators can build consistent engagement without spending all day online.";
    await act(async () => {
      instances[0].emitResults([{ transcript: spokenIdea, isFinal: true }], 0);
      instances[0].emitEnd();
    });

    assert.equal(topicInput.value, spokenIdea);
    assert.equal(
      generationFetchCalls,
      0,
      "Content Engine must NOT auto-generate when speech recognition finishes"
    );

    // Creator can edit/expand the transcription before submitting
    await act(async () => {
      setTextareaValue(topicInput, `${spokenIdea} Focus on 15-minute daily routines.`);
    });
    assert.equal(
      topicInput.value,
      `${spokenIdea} Focus on 15-minute daily routines.`
    );
  } finally {
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

test("12. ThreadGuide integration populates message input via voice and lets creator edit before sending", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "webkit" });
  const submittedMessages: string[] = [];

  function ThreadGuideMockPanel() {
    const [draft, setDraft] = useState("");
    return React.createElement(VoiceMessageComposer, {
      value: draft,
      onChange: setDraft,
      onSubmit: (msg) => {
        submittedMessages.push(msg);
        setDraft("");
      },
    });
  }

  try {
    await act(async () => {
      root.render(React.createElement(ThreadGuideMockPanel));
    });

    const micBtn = container.querySelector("#threadguide-voice-btn") as HTMLButtonElement;
    const msgInput = container.querySelector("#threadguide-message-input") as HTMLTextAreaElement;
    const sendBtn = container.querySelector("#threadguide-send-btn") as HTMLButtonElement;

    assert.ok(micBtn);
    assert.ok(msgInput);
    assert.ok(sendBtn);

    // Creator taps mic and asks a question verbally
    await act(async () => {
      micBtn.click();
    });
    assert.equal(instances.length, 1);

    const spokenQuestion = "Why didn’t my scheduled post publish yesterday?";
    await act(async () => {
      instances[0].emitResults([{ transcript: spokenQuestion, isFinal: true }], 0);
      instances[0].emitEnd();
    });

    assert.equal(msgInput.value, spokenQuestion);
    assert.equal(
      submittedMessages.length,
      0,
      "ThreadGuide composer must NEVER auto-submit when speech recognition ends"
    );

    // Creator edits the message before sending
    const editedQuestion = `${spokenQuestion} It was scheduled for 9:00 AM.`;
    await act(async () => {
      setTextareaValue(msgInput, editedQuestion);
    });
    assert.equal(msgInput.value, editedQuestion);

    // Creator explicitly submits
    await act(async () => {
      sendBtn.click();
    });
    assert.deepEqual(submittedMessages, [editedQuestion]);
    assert.equal(msgInput.value, "");
  } finally {
    await cleanup();
  }
});

test("13. No automatic submission without explicit user confirmation across start, result, stop, and error", async () => {
  const { container, root, instances, cleanup } = createDomEnv({ speechApi: "standard" });
  let submitCount = 0;

  try {
    await act(async () => {
      root.render(
        React.createElement(VoiceFieldHarness, {
          onSubmit: () => {
            submitCount += 1;
          },
        })
      );
    });

    const micBtn = container.querySelector("#harness-mic-btn") as HTMLButtonElement;
    const submitBtn = container.querySelector("#harness-submit-btn") as HTMLButtonElement;

    await act(async () => {
      micBtn.click();
    });
    await act(async () => {
      instances[0].emitResults([{ transcript: "First sentence.", isFinal: false }], 0);
      instances[0].emitResults([{ transcript: "First sentence.", isFinal: true }], 0);
      micBtn.click(); // explicit stop
    });
    assert.equal(submitCount, 0, "Stopping voice input must never auto-submit");

    // Second session ending naturally via onend
    await act(async () => {
      micBtn.click();
    });
    await act(async () => {
      instances[1].emitResults([{ transcript: "Second sentence.", isFinal: true }], 0);
      instances[1].emitEnd();
    });
    assert.equal(submitCount, 0, "Natural speech end must never auto-submit");

    // Only explicit submit triggers submission
    await act(async () => {
      submitBtn.click();
    });
    assert.equal(submitCount, 1);
  } finally {
    await cleanup();
  }
});
