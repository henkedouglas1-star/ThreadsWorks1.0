import React, { useState, useEffect } from "react";
import ThreadsWorksLogo from "./ThreadsWorksLogo";
import { Zap, LogOut, Menu, X, Sparkles, Sun, Moon, Calendar, User, Briefcase, Handshake, BarChart3, Target, HardDrive, LayoutGrid } from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";
import { UserProfile } from "../types";
import CharacterAvatarPreview from "./CharacterAvatarPreview";
import { clearThreadsLocalConnection } from "../utils/threadsApi";
import { useGenerationUsage } from "../services/generationLimitService";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  email?: string;
  subscriptionStatus?: string;
  profile?: UserProfile | null;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, email, subscriptionStatus, profile, onOpenPrivacy, onOpenTerms }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const { remaining, used, isLimitReached, displayMessage, isPro } = useGenerationUsage(
    auth.currentUser?.uid || profile?.uid,
    subscriptionStatus,
    email || auth.currentUser?.email || undefined
  );

  // Prevent background body scrolling when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    console.log("Logout clicked");
    console.log("Logout function started");
    setLogoutError(null);
    try {
      const currentUid = auth.currentUser?.uid;
      clearThreadsLocalConnection(currentUid);
      window.dispatchEvent(new CustomEvent("threadsworks-user-signout"));
      await signOut(auth);
      console.log("Firebase signOut success");
      console.log("Redirecting user");
    } catch (err: any) {
      console.error("Logout failed:", err);
      if (err instanceof Error) {
        console.error("Error stack:", err.stack);
        setLogoutError(err.message + (err.stack ? `\n${err.stack}` : ""));
      } else {
        setLogoutError(String(err));
      }
    }
  };

  const primaryNavItems = [
    { id: "engine", label: "Content", icon: Sparkles },
    { id: "apps", label: "Workspace", icon: LayoutGrid },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "profile", label: "Profile", icon: User },
  ];

  const secondaryNavItems: { id: string; label: string; icon: any; badge?: string }[] = [
    { id: "pricing", label: "Upgrade", icon: Sparkles },
  ];

  return (
    <>
      {/* Mobile Top Navbar */}
      <div className="flex items-center justify-between border-b border-border-primary bg-bg-sidebar px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 md:hidden">
        <button
          onClick={() => {
            setActiveTab("dashboard");
            setIsOpen(false);
          }}
          className="flex items-center cursor-pointer text-left hover:opacity-90 transition-opacity"
        >
          <ThreadsWorksLogo variant="full" size="xs" />
        </button>
        <button
          id="mobile-menu-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          className="rounded-lg border border-border-primary bg-bg-card w-11 h-11 flex items-center justify-center text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Slide-out Sidebar for Mobile & Persistent Sidebar for Desktop */}
      <div
        id="app-sidebar-nav"
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[280px] transform flex-col border-r border-border-primary bg-bg-sidebar transition-transform duration-300 md:static md:h-auto md:max-h-none md:translate-x-0 md:p-5 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Sidebar Header (pinned at top so close button remains accessible while scrolling on mobile) */}
        <div className="flex items-center justify-between shrink-0 p-5 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))] pl-[calc(1.25rem+env(safe-area-inset-left))] pr-5 md:p-0 md:mb-5 border-b border-border-primary/40 md:border-b-0">
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setIsOpen(false);
            }}
            className="flex items-center cursor-pointer text-left hover:opacity-90 transition-opacity"
          >
            <ThreadsWorksLogo variant="full" size="sm" />
          </button>
          <button
            id="mobile-menu-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close sidebar"
            className="rounded-lg w-11 h-11 flex items-center justify-center hover:bg-bg-card-hover md:hidden text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body on mobile: enables vertical scrolling through all nav items and bottom settings */}
        <div
          id="sidebar-scroll-container"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pl-[calc(1.25rem+env(safe-area-inset-left))] pr-5 flex flex-col md:overflow-y-visible md:p-0 md:flex-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Top Logout Action */}
          <div className="mb-4">
            {logoutError && (
              <div className="px-3 py-2 mb-2 text-[11px] font-mono whitespace-pre-wrap leading-tight text-status-danger-text bg-status-danger-bg border border-status-danger-border rounded-lg">
                {logoutError}
              </div>
            )}
            <button
              id="sidebar-logout-button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-status-danger-bg hover:text-status-danger-text transition cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5" />
              Logout
            </button>
          </div>

          {/* Sidebar Navigation Links */}
          <nav className="space-y-4 flex-1 md:flex-initial">
            {/* Primary Destinations */}
            <div>
              <span className="block px-3 text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2 select-none font-bold">
                CORE WORKFLOW
              </span>
              <div className="space-y-1">
                {primaryNavItems.map((item) => {
                  const Icon = item.icon;
                  // Handle mapped sub-tabs so active state works for legacy routes too
                  const isActive = 
                    activeTab === item.id || 
                    (item.id === "engine" && activeTab === "create") ||
                    (item.id === "apps" && activeTab === "dashboard") ||
                    (item.id === "profile" && (activeTab === "identity" || activeTab === "business" || activeTab === "settings" || activeTab === "partner"));

                  return (
                    <button
                      key={item.id}
                      id={`sidebar-tab-${item.id}`}
                      onClick={() => {
                        if (item.id === "apps" || item.id === "dashboard") {
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(new CustomEvent("reset-workspace-root"));
                          }
                        }
                        setActiveTab(item.id);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition cursor-pointer whitespace-nowrap select-none ${
                        isActive
                          ? "bg-brand-surface border-l-2 border-purple-600 dark:border-purple-500 text-brand-text-strong font-bold"
                          : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isActive ? "text-brand-text" : "text-text-muted"}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ecosystem & Upgrade */}
            <div className="pt-2 border-t border-border-primary/50">
              <span className="block px-3 text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2 select-none font-bold">
                MORE
              </span>
              <div className="space-y-1">
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`sidebar-tab-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition cursor-pointer whitespace-nowrap select-none ${
                        isActive
                          ? "bg-brand-surface border-l-2 border-purple-600 dark:border-purple-500 text-brand-text-strong font-bold"
                          : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-brand-text" : "text-text-muted"}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-full bg-brand-surface text-brand-text-strong border border-brand-border">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Subscription Upgrade Card / PRO status indicator */}
          <div className="mt-auto pt-4 border-t border-border-primary">
            {isPro || subscriptionStatus === "active" ? (
              <div className="rounded-xl bg-brand-surface/70 dark:bg-purple-950/20 border border-brand-border dark:border-purple-500/20 p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-brand-text-strong">
                  <Sparkles className="h-4 w-4 text-brand-text" />
                  <span className="text-xs font-bold font-sans">PRO Account Active</span>
                </div>
                <p className="text-[10px] text-text-secondary leading-normal">
                  You have full access to all ThreadWorks engines with unlimited generation.
                </p>
                <button
                  id="sidebar-manage-billing-btn"
                  onClick={() => {
                    setActiveTab("pricing");
                    setIsOpen(false);
                  }}
                  className="w-full text-center text-[10px] font-bold text-text-primary bg-bg-card hover:bg-bg-card-hover rounded-lg py-1.5 transition border border-border-primary cursor-pointer"
                >
                  Manage Subscription
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-bg-card border border-border-primary p-3.5 flex flex-col gap-2.5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 rounded-full bg-purple-500/5 blur-xl group-hover:bg-purple-500/10 transition-colors" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-brand-text-strong">
                    <Zap className="h-4 w-4 text-brand-text" />
                    <span className="text-xs font-bold font-sans">Free Plan Usage</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${isLimitReached ? "text-status-danger-text" : "text-brand-text"}`}>
                    {used}/150
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-bg-app overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isLimitReached ? "bg-red-600" : "bg-purple-600"}`}
                    style={{ width: `${Math.min(100, (used / 150) * 100)}%` }}
                  />
                </div>

                <p className={`text-[10px] leading-normal ${isLimitReached ? "text-status-danger-text font-semibold" : "text-text-secondary"}`}>
                  {displayMessage}
                </p>

                <button
                  id="sidebar-upgrade-btn"
                  onClick={() => {
                    setActiveTab("pricing");
                    setIsOpen(false);
                  }}
                  className={`w-full text-center text-xs font-bold text-white rounded-xl py-2 transition shadow-lg cursor-pointer ${
                    isLimitReached
                      ? "bg-red-600 hover:bg-red-500 shadow-red-500/20 animate-pulse"
                      : "bg-purple-600 hover:bg-purple-500 shadow-purple-500/10"
                  }`}
                >
                  {isLimitReached ? "Upgrade to Pro (Limit Reached)" : "Upgrade to Pro"}
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Footer with Theme Toggle, Account info and Sign Out block */}
          <div className="border-t border-border-primary pt-4 mt-6">
            
            {/* Segmented Control Theme Selector Toggle */}
            <div className="px-3 mb-4">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2 select-none">INTERFACE THEME</span>
              <div
                className="flex w-full items-center rounded-xl bg-bg-card border border-border-primary p-1 shadow-sm"
              >
                <button
                  id="sidebar-theme-light-btn"
                  onClick={() => toggleTheme()}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold w-1/2 justify-center transition-all cursor-pointer ${
                    theme === "light" 
                      ? "bg-purple-600 text-white shadow-sm" 
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light</span>
                </button>
                <button
                  id="sidebar-theme-dark-btn"
                  onClick={() => toggleTheme()}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold w-1/2 justify-center transition-all cursor-pointer ${
                    theme === "dark" 
                      ? "bg-purple-600 text-white shadow-sm" 
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            {email && (
              <div className="px-3 py-2 mb-2 flex items-center gap-2.5 rounded-xl bg-bg-card border border-border-primary">
                {profile?.creatorIdentity?.character ? (
                  <div className="shrink-0">
                    <CharacterAvatarPreview
                      config={profile.creatorIdentity.character}
                      size="xs"
                      showPropsBadge={false}
                      className="w-7 h-7 rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="truncate flex-1">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-text-muted leading-none">SIGNED IN AS</span>
                  <span className="block truncate text-xs font-semibold text-text-primary mt-0.5" title={email}>{email}</span>
                </div>
              </div>
            )}
            
            <div className="mt-3.5 pt-3.5 border-t border-border-secondary px-3 flex items-center justify-between">
              <button 
                id="sidebar-trigger-privacy"
                onClick={onOpenPrivacy} 
                className="text-[10px] text-text-muted hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer font-medium"
              >
                Privacy
              </button>
              <span className="text-[10px] text-text-muted/40">•</span>
              <button 
                id="sidebar-trigger-terms"
                onClick={onOpenTerms} 
                className="text-[10px] text-text-muted hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer font-medium"
              >
                Terms
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dimmed Overlay background when active on Mobile */}
      {isOpen && (
        <div
          id="mobile-menu-overlay"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}
    </>
  );
}
