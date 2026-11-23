import React, { useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Check,
  X,
  Clock,
  Lightbulb,
  FileText,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Send,
  Layers,
  AlertCircle,
} from "lucide-react";
import { auth } from "../../firebase";
import { UserProfile } from "../../types";
import { CanonicalContentRecord, formatLocalDateKey } from "../../lib/canonicalContent";
import {
  WeeklyPlanRecommendationItem,
  buildDeterministicWeeklyPlanFallback,
  buildWeeklyPlanSlots,
} from "../../lib/contentIntelligence";

interface WeeklyPlannerWorkspaceProps {
  records: CanonicalContentRecord[];
  userId: string;
  profile?: UserProfile | null;
  onAssignToDay: (recordId: string, dateKey: string) => Promise<void>;
  onUnplanRecord: (recordId: string) => Promise<void>;
  onOpenSchedule: (record: CanonicalContentRecord, preferredDateKey?: string) => void;
  onOpenPublish: (record: CanonicalContentRecord) => void;
  onCreateForDay: (params: {
    dateKey: string;
    title?: string;
    topic?: string;
    pillarTitle?: string;
    summary?: string;
    sourceIdeaId?: string;
  }) => void;
}

export default function WeeklyPlannerWorkspace({
  records,
  userId,
  profile,
  onAssignToDay,
  onUnplanRecord,
  onOpenSchedule,
  onOpenPublish,
  onCreateForDay,
}: WeeklyPlannerWorkspaceProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [requestedTopic, setRequestedTopic] = useState("");
  const [recommending, setRecommending] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<WeeklyPlanRecommendationItem[]>([]);
  const [editorialSummary, setEditorialSummary] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [assigningDayKey, setAssigningDayKey] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"ready" | "drafts" | "ideas">("ready");

  const weekSlots = useMemo(
    () => buildWeeklyPlanSlots(records, weekOffset),
    [records, weekOffset]
  );

  const coveredCount = useMemo(
    () => weekSlots.filter((s) => !s.isOpen).length,
    [weekSlots]
  );

  const openUpcomingDays = useMemo(
    () => weekSlots.filter((s) => s.isOpen && !s.isPast),
    [weekSlots]
  );

  // Unused drafts & saved ideas available to assign to the week
  const assignedIdsInWeek = useMemo(
    () => new Set(weekSlots.flatMap((s) => s.allItems.map((i) => i.id))),
    [weekSlots]
  );

  const readyPosts = useMemo(
    () => records.filter((r) => r.stage === "Ready" && !assignedIdsInWeek.has(r.id)),
    [records, assignedIdsInWeek]
  );
  const unfinishedDrafts = useMemo(
    () => records.filter((r) => r.stage === "Draft" && !assignedIdsInWeek.has(r.id)),
    [records, assignedIdsInWeek]
  );
  const savedIdeas = useMemo(
    () => records.filter((r) => r.stage === "Idea" && !assignedIdsInWeek.has(r.id)),
    [records, assignedIdsInWeek]
  );

  const assignablePool = useMemo(
    () => [...readyPosts, ...unfinishedDrafts, ...savedIdeas],
    [readyPosts, unfinishedDrafts, savedIdeas]
  );

  const weekRangeLabel = useMemo(() => {
    if (weekSlots.length < 7) return "";
    const first = weekSlots[0].dateObj;
    const last = weekSlots[6].dateObj;
    const f = first.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const l = last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${f} – ${l}`;
  }, [weekSlots]);

  const handleRequestWeeklyPlan = async () => {
    if (openUpcomingDays.length === 0) {
      setEditorialSummary("All upcoming days in this week already have planned or scheduled content.");
      setAiRecommendations([]);
      return;
    }

    setRecommending(true);
    setAiNotice(null);
    setEditorialSummary(null);

    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

      const res = await fetch("/api/content-intelligence/weekly-plan", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          requestedTopic: requestedTopic.trim() || undefined,
          weekDays: weekSlots.map((s) => ({
            dateKey: s.dateKey,
            dayName: s.dayName,
            isOpen: s.isOpen,
            isPast: s.isPast,
            existingTitles: s.allItems.map((i) => i.title),
          })),
          existingPosts: records.slice(0, 60).map((r) => ({
            id: r.id,
            title: r.title,
            hook: r.hook,
            bodyPreview: (r.singlePost || r.notes || "").slice(0, 220),
            stage: r.stage,
            topic: r.topic,
            topics: r.topics,
            pillarTitle: r.pillarTitle || "",
            plannedDate: r.plannedDate || null,
            scheduledFor: r.scheduledFor || null,
            publishedAt: r.publishedAt || null,
          })),
          profile: profile
            ? {
                offer: profile.offer || "",
                audience: profile.audience || "",
                desiredResult: profile.desiredResult || "",
                voiceTone: profile.creatorIdentity?.tone || "",
                writingStyle: profile.writingStyle || profile.creatorIdentity?.writingStyle || "",
                customInstruction: profile.customInstruction || "",
                contentPillars: (profile.contentPillars || []).map((p) => ({
                  title: p.title,
                  description: p.description || "",
                  coreExpertise: p.coreExpertise || "",
                })),
              }
            : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      const data = await res.json();
      const recs: WeeklyPlanRecommendationItem[] = Array.isArray(data?.recommendations)
        ? data.recommendations
        : [];
      setAiRecommendations(recs);
      setEditorialSummary(data?.editorialSummary || null);
      if (data?.notice) {
        setAiNotice(data.notice);
      }
    } catch {
      const fallback = buildDeterministicWeeklyPlanFallback(
        records,
        weekSlots,
        profile,
        requestedTopic.trim() || undefined
      );
      setAiRecommendations(fallback);
      setAiNotice(
        "AI planning is temporarily unavailable. Showing grounded suggestions built from your existing drafts, saved ideas, and content pillars."
      );
    } finally {
      setRecommending(false);
    }
  };

  const handleApproveRecommendation = async (rec: WeeklyPlanRecommendationItem) => {
    if (rec.actionType === "assign_existing_draft" && rec.existingRecordId) {
      await onAssignToDay(rec.existingRecordId, rec.dateKey);
      setAiRecommendations((prev) => prev.filter((item) => item.dateKey !== rec.dateKey));
      return;
    }

    if (rec.actionType === "develop_saved_idea" && rec.existingRecordId) {
      const idea = records.find((r) => r.id === rec.existingRecordId);
      onCreateForDay({
        dateKey: rec.dateKey,
        sourceIdeaId: rec.existingRecordId,
        title: idea?.title || rec.title,
        topic: rec.topic,
        pillarTitle: rec.pillarTitle || idea?.pillarTitle,
        summary: idea?.singlePost || idea?.notes || rec.rationale,
      });
      return;
    }

    onCreateForDay({
      dateKey: rec.dateKey,
      title: rec.title,
      topic: rec.topic,
      pillarTitle: rec.pillarTitle,
      summary: `${rec.angle}: ${rec.title}. ${rec.rationale}`,
    });
  };

  const handleApproveAllDraftAssignments = async () => {
    const draftRecs = aiRecommendations.filter(
      (r) => r.actionType === "assign_existing_draft" && r.existingRecordId
    );
    for (const rec of draftRecs) {
      if (rec.existingRecordId) {
        await onAssignToDay(rec.existingRecordId, rec.dateKey);
      }
    }
    const approvedDates = new Set(draftRecs.map((r) => r.dateKey));
    setAiRecommendations((prev) => prev.filter((item) => !approvedDates.has(item.dateKey)));
  };

  const draftRecsCount = aiRecommendations.filter(
    (r) => r.actionType === "assign_existing_draft" && r.existingRecordId
  ).length;

  return (
    <div className="space-y-4" id="weekly-planner-workspace">
      {/* Header & Week Controls */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-4 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-text" />
              <h2 className="!text-left !mx-0 text-sm font-bold text-text-primary">
                7-Day Weekly Content Plan
              </h2>
              <span className="rounded-md bg-bg-app border border-border-primary px-2 py-0.5 text-[10px] font-mono text-text-secondary">
                {coveredCount}/7 days covered
              </span>
            </div>
            <p className="!text-left !mx-0 text-xs text-text-muted">
              Plan your week first, assign ready drafts or saved ideas, then schedule approved posts when ready.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setWeekOffset((w) => w - 1);
                setAiRecommendations([]);
              }}
              className="rounded-lg border border-border-primary bg-bg-app hover:bg-bg-card-hover p-2 text-text-secondary hover:text-text-primary transition cursor-pointer"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setAiRecommendations([]);
              }}
              className="rounded-lg border border-border-primary bg-bg-app hover:bg-bg-card-hover px-3 py-1.5 text-xs font-semibold text-text-primary transition cursor-pointer"
            >
              {weekOffset === 0 ? `This Week · ${weekRangeLabel}` : weekRangeLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekOffset((w) => w + 1);
                setAiRecommendations([]);
              }}
              className="rounded-lg border border-border-primary bg-bg-app hover:bg-bg-card-hover p-2 text-text-secondary hover:text-text-primary transition cursor-pointer"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI Weekly Planner Assistant Bar */}
        <div className="pt-3 border-t border-border-primary/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={requestedTopic}
            onChange={(e) => setRequestedTopic(e.target.value)}
            placeholder="Optional weekly focus topic (e.g. client onboarding, offer launch)..."
            className="flex-1 rounded-xl border border-border-primary bg-bg-app px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-purple-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleRequestWeeklyPlan}
            disabled={recommending || openUpcomingDays.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 text-xs transition cursor-pointer shadow-sm disabled:opacity-40"
          >
            {recommending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>
              {recommending
                ? "Planning Open Days..."
                : openUpcomingDays.length === 0
                ? "All Upcoming Days Filled"
                : `Suggest Plan for ${openUpcomingDays.length} Open ${
                    openUpcomingDays.length === 1 ? "Day" : "Days"
                  }`}
            </span>
          </button>
        </div>

        {/* AI Notice / Summary */}
        {(aiNotice || editorialSummary) && (
          <div className="rounded-xl border border-brand-border bg-brand-surface/50 dark:bg-purple-500/5 px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2">
              {aiNotice ? (
                <AlertCircle className="h-4 w-4 text-status-warning-text shrink-0 mt-0.5" />
              ) : (
                <Sparkles className="h-4 w-4 text-brand-text shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                {editorialSummary && (
                  <p className="!text-left !mx-0 text-text-primary font-medium">{editorialSummary}</p>
                )}
                {aiNotice && (
                  <p className="!text-left !mx-0 text-[11px] text-status-warning-text font-medium">{aiNotice}</p>
                )}
              </div>
            </div>
            {aiRecommendations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAiRecommendations([]);
                  setEditorialSummary(null);
                  setAiNotice(null);
                }}
                className="text-[11px] text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Reviewable AI Recommendations Panel */}
        {aiRecommendations.length > 0 && (
          <div className="rounded-xl border border-brand-border bg-bg-app p-3.5 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text-strong">
                Review Recommendations ({aiRecommendations.length} Open{" "}
                {aiRecommendations.length === 1 ? "Day" : "Days"})
              </span>
              {draftRecsCount > 1 && (
                <button
                  type="button"
                  onClick={handleApproveAllDraftAssignments}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold px-3 py-1 text-[11px] transition cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                  <span>Approve All {draftRecsCount} Draft Assignments</span>
                </button>
              )}
            </div>

            <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {aiRecommendations.map((rec) => (
                <div
                  key={rec.dateKey}
                  className="rounded-xl border border-border-primary bg-bg-card p-3 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-text-primary">
                        {rec.dayName} · {rec.dateKey.slice(5)}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          rec.actionType === "assign_existing_draft"
                            ? "bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-400 border-teal-300 dark:border-teal-500/25"
                            : rec.actionType === "develop_saved_idea"
                            ? "bg-sky-50 dark:bg-sky-500/15 text-sky-800 dark:text-sky-400 border-sky-300 dark:border-sky-500/25"
                            : "bg-brand-surface text-brand-text-strong border-brand-border"
                        }`}
                      >
                        {rec.actionType === "assign_existing_draft"
                          ? "Reuse Draft"
                          : rec.actionType === "develop_saved_idea"
                          ? "Saved Idea"
                          : "Create New"}
                      </span>
                    </div>
                    <p className="!text-left !mx-0 text-xs font-bold text-text-primary leading-snug">
                      {rec.title}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {rec.pillarTitle && (
                        <span className="rounded bg-status-info-bg border border-status-info-border px-1.5 py-0.5 text-[10px] font-semibold text-status-info-text">
                          {rec.pillarTitle}
                        </span>
                      )}
                      <span className="rounded bg-bg-app border border-border-primary px-1.5 py-0.5 text-[10px] text-text-secondary">
                        {rec.angle}
                      </span>
                    </div>
                    <p className="!text-left !mx-0 text-[11px] text-text-secondary leading-snug">
                      {rec.rationale}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border-primary/60">
                    <button
                      type="button"
                      onClick={() =>
                        setAiRecommendations((prev) =>
                          prev.filter((item) => item.dateKey !== rec.dateKey)
                        )
                      }
                      className="rounded-lg border border-border-primary px-2.5 py-1 text-[10px] font-semibold text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveRecommendation(rec)}
                      className="inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 text-[10px] transition cursor-pointer"
                    >
                      <span>
                        {rec.actionType === "assign_existing_draft"
                          ? "Approve & Assign"
                          : "Generate Post"}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 7-Day Grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {weekSlots.map((slot) => (
          <div
            key={slot.dateKey}
            className={`rounded-2xl border p-3 flex flex-col justify-between gap-3 min-h-[220px] transition ${
              slot.isToday
                ? "border-purple-500/50 bg-purple-500/[0.04]"
                : slot.isOpen && !slot.isPast
                ? "border-dashed border-border-secondary bg-bg-card/70"
                : "border-border-primary bg-bg-card"
            }`}
          >
            <div className="space-y-2.5">
              {/* Day Header */}
              <div className="flex items-center justify-between gap-1 pb-2 border-b border-border-primary/70">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text-primary">{slot.shortDay}</span>
                    <span className="text-[11px] font-mono text-text-muted">
                      {slot.monthShort} {slot.dayNumber}
                    </span>
                  </div>
                </div>
                {slot.isToday ? (
                  <span className="rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Today
                  </span>
                ) : slot.isOpen && !slot.isPast ? (
                  <span className="rounded bg-status-warning-bg border border-status-warning-border px-1.5 py-0.5 text-[9px] font-semibold text-status-warning-text">
                    Open
                  </span>
                ) : null}
              </div>

              {/* Day Items */}
              {slot.allItems.length === 0 ? (
                <p className="!text-left !mx-0 text-[11px] text-text-secondary py-2">
                  {slot.isPast ? "No posts recorded." : "No content planned yet."}
                </p>
              ) : (
                <div className="space-y-2">
                  {slot.allItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-2.5 space-y-2 ${
                        item.stage === "Published"
                          ? "border-status-success-border bg-status-success-bg"
                          : item.stage === "Scheduled"
                          ? "border-brand-border bg-brand-surface/70 dark:bg-purple-500/10"
                          : "border-status-warning-border bg-status-warning-bg"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[9px] font-bold uppercase ${
                            item.stage === "Published"
                              ? "text-status-success-text"
                              : item.stage === "Scheduled"
                              ? "text-brand-text-strong"
                              : "text-status-warning-text"
                          }`}
                        >
                          {item.stage}
                        </span>
                        {item.stage === "Scheduled" && item.scheduledFor && (
                          <span className="text-[9px] font-mono font-semibold text-brand-text-strong flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(item.scheduledFor).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      <p className="!text-left !mx-0 text-[11px] font-bold text-text-primary leading-snug line-clamp-2">
                        {item.title}
                      </p>

                      {item.pillarTitle && (
                        <span className="inline-block rounded bg-bg-card border border-border-primary px-1.5 py-0.5 text-[9px] text-text-secondary truncate max-w-full">
                          {item.pillarTitle}
                        </span>
                      )}

                      {/* Planned item controls: Move Day, Schedule, Unplan */}
                      {item.stage === "Planned" && (
                        <div className="space-y-1.5 pt-1 border-t border-status-warning-border/60">
                          <select
                            value={slot.dateKey}
                            onChange={(e) => onAssignToDay(item.id, e.target.value)}
                            aria-label="Move planned post to another day"
                            className="w-full rounded-md border border-border-primary bg-bg-card px-1.5 py-1 text-[10px] text-text-primary focus:border-purple-500 focus:outline-none"
                          >
                            {weekSlots.map((ws) => (
                              <option key={ws.dateKey} value={ws.dateKey}>
                                Move: {ws.shortDay} {ws.monthShort} {ws.dayNumber}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenSchedule(item, slot.dateKey)}
                              className="flex-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-bold py-1 text-[10px] transition cursor-pointer"
                            >
                              Schedule
                            </button>
                            <button
                              type="button"
                              onClick={() => onUnplanRecord(item.id)}
                              title="Move back to Ready"
                              className="rounded-md border border-border-primary bg-bg-card px-1.5 py-1 text-[10px] text-text-secondary hover:text-text-primary cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Scheduled item quick controls */}
                      {item.stage === "Scheduled" && (
                        <div className="flex items-center gap-1 pt-1 border-t border-brand-border/60">
                          <button
                            type="button"
                            onClick={() => onOpenSchedule(item)}
                            className="flex-1 rounded-md border border-brand-border bg-bg-card hover:bg-brand-surface-hover text-brand-text-strong font-semibold py-1 text-[10px] transition cursor-pointer"
                          >
                            Edit Time
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPublish(item)}
                            title="Publish now"
                            className="rounded-md border border-status-success-border bg-status-success-bg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 p-1 text-status-success-text cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Day Footer: Assign Existing or Create New */}
            {!slot.isPast && (
              <div className="pt-2 border-t border-border-primary/60 space-y-1.5">
                {assigningDayKey === slot.dateKey ? (
                  <div className="space-y-1.5">
                    <select
                      defaultValue=""
                      onChange={async (e) => {
                        const recId = e.target.value;
                        if (!recId) return;
                        await onAssignToDay(recId, slot.dateKey);
                        setAssigningDayKey(null);
                      }}
                      className="w-full rounded-lg border border-brand-border bg-bg-app px-2 py-1.5 text-[10px] text-text-primary focus:outline-none"
                    >
                      <option value="">Choose draft or idea...</option>
                      {assignablePool.map((item) => (
                        <option key={item.id} value={item.id}>
                          [{item.stage}] {item.title.slice(0, 34)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAssigningDayKey(null)}
                      className="w-full text-[10px] text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {assignablePool.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAssigningDayKey(slot.dateKey)}
                        className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-border-primary bg-bg-app hover:border-amber-500/60 hover:text-text-primary py-1.5 text-[10px] font-semibold text-text-secondary transition cursor-pointer"
                      >
                        <Layers className="h-3 w-3 text-status-warning-text" />
                        <span>Assign Draft</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCreateForDay({ dateKey: slot.dateKey })}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover py-1.5 text-[10px] font-bold text-brand-text-strong transition cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Create Post</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Unused Drafts & Saved Ideas Drawer */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-primary">
              Available Content Pool for This Week
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDrawerTab("ready")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition ${
                drawerTab === "ready"
                  ? "bg-teal-600 text-white"
                  : "bg-bg-app border border-border-primary text-text-secondary"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Ready ({readyPosts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab("drafts")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition ${
                drawerTab === "drafts"
                  ? "bg-purple-600 text-white"
                  : "bg-bg-app border border-border-primary text-text-secondary"
              }`}
            >
              <FileText className="h-3 w-3" />
              <span>Drafts ({unfinishedDrafts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab("ideas")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition ${
                drawerTab === "ideas"
                  ? "bg-sky-600 text-white"
                  : "bg-bg-app border border-border-primary text-text-secondary"
              }`}
            >
              <Lightbulb className="h-3 w-3" />
              <span>Saved Ideas ({savedIdeas.length})</span>
            </button>
          </div>
        </div>

        {(() => {
          const items =
            drawerTab === "ready"
              ? readyPosts
              : drawerTab === "drafts"
              ? unfinishedDrafts
              : savedIdeas;

          if (items.length === 0) {
            return (
              <p className="!text-left !mx-0 text-xs text-text-muted py-2">
                {drawerTab === "ready"
                  ? "No unassigned Ready posts right now. Mark a draft Ready or generate a new post."
                  : drawerTab === "drafts"
                  ? "No unfinished drafts waiting."
                  : "No saved ideas yet. Capture ideas in the Content Library or Content Engine."}
              </p>
            );
          }

          return (
            <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {items.slice(0, 9).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border-primary bg-bg-app/80 p-3 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <p className="!text-left !mx-0 text-xs font-bold text-text-primary line-clamp-1">
                      {item.title}
                    </p>
                    <p className="!text-left !mx-0 text-[11px] text-text-muted line-clamp-2">
                      {item.singlePost || item.notes || item.hook}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <select
                      defaultValue=""
                      onChange={async (e) => {
                        const dateKey = e.target.value;
                        if (!dateKey) return;
                        await onAssignToDay(item.id, dateKey);
                        e.target.value = "";
                      }}
                      className="flex-1 rounded-lg border border-border-primary bg-bg-card px-2 py-1 text-[11px] text-text-primary focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Assign to day...</option>
                      {weekSlots
                        .filter((s) => !s.isPast)
                        .map((s) => (
                          <option key={s.dateKey} value={s.dateKey}>
                            {s.shortDay} {s.monthShort} {s.dayNumber}
                            {s.isOpen ? " (Open)" : ""}
                          </option>
                        ))}
                    </select>

                    {item.stage === "Idea" && (
                      <button
                        type="button"
                        onClick={() =>
                          onCreateForDay({
                            dateKey:
                              openUpcomingDays[0]?.dateKey ||
                              formatLocalDateKey(new Date()),
                            sourceIdeaId: item.id,
                            title: item.title,
                            topic: item.topic,
                            pillarTitle: item.pillarTitle,
                            summary: item.singlePost || item.notes || "",
                          })
                        }
                        className="rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 text-[11px] transition cursor-pointer shrink-0"
                      >
                        Draft
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
