import React, { useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  Plus,
  Calendar,
  Send,
  Copy,
  Check,
  Trash2,
  Edit3,
  Save,
  X,
  Tag,
  Layers,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  CopyCheck,
  ArrowUpRight,
  Link2,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { auth } from "../../firebase";
import { UserProfile } from "../../types";
import {
  CanonicalContentRecord,
  CanonicalStage,
  formatLocalDateKey,
  normalizeTopicsList,
} from "../../lib/canonicalContent";
import {
  LibrarySortOption,
  detectDuplicateGroups,
  extractAvailableFacets,
  filterAndSortLibraryRecords,
  findRelatedContent,
  getWeekStartDate,
} from "../../lib/contentIntelligence";

interface ClassificationSuggestion {
  id: string;
  suggestedTopics: string[];
  suggestedPillarTitle: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

interface ContentLibraryWorkspaceProps {
  records: CanonicalContentRecord[];
  userId: string;
  profile?: UserProfile | null;
  stageFilter: CanonicalStage | "all" | "unfinished";
  onStageFilterChange: (stage: CanonicalStage | "all" | "unfinished") => void;
  topicFilter: string;
  onTopicFilterChange: (topic: string) => void;
  pillarFilter: string;
  onPillarFilterChange: (pillar: string) => void;
  onlyDuplicates: boolean;
  onOnlyDuplicatesChange: (only: boolean) => void;
  onCreateRecord: (input: {
    title: string;
    body: string;
    stage: "Idea" | "Draft" | "Ready";
    topic?: string;
    pillarTitle?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateRecord: (
    recordId: string,
    updates: Partial<CanonicalContentRecord>
  ) => Promise<void>;
  onDeleteRecord: (recordId: string) => Promise<void>;
  onOpenSchedule: (record: CanonicalContentRecord, preferredDateKey?: string) => void;
  onOpenPublish: (record: CanonicalContentRecord) => void;
  onDevelopIdea: (record: CanonicalContentRecord) => void;
}

const STAGE_BADGE_STYLES: Record<CanonicalStage, string> = {
  Idea: "bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-400 border-sky-300 dark:border-sky-500/25",
  Draft: "bg-bg-app text-text-secondary border-border-primary",
  Ready: "bg-teal-50 dark:bg-teal-500/10 text-teal-800 dark:text-teal-400 border-teal-300 dark:border-teal-500/25",
  Planned: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
  Scheduled: "bg-brand-surface text-brand-text-strong border-brand-border",
  Published: "bg-status-success-bg text-status-success-text border-status-success-border",
  Failed: "bg-status-danger-bg text-status-danger-text border-status-danger-border",
};

export default function ContentLibraryWorkspace({
  records,
  userId,
  profile,
  stageFilter,
  onStageFilterChange,
  topicFilter,
  onTopicFilterChange,
  pillarFilter,
  onPillarFilterChange,
  onlyDuplicates,
  onOnlyDuplicatesChange,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  onOpenSchedule,
  onOpenPublish,
  onDevelopIdea,
}: ContentLibraryWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<LibrarySortOption>("newest");

  // Quick capture drawer state
  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [captureStage, setCaptureStage] = useState<"Idea" | "Draft">("Idea");
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureBody, setCaptureBody] = useState("");
  const [captureTopic, setCaptureTopic] = useState("");
  const [capturePillar, setCapturePillar] = useState("");
  const [capturing, setCapturing] = useState(false);

  // Inline editing & expansion state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editParts, setEditParts] = useState<string[]>([]);
  const [editTopicsText, setEditTopicsText] = useState("");
  const [editPillar, setEditPillar] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedRelatedId, setExpandedRelatedId] = useState<string | null>(null);
  const [planDayPickerId, setPlanDayPickerId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // AI organization suggestions state
  const [classifying, setClassifying] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, ClassificationSuggestion>>({});
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const facets = useMemo(() => extractAvailableFacets(records, profile), [records, profile]);
  const duplicateGroups = useMemo(() => detectDuplicateGroups(records), [records]);
  const duplicateByRecordId = useMemo(() => {
    const map = new Map<string, { groupSize: number; isPrimary: boolean; similarity: number }>();
    for (const g of duplicateGroups) {
      for (const id of g.recordIds) {
        map.set(id, {
          groupSize: g.recordIds.length,
          isPrimary: id === g.primaryRecordId,
          similarity: g.similarity,
        });
      }
    }
    return map;
  }, [duplicateGroups]);

  const recordTitleById = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => map.set(r.id, r.title));
    return map;
  }, [records]);

  const filteredRecords = useMemo(
    () =>
      filterAndSortLibraryRecords(records, {
        searchQuery,
        stage: stageFilter,
        topic: topicFilter,
        pillar: pillarFilter,
        sortBy,
        onlyDuplicates,
      }),
    [records, searchQuery, stageFilter, topicFilter, pillarFilter, sortBy, onlyDuplicates]
  );

  // Next 7 upcoming days for quick "Add to Week" assignment
  const upcomingSevenDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = getWeekStartDate(today);
    const days: Array<{ dateKey: string; label: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push({
        dateKey: formatLocalDateKey(d),
        label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return days;
  }, []);

  const configuredPillars = useMemo(
    () => (profile?.contentPillars || []).filter((p) => p?.title?.trim()),
    [profile]
  );

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureTitle.trim() && !captureBody.trim()) return;
    setCapturing(true);
    try {
      await onCreateRecord({
        title: captureTitle.trim() || captureBody.trim().slice(0, 60),
        body: captureBody.trim() || captureTitle.trim(),
        stage: captureStage,
        topic: captureTopic.trim() || undefined,
        pillarTitle: capturePillar || undefined,
      });
      setCaptureTitle("");
      setCaptureBody("");
      setCaptureTopic("");
      setCapturePillar("");
      setShowCaptureForm(false);
    } finally {
      setCapturing(false);
    }
  };

  const handleStartEdit = (rec: CanonicalContentRecord) => {
    setEditingId(rec.id);
    setEditTitle(rec.title);
    setEditParts(rec.threadParts.length > 0 ? [...rec.threadParts] : [rec.singlePost]);
    setEditTopicsText((rec.topics || []).join(", "));
    setEditPillar(rec.pillarTitle || "");
  };

  const handleSaveEdit = async (rec: CanonicalContentRecord) => {
    setSavingEdit(true);
    try {
      const cleanParts = editParts.map((p) => p.trim()).filter(Boolean);
      const parsedTopics = normalizeTopicsList(editTopicsText);
      await onUpdateRecord(rec.id, {
        title: editTitle.trim() || rec.title,
        singlePost: cleanParts[0] || rec.singlePost,
        threadParts: cleanParts.length > 0 ? cleanParts : [rec.singlePost],
        hook: (cleanParts[0] || rec.singlePost).split("\n")[0].slice(0, 120),
        topics: parsedTopics,
        topic: parsedTopics[0] || "General",
        pillarTitle: editPillar || undefined,
      });
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopy = (rec: CanonicalContentRecord) => {
    const text = rec.threadParts.length > 1 ? rec.threadParts.join("\n\n") : rec.singlePost;
    navigator.clipboard.writeText(text || rec.title);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRunAiClassify = async () => {
    const candidates = (filteredRecords.length > 0 ? filteredRecords : records)
      .filter((r) => r.stage !== "Published" || !r.pillarTitle || r.topics.length === 0)
      .slice(0, 18);

    if (candidates.length === 0) {
      setAiNotice("All visible items already have topics and pillars assigned.");
      return;
    }

    setClassifying(true);
    setAiNotice(null);
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

      const res = await fetch("/api/content-intelligence/classify", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          items: candidates.map((r) => ({
            id: r.id,
            title: r.title,
            body: r.threadParts.join(" ").slice(0, 500),
            currentTopic: r.topic,
            currentTopics: r.topics,
            currentPillarTitle: r.pillarTitle || "",
          })),
          availablePillars: configuredPillars.map((p) => ({
            title: p.title,
            description: p.description || "",
            coreExpertise: p.coreExpertise || "",
          })),
          creatorContext: {
            offer: profile?.offer || "",
            audience: profile?.audience || "",
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const data = await res.json();
      const map: Record<string, ClassificationSuggestion> = {};
      if (Array.isArray(data?.results)) {
        for (const item of data.results) {
          if (item?.id) map[item.id] = item;
        }
      }
      setAiSuggestions(map);
      if (data?.notice) {
        setAiNotice(data.notice);
      } else if (Object.keys(map).length > 0) {
        setAiNotice(
          `Prepared topic & pillar suggestions for ${Object.keys(map).length} items. Review and apply individually or in one click.`
        );
      }
    } catch {
      setAiNotice(
        "AI topic suggestions are temporarily unavailable. Your library is safe and you can still tag topics or pillars manually."
      );
    } finally {
      setClassifying(false);
    }
  };

  const handleApplySuggestion = async (rec: CanonicalContentRecord, suggestion: ClassificationSuggestion) => {
    const mergedTopics = normalizeTopicsList(undefined, [...(rec.topics || []), ...suggestion.suggestedTopics]);
    await onUpdateRecord(rec.id, {
      topics: mergedTopics,
      topic: mergedTopics[0] || rec.topic,
      ...(suggestion.suggestedPillarTitle ? { pillarTitle: suggestion.suggestedPillarTitle } : {}),
    });
    setAiSuggestions((prev) => {
      const next = { ...prev };
      delete next[rec.id];
      return next;
    });
  };

  const handleApplyAllSuggestions = async () => {
    const entries = Object.entries(aiSuggestions);
    for (const [id, suggestion] of entries) {
      const rec = records.find((r) => r.id === id);
      if (rec) {
        await handleApplySuggestion(rec, suggestion);
      }
    }
    setAiNotice("Applied topic and pillar suggestions to your library.");
  };

  const formatPlannedDisplay = (dateKey?: string | null) => {
    if (!dateKey) return "";
    const [y, m, d] = dateKey.split("-").map(Number);
    if (!y || !m || !d) return dateKey;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const stageTabs: Array<{ id: CanonicalStage | "all" | "unfinished"; label: string }> = [
    { id: "all", label: `All (${records.length})` },
    { id: "unfinished", label: "Unfinished" },
    { id: "Idea", label: "Ideas" },
    { id: "Draft", label: "Drafts" },
    { id: "Ready", label: "Ready" },
    { id: "Planned", label: "Planned" },
    { id: "Scheduled", label: "Scheduled" },
    { id: "Published", label: "Published" },
  ];

  const pendingSuggestionsCount = Object.keys(aiSuggestions).length;

  return (
    <div className="space-y-4" id="content-library-workspace">
      {/* Top Action Bar: Search, Quick Capture, AI Organize */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search titles, post text, topics, pillars, or notes..."
              className="w-full rounded-xl border border-border-primary bg-bg-app pl-9 pr-8 py-2 text-xs text-text-primary placeholder-text-muted focus:border-purple-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCaptureForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-3.5 py-2 text-xs transition cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Save Idea / Draft</span>
            </button>

            <button
              type="button"
              onClick={handleRunAiClassify}
              disabled={classifying || records.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text-strong font-bold px-3.5 py-2 text-xs transition cursor-pointer disabled:opacity-40"
            >
              {classifying ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{classifying ? "Organizing..." : "AI Suggest Topics"}</span>
            </button>
          </div>
        </div>

        {/* Lifecycle Filter Pills + Dropdown Facets */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pt-1 border-t border-border-primary/70">
          <div className="flex flex-wrap items-center gap-1.5">
            {stageTabs.map((tab) => {
              const active = stageFilter === tab.id && !onlyDuplicates;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onOnlyDuplicatesChange(false);
                    onStageFilterChange(tab.id);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    active
                      ? "bg-purple-600 text-white"
                      : "bg-bg-app border border-border-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
            {duplicateGroups.length > 0 && (
              <button
                type="button"
                onClick={() => onOnlyDuplicatesChange(!onlyDuplicates)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  onlyDuplicates
                    ? "bg-orange-600 text-white"
                    : "bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/25 text-orange-800 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20"
                }`}
              >
                <CopyCheck className="h-3 w-3" />
                <span>Duplicates ({duplicateGroups.length})</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Topic Filter */}
            <select
              value={topicFilter}
              onChange={(e) => onTopicFilterChange(e.target.value)}
              aria-label="Filter by topic"
              className="rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-[11px] text-text-primary focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Topics</option>
              {facets.topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Pillar Filter */}
            <select
              value={pillarFilter}
              onChange={(e) => onPillarFilterChange(e.target.value)}
              aria-label="Filter by content pillar"
              className="rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-[11px] text-text-primary focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Pillars</option>
              <option value="__unassigned__">Unassigned Pillar</option>
              {facets.pillars.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as LibrarySortOption)}
              aria-label="Sort content"
              className="rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-[11px] text-text-primary focus:border-purple-500 focus:outline-none"
            >
              <option value="newest">Sort: Newest</option>
              <option value="updated">Sort: Recently Updated</option>
              <option value="scheduled">Sort: Planned / Scheduled Date</option>
              <option value="stage">Sort: Lifecycle Stage</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="title">Sort: Title A-Z</option>
            </select>
          </div>
        </div>

        {/* AI Notice / Batch Apply Banner */}
        {(aiNotice || pendingSuggestionsCount > 0) && (
          <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-text-secondary">{aiNotice}</span>
            <div className="flex items-center gap-2">
              {pendingSuggestionsCount > 0 && (
                <button
                  type="button"
                  onClick={handleApplyAllSuggestions}
                  className="rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1 text-[11px] transition cursor-pointer"
                >
                  Apply All ({pendingSuggestionsCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAiNotice(null);
                  setAiSuggestions({});
                }}
                className="text-text-muted hover:text-text-primary text-[11px] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Capture Idea / Manual Draft Form */}
      {showCaptureForm && (
        <form
          onSubmit={handleQuickCapture}
          className="rounded-2xl border border-purple-500/30 bg-bg-card p-4 space-y-3 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCaptureStage("Idea")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition ${
                  captureStage === "Idea"
                    ? "bg-sky-600 text-white"
                    : "bg-bg-app border border-border-primary text-text-secondary"
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Saved Idea</span>
              </button>
              <button
                type="button"
                onClick={() => setCaptureStage("Draft")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition ${
                  captureStage === "Draft"
                    ? "bg-purple-600 text-white"
                    : "bg-bg-app border border-border-primary text-text-secondary"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Manual Draft</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowCaptureForm(false)}
              className="text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={captureTitle}
              onChange={(e) => setCaptureTitle(e.target.value)}
              placeholder={
                captureStage === "Idea"
                  ? "Idea title or angle (e.g. Why daily replies outperform cold DMs)"
                  : "Draft title"
              }
              required
              className="w-full rounded-xl border border-border-primary bg-bg-app px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-purple-500 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={captureTopic}
                onChange={(e) => setCaptureTopic(e.target.value)}
                placeholder="Topic tag (optional)"
                className="w-full rounded-xl border border-border-primary bg-bg-app px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-purple-500 focus:outline-none"
              />
              <select
                value={capturePillar}
                onChange={(e) => setCapturePillar(e.target.value)}
                className="w-full rounded-xl border border-border-primary bg-bg-app px-2.5 py-2 text-xs text-text-primary focus:border-purple-500 focus:outline-none"
              >
                <option value="">Pillar (optional)</option>
                {configuredPillars.map((p) => (
                  <option key={p.title} value={p.title}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={captureBody}
            onChange={(e) => setCaptureBody(e.target.value)}
            rows={3}
            placeholder={
              captureStage === "Idea"
                ? "Notes, key takeaway, or rough thought you want to expand later..."
                : "Write your Threads post draft..."
            }
            className="w-full rounded-xl border border-border-primary bg-bg-app p-3 text-xs text-text-primary placeholder-text-muted focus:border-purple-500 focus:outline-none resize-y"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCaptureForm(false)}
              className="rounded-xl border border-border-primary bg-bg-app px-3.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={capturing || (!captureTitle.trim() && !captureBody.trim())}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-1.5 text-xs transition cursor-pointer disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{capturing ? "Saving..." : `Save ${captureStage}`}</span>
            </button>
          </div>
        </form>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
        <span>
          Showing <strong className="text-text-primary">{filteredRecords.length}</strong> of{" "}
          {records.length} content {records.length === 1 ? "item" : "items"}
        </span>
        {(searchQuery || stageFilter !== "all" || topicFilter !== "all" || pillarFilter !== "all" || onlyDuplicates) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              onStageFilterChange("all");
              onTopicFilterChange("all");
              onPillarFilterChange("all");
              onOnlyDuplicatesChange(false);
            }}
            className="text-brand-text-strong hover:underline font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Empty State */}
      {filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-border-primary bg-bg-card p-10 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-brand-text">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">No matching content found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {records.length === 0
              ? "Save an idea, write a draft, or generate posts in the Content Engine to start building your organized library."
              : "Try clearing one of your active filters or search terms."}
          </p>
          {records.length === 0 && (
            <button
              type="button"
              onClick={() => setShowCaptureForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 text-xs transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Save Your First Idea or Draft</span>
            </button>
          )}
        </div>
      ) : (
        /* Content Cards Grid */
        <div className="grid gap-3 md:grid-cols-2">
          {filteredRecords.map((rec) => {
            const isEditing = editingId === rec.id;
            const dupMeta = duplicateByRecordId.get(rec.id);
            const suggestion = aiSuggestions[rec.id];
            const showRelated = expandedRelatedId === rec.id;
            const relatedItems = showRelated ? findRelatedContent(rec, records, 3) : [];
            const sourceIdeaTitle = rec.sourceIdeaId ? recordTitleById.get(rec.sourceIdeaId) : undefined;

            return (
              <div
                key={rec.id}
                className="rounded-2xl border border-border-primary bg-bg-card p-4 flex flex-col justify-between gap-3 hover:border-border-secondary transition"
              >
                <div className="space-y-2.5">
                  {/* Top Meta Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STAGE_BADGE_STYLES[rec.stage]}`}
                      >
                        {rec.stage}
                      </span>

                      {rec.stage === "Planned" && rec.plannedDate && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-status-warning-bg border border-status-warning-border px-2 py-0.5 text-[10px] font-semibold text-status-warning-text">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatPlannedDisplay(rec.plannedDate)}
                        </span>
                      )}

                      {rec.stage === "Scheduled" && rec.scheduledFor && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-surface border border-brand-border px-2 py-0.5 text-[10px] font-semibold text-brand-text-strong font-mono">
                          {new Date(rec.scheduledFor).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      )}

                      {rec.threadParts.length > 1 && (
                        <span className="rounded-md bg-bg-app border border-border-primary px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                          {rec.threadParts.length} parts
                        </span>
                      )}

                      {dupMeta && (
                        <span
                          title={`${Math.round(dupMeta.similarity * 100)}% similar to another saved record`}
                          className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800 dark:text-orange-400"
                        >
                          <CopyCheck className="h-2.5 w-2.5" />
                          Similar ({dupMeta.groupSize})
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-text-secondary shrink-0 font-mono">
                      {new Date(rec.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Source Idea Linkage Badge */}
                  {rec.sourceIdeaId && (
                    <div className="inline-flex items-center gap-1 text-[10px] text-sky-800 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/5 border border-sky-300 dark:border-sky-500/20 rounded-md px-2 py-0.5 font-medium">
                      <Link2 className="h-2.5 w-2.5" />
                      <span>
                        From Idea{sourceIdeaTitle ? `: ${sourceIdeaTitle.slice(0, 42)}` : ""}
                      </span>
                    </div>
                  )}

                  {/* Failed Error Message */}
                  {rec.stage === "Failed" && rec.errorMessage && (
                    <div className="rounded-lg border border-status-danger-border bg-status-danger-bg px-2.5 py-1.5 text-[11px] text-status-danger-text flex items-start gap-1.5 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{rec.errorMessage}</span>
                    </div>
                  )}

                  {/* Content Body or Inline Editor */}
                  {isEditing ? (
                    <div className="space-y-2.5 pt-1">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-xs font-bold text-text-primary focus:border-purple-500 focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editTopicsText}
                          onChange={(e) => setEditTopicsText(e.target.value)}
                          placeholder="Topics (comma separated)"
                          className="w-full rounded-lg border border-border-primary bg-bg-app px-2.5 py-1.5 text-[11px] text-text-primary focus:border-purple-500 focus:outline-none"
                        />
                        <select
                          value={editPillar}
                          onChange={(e) => setEditPillar(e.target.value)}
                          className="w-full rounded-lg border border-border-primary bg-bg-app px-2 py-1.5 text-[11px] text-text-primary focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">No Pillar</option>
                          {facets.pillars.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        {editParts.map((part, idx) => (
                          <textarea
                            key={idx}
                            value={part}
                            rows={3}
                            onChange={(e) => {
                              const next = [...editParts];
                              next[idx] = e.target.value;
                              setEditParts(next);
                            }}
                            className="w-full rounded-lg border border-border-primary bg-bg-app p-2.5 text-xs text-text-primary focus:border-purple-500 focus:outline-none resize-y"
                          />
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-border-primary px-3 py-1 text-[11px] font-semibold text-text-secondary cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => handleSaveEdit(rec)}
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1 text-[11px] font-bold text-white cursor-pointer disabled:opacity-50"
                        >
                          <Save className="h-3 w-3" />
                          <span>{savingEdit ? "Saving..." : "Save"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="!text-left !mx-0 text-sm font-bold text-text-primary leading-snug line-clamp-2">
                        {rec.title}
                      </h4>
                      <p className="!text-left !mx-0 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed line-clamp-4">
                        {rec.singlePost || rec.notes || rec.hook}
                      </p>

                      {/* Pillar & Topic Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {rec.pillarTitle && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-status-info-bg border border-status-info-border px-2 py-0.5 text-[10px] font-semibold text-status-info-text">
                            <Layers className="h-2.5 w-2.5" />
                            {rec.pillarTitle}
                          </span>
                        )}
                        {(rec.topics || []).slice(0, 3).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onTopicFilterChange(t)}
                            className="inline-flex items-center gap-1 rounded-md bg-bg-app border border-border-primary hover:border-purple-500/40 px-2 py-0.5 text-[10px] text-text-secondary hover:text-text-primary transition cursor-pointer"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* AI Organization Suggestion Box (if present for this card) */}
                  {suggestion && !isEditing && (
                    <div className="rounded-xl border border-brand-border bg-brand-surface/50 dark:bg-purple-500/5 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-text-strong uppercase">
                          <Sparkles className="h-3 w-3" /> Suggested Organization
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApplySuggestion(rec, suggestion)}
                            className="rounded-md bg-purple-600 hover:bg-purple-500 text-white px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAiSuggestions((prev) => {
                                const next = { ...prev };
                                delete next[rec.id];
                                return next;
                              })
                            }
                            className="text-[10px] text-text-secondary hover:text-text-primary cursor-pointer"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {suggestion.suggestedPillarTitle && (
                          <span className="rounded bg-status-info-bg border border-status-info-border text-status-info-text px-1.5 py-0.5 font-semibold">
                            Pillar: {suggestion.suggestedPillarTitle}
                          </span>
                        )}
                        {suggestion.suggestedTopics.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-bg-card border border-border-primary text-text-primary px-1.5 py-0.5"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Day Assignment Picker */}
                  {planDayPickerId === rec.id && (
                    <div className="rounded-xl border border-status-warning-border bg-status-warning-bg p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-status-warning-text">
                          Assign to a day this week
                        </span>
                        <button
                          type="button"
                          onClick={() => setPlanDayPickerId(null)}
                          className="text-text-muted hover:text-text-primary cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {upcomingSevenDays.map((day) => (
                          <button
                            key={day.dateKey}
                            type="button"
                            onClick={async () => {
                              await onUpdateRecord(rec.id, {
                                stage: "Planned",
                                status: "Planned",
                                plannedDate: day.dateKey,
                              });
                              setPlanDayPickerId(null);
                            }}
                            className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition cursor-pointer ${
                              rec.plannedDate === day.dateKey
                                ? "bg-amber-600 text-white border-amber-500"
                                : "bg-bg-app border-border-primary text-text-secondary hover:border-amber-500/50 hover:text-text-primary"
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Content Suggestions (Expandable) */}
                  {showRelated && (
                    <div className="rounded-xl border border-border-primary bg-bg-app/70 p-2.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-text-muted block">
                        Related Content ({relatedItems.length})
                      </span>
                      {relatedItems.length === 0 ? (
                        <p className="!text-left !mx-0 text-[11px] text-text-muted">
                          No closely related items in your library yet.
                        </p>
                      ) : (
                        relatedItems.map(({ record: rel, reason }) => (
                          <div
                            key={rel.id}
                            className="flex items-center justify-between gap-2 text-[11px] py-1 border-t border-border-primary/50 first:border-t-0"
                          >
                            <div className="min-w-0">
                              <p className="!text-left !mx-0 font-semibold text-text-primary truncate">
                                {rel.title}
                              </p>
                              <span className="text-[10px] text-text-muted">{reason}</span>
                            </div>
                            <span
                              className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${STAGE_BADGE_STYLES[rel.stage]}`}
                            >
                              {rel.stage}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Lifecycle Action Row */}
                {!isEditing && (
                  <div className="pt-2.5 border-t border-border-primary/70 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {rec.stage === "Idea" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onDevelopIdea(rec)}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 text-[11px] transition cursor-pointer"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Create Post</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateRecord(rec.id, { stage: "Draft", status: "Draft" })}
                            className="rounded-lg border border-border-primary bg-bg-app hover:bg-bg-card-hover px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
                          >
                            To Draft
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPlanDayPickerId(planDayPickerId === rec.id ? null : rec.id)
                            }
                            className="rounded-lg border border-status-warning-border bg-status-warning-bg hover:bg-amber-100 dark:hover:bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-status-warning-text transition cursor-pointer"
                          >
                            Plan Day
                          </button>
                        </>
                      )}

                      {rec.stage === "Draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUpdateRecord(rec.id, { stage: "Ready", status: "Ready" })}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold px-2.5 py-1 text-[11px] transition cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Mark Ready</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPlanDayPickerId(planDayPickerId === rec.id ? null : rec.id)
                            }
                            className="rounded-lg border border-status-warning-border bg-status-warning-bg hover:bg-amber-100 dark:hover:bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-status-warning-text transition cursor-pointer"
                          >
                            Plan Day
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenSchedule(rec)}
                            className="rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover px-2.5 py-1 text-[11px] font-semibold text-brand-text-strong transition cursor-pointer"
                          >
                            Schedule
                          </button>
                        </>
                      )}

                      {rec.stage === "Ready" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPlanDayPickerId(planDayPickerId === rec.id ? null : rec.id)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold px-2.5 py-1 text-[11px] transition cursor-pointer"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Add to Week</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenSchedule(rec)}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 text-[11px] transition cursor-pointer"
                          >
                            <span>Schedule</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPublish(rec)}
                            className="rounded-lg border border-border-primary bg-bg-app hover:bg-bg-card-hover px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
                          >
                            Publish
                          </button>
                        </>
                      )}

                      {rec.stage === "Planned" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenSchedule(rec, rec.plannedDate || undefined)}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold px-2.5 py-1 text-[11px] transition cursor-pointer"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Schedule</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPlanDayPickerId(planDayPickerId === rec.id ? null : rec.id)
                            }
                            className="rounded-lg border border-status-warning-border bg-status-warning-bg hover:bg-amber-100 dark:hover:bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-status-warning-text transition cursor-pointer"
                          >
                            Move Day
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRecord(rec.id, {
                                stage: "Ready",
                                status: "Ready",
                                plannedDate: null,
                              })
                            }
                            className="rounded-lg border border-border-primary bg-bg-app px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary transition cursor-pointer"
                          >
                            Unplan
                          </button>
                        </>
                      )}

                      {rec.stage === "Scheduled" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenSchedule(rec)}
                            className="rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover px-2.5 py-1 text-[11px] font-semibold text-brand-text-strong transition cursor-pointer"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPublish(rec)}
                            className="inline-flex items-center gap-1 rounded-lg border border-status-success-border bg-status-success-bg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-status-success-text transition cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            <span>Publish Now</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRecord(rec.id, {
                                stage: "Ready",
                                status: "Ready",
                                scheduledFor: null,
                                plannedDate: null,
                              })
                            }
                            className="rounded-lg border border-border-primary bg-bg-app px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary transition cursor-pointer"
                          >
                            Unschedule
                          </button>
                        </>
                      )}

                      {rec.stage === "Failed" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRecord(rec.id, {
                                stage: "Ready",
                                status: "Ready",
                                scheduledFor: null,
                                errorMessage: "",
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold px-2.5 py-1 text-[11px] transition cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Recover to Ready</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenSchedule(rec)}
                            className="rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover px-2.5 py-1 text-[11px] font-semibold text-brand-text-strong cursor-pointer"
                          >
                            Retry Schedule
                          </button>
                        </>
                      )}

                      {rec.stage === "Published" && rec.threadsPermalink && (
                        <a
                          href={rec.threadsPermalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-status-success-border bg-status-success-bg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-status-success-text transition"
                        >
                          <span>View on Threads</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {/* Utility Icons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRelatedId(showRelated ? null : rec.id)
                        }
                        title="Show related content"
                        className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-app transition cursor-pointer inline-flex items-center gap-0.5 text-[10px]"
                      >
                        {showRelated ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {rec.stage !== "Published" && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(rec)}
                          title="Edit content & tags"
                          className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-app transition cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopy(rec)}
                        title="Copy content"
                        className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-app transition cursor-pointer"
                      >
                        {copiedId === rec.id ? (
                          <Check className="h-3.5 w-3.5 text-status-success-text" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {confirmDeleteId === rec.id ? (
                        <div className="flex items-center gap-1 bg-status-danger-bg border border-status-danger-border rounded-lg px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteRecord(rec.id);
                              setConfirmDeleteId(null);
                            }}
                            className="text-[10px] font-bold text-status-danger-text cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] text-text-secondary hover:text-text-primary cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rec.id)}
                          title="Delete item"
                          className="rounded-lg p-1.5 text-text-secondary hover:text-status-danger-text hover:bg-status-danger-bg transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
