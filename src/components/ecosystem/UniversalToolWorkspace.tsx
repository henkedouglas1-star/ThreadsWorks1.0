import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Download,
  History,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2
} from "lucide-react";
import {
  EcosystemToolDefinition,
  getToolsForApp
} from "../../data/ecosystemToolRegistry";
import {
  getAvailabilityDotClass,
  getAvailabilityTextClass,
  getEcosystemAppById
} from "../../data/contentPaysUsRegistry";
import { EcosystemProject } from "../../types/sharedProjects";
import { ecosystemFetch, exportStructuredAsset } from "../../services/ecosystemClient";

export interface SavedEcosystemAsset {
  id: string;
  appId: string;
  toolId: string;
  title: string;
  sections: Record<string, string>;
  inputs?: Record<string, string>;
  projectId?: string | null;
  provenance?: string;
  isolatedExperiment?: boolean;
  version: number;
  versions?: Array<{ version: number; savedAt: string; sections: Record<string, string> }>;
  updatedAt: string;
}

export interface ToolTransferPayload {
  sourceAppId: string;
  targetAppId: string;
  title: string;
  content: string;
  sourceAssetId?: string;
}

interface UniversalToolWorkspaceProps {
  appId: string;
  projects: EcosystemProject[];
  /** Preserved unsaved draft state across app switches (owned by parent workspace, cleared on UID switch) */
  draftCache: Record<string, { toolId: string; inputs: Record<string, string>; sections: Record<string, string>; title: string }>;
  onUpdateDraftCache: (
    appId: string,
    draft: { toolId: string; inputs: Record<string, string>; sections: Record<string, string>; title: string }
  ) => void;
  incomingTransfer?: ToolTransferPayload | null;
  onConsumeTransfer?: () => void;
  onTransferToApp: (payload: ToolTransferPayload) => void;
  onSendBriefToThreadsWorks?: (title: string, body: string) => Promise<void>;
  onProfileSynced?: () => void;
}

