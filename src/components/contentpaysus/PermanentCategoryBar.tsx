import React from "react";
import { BookOpen, Compass } from "lucide-react";
import {
  ECOSYSTEM_CATEGORY_TABS,
  EcosystemCategory,
  getAppsByCategory
} from "../../data/contentPaysUsRegistry";

interface PermanentCategoryBarProps {
  activeCategory: EcosystemCategory;
  onSelectCategory: (category: EcosystemCategory) => void;
  /** Optional independent Academy trigger so Academy always remains accessible alongside the 3 app categories */
  onOpenAcademy?: () => void;
  academyActive?: boolean;
  /** Optional First Sale Engine workflow trigger */
  onOpenFirstSaleEngine?: () => void;
  firstSaleActive?: boolean;
  /** Sticky offset class (e.g. "top-16" on public site, "top-0" in workspace) */
  stickyTopClass?: string;
  /** Visual variant for public vs authenticated workspace */
  variant?: "public" | "workspace";
}

/**
 * Permanent 3-Category Application Navigation Bar.
 *
 * Guarantees that all 3 approved categories ("Create & Sell", "Connect & Grow",
 * "Automate & Scale") remain permanently visible and accessible while scrolling
 * on both desktop and mobile—switching the active app grid without ever hiding
 * or removing the other two category tabs.
 */
export function PermanentCategoryBar({
  activeCategory,
  onSelectCategory,
  onOpenAcademy,
  academyActive = false,
  onOpenFirstSaleEngine,
  firstSaleActive = false,
  stickyTopClass = "top-16",
  variant = "public"
}: PermanentCategoryBarProps) {
  const isWorkspace = variant === "workspace";

  return (
    <div
      data-testid="permanent-category-nav"
      className={`sticky ${stickyTopClass} z-30 border-y border-slate-200 dark:border-zinc-800 bg-[#fafaf9]/95 dark:bg-[#09090b]/95 backdrop-blur-md`}
    >
      <div
        className={`${
          isWorkspace ? "px-3 sm:px-5" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        } py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5`}
      >
        {/* All 3 Permanent Category Tabs — always visible simultaneously on desktop & mobile */}
        <div
          role="tablist"
          aria-label="ContentPaysUs application categories"
          className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full lg:w-auto"
        >
          {ECOSYSTEM_CATEGORY_TABS.map((tab) => {
            const count = getAppsByCategory(tab.id).length;
            const isSelected = !academyActive && !firstSaleActive && activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-category-tab={tab.id}
                onClick={() => onSelectCategory(tab.id)}
                className={`px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                    : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-indigo-400 dark:hover:border-indigo-500/60"
                }`}
              >
                <span className="truncate">{tab.label}</span>
                <span
                  className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Independent Destinations: First Sale Engine Workflow & ContentPaysUs Academy */}
        {(onOpenAcademy || onOpenFirstSaleEngine) && (
          <div className="flex items-center gap-2 shrink-0">
            {onOpenFirstSaleEngine && (
              <button
                type="button"
                onClick={onOpenFirstSaleEngine}
                data-independent-nav="first-sale-engine"
                className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  firstSaleActive
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-emerald-500/60"
                }`}
              >
                <Compass className="h-3.5 w-3.5 shrink-0" />
                <span>First Sale Engine</span>
              </button>
            )}
            {onOpenAcademy && (
              <button
                type="button"
                onClick={onOpenAcademy}
                data-independent-nav="academy"
                className={`flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  academyActive
                    ? "bg-slate-950 dark:bg-white border-slate-950 dark:border-white text-white dark:text-slate-950"
                    : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-slate-400 dark:hover:border-zinc-600"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span>Academy</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
