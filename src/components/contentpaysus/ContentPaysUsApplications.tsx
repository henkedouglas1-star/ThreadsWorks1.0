import React, { useState, useMemo } from "react";
import { Layers, Search, ArrowRight, ExternalLink, Sparkles, Filter } from "lucide-react";
import { CONTENT_PAYS_US_APPS, ECOSYSTEM_CATEGORIES, EcosystemApp } from "../../data/contentPaysUsRegistry";

interface ContentPaysUsApplicationsProps {
  onNavigate: (route: string) => void;
}

export function ContentPaysUsApplications({ onNavigate }: ContentPaysUsApplicationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredApps = useMemo(() => {
    return CONTENT_PAYS_US_APPS.filter((app) => {
      const matchesCategory = selectedCategory === "All" || app.category === selectedCategory;
      const matchesSearch = 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-4">
          <Layers className="h-3.5 w-3.5" />
          <span>Ecosystem Application Registry</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
          Specialized AI Applications
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Explore all 16 specialized applications across foundation, attention, monetization, customer success, and expansion. Each tool is designed to solve a specific creator workflow.
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
        
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {ECOSYSTEM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applications..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            onClick={() => onNavigate(`/applications/${app.id}`)}
            className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 flex flex-col justify-between shadow-xl hover:border-slate-700 hover:scale-[1.01] transition-all cursor-pointer group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${app.badgeColor}`}>
                  {app.availability}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {app.category}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                {app.name}
              </h3>

              <p className="text-xs font-medium text-indigo-300 mb-3">
                {app.headline}
              </p>

              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                {app.shortDescription}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 group-hover:underline inline-flex items-center gap-1">
                View application detail <ArrowRight className="h-3 w-3" />
              </span>
              {app.availability === "Available" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Ready
                </span>
              )}
              {app.availability === "In Development" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Active
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredApps.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-slate-400">No applications match your search criteria.</p>
        </div>
      )}

    </div>
  );
}