export function UniversalToolWorkspace({
  appId,
  projects,
  draftCache,
  onUpdateDraftCache,
  incomingTransfer,
  onConsumeTransfer,
  onTransferToApp,
  onSendBriefToThreadsWorks,
  onProfileSynced
}: UniversalToolWorkspaceProps) {
  const tools = useMemo(
    () => getToolsForApp(appId).filter((t) => !(t.mode === "operational" && t.outputSchema.length === 0)),
    [appId]
  );

  const cached = draftCache[appId];
  const [selectedToolId, setSelectedToolId] = useState<string>(
    cached?.toolId && tools.some((t) => t.toolId === cached.toolId)
      ? cached.toolId
      : tools[0]?.toolId || ""
  );
  const [inputs, setInputs] = useState<Record<string, string>>(cached?.inputs || {});
  const [sections, setSections] = useState<Record<string, string>>(cached?.sections || {});
  const [assetTitle, setAssetTitle] = useState<string>(cached?.title || "");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [provenance, setProvenance] = useState<string>("");
  const [contextSummary, setContextSummary] = useState<string>("");
  const [usageNote, setUsageNote] = useState<string>("");
  const [syncToProfile, setSyncToProfile] = useState<boolean>(appId === "creatorworks");

  const [savedAssets, setSavedAssets] = useState<SavedEcosystemAsset[]>([]);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const activeTool: EcosystemToolDefinition | undefined = useMemo(
    () => tools.find((t) => t.toolId === selectedToolId) || tools[0],
    [tools, selectedToolId]
  );

  // Sync draft state when appId changes
  useEffect(() => {
    const nextCached = draftCache[appId];
    const defaultTool = tools[0]?.toolId || "";
    setSelectedToolId(
      nextCached?.toolId && tools.some((t) => t.toolId === nextCached.toolId)
        ? nextCached.toolId
        : defaultTool
    );
    setInputs(nextCached?.inputs || {});
    setSections(nextCached?.sections || {});
    setAssetTitle(nextCached?.title || "");
    setEditingAssetId(null);
    setShowHistory(false);
    setErrorMsg(null);
    setStatusMsg(null);
    setSyncToProfile(appId === "creatorworks");
  }, [appId]);

  // Apply incoming cross-app transfer automatically into first input field
  useEffect(() => {
    if (!incomingTransfer || incomingTransfer.targetAppId !== appId || !activeTool) return;
    const firstField = activeTool.requiredInputs[0] || activeTool.optionalInputs[0];
    if (firstField) {
      const nextInputs = {
        ...inputs,
        [firstField.key]: `${incomingTransfer.title}\n\n${incomingTransfer.content}`.slice(0, 3500)
      };
      setInputs(nextInputs);
      setAssetTitle(`${activeTool.name} — ${incomingTransfer.title}`);
      onUpdateDraftCache(appId, {
        toolId: activeTool.toolId,
        inputs: nextInputs,
        sections,
        title: `${activeTool.name} — ${incomingTransfer.title}`
      });
      setStatusMsg(`Imported context from ${getEcosystemAppById(incomingTransfer.sourceAppId)?.name || incomingTransfer.sourceAppId}.`);
    }
    onConsumeTransfer?.();
  }, [incomingTransfer, appId, activeTool]);

  // Load saved assets for this app
  const loadSavedAssets = async () => {
    setIsLoadingAssets(true);
    try {
      const data = await ecosystemFetch<{ assets: SavedEcosystemAsset[] }>(
        `/api/ecosystem/assets?appId=${encodeURIComponent(appId)}`
      );
      setSavedAssets(data.assets || []);
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    loadSavedAssets();
  }, [appId]);

  const updateInput = (key: string, value: string) => {
    const next = { ...inputs, [key]: value };
    setInputs(next);
    onUpdateDraftCache(appId, { toolId: selectedToolId, inputs: next, sections, title: assetTitle });
  };

  const updateSection = (key: string, value: string) => {
    const next = { ...sections, [key]: value };
    setSections(next);
    onUpdateDraftCache(appId, { toolId: selectedToolId, inputs, sections: next, title: assetTitle });
  };

  const handleRunTool = async (refinementMode: "default" | "tighten" | "expand" = "default") => {
    if (!activeTool) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setIsRunning(true);
    try {
      const result = await ecosystemFetch<{
        sections: Record<string, string>;
        provenance: string;
        contextUsed: { domainsLoaded: string[]; hasProfileData: boolean; activeProjectName: string | null };
        usage: { isPro: boolean; displayRemaining: string };
      }>("/api/ecosystem/run-tool", {
        method: "POST",
        body: {
          appId,
          toolId: activeTool.toolId,
          inputs,
          projectId: selectedProjectId || undefined,
          refinementMode
        }
      });

      const nextTitle = assetTitle.trim() || `${activeTool.name} (${new Date().toLocaleDateString()})`;
      setSections(result.sections || {});
      setAssetTitle(nextTitle);
      setProvenance(result.provenance || activeTool.provenanceDefault);
      setContextSummary(
        `Shared Intelligence loaded: ${result.contextUsed.domainsLoaded.join(", ") || "none"}${
          result.contextUsed.activeProjectName ? ` · Project: ${result.contextUsed.activeProjectName}` : ""
        }`
      );
      setUsageNote(result.usage?.displayRemaining || "");
      onUpdateDraftCache(appId, {
        toolId: activeTool.toolId,
        inputs,
        sections: result.sections || {},
        title: nextTitle
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to execute tool.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveAsset = async () => {
    if (!activeTool || Object.keys(sections).length === 0) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setIsSaving(true);
    try {
      const title = assetTitle.trim() || `${activeTool.name} (${new Date().toLocaleDateString()})`;
      if (editingAssetId) {
        const res = await ecosystemFetch<{ asset: SavedEcosystemAsset }>(
          `/api/ecosystem/assets/${editingAssetId}`,
          {
            method: "PUT",
            body: { title, sections }
          }
        );
        setStatusMsg(`Saved revision v${res.asset.version}.`);
      } else {
        const res = await ecosystemFetch<{ asset: SavedEcosystemAsset }>("/api/ecosystem/assets", {
          method: "POST",
          body: {
            appId,
            toolId: activeTool.toolId,
            title,
            sections,
            inputs,
            projectId: selectedProjectId || undefined,
            provenance: provenance || activeTool.provenanceDefault,
            syncToProfile: appId === "creatorworks" ? syncToProfile : false
          }
        });
        setEditingAssetId(res.asset.id);
        setStatusMsg(
          appId === "creatorworks" && syncToProfile
            ? "Saved asset & synced approved brand fields to your Creator Profile."
            : "Saved to your persistent ContentPaysUs library."
        );
        if (appId === "creatorworks" && syncToProfile) {
          onProfileSynced?.();
        }
      }
      await loadSavedAssets();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save asset.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      await ecosystemFetch(`/api/ecosystem/assets/${id}`, { method: "DELETE" });
      if (editingAssetId === id) setEditingAssetId(null);
      await loadSavedAssets();
      setStatusMsg("Asset removed.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete asset.");
    }
  };

  const handleLoadAsset = (asset: SavedEcosystemAsset) => {
    setSelectedToolId(asset.toolId);
    setInputs(asset.inputs || {});
    setSections(asset.sections || {});
    setAssetTitle(asset.title);
    setProvenance(asset.provenance || "user_provided_fact");
    setEditingAssetId(asset.id);
    setShowHistory(false);
    onUpdateDraftCache(appId, {
      toolId: asset.toolId,
      inputs: asset.inputs || {},
      sections: asset.sections || {},
      title: asset.title
    });
  };

  const compiledSectionList = useMemo(() => {
    if (!activeTool) return [];
    return activeTool.outputSchema.map((f) => ({
      key: f.key,
      label: f.label,
      value: sections[f.key] || ""
    }));
  }, [activeTool, sections]);

  const hasOutput = compiledSectionList.some((s) => s.value.trim().length > 0);
  const combinedPlainText = compiledSectionList
    .filter((s) => s.value.trim())
    .map((s) => `## ${s.label}\n${s.value}`)
    .join("\n\n");

  const activeSavedAsset = savedAssets.find((a) => a.id === editingAssetId);

  if (tools.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {appId === "projectz" && (
        <div className="rounded-xl border border-amber-400/50 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
          <strong className="font-bold">Isolated Experimental Sandbox:</strong> Outputs created in Project Z are explicitly labeled hypothetical and kept completely separate from your live production profile, CRM, and Shared Intelligence context for other apps.
        </div>
      )}

      {/* Tool Selector Strip */}
      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => {
          const isSelected = activeTool?.toolId === tool.toolId;
          return (
            <button
              key={tool.toolId}
              type="button"
              onClick={() => {
                setSelectedToolId(tool.toolId);
                setErrorMsg(null);
                setStatusMsg(null);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-2 ${
                isSelected
                  ? "bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white"
                  : "bg-white dark:bg-[#111115] border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-indigo-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isSelected ? "bg-white" : getAvailabilityDotClass(tool.availability)
                }`}
                aria-hidden="true"
              />
              <span>{tool.name}</span>
            </button>
          );
        })}
      </div>

      {activeTool && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Structured Inputs + Context Controls */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-950 dark:text-white">{activeTool.name}</h3>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${getAvailabilityTextClass(activeTool.availability)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${getAvailabilityDotClass(activeTool.availability)}`} />
                  {activeTool.availability}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{activeTool.intent}</p>
            </div>

            {activeTool.availability !== "Available" ? (
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 text-xs text-slate-700 dark:text-zinc-300 space-y-2">
                <p className="font-semibold text-indigo-800 dark:text-indigo-300">
                  External Integration Required ({activeTool.availability})
                </p>
                <p className="leading-relaxed">{activeTool.availabilityNote}</p>
              </div>
            ) : (
              <>
                {/* Optional Project Context Selector */}
                {projects.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Shared Project Context (Optional)
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                    >
                      <option value="">General Creator Profile Context</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Required & Optional Input Fields */}
                {[...activeTool.requiredInputs, ...activeTool.optionalInputs].map((field) => {
                  const isReq = activeTool.requiredInputs.some((r) => r.key === field.key);
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                        {field.label} {isReq && <span className="text-indigo-600 dark:text-indigo-400">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          rows={3}
                          value={inputs[field.key] || ""}
                          onChange={(e) => updateInput(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                      ) : field.type === "select" ? (
                        <select
                          value={inputs[field.key] || ""}
                          onChange={(e) => updateInput(field.key, e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                        >
                          <option value="">{field.placeholder}</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={inputs[field.key] || ""}
                          onChange={(e) => updateInput(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                      )}
                    </div>
                  );
                })}

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleRunTool("default")}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isRunning ? "Generating..." : hasOutput ? "Regenerate" : `Run ${activeTool.name}`}
                  </button>
                  {hasOutput && (
                    <>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => handleRunTool("tighten")}
                        className="px-3 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Tighten
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => handleRunTool("expand")}
                        className="px-3 py-2.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Expand
                      </button>
                    </>
                  )}
                </div>

                {usageNote && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">{usageNote}</p>
                )}
              </>
            )}

            {errorMsg && (
              <div className="rounded-lg border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusMsg && (
              <div className="rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{statusMsg}</span>
              </div>
            )}
          </div>

          {/* Right: Structured Editable Output + Exports + Cross-App Transfers */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={assetTitle}
                    onChange={(e) => {
                      setAssetTitle(e.target.value);
                      onUpdateDraftCache(appId, { toolId: selectedToolId, inputs, sections, title: e.target.value });
                    }}
                    placeholder="Document title (editable)..."
                    className="w-full text-sm font-bold bg-transparent text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  {contextSummary && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{contextSummary}</p>
                  )}
                </div>

                {provenance && (
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {provenance.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              {!hasOutput ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Ready to build with {activeTool.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                    Fill in the structured inputs on the left and run the tool. Your Shared Intelligence context is loaded automatically, and every generated section can be edited, saved, exported, or transferred to connected apps.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {compiledSectionList.map((sec) => (
                    <div key={sec.key} className="space-y-1.5">
                      <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                        {sec.label}
                      </label>
                      <textarea
                        rows={Math.min(10, Math.max(3, sec.value.split("\n").length + 1))}
                        value={sec.value}
                        onChange={(e) => updateSection(sec.key, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] p-3 text-xs leading-relaxed text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}

                  {appId === "creatorworks" && (
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 pt-1">
                      <input
                        type="checkbox"
                        checked={syncToProfile}
                        onChange={(e) => setSyncToProfile(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Sync approved brand positioning / audience / voice fields into my Shared Creator Profile</span>
                    </label>
                  )}

                  {/* Action Bar: Save, Copy, History, Real Downloads */}
                  <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveAsset}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {editingAssetId ? "Save New Version" : "Save Asset"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(combinedPlainText);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>

                    {activeSavedAsset && (activeSavedAsset.versions?.length || 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowHistory((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 cursor-pointer"
                      >
                        <History className="h-3.5 w-3.5" />
                        Versions ({activeSavedAsset.versions?.length})
                      </button>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      {(["md", "txt", "html", "json"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() =>
                            exportStructuredAsset(
                              fmt,
                              assetTitle || activeTool.name,
                              compiledSectionList.map((s) => ({ label: s.label, value: s.value })),
                              { appId, provenance }
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold uppercase border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-indigo-400 cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Version History Restore Drawer */}
                  {showHistory && activeSavedAsset?.versions && (
                    <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] p-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Saved Revision History
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeSavedAsset.versions.map((ver) => (
                          <button
                            key={ver.version}
                            type="button"
                            onClick={() => {
                              setSections(ver.sections);
                              setStatusMsg(`Restored version v${ver.version} into editor.`);
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-zinc-700 text-xs text-slate-800 dark:text-zinc-200 hover:border-indigo-500 cursor-pointer"
                          >
                            v{ver.version} · {new Date(ver.savedAt).toLocaleTimeString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cross-App Transfer Bar */}
                  {activeTool.connectedApps.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Transfer to:
                      </span>
                      {activeTool.connectedApps.map((targetId) => {
                        const targetApp = getEcosystemAppById(targetId);
                        if (!targetApp) return null;
                        return (
                          <button
                            key={targetId}
                            type="button"
                            onClick={async () => {
                              if (targetId === "threadsworks" && onSendBriefToThreadsWorks) {
                                await onSendBriefToThreadsWorks(
                                  assetTitle || activeTool.name,
                                  combinedPlainText
                                );
                                setStatusMsg("Transferred draft brief to your ThreadsWorks Content Library.");
                              } else {
                                onTransferToApp({
                                  sourceAppId: appId,
                                  targetAppId: targetId,
                                  title: assetTitle || activeTool.name,
                                  content: combinedPlainText,
                                  sourceAssetId: editingAssetId || undefined
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                          >
                            {targetApp.name} <ArrowRight className="h-3 w-3" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Saved Persistent Assets for this App */}
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Saved {getEcosystemAppById(appId)?.name || appId} Library ({savedAssets.length})
                </h4>
                <button
                  type="button"
                  onClick={loadSavedAssets}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingAssets ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {savedAssets.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  No saved items in {getEcosystemAppById(appId)?.name} yet. Run a tool and click Save Asset to persist versions across sessions.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {savedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                        editingAssetId === asset.id
                          ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20"
                          : "border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadAsset(asset)}
                        className="text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{asset.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          v{asset.version || 1} · {asset.toolId.replace(/_/g, " ")} · {new Date(asset.updatedAt).toLocaleDateString()}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset.id)}
                        aria-label={`Delete ${asset.title}`}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
