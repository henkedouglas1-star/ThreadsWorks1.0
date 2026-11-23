import React, { useState } from "react";
import { UserProfile } from "../types";
import { 
  X, 
  Settings, 
  AtSign, 
  Sparkles, 
  LogOut, 
  Sun, 
  Moon, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  CreditCard,
  User,
  ExternalLink
} from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";
import { useThreadsConnection } from "../context/ThreadsConnectionContext";
import ThreadsConnectButton from "./ThreadsConnectButton";
import { clearThreadsLocalConnection } from "../utils/threadsApi";
import { useGenerationUsage } from "../services/generationLimitService";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  subscriptionStatus?: string;
  profile?: UserProfile | null;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  userEmail,
  subscriptionStatus,
  profile,
  onOpenPrivacy,
  onOpenTerms,
  onNavigateToTab
}: SettingsModalProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"threads" | "billing" | "preferences">("threads");
  
  const {
    loading: loadingConn,
    connected,
    username,
    profilePictureUrl,
    biography,
    hasInsightsPermission,
    hasPublishPermission,
    connectThreads,
    refreshConnection,
    disconnectThreads
  } = useThreadsConnection();

  const isPro = subscriptionStatus === "active";
  const { remaining, used, isLimitReached, displayMessage } = useGenerationUsage(
    auth.currentUser?.uid || profile?.uid,
    subscriptionStatus,
    userEmail || auth.currentUser?.email || undefined
  );

  const handleSignOut = async () => {
    try {
      const currentUid = auth.currentUser?.uid;
      clearThreadsLocalConnection(currentUid);
      window.dispatchEvent(new CustomEvent("threadsworks-user-signout"));
      onClose();
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" id="settings-global-modal">
      <div className="w-full max-w-2xl rounded-2xl border border-border-primary bg-bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-primary bg-bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary font-display flex items-center gap-2">
                <span>System & Operational Settings</span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Manage your Threads account connection, subscription plan, and system preferences.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-app transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-bg-app border-b border-border-primary shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("threads")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "threads"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
            }`}
          >
            <AtSign className="w-3.5 h-3.5" />
            <span>Threads Connection</span>
            {connected && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>

          <button
            onClick={() => setActiveTab("billing")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "billing"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Account & Billing</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
              activeTab === "billing"
                ? "bg-white/20 text-white"
                : isPro
                ? "bg-brand-surface text-brand-text-strong border border-brand-border"
                : "bg-bg-card text-text-secondary border border-border-primary"
            }`}>
              {isPro ? "PRO" : "FREE"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("preferences")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === "preferences"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>System & Security</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: THREADS CONNECTION */}
          {activeTab === "threads" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <AtSign className="w-4 h-4 text-purple-500" />
                    Meta Threads Account Connection
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Powers automatic Analytics metric sync, historical content performance, and 1-click scheduling.
                  </p>
                </div>

                <button
                  onClick={() => refreshConnection()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary transition cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verify
                </button>
              </div>

              {/* Status Card */}
              <div className={`p-5 rounded-2xl border ${connected ? "bg-status-success-bg/70 dark:bg-emerald-500/5 border-status-success-border" : "bg-status-warning-bg/70 dark:bg-amber-500/5 border-status-warning-border"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-muted">STATUS</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${connected ? "bg-status-success-bg text-status-success-text border-status-success-border" : "bg-status-warning-bg text-status-warning-text border-status-warning-border"}`}>
                    {connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {connected ? "Active & Verified" : "Not Connected"}
                  </span>
                </div>

                {connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {profilePictureUrl ? (
                        <img src={profilePictureUrl} alt={username} className="w-10 h-10 rounded-full border border-status-success-border object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-status-success-bg text-status-success-text border border-status-success-border flex items-center justify-center font-bold text-sm">
                          @
                        </div>
                      )}
                      <div>
                        <span className="block text-sm font-bold text-text-primary">@{username || "threads_user"}</span>
                        {biography && <p className="text-xs text-text-muted line-clamp-1 mt-0.5">{biography}</p>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border-primary/60 flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Analytics Scope:</span>
                      <span className={hasInsightsPermission ? "text-status-success-text font-bold" : "text-status-warning-text font-bold"}>
                        {hasInsightsPermission ? "Granted" : "Pending"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-border-primary/60 flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Publishing Scope:</span>
                      <span className={hasPublishPermission ? "text-status-success-text font-bold" : "text-status-warning-text font-bold"}>
                        {hasPublishPermission ? "Granted" : "Pending"}
                      </span>
                    </div>

                    <div className="pt-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => connectThreads("/profile")}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-brand-text-strong bg-brand-surface hover:bg-brand-surface-hover border border-brand-border transition cursor-pointer"
                      >
                        Reconnect
                      </button>
                      <button
                        onClick={() => disconnectThreads()}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-status-danger-text hover:bg-status-danger-bg border border-transparent hover:border-status-danger-border transition cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Connect your Meta Threads account to unlock real-time post analytics, performance intelligence learning, and 1-click scheduling directly from ThreadsWorks.
                    </p>
                    <ThreadsConnectButton returnTo="/profile" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACCOUNT & BILLING */}
          {activeTab === "billing" && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl border border-border-primary bg-bg-app space-y-4">
                <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-muted">ACCOUNT INFORMATION</span>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-border-primary/60">
                    <span className="text-text-muted">Email Address:</span>
                    <span className="font-semibold text-text-primary">{userEmail || auth.currentUser?.email || "Not specified"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-border-primary/60">
                    <span className="text-text-muted">User ID:</span>
                    <span className="font-mono text-[11px] text-text-secondary">{auth.currentUser?.uid || profile?.uid || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-border-primary/60">
                    <span className="text-text-muted">Current Subscription:</span>
                    <span className={`font-extrabold ${isPro ? "text-purple-600 dark:text-purple-400" : "text-text-secondary"}`}>
                      {isPro ? "PRO Creator Plan" : "Free Plan"}
                    </span>
                  </div>
                  {!isPro && (
                    <div className="flex flex-col gap-1.5 py-1.5 border-b border-border-primary/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">Monthly AI Generations:</span>
                        <span className={`font-mono text-xs font-bold ${isLimitReached ? "text-status-danger-text" : "text-brand-text-strong"}`}>
                          {used}/150 used
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-bg-card overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isLimitReached ? "bg-red-600 dark:bg-red-500" : "bg-purple-600"}`}
                          style={{ width: `${Math.min(100, (used / 150) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-[11px] ${isLimitReached ? "text-status-danger-text font-semibold" : "text-text-muted"}`}>
                        {displayMessage}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      if (onNavigateToTab) onNavigateToTab("pricing");
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isPro ? "Manage Pro Subscription" : "Upgrade to Pro"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM & SECURITY */}
          {activeTab === "preferences" && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl border border-border-primary bg-bg-app space-y-4">
                <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-muted">INTERFACE & THEME</span>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="block text-xs font-bold text-text-primary">Appearance Mode</span>
                    <span className="block text-[11px] text-text-muted">Switch between dark and light themes</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-bg-card p-1 border border-border-primary">
                    <button
                      onClick={toggleTheme}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${theme === "light" ? "bg-purple-600 text-white" : "text-text-secondary"}`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={toggleTheme}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${theme === "dark" ? "bg-purple-600 text-white" : "text-text-secondary"}`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-border-primary bg-bg-app space-y-4">
                <span className="block text-[10px] font-bold font-mono uppercase tracking-wider text-text-muted">LEGAL & SESSION</span>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <button onClick={onOpenPrivacy} className="text-xs text-text-muted hover:text-purple-600 transition cursor-pointer flex items-center gap-1">
                      <span>Privacy Policy</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <span className="text-text-muted/30">•</span>
                    <button onClick={onOpenTerms} className="text-xs text-text-muted hover:text-purple-600 transition cursor-pointer flex items-center gap-1">
                      <span>Terms of Service</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-status-danger-text bg-status-danger-bg hover:bg-red-100 dark:hover:bg-red-500/20 border border-status-danger-border transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
