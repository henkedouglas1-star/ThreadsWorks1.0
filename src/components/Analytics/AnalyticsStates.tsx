import React from "react";
import { Sparkles, AlertCircle, RefreshCw, BarChart3, Lock, ShieldCheck } from "lucide-react";
import ThreadsConnectButton from "../ThreadsConnectButton";

interface DisconnectedStateProps {
  onConnect: () => void;
  isConnecting?: boolean;
}

export function DisconnectedState({ onConnect, isConnecting = false }: DisconnectedStateProps) {
  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card p-8 md:p-12 text-center space-y-5 max-w-xl mx-auto my-6 shadow-sm" id="analytics-disconnected-state">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner">
        <BarChart3 className="h-7 w-7" />
      </div>

      <div className="space-y-2">
        <h3 className="text-base md:text-lg font-bold text-text-primary">Connect Threads for Analytics</h3>
        <p className="text-xs text-text-secondary leading-relaxed max-w-md mx-auto">
          ThreadsWorks Content Performance Intelligence connects directly with Meta Threads Graph API Insights to measure views, interactions, and tie your strategic pillars directly to real audience results.
        </p>
      </div>

      <div className="pt-2">
        <ThreadsConnectButton 
          returnTo="/analytics"
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 text-xs shadow-lg transition cursor-pointer disabled:opacity-50 min-h-[44px]"
          icon={<Sparkles className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}

interface MissingPermissionStateProps {
  onAuthorize: () => void;
}

export function MissingPermissionState({ onAuthorize }: MissingPermissionStateProps) {
  return (
    <div className="rounded-2xl border border-status-warning-border bg-bg-card p-8 text-center space-y-4 max-w-xl mx-auto my-6 shadow-sm" id="analytics-permission-state">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-status-warning-bg border border-status-warning-border text-status-warning-text flex items-center justify-center">
        <Lock className="h-6 w-6" />
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-bold text-text-primary">Meta Insights Authorization Required</h3>
        <p className="text-xs text-text-secondary leading-relaxed max-w-md mx-auto">
          To read impressions, view counts, and engagement telemetry, your Threads authorization needs the <code className="px-1.5 py-0.5 rounded bg-bg-app font-mono text-brand-text-strong font-semibold text-[11px]">threads_manage_insights</code> scope.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onAuthorize}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 text-xs shadow-md transition cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Authorize Insights Scope</span>
        </button>
      </div>
    </div>
  );
}

export function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" id="analytics-loading-skeleton">
      <div className="h-28 rounded-2xl bg-bg-card border border-border-primary" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-bg-card border border-border-primary" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-bg-card border border-border-primary" />
      <div className="h-80 rounded-2xl bg-bg-card border border-border-primary" />
    </div>
  );
}
