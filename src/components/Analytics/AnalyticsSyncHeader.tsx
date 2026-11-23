import React from "react";
import { AnalyticsSyncSummary } from "../../types/analytics";
import { 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  ExternalLink,
  Lock
} from "lucide-react";

interface AnalyticsSyncHeaderProps {
  connected: boolean;
  username?: string;
  hasInsightsPermission: boolean;
  lastSyncedAt?: string;
  isSyncing: boolean;
  isVerifying?: boolean;
  syncSummary: AnalyticsSyncSummary | null;
  syncError: string | null;
  selectedTimeframe?: "1d" | "7d" | "30d";
  totalTrackedPosts?: number;
  onTriggerSync: () => void;
  onAuthorizeInsights: () => void;
}

export default function AnalyticsSyncHeader({
  connected,
  username,
  hasInsightsPermission,
  lastSyncedAt,
  isSyncing,
  isVerifying = false,
  syncSummary,
  syncError,
  selectedTimeframe = "7d",
  totalTrackedPosts = 0,
  onTriggerSync,
  onAuthorizeInsights
}: AnalyticsSyncHeaderProps) {
  const formattedLastSync = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Never";

  const postsSynced = syncSummary?.postsSyncedCount ?? totalTrackedPosts ?? 0;
  const timeframeLabel = selectedTimeframe === "1d" ? "1-day" : selectedTimeframe === "7d" ? "7-day" : "30-day";

  // Determine the exact verified state
  const renderStatusBadge = () => {
    if (!connected) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-bg-app text-text-secondary border border-border-primary">
          Not Connected
        </span>
      );
    }
    if (isVerifying) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-status-info-bg text-status-info-text border border-status-info-border animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Verifying Insights...</span>
        </span>
      );
    }
    if (!hasInsightsPermission) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-status-warning-bg text-status-warning-text border border-status-warning-border">
          <Lock className="h-3 w-3" />
          <span>Insights Authorization Required</span>
        </span>
      );
    }
    if (syncError) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-status-danger-bg text-status-danger-text border border-status-danger-border">
          <AlertCircle className="h-3 w-3" />
          <span>Sync Error</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-status-success-bg text-status-success-text border border-status-success-border">
        <ShieldCheck className="h-3 w-3" />
        <span>Insights Active</span>
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card p-5 md:p-6 shadow-sm space-y-4" id="analytics-sync-header">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Account Identity & Insights Status */}
        <div className="flex items-start md:items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg md:text-xl font-extrabold text-text-primary tracking-tight">
                {connected && username ? `@${username}` : "Threads Analytics"}
              </h2>
              {renderStatusBadge()}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Content Performance Intelligence &amp; Meta Threads Telemetry
            </p>
          </div>
        </div>

        {/* Right: Last Synced Time & Sync Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {connected && (
            <div className="text-left md:text-right text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Last Synced</span>
              <span className="font-mono text-text-secondary text-[11px] flex items-center gap-1">
                <Clock className="h-3 w-3 text-text-muted" />
                {formattedLastSync}
              </span>
            </div>
          )}

          {connected && !hasInsightsPermission ? (
            <button
              type="button"
              id="authorize-insights-btn"
              onClick={onAuthorizeInsights}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 text-xs shadow-md transition cursor-pointer min-h-[40px]"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Grant Insights Permission</span>
            </button>
          ) : (
            <button
              type="button"
              id="sync-analytics-btn"
              onClick={onTriggerSync}
              disabled={isSyncing || !connected}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-bold px-4 py-2.5 text-xs shadow-md transition cursor-pointer disabled:cursor-not-allowed min-h-[40px]"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Synchronizing Telemetry..." : "Sync Latest Analytics"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Feedback Banners */}
      {syncError && (
        <div className="rounded-xl border border-status-danger-border bg-status-danger-bg p-3.5 flex items-start gap-2.5 text-xs text-status-danger-text animate-fade-in">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-0.5 flex-1">
            <p className="font-bold">Analytics Synchronization Alert</p>
            <p className="text-[11px] leading-snug">{syncError}</p>
          </div>
          {!hasInsightsPermission && (
            <button
              type="button"
              onClick={onAuthorizeInsights}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 text-[11px] transition shrink-0 cursor-pointer"
            >
              <span>Authorize Scope</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {syncSummary && !syncError && (
        <div className="rounded-xl border border-status-success-border bg-status-success-bg p-3 flex items-center justify-between text-xs text-status-success-text animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">
              Analytics updated {syncSummary.lastSyncedAt ? new Date(syncSummary.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : "recently"} · {timeframeLabel} window ({postsSynced} posts tracked)
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-secondary">
            {syncSummary.lastSyncedAt ? new Date(syncSummary.lastSyncedAt).toLocaleTimeString() : "Just now"}
          </span>
        </div>
      )}

      {/* Permission Upgrade Notice Card */}
      {connected && !hasInsightsPermission && (
        <div className="rounded-xl border border-status-warning-border bg-status-warning-bg p-4 space-y-2" id="insights-auth-required-banner">
          <div className="flex items-center gap-2 text-status-warning-text">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold">Meta Insights Permission Required (`threads_manage_insights`)</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Your Threads account is linked for basic publishing, but Meta requires the <code className="font-mono font-semibold text-status-warning-text">threads_manage_insights</code> scope to access views, impressions, and engagement metrics. Click below to authorize Insights access.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onAuthorizeInsights}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 text-xs transition cursor-pointer shadow-sm"
            >
              <span>Grant Insights Permission</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
