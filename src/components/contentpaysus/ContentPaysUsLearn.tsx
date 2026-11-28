import React from "react";
import { BookOpen, Check, ExternalLink } from "lucide-react";
import { LEARN_TOPICS } from "../../data/contentPaysUsLearn";
import { ContentPaysUsAcademyView } from "./ContentPaysUsAcademyView";

interface ContentPaysUsLearnProps {
  onNavigate: (route: string) => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
  isAuthenticated?: boolean;
}

export function ContentPaysUsLearn({
  onNavigate,
  onOpenAuth,
  isAuthenticated = false
}: ContentPaysUsLearnProps) {
  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-16">
      {/* Header */}
      <header className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
            ContentPaysUs Academy
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Live · Free Independent Learning Destination
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.08]">
          Learn for free. Build with AI. Grow together.
        </h1>

        <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-zinc-400">
          ContentPaysUs Academy is our free, independent creator education hub. Start our flagship course below—with structured lessons, practical assignments, downloadable worksheets, and direct links into the workspace tools.
        </p>
      </header>

      {/* Live Interactive Flagship Course */}
      <ContentPaysUsAcademyView
        isAuthenticated={isAuthenticated}
        onOpenAuth={onOpenAuth}
        onLaunchApp={(appId) => {
          if (appId === "threadsworks") {
            onNavigate(isAuthenticated ? "/create" : "/?auth=signup");
          } else {
            onNavigate(isAuthenticated ? "/workspace" : `/applications/${appId}`);
          }
        }}
      />

      {/* Structured Curriculum Guide (9 Foundational Reference Topics) */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
            Creator Business Reference Guide
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Core principles you can apply today
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
            Nine foundational disciplines that map directly across Create &amp; Sell, Connect &amp; Grow, and Automate &amp; Scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {LEARN_TOPICS.map((topic) => (
            <article
              key={topic.id}
              className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  {topic.stage}
                </span>

                <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                  {topic.title}
                </h3>

                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {topic.summary}
                </p>

                <div className="space-y-2 pt-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                    Key Principles
                  </p>
                  <ul className="space-y-2">
                    {topic.keyPrinciples.map((principle, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                        <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <span>{principle}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 mb-1.5">
                  Ecosystem Connection
                </p>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                  {topic.practicalApplication}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom Action Bar */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-xl space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white">
            Start applying these principles today
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            Use ThreadsWorks today to build consistent Meta Threads momentum, or open all 20 ContentPaysUs applications inside your workspace.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <a
            href="/create"
            onClick={(e) => handleLink(e, "/create")}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
          >
            Launch ThreadsWorks <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="/applications"
            onClick={(e) => handleLink(e, "/applications")}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-lg text-sm font-semibold border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Explore 20 Applications
          </a>
        </div>
      </section>
    </div>
  );
}
