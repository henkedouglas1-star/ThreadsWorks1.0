import React from "react";
import { ArrowRight, BookOpen, Check, ExternalLink } from "lucide-react";
import { LEARN_TOPICS } from "../../data/contentPaysUsLearn";

interface ContentPaysUsLearnProps {
  onNavigate: (route: string) => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
  isAuthenticated?: boolean;
}

const FIRST_SALE_MODULES = [
  {
    step: "01",
    title: "Choose a concrete buyer problem",
    detail: "Identify a specific question or bottleneck your audience already asks about instead of guessing in isolation."
  },
  {
    step: "02",
    title: "Package a focused first product",
    detail: "Build a concise, useful digital asset or service people can put to work immediately without overcomplicating delivery."
  },
  {
    step: "03",
    title: "Share clear, helpful content",
    detail: "Publish practical lessons and honest examples on Meta Threads so interested readers naturally raise their hand."
  },
  {
    step: "04",
    title: "Earn and fulfill your first verified sale",
    detail: "Guide early buyers transparently, deliver what you promised, and collect real feedback to improve your offer."
  }
];

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-16">
      {/* Header */}
      <header className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
            ContentPaysUs Academy
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-zinc-500" aria-hidden="true" />
            Planned Free Learning Destination
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.08]">
          Learn for free. Build with AI. Grow together.
        </h1>

        <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-zinc-400">
          ContentPaysUs Academy is our planned free education hub for creators. Foundational business training should be open to everyone—whether you are writing your first post or preparing your first digital product.
        </p>
      </header>

      {/* Flagship Planned Course Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-7 sm:p-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div className="max-w-2xl space-y-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Flagship Course · Planned (Not Yet Live)
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              How to Get Your First Sale
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-zinc-400">
              Our inaugural free course is being built to guide creators step by step from raw knowledge to their first verified paying customer—pairing practical business principles directly with ContentPaysUs tools.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-400 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-zinc-500" aria-hidden="true" />
            Planned · Free Access
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FIRST_SALE_MODULES.map((mod) => (
            <div
              key={mod.step}
              className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#0d0d11] p-5 space-y-2"
            >
              <span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                Module {mod.step}
              </span>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">{mod.title}</h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">{mod.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#0d0d11] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Future Community-Created Free Courses
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400 max-w-2xl">
              As ContentPaysUs Academy matures, creators across the community will be able to publish and share their own free courses—building a peer-driven library of practical skills.
            </p>
          </div>
          <a
            href={isAuthenticated ? "/workspace" : "/?auth=signup"}
            onClick={handlePrimaryCta}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors shrink-0"
          >
            {isAuthenticated ? "Open Workspace" : "Get Started Free"} <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* Structured Curriculum Guide (Available Reading Today) */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
            Creator Business Reference Guide
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Core principles you can apply today
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
            While the full interactive Academy experience is planned, these nine foundational topics outline the complete path from brand clarity to sustainable creator growth.
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
            Use ThreadsWorks today to build consistent Meta Threads momentum, or browse all 20 applications on the ContentPaysUs roadmap.
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
