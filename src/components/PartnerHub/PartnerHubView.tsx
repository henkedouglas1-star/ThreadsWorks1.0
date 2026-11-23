import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  TrendingUp,
  Share2,
  DollarSign,
  Wallet,
  BookOpen,
  FileText,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Bell,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";
import { PartnerProfile, PartnerPerformanceMetrics, PartnerNotification } from "../../types/partner";
import {
  fetchMyPartnerProfile,
  fetchPartnerPerformance,
  fetchPartnerNotifications,
  markPartnerNotificationAsRead,
} from "../../services/partnerService";
import PartnerActivationScreen from "./PartnerActivationScreen";
import PartnerOverviewTab from "./PartnerOverviewTab";
import PromoteThreadsWorksTab from "./PromoteThreadsWorksTab";
import MyLinkTab from "./MyLinkTab";
import PerformanceTab from "./PerformanceTab";
import CommissionsTab from "./CommissionsTab";
import PayoutsTab from "./PayoutsTab";
import ResourcesTab from "./ResourcesTab";
import ProgramTermsTab from "./ProgramTermsTab";
import AdminPartnerTab from "./AdminPartnerTab";
import { isEntitledAccount } from "../../utils/contentLimit";

interface PartnerHubViewProps {
  userEmail?: string;
  onSaveToLibrary?: (text: string, title?: string) => void;
  isAdmin?: boolean;
}

type TabType =
  | "overview"
  | "promote"
  | "link"
  | "performance"
  | "commissions"
  | "payouts"
  | "resources"
  | "terms"
  | "admin";

export default function PartnerHubView({ userEmail, onSaveToLibrary, isAdmin = false }: PartnerHubViewProps) {
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [metrics, setMetrics] = useState<PartnerPerformanceMetrics | null>(null);
  const [notifications, setNotifications] = useState<PartnerNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [error, setError] = useState<string | null>(null);

  const loadPartnerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await fetchMyPartnerProfile();
      setPartner(profile);
      if (profile) {
        try {
          const [perf, notifs] = await Promise.all([
            fetchPartnerPerformance().catch(e => { console.warn(e); return null; }),
            fetchPartnerNotifications().catch(e => { console.warn(e); return []; }),
          ]);
          setMetrics(perf);
          setNotifications(notifs);
        } catch (e) {
          console.warn("[PARTNER_HUB] Non-blocking perf load error:", e);
        }
      }
    } catch (err: any) {
      console.error("[PARTNER_HUB] Load error:", err);
      setError(err.message || "Failed to load partner program data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartnerData();
  }, []);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await markPartnerNotificationAsRead(notifId);
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, read: true, isRead: true } : n)
      );
    } catch (e) {
      console.warn("Failed to mark notification read:", e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read && !n.isRead).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
        <p className="text-xs text-text-muted font-mono">Loading Partner Hub...</p>
      </div>
    );
  }

  // If user has not activated their partner account yet, show instant self-serve activation screen
  if (!partner) {
    return (
      <PartnerActivationScreen
        userEmail={userEmail}
        onPartnerCreated={(newPartner) => {
          setPartner(newPartner);
          loadPartnerData();
        }}
      />
    );
  }

  const tabs: { id: TabType; label: string; icon: any; badge?: string }[] = [
    { id: "overview", label: "Overview", icon: Zap },
    { id: "promote", label: "Promote ThreadsWorks", icon: Sparkles, badge: "AI" },
    { id: "link", label: "My Link", icon: Share2 },
    { id: "performance", label: "Analytics", icon: TrendingUp },
    { id: "commissions", label: "Commissions Ledger", icon: DollarSign },
    { id: "payouts", label: "Payouts & Balance", icon: Wallet },
    { id: "resources", label: "Brand & Claims", icon: BookOpen },
    { id: "terms", label: "Program Terms", icon: FileText },
  ];

  // If admin, append Admin tab
  if (isAdmin || isEntitledAccount(userEmail) || userEmail?.includes("admin")) {
    tabs.push({ id: "admin", label: "Admin Controls", icon: ShieldCheck });
  }

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 space-y-6" id="partner-hub-view-container">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-primary">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary font-sans">
              ThreadsWorks Partner Hub
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-300 border border-purple-500/20">
              50% Recurring
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Earn 50% on every $7/month recurring ThreadsWorks subscription generated by your referrals.
          </p>
        </div>

        {/* Top Right Controls: Referral Code & Notifications Bell */}
        <div className="flex items-center gap-3 self-start sm:self-auto relative">
          <div className="px-3 py-1.5 rounded-xl bg-bg-card border border-border-primary text-xs font-mono text-text-primary">
            Ref: <strong className="text-purple-600 dark:text-purple-400">{partner.referralCode}</strong>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl bg-bg-card border border-border-primary hover:bg-bg-card-hover text-text-secondary hover:text-text-primary transition cursor-pointer relative"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-purple-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-2xl bg-bg-card border border-border-primary shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-3 border-b border-border-primary flex items-center justify-between bg-bg-primary/50">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-bold text-text-primary">Partner Notifications</span>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 rounded-lg text-text-muted hover:text-text-primary transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-border-primary/50">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted">
                      No notifications yet. You'll receive updates when commissions are processed or payouts are sent.
                    </div>
                  ) : (
                    notifications.map(n => {
                      const isRead = n.read || n.isRead;
                      return (
                        <div
                          key={n.id}
                          onClick={() => !isRead && handleMarkAsRead(n.id)}
                          className={`p-3 text-xs transition cursor-pointer flex items-start gap-2.5 ${
                            isRead ? "bg-bg-card opacity-70" : "bg-purple-500/5 hover:bg-purple-500/10"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {n.type === "payout_paid" || (n.type as string) === "commission_approved" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-purple-500" />
                            )}
                          </div>
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-text-primary text-[11px]">{n.title}</span>
                              <span className="text-[9px] font-mono text-text-muted">
                                {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}
                              </span>
                            </div>
                            <p className="text-text-secondary text-[11px] leading-relaxed">{n.message}</p>
                            {!isRead && (
                              <span className="inline-block text-[9px] text-purple-600 dark:text-purple-400 font-semibold pt-0.5">
                                Click to mark read
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Horizontal Navigation Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border-primary/60 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-extrabold ${
                    isActive ? "bg-white/20 text-white" : "bg-purple-500/15 text-purple-600 dark:text-purple-300"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <PartnerOverviewTab
            partner={partner}
            metrics={metrics}
            onNavigateTab={(tabId) => setActiveTab(tabId as TabType)}
          />
        )}
        {activeTab === "promote" && (
          <PromoteThreadsWorksTab
            partner={partner}
            onSaveToLibrary={onSaveToLibrary}
          />
        )}
        {activeTab === "link" && <MyLinkTab partner={partner} />}
        {activeTab === "performance" && (
          <PerformanceTab partner={partner} metrics={metrics} />
        )}
        {activeTab === "commissions" && <CommissionsTab />}
        {activeTab === "payouts" && (
          <PayoutsTab partner={partner} onRefreshPartner={loadPartnerData} />
        )}
        {activeTab === "resources" && <ResourcesTab />}
        {activeTab === "terms" && <ProgramTermsTab />}
        {activeTab === "admin" && <AdminPartnerTab />}
      </div>
    </div>
  );
}
