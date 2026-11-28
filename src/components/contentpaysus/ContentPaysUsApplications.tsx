import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Compass, ExternalLink, Search } from "lucide-react";
import {
  AVAILABILITY_FILTERS,
  AppAvailabilityStatus,
  CONTENT_PAYS_US_ACADEMY,
  CONTENT_PAYS_US_APPS,
  ECOSYSTEM_CATEGORY_TABS,
  EcosystemCategory,
  FIRST_SALE_ENGINE_WORKFLOW,
  getAvailabilityDotClass,
  getAvailabilityTextClass
} from "../../data/contentPaysUsRegistry";
import { PermanentCategoryBar } from "./PermanentCategoryBar";

interface ContentPaysUsApplicationsProps {
  onNavigate: (route: string) => void;
}

export function ContentPaysUsApplications({ onNavigate }: ContentPaysUsApplicationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<EcosystemCategory>("Create & Sell");
  const [selectedAvailability, setSelectedAvailability] = useState<"All" | AppAvailabilityStatus>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const counts = useMemo(() => {
    const available = CONTENT_PAYS_US_APPS.filter((a) => a.availability === "Available").length;
    const inDev = CONTENT_PAYS_US_APPS.filter((a) => a.availability === "In Development").length;
    const planned = CONTENT_PAYS_US_APPS.filter((a) => a.availability === "Planned").length;
    return { total: CONTENT_PAYS_US_APPS.length, available, inDev, planned };
  }, []);

  const activeCategoryMeta = ECOSYSTEM_CATEGORY_TABS.find((t) => t.id === selectedCategory)!;

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CONTENT_PAYS_US_APPS.filter((app) => {
      const matchesCategory = q ? true : app.category === selectedCategory;
      const matchesAvailability = selectedAvailability === "All" || app.availability === selectedAvailability;
      const matchesSearch =
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.headline.toLowerCase().includes(q) ||
        app.shortDescription.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        app.journeyStage.toLowerCase().includes(q);
      return matchesCategory && matchesAvailability && matchesSearch;
    });
  }, [selectedCategory, selectedAvailability, searchQuery]);

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-10 space-y-5">
        <header className="max-w-3xl space-y-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
            Ecosystem Directory · {counts.total} Specialized Applications
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.08]">
            Specialized applications connected around one creator business.
          </h1>
          <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-zinc-400">
            Explore all {counts.total} ContentPaysUs applications organized into three permanent categories—<strong className="font-semibold text-slate-900 dark:text-zinc-200">Create &amp; Sell</strong>, <strong className="font-semibold text-slate-900 dark:text-zinc-200">Connect &amp; Grow</strong>, and <strong className="font-semibold text-slate-900 dark:text-zinc-200">Automate &amp; Scale</strong>. Every application and tool is labeled honestly by real availability.
          </p>

          {/* Transparent Availability Summary */}
          <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
              <strong className="text-slate-950 dark:text-white">{counts.available} Available</strong> (Fully functional in workspace)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-hidden="true" />
              <strong className="text-slate-950 dark:text-white">{counts.inDev} In Development</strong> (Core tools live; external integrations gated)
            </span>
            {counts.planned > 0 && (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-zinc-500" aria-hidden="true" />
                <strong className="text-slate-950 dark:text-white">{counts.planned} Planned</strong>
              </span>
            )}
          </div>
        </header>
      </div>

      {/* Permanent Sticky 3-Category Bar (Always Visible While Scrolling) */}
      <PermanentCategoryBar
        activeCategory={selectedCategory}
        onSelectCategory={(category) => {
          setSelectedCategory(category);
          setSearchQuery("");
        }}
        onOpenAcademy={() => onNavigate("/learn")}
        onOpenFirstSaleEngine={() => onNavigate("/workspace")}
        stickyTopClass="top-16"
        variant="public"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10">
        {/* Active Category Header + Search & Status Filter */}
        <section
          aria-label="Filter applications"
          className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                {searchQuery.trim() ? "Searching Across All 20 Applications" : `Category · ${activeCategoryMeta.label}`}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                {searchQuery.trim()
                  ? `Showing ${filteredApps.length} matching applications across all three categories.`
                  : activeCategoryMeta.tagline}
              </p>
            </div>

            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all 20 applications..."
                aria-label="Search applications"
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] pl-9 pr-3 py-2 text-xs text-slate-950 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 mr-1">
              Status:
            </span>
            {AVAILABILITY_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedAvailability(status)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedAvailability === status
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </section>

        {/* Applications Grid */}
        <section aria-label="Application grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredApps.map((app) => (
            <a
              key={app.id}
              href={`/applications/${app.id}`}
              onClick={(e) => handleLink(e, `/applications/${app.id}`)}
              className="group rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 flex flex-col justify-between gap-5 hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getAvailabilityTextClass(app.availability)}`}>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${getAvailabilityDotClass(app.availability)}`}
                      aria-hidden="true"
                    />
                    {app.availability}
                  </span>
                  <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                    {app.category}
                  </span>
                </div>

                <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                  {app.name}
                </h2>

                <p className="mt-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  {app.headline}
                </p>

                <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  {app.shortDescription}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-500">
                  Stage: {app.journeyStage}
                </span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Explore <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </a>
          ))}
        </section>

        {filteredApps.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-12 text-center">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              No applications match your current filter. Reset filters to view applications in {selectedCategory}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedAvailability("All");
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-950 dark:bg-white text-white dark:text-slate-950 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Independent Ecosystem Destinations (Clearly Separated From The 20 Apps) */}
        <section aria-label="Independent ecosystem destinations" className="pt-6 border-t border-slate-200 dark:border-zinc-800 space-y-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
              Ecosystem Foundations (Independent of the 20 Applications)
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Free education &amp; guided cross-app execution
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    {CONTENT_PAYS_US_ACADEMY.type}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                    {CONTENT_PAYS_US_ACADEMY.availability}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-950 dark:text-white">
                  {CONTENT_PAYS_US_ACADEMY.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {CONTENT_PAYS_US_ACADEMY.description}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
                <a
                  href="/learn"
                  onClick={(e) => handleLink(e, "/learn")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline underline-offset-4"
                >
                  Open ContentPaysUs Academy <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {FIRST_SALE_ENGINE_WORKFLOW.type}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                    {FIRST_SALE_ENGINE_WORKFLOW.availability}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-950 dark:text-white">
                  {FIRST_SALE_ENGINE_WORKFLOW.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {FIRST_SALE_ENGINE_WORKFLOW.description}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
                <a
                  href="/workspace"
                  onClick={(e) => handleLink(e, "/workspace")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline underline-offset-4"
                >
                  Launch First Sale Engine in Workspace <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
