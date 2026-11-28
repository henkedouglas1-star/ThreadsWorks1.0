import React from "react";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { CONTENT_PAYS_US_APPS } from "../../data/contentPaysUsRegistry";

interface ContentPaysUsAboutProps {
  onNavigate: (route: string) => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
  isAuthenticated?: boolean;
}

const GOVERNING_PRINCIPLES = [
  "One unified ecosystem at ThreadsWorks.com.",
  "One creator identity carried across every tool.",
  "One shared intelligence layer so you never repeat yourself.",
  "Shared creator projects connecting content, offers, and products.",
  "Specialized applications built around clear customer jobs.",
  "Real business outcomes prioritized over vanity metrics."
];

export function ContentPaysUsAbout({
  onNavigate,
  onOpenAuth,
  isAuthenticated = false
}: ContentPaysUsAboutProps) {
  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  const handlePrimaryCta = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (isAuthenticated) {
      onNavigate("/workspace");
    } else if (onOpenAuth) {
      onOpenAuth("signup");
    } else {
      onNavigate("/?auth=signup");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-16">
      {/* Header */}
      <header className="max-w-3xl space-y-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
          About ContentPaysUs &amp; ThreadsWorks
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.08]">
          It started with a thread.
        </h1>
        <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-zinc-400">
          ThreadsWorks is the original application where our work began, and ThreadsWorks.com remains our official home as we build the connected ContentPaysUs ecosystem.
        </p>
      </header>

      {/* Origin Story Section */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-7 sm:p-11 space-y-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
          Our Story
        </p>
        <div className="max-w-3xl space-y-4 text-base sm:text-lg leading-relaxed text-slate-700 dark:text-zinc-300">
          <p>
            ThreadsWorks began with a simple purpose: helping creators turn their ideas into content.
          </p>
          <p>
            But creating content is only part of building a successful creator business.
          </p>
          <p>
            Creators also need to understand their audience, discover demand, build valuable products, find customers and make sales.
          </p>
          <p>
            That is why ThreadsWorks is evolving into ContentPaysUs — a connected ecosystem designed to support the entire creator journey.
          </p>
          <p className="font-semibold text-slate-950 dark:text-white pt-1">
            ThreadsWorks is where it started. ContentPaysUs is what we’re building together.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-7 sm:p-11 space-y-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
          Our Mission
        </p>
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
          1,000 creators. 1,000 first sales.
        </h2>
        <p className="text-base sm:text-lg leading-relaxed text-slate-700 dark:text-zinc-300 max-w-3xl">
          Our goal is to help 1,000 creators achieve their first verified sale through ContentPaysUs.
        </p>
        <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-zinc-400 max-w-3xl">
          We believe creator success should be measured by meaningful business outcomes—building useful work and serving real paying customers—not just follower counts, impressions, or software subscriptions.
        </p>
        <p className="pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs leading-relaxed text-slate-500 dark:text-zinc-400 max-w-3xl">
          Transparency note: This is our guiding mission and long-term objective—not an achieved milestone or guarantee of earnings.
        </p>
      </section>

      {/* Architecture & Honest Roadmap */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-7 space-y-5">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">
            How the ecosystem is designed
          </h2>
          <ul className="space-y-3 text-sm text-slate-700 dark:text-zinc-300">
            {GOVERNING_PRINCIPLES.map((principle) => (
              <li key={principle} className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <span>{principle}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-7 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              Transparent progressive delivery
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
              We label every application across our {CONTENT_PAYS_US_APPS.length}-application roadmap honestly. <strong className="font-semibold text-slate-900 dark:text-zinc-200">ThreadsWorks</strong> is Available today for Meta Threads writing and scheduling. <strong className="font-semibold text-slate-900 dark:text-zinc-200">ProductWorks</strong> is In Development for downloadable product assets. All other roadmap applications—including ContentPaysUs Academy, CommunityWorks, MeetingWorks, and First Sale Engine—are clearly marked Planned until built and verified.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <a
              href={isAuthenticated ? "/workspace" : "/?auth=signup"}
              onClick={handlePrimaryCta}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
            >
              {isAuthenticated ? "Open Workspace" : "Get Started Free"} <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="/applications"
              onClick={(e) => handleLink(e, "/applications")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Explore {CONTENT_PAYS_US_APPS.length} Applications <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
