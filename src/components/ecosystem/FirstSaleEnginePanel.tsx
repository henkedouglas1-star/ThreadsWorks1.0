import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Compass, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { ecosystemFetch } from "../../services/ecosystemClient";
import type { FirstSaleEngineState } from "../../../server/ecosystemDomainLogic";

interface FirstSaleEnginePanelProps {
  onLaunchApp: (appId: string) => void;
  onLaunchThreadsWorks: () => void;
}

export function FirstSaleEnginePanel({
  onLaunchApp,
  onLaunchThreadsWorks
}: FirstSaleEnginePanelProps) {
  const [state, setState] = useState<FirstSaleEngineState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ecosystemFetch<FirstSaleEngineState>("/api/ecosystem/first-sale-status");
      setState(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load First Sale Engine progress.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleOpenStep = (appId: string) => {
    if (appId === "threadsworks") {
      onLaunchThreadsWorks();
    } else {
      onLaunchApp(appId);
    }
  };

  if (loading && !state) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-8 flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        Inspecting your real ContentPaysUs workspace records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 sm:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Compass className="h-4 w-4" />
              Cross-Application Guided Workflow (Not a Standalone App)
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              First Sale Engine
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Automatically inspects your actual completed creator records—profile, research, offers, products, promos, CRM leads, meetings, and verified sales—so you never repeat work you already finished.
            </p>
          </div>

          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Progress
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {state && (
          <>
            {/* Real Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 dark:text-zinc-200">
                  {state.completedCount} of {state.totalMilestones} milestones completed ({state.percentComplete}%)
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Verified Creator Sales: {state.verifiedCreatorSalesCount}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                  style={{ width: `${state.percentComplete}%` }}
                />
              </div>
            </div>

            {/* Dynamic Next Recommended Action */}
            {state.nextRecommendedMilestone ? (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-950/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    Recommended Next Step · Milestone {state.nextRecommendedMilestone.step} of {state.totalMilestones}
                  </p>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    {state.nextRecommendedMilestone.title}
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-zinc-300">
                    {state.nextRecommendedMilestone.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenStep(state.nextRecommendedMilestone!.appId)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shrink-0"
                >
                  {state.nextRecommendedMilestone.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                All 12 First Sale Engine milestones are complete, including your verified creator sale!
              </div>
            )}

            {/* Verification Integrity Notice */}
            <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] p-3.5 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-900 dark:text-zinc-200">Verified Sale Integrity:</strong> Creator first-sale counts strictly exclude test payments, self-purchases, refunded/cancelled transactions, and ThreadsWorks SaaS subscription fees.
                {state.excludedSalesCount > 0 && ` (${state.excludedSalesCount} ineligible/test record(s) automatically excluded.)`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* All 12 Milestones Grid */}
      {state && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.milestones.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${
                m.completed
                  ? "border-emerald-300/80 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/10"
                  : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115]"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                    STEP {String(m.step).padStart(2, "0")} · {m.appName}
                  </span>
                  {m.completed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                      <Circle className="h-3.5 w-3.5" /> Pending
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">{m.title}</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{m.summary}</p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenStep(m.appId)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {m.completed ? `Revisit ${m.appName}` : m.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
