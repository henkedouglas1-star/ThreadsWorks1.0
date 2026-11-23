import React from "react";
import { PostAnalyticsFilterOptions } from "../../types/analytics";
import { Search, Filter, RotateCcw, Sparkles, Layers } from "lucide-react";

export interface AnalyticsFilterUIState {
  page?: number;
  limit?: number;
  sortBy?: "views" | "likes" | "replies" | "reposts" | "quotes" | "engagementRate" | "publishedAt";
  sortDirection?: "asc" | "desc";
  search?: string;
  pillarTitle?: string;
  topic?: string;
  mediaType?: string;
  dateRange?: "all" | "7d" | "30d" | "90d";
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilterUIState;
  onFilterChange: (filters: Partial<AnalyticsFilterUIState>) => void;
  onResetFilters: () => void;
  pillarsList: string[];
  totalPostsCount: number;
  filteredCount: number;
}

export default function AnalyticsFilters({
  filters,
  onFilterChange,
  onResetFilters,
  pillarsList,
  totalPostsCount,
  filteredCount
}: AnalyticsFiltersProps) {
  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card p-4 md:p-5 shadow-sm space-y-3" id="analytics-filters-section">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={filters.search || ""}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            placeholder="Search post text, topic, or hook..."
            className="w-full rounded-xl border border-border-primary bg-bg-app pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        {/* Counter & Clear Button */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
          <span className="text-text-muted">
            Showing <strong className="text-text-primary">{filteredCount}</strong> of {totalPostsCount} posts
          </span>

          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-app text-text-secondary hover:text-text-primary hover:bg-bg-card transition cursor-pointer text-[11px]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Filter Select Controls Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border-primary/60 text-xs">
        {/* Sort By Metric */}
        <div>
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
            Sort Metric
          </label>
          <select
            value={filters.sortBy || "views"}
            onChange={(e) =>
              onFilterChange({
                sortBy: e.target.value as any,
                page: 1
              })
            }
            className="w-full rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="views">Most Views</option>
            <option value="engagementRate">Highest Engagement Rate</option>
            <option value="likes">Most Likes</option>
            <option value="replies">Most Replies</option>
            <option value="reposts">Most Reposts</option>
            <option value="publishedAt">Most Recent Date</option>
          </select>
        </div>

        {/* Sort Order Direction */}
        <div>
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
            Sort Order
          </label>
          <select
            value={filters.sortDirection || "desc"}
            onChange={(e) =>
              onFilterChange({
                sortDirection: e.target.value as "asc" | "desc",
                page: 1
              })
            }
            className="w-full rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="desc">Descending (High to Low)</option>
            <option value="asc">Ascending (Low to High)</option>
          </select>
        </div>

        {/* Strategic Content Pillar */}
        <div>
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
            Content Pillar
          </label>
          <select
            value={filters.pillarTitle || ""}
            onChange={(e) =>
              onFilterChange({
                pillarTitle: e.target.value || undefined,
                page: 1
              })
            }
            className="w-full rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="">All Strategic Pillars</option>
            {pillarsList.map((pillar) => (
              <option key={pillar} value={pillar}>
                {pillar}
              </option>
            ))}
          </select>
        </div>

        {/* Date Window */}
        <div>
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
            Time Range
          </label>
          <select
            value={filters.dateRange || "all"}
            onChange={(e) =>
              onFilterChange({
                dateRange: e.target.value as any,
                page: 1
              })
            }
            className="w-full rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="all">All Lifetime Posts</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>
    </div>
  );
}
