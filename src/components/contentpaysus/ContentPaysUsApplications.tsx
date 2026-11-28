import React, { useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Search } from "lucide-react";
import {
  AVAILABILITY_FILTERS,
  AppAvailabilityStatus,
  CONTENT_PAYS_US_APPS,
  ECOSYSTEM_CATEGORIES,
  getAvailabilityDotClass,
  getAvailabilityTextClass
} from "../../data/contentPaysUsRegistry";

interface ContentPaysUsApplicationsProps {
  onNavigate: (route: string) => void;
}

export function ContentPaysUsApplications({ onNavigate }: ContentPaysUsApplicationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedAvailability, setSelectedAvailability] = useState<"All" | AppAvailabilityStatus>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const counts = useMemo(() => {
    const available = CONTENT_PAYS_US_APPS.filter((a) => a.availability === "Available").length;
    const inDev = CONTENT_PAYS_US_APPS.filter((a) => a.availability === "In Development").length;
    const planned = CONTENT_PAYS_US_APPS.filter((a) => a.availability === "Planned").length;
    return { total: CONTENT_PAYS_US_APPS.length, available, inDev, planned };
  }, []);

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CONTENT_PAYS_US_APPS.filter((app) => {
      const matchesCategory = selectedCategory === "All" || app.category === selectedCategory;
      const matchesAvailability = selectedAvailability === "All" || app.availability === selectedAvailability;
      const matchesSearch =
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.headline.toLowerCase().includes(q) ||
        app.shortDescription.toLowerCase().includes(q) ||
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-12">
      {/* Header */}
      <header className="max-w-3xl space-y-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
          Ecosystem Directory · {counts.total}-Application Roadmap
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.08]">
          Specialized applications connected around one creator business.
        </h1>
        <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-zinc-400">
          Every application in ContentPaysUs is classified honestly as <strong className="font-semibold text-slate-900 dark:text-zinc-200">Available</strong>, <strong className="font-semibold text-slate-900 dark:text-zinc-200">In Development</strong>, or <strong className="font-semibold text-slate-900 dark:text-zinc-200">Planned</strong>. Start with ThreadsWorks today and carry your creator profile forward as new applications launch.
        </p>

        {/* Transparent Availability Summary */}
        <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
            <strong className="text-slate-950 dark:text-white">{counts.available} Available</strong> (ThreadsWorks)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-hidden="true" />
            <strong className="text-slate-950 dark:text-white">{counts.inDev} In Development</strong> (ProductWorks)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-zinc-500" aria-hidden="true" />
            <strong className="text-slate-950 dark:text-white">{counts.planned} Planned</strong> (Roadmap)
          </span>
        </div>
      </header>

      {/* Live & Active Quick-Access Bar for Existing & New Customers */}
      <section aria-label="Available and active applications" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Ready to Use Today
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                Available
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">ThreadsWorks</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Write voice-preserved Meta Threads posts and multi-part threads, refine opening hooks, organize your library, and schedule publishing via official Meta OAuth.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-200 dark:border-zinc-800">
            <a
              href="/create"
              onClick={(e) => handleLink(e, "/create")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
            >
              Launch ThreadsWorks <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="/applications/threadsworks"
              onClick={(e) => handleLink(e, "/applications/threadsworks")}
              className="text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white"
            >
              View details
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Active Workspace Generator
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-hidden="true" />
                In Development
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">ProductWorks</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Generate downloadable 2-page PDF playbooks, 7-slide PNG/ZIP carousels, companion posts, and storefront sales copy from a single idea or Threads post.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-200 dark:border-zinc-800">
            <a
              href="/productworks"
              onClick={(e) => handleLink(e, "/productworks")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Explore ProductWorks <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="/applications/productworks"
              onClick={(e) => handleLink(e, "/applications/productworks")}
              className="text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white"
            >
              View details
            </a>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section aria-label="Filter applications" className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {ECOSYSTEM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-slate-950 dark:bg-white text-white dark:text-slate-950"
                    : "bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 20 applications..."
              aria-label="Search applications"
              className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] pl-9 pr-3 py-2 text-xs text-slate-950 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Availability Filter */}
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
      <section aria-label="Application roadmap grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

              <h3 className="mt-3 text-lg font-bold text-slate-950 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                {app.name}
              </h3>

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
                View details <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </a>
        ))}
      </section>

      {filteredApps.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-12 text-center">
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            No applications match your current filter. Reset your search or status filter to view all {counts.total} roadmap applications.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("All");
              setSelectedAvailability("All");
              setSearchQuery("");
            }}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-950 dark:bg-white text-white dark:text-slate-950 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
