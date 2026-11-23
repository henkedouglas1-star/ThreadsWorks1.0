import React, { useState } from "react";
import ThreadsWorksLogo from "./ThreadsWorksLogo";
import { 
  Sparkles, 
  Zap, 
  LogOut, 
  Sun, 
  Moon, 
  Calendar, 
  User, 
  Briefcase, 
  Handshake, 
  BarChart3, 
  Target, 
  HardDrive,
  ArrowLeft,
  Menu,
  X,
  ChevronRight,
  Settings,
  LayoutGrid
} from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";
import { UserProfile } from "../types";
import CharacterAvatarPreview from "./CharacterAvatarPreview";
import { clearThreadsLocalConnection } from "../utils/threadsApi";
import SettingsModal from "./SettingsModal";

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userEmail?: string;
  subscriptionStatus?: string;
  profile?: UserProfile | null;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export default function TopNav({
  activeTab,
  setActiveTab,
  userEmail,
  subscriptionStatus,
  profile,
  onOpenPrivacy,
  onOpenTerms
}: TopNavProps) {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLogoutError(null);
    try {
      const currentUid = auth.currentUser?.uid;
      clearThreadsLocalConnection(currentUid);
      window.dispatchEvent(new CustomEvent("threadsworks-user-signout"));
      await signOut(auth);
    } catch (err: any) {
      console.error("Logout failed:", err);
      setLogoutError(err?.message || String(err));
    }
  };

  const isCreateActive = activeTab === "engine" || activeTab === "create";
  const isAppsActive = activeTab === "apps" || activeTab === "dashboard";
  const isCalendarActive = activeTab === "calendar";
  const isAnalyticsActive = activeTab === "analytics";
  const isProfileActive = activeTab === "profile" || activeTab === "identity" || activeTab === "business" || activeTab === "settings" || activeTab === "partner";

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border-primary dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-2xl transition-all shadow-xs dark:shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            
            {/* Left Area: Logo */}
            <div className="flex items-center gap-3 md:gap-4 shrink-0">
              <button
                onClick={() => setActiveTab("engine")}
                className="group flex items-center focus:outline-none cursor-pointer hover:opacity-90 transition-opacity"
              >
                <ThreadsWorksLogo variant="full" size="sm" />
              </button>
            </div>

            {/* Right Area: Navigation items next to Settings, Account Controls & Logout */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Desktop Quick Navigation: Content, Workspace, Calendar, Analytics, Profile */}
              <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 mr-1" aria-label="Desktop Top Navigation">
                <button
                  id="topnav-content-btn"
                  onClick={() => setActiveTab("engine")}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    isCreateActive
                      ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm shadow-purple-500/10 font-bold"
                      : "text-text-secondary hover:text-text-primary bg-bg-card dark:bg-zinc-900 border-border-primary dark:border-zinc-800 hover:border-purple-400/60 dark:hover:border-zinc-700 hover:bg-bg-card-hover dark:hover:bg-zinc-800/80"
                  }`}
                  title="Content Creation Engine"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${isCreateActive ? "text-brand-text" : "text-text-muted"}`} />
                  <span>Content</span>
                </button>

                <button
                  id="topnav-workspace-btn"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("reset-workspace-root"));
                    }
                    setActiveTab("apps");
                  }}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    isAppsActive
                      ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm shadow-purple-500/10 font-bold"
                      : "text-text-secondary hover:text-text-primary bg-bg-card dark:bg-zinc-900 border-border-primary dark:border-zinc-800 hover:border-purple-400/60 dark:hover:border-zinc-700 hover:bg-bg-card-hover dark:hover:bg-zinc-800/80"
                  }`}
                  title="Workspace & Creator Tools"
                >
                  <LayoutGrid className={`h-3.5 w-3.5 ${isAppsActive ? "text-brand-text" : "text-text-muted"}`} />
                  <span>Workspace</span>
                </button>

                <button
                  id="topnav-calendar-btn"
                  onClick={() => setActiveTab("calendar")}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    isCalendarActive
                      ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm shadow-purple-500/10 font-bold"
                      : "text-text-secondary hover:text-text-primary bg-bg-card dark:bg-zinc-900 border-border-primary dark:border-zinc-800 hover:border-purple-400/60 dark:hover:border-zinc-700 hover:bg-bg-card-hover dark:hover:bg-zinc-800/80"
                  }`}
                  title="Content Calendar & Scheduler"
                >
                  <Calendar className={`h-3.5 w-3.5 ${isCalendarActive ? "text-brand-text" : "text-text-muted"}`} />
                  <span>Calendar</span>
                </button>

                <button
                  id="topnav-analytics-btn"
                  onClick={() => setActiveTab("analytics")}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    isAnalyticsActive
                      ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm shadow-purple-500/10 font-bold"
                      : "text-text-secondary hover:text-text-primary bg-bg-card dark:bg-zinc-900 border-border-primary dark:border-zinc-800 hover:border-purple-400/60 dark:hover:border-zinc-700 hover:bg-bg-card-hover dark:hover:bg-zinc-800/80"
                  }`}
                  title="Threads Analytics"
                >
                  <BarChart3 className={`h-3.5 w-3.5 ${isAnalyticsActive ? "text-brand-text" : "text-text-muted"}`} />
                  <span>Analytics</span>
                </button>

                <button
                  id="topnav-profile-btn"
                  onClick={() => setActiveTab("profile")}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                    isProfileActive
                      ? "bg-brand-surface text-brand-text-strong border-brand-border shadow-sm shadow-purple-500/10 font-bold"
                      : "text-text-secondary hover:text-text-primary bg-bg-card dark:bg-zinc-900 border-border-primary dark:border-zinc-800 hover:border-purple-400/60 dark:hover:border-zinc-700 hover:bg-bg-card-hover dark:hover:bg-zinc-800/80"
                  }`}
                  title="Profile & Creator Identity"
                >
                  <User className={`h-3.5 w-3.5 ${isProfileActive ? "text-brand-text" : "text-text-muted"}`} />
                  <span>Profile</span>
                </button>
              </nav>

              <div className="hidden md:block h-4 w-px bg-border-primary dark:bg-zinc-800 mx-0.5" />

              {/* Settings Gear Toggle */}
              <button
                id="topnav-settings-toggle"
                onClick={() => setSettingsOpen(true)}
                title="System & Account Settings"
                aria-label="System & Account Settings"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-primary dark:border-zinc-800 bg-bg-card dark:bg-zinc-900 text-text-secondary hover:text-text-primary hover:bg-bg-card-hover hover:border-purple-400/60 dark:hover:border-zinc-700 transition cursor-pointer"
              >
                <Settings className="h-4 w-4" />
              </button>

              {/* Theme Toggle */}
              <button
                id="topnav-theme-toggle"
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-primary dark:border-zinc-800 bg-bg-card dark:bg-zinc-900 text-text-secondary hover:text-text-primary hover:bg-bg-card-hover hover:border-purple-400/60 dark:hover:border-zinc-700 transition cursor-pointer"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* User Profile Pill */}
              {userEmail && (
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  title="Go to My Profile"
                  className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-bg-card dark:bg-zinc-900/80 border border-border-primary dark:border-zinc-800 hover:border-purple-400/60 dark:hover:border-zinc-700 text-xs transition cursor-pointer text-left"
                >
                  {profile?.creatorIdentity?.character ? (
                    <CharacterAvatarPreview
                      config={profile.creatorIdentity.character}
                      size="xs"
                      showPropsBadge={false}
                      className="w-5 h-5 rounded-md"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-md bg-brand-surface text-brand-text-strong flex items-center justify-center font-bold text-[10px]">
                      {userEmail.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[120px] truncate text-text-primary font-medium" title={userEmail}>
                    {userEmail.split("@")[0]}
                  </span>
                  {subscriptionStatus === "active" ? (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-brand-surface text-brand-text-strong border border-brand-border uppercase">
                      PRO
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-bg-app dark:bg-zinc-800 text-text-secondary border border-border-primary uppercase">
                      FREE
                    </span>
                  )}
                </button>
              )}

              {/* Distinct Logout Button (Account Control) */}
              <button
                id="topnav-logout-button"
                onClick={handleSignOut}
                title="Sign Out of ThreadsWorks"
                aria-label="Sign Out of ThreadsWorks"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-status-danger-border bg-status-danger-bg hover:bg-red-100 dark:hover:bg-red-500/20 text-status-danger-text text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userEmail={userEmail}
        subscriptionStatus={subscriptionStatus}
        profile={profile}
        onOpenPrivacy={onOpenPrivacy}
        onOpenTerms={onOpenTerms}
        onNavigateToTab={setActiveTab}
      />
    </>
  );
}
