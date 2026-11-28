import React, { useState } from "react";
import { Share2 } from "lucide-react";

function getPageUrl(): string {
  const pathname = window.location.pathname;
  const authMode = new URLSearchParams(window.location.search).get("auth");
  if (pathname === "/" && (authMode === "signup" || authMode === "signin")) {
    return `${window.location.origin}/?auth=${authMode}`;
  }

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (canonical) return canonical;
  return `${window.location.origin}${pathname}`;
}

async function copyPageUrl(url: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return;
    } catch {
      // Fall through to the legacy copy command when clipboard access is blocked.
    }
  }

  const input = document.createElement("textarea");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy was not available");
}

interface PageShareButtonProps {
  className?: string;
}

export default function PageShareButton({ className = "" }: PageShareButtonProps) {
  const [status, setStatus] = useState("");

  const sharePage = async () => {
    const url = getPageUrl();
    const title = document.title || "ThreadsWorks & ContentPaysUs";
    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content || title;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: description, url });
        setStatus("Shared");
        window.setTimeout(() => setStatus(""), 1800);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      await copyPageUrl(url);
      setStatus("Link copied");
    } catch {
      setStatus("Could not copy link");
    }
    window.setTimeout(() => setStatus(""), 1800);
  };

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={sharePage}
        aria-label="Share this page"
        title="Share this page"
        className={
          className ||
          "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        }
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
      </button>
      {status && (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-[60] mt-2 whitespace-nowrap rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white shadow-lg"
        >
          {status}
        </span>
      )}
    </span>
  );
}
