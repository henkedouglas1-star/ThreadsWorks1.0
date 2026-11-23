import React from "react";
import { Sparkles, LayoutGrid, Calendar, BarChart3, User } from "lucide-react";

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function MobileBottomNav({ activeTab, setActiveTab }: MobileBottomNavProps) {
  const isCreate = activeTab === "create" || activeTab === "engine";
  const isWorkspace = activeTab === "apps" || activeTab === "dashboard";
  const isCalendar = activeTab === "calendar";
  const isAnalytics = activeTab === "analytics";
  const isProfile = activeTab === "profile" || activeTab === "identity" || activeTab === "business" || activeTab === "settings" || activeTab === "partner";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-bg-sidebar/95 backdrop-blur-md border-t border-border-primary pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 px-1 md:hidden select-none shadow-[0_-2px_10px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="grid grid-cols-5 items-center max-w-lg mx-auto">
        {/* Content */}
        <button
          id="mobile-nav-create"
          onClick={() => setActiveTab("engine")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-0.5 rounded-xl transition cursor-pointer ${
            isCreate ? "text-brand-text-strong dark:text-purple-400 font-bold" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Sparkles className={`w-4 h-4 ${isCreate ? "text-brand-text dark:text-purple-400" : ""}`} />
          <span className="text-[10px] tracking-tight whitespace-nowrap">Content</span>
        </button>

        {/* Workspace */}
        <button
          id="mobile-nav-workspace"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("reset-workspace-root"));
            }
            setActiveTab("apps");
          }}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-0.5 rounded-xl transition cursor-pointer ${
            isWorkspace ? "text-brand-text-strong dark:text-purple-400 font-bold" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <LayoutGrid className={`w-4 h-4 ${isWorkspace ? "text-brand-text dark:text-purple-400" : ""}`} />
          <span className="text-[10px] tracking-tight whitespace-nowrap">Workspace</span>
        </button>

        {/* Calendar */}
        <button
          id="mobile-nav-calendar"
          onClick={() => setActiveTab("calendar")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-0.5 rounded-xl transition cursor-pointer ${
            isCalendar ? "text-brand-text-strong dark:text-purple-400 font-bold" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Calendar className={`w-4 h-4 ${isCalendar ? "text-brand-text dark:text-purple-400" : ""}`} />
          <span className="text-[10px] tracking-tight whitespace-nowrap">Calendar</span>
        </button>

        {/* Analytics */}
        <button
          id="mobile-nav-analytics"
          onClick={() => setActiveTab("analytics")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-0.5 rounded-xl transition cursor-pointer ${
            isAnalytics ? "text-brand-text-strong dark:text-purple-400 font-bold" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <BarChart3 className={`w-4 h-4 ${isAnalytics ? "text-brand-text dark:text-purple-400" : ""}`} />
          <span className="text-[10px] tracking-tight whitespace-nowrap">Analytics</span>
        </button>

        {/* Profile */}
        <button
          id="mobile-nav-profile"
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-0.5 rounded-xl transition cursor-pointer ${
            isProfile ? "text-brand-text-strong dark:text-purple-400 font-bold" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <User className={`w-4 h-4 ${isProfile ? "text-brand-text dark:text-purple-400" : ""}`} />
          <span className="text-[10px] tracking-tight whitespace-nowrap">Profile</span>
        </button>
      </div>
    </div>
  );
}
