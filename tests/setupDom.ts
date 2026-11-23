import { Window } from "happy-dom";

// Bootstrap a happy-dom Window on globalThis BEFORE react-dom/client evaluates
// so React's module-init feature detection (canUseDOM, isInputEventSupported)
// sees a real DOM environment in Node test runs.
if (typeof (globalThis as any).window === "undefined") {
  const bootstrapWindow = new Window({ url: "https://preview.local/" });
  (globalThis as any).window = bootstrapWindow;
  (globalThis as any).document = bootstrapWindow.document;
  (globalThis as any).HTMLElement = bootstrapWindow.HTMLElement;
  (globalThis as any).HTMLInputElement = bootstrapWindow.HTMLInputElement;
  (globalThis as any).HTMLTextAreaElement = bootstrapWindow.HTMLTextAreaElement;
  (globalThis as any).Element = bootstrapWindow.Element;
  (globalThis as any).Node = bootstrapWindow.Node;
  (globalThis as any).Event = bootstrapWindow.Event;
  (globalThis as any).InputEvent = bootstrapWindow.InputEvent;
  (globalThis as any).CustomEvent = bootstrapWindow.CustomEvent;
  (globalThis as any).PopStateEvent = bootstrapWindow.PopStateEvent;
  (globalThis as any).MutationObserver = bootstrapWindow.MutationObserver;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: bootstrapWindow.navigator,
  });
}
