import React from "react";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import {
  CONTENT_PAYS_US_APPS,
  getAvailabilityDotClass,
  getAvailabilityTextClass,
  getEcosystemAppById
} from "../../data/contentPaysUsRegistry";

interface ContentPaysUsAppDetailProps {
  appId: string;
  onNavigate: (route: string) => void;
}

export function ContentPaysUsAppDetail({ appId, onNavigate }: ContentPaysUsAppDetailProps) {
  const app = getEcosystemAppById(appId);

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  if (!app) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white">
          Application Not Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          The requested application could not be found among the {CONTENT_PAYS_US_APPS.length} specialized ContentPaysUs applications.
        </p>
        <a
          href="/applications"
          onClick={(e) => handleLink(e, "/applications")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Applications Directory
        </a>
      </div>
    );
  }

  const connectedApps = app.connectedAppIds
    .map((id) => getEcosystemAppById(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-10">
      {/* Back Link */}
      <a
        href="/applications"
        onClick={(e) => handleLink(e, "/applications")}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Applications Directory ({CONTENT_PAYS_US_APPS.length} Apps)
      </a>

      {/* Header Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-7 sm:p-10 space-y-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${getAvailabilityTextClass(app.availability)}`}>
            <span
              className={`h-2 w-2 rounded-full ${getAvailabilityDotClass(app.availability)}`}
              aria-hidden="true"
            />
            {app.availability}
          </span>
          <span className="font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            {app.category}
          </span>
          <span className="font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Journey Stage: {app.journeyStage}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white">
          {app.name}
        </h1>

        <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-400">
          {app.headline}
        </p>

        <p className="text-base leading-relaxed text-slate-600 dark:text-zinc-300">
          {app.shortDescription}
        </p>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#0c0c10] p-4 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
          <strong className="font-semibold text-slate-900 dark:text-zinc-200">Current status ({app.availability}): </strong>
          {app.availabilityNote}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-3">
          <a
            href={app.externalLink || "/workspace"}
            onClick={(e) => handleLink(e, app.externalLink || "/workspace")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
          >
            Open {app.name} in Workspace
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="/applications"
            onClick={(e) => handleLink(e, "/applications")}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Browse All {CONTENT_PAYS_US_APPS.length} Applications
          </a>
        </div>
      </section>

      {/* Purpose & Problem Solved */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 sm:p-7 space-y-2.5">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            Core Purpose
          </p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
            {app.purpose}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 sm:p-7 space-y-2.5">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            Customer Problem Solved
          </p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
            {app.problemSolved}
          </p>
        </div>
      </section>

      {/* Intended Outputs */}
      <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 sm:p-8 space-y-5">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">
          Deliverables &amp; Capabilities
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {app.intendedOutputs.map((output, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#0d0d11] p-4 text-sm text-slate-800 dark:text-zinc-200"
            >
              <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span>{output}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Ecosystem Relationship & Connected Apps */}
      <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 sm:p-8 space-y-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
          Ecosystem Integration
        </p>
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          How {app.name} connects to ContentPaysUs
        </h2>
        <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-zinc-300">
          {app.ecosystemRelationship}
        </p>

        {connectedApps.length > 0 && (
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 mr-1">
              Connects with:
            </span>
            {connectedApps.map((connected) => (
              <a
                key={connected.id}
                href={`/applications/${connected.id}`}
                onClick={(e) => handleLink(e, `/applications/${connected.id}`)}
                className="px-3 py-1 rounded-md border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:border-indigo-500 transition-colors"
              >
                {connected.name}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
