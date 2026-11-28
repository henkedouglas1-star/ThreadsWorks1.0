import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  Edit3,
  FileArchive,
  FileText,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2
} from "lucide-react";
import type { FunnelPackage } from "../../features/funnelworks/types";
import { downloadPlaybookPdf } from "../../features/funnelworks/playbookExport";
import { downloadCompleteProductWorksZip } from "../../features/funnelworks/carouselZip";
import { ecosystemFetch, exportStructuredAsset } from "../../services/ecosystemClient";

interface ProductPromotionDraft {
  id: string;
  angle: string;
  label: string;
  parts: string[];
  sourceProductId: string;
  sourceProductTitle: string;
  sourceProductVersion: number;
  transferredToLibrary?: boolean;
}

interface ProductWorksProject extends FunnelPackage {
  version?: number;
  audience?: string;
  outcome?: string;
  price?: string;
  url?: string;
  promotionDrafts?: ProductPromotionDraft[];
  promotionGeneratedForVersion?: number;
  promotionGeneratedAt?: string;
}

interface ProductWorksEnhancedPanelProps {
  onNavigateToThreadsWorksLibrary?: () => void;
  onOpenOriginalStudio?: () => void;
}

export function ProductWorksEnhancedPanel({
  onNavigateToThreadsWorksLibrary,
  onOpenOriginalStudio
}: ProductWorksEnhancedPanelProps) {
  const [subTab, setSubTab] = useState<"create" | "edit" | "export" | "promote">("create");
  const [projects, setProjects] = useState<ProductWorksProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Create form
  const [topic, setTopic] = useState<string>("");
  const [audience, setAudience] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [goal, setGoal] = useState<"lead_magnet" | "impulse_product">("impulse_product");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Edit state
  const [editTitle, setEditTitle] = useState<string>("");
  const [editSubtitle, setEditSubtitle] = useState<string>("");
  const [editAudience, setEditAudience] = useState<string>("");
  const [editOutcome, setEditOutcome] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editUrl, setEditUrl] = useState<string>("");
  const [editCheckoutDesc, setEditCheckoutDesc] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Automatic Promotion state
  const [promoDrafts, setPromoDrafts] = useState<ProductPromotionDraft[]>([]);
  const [isPromoting, setIsPromoting] = useState<boolean>(false);
  const [promoMeta, setPromoMeta] = useState<string>("");
  const [transferringId, setTransferringId] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedId) || projects[0] || null;

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await ecosystemFetch<{ projects: ProductWorksProject[] }>("/api/funnelworks/projects");
      const list = data.projects || [];
      setProjects(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to load saved ProductWorks projects.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setEditTitle(selectedProject.playbook?.title || selectedProject.storefront?.productTitle || "");
    setEditSubtitle(selectedProject.playbook?.subtitle || "");
    setEditAudience(selectedProject.audience || "");
    setEditOutcome(selectedProject.outcome || "");
    setEditPrice(selectedProject.price || "");
    setEditUrl(selectedProject.url || "");
    setEditCheckoutDesc(selectedProject.storefront?.checkoutDescription || "");
    setPromoDrafts(Array.isArray(selectedProject.promotionDrafts) ? selectedProject.promotionDrafts : []);
    if (selectedProject.promotionGeneratedAt) {
      setPromoMeta(
        `Prepared for product v${selectedProject.promotionGeneratedForVersion || selectedProject.version || 1} on ${new Date(
          selectedProject.promotionGeneratedAt
        ).toLocaleString()}`
      );
    } else {
      setPromoMeta("");
    }
  }, [selectedProject?.id, selectedProject?.version]);

  const handleGenerateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setIsGenerating(true);
    try {
      const res = await ecosystemFetch<{ project: ProductWorksProject }>("/api/funnelworks/generate", {
        method: "POST",
        body: {
          sourceMode: "idea",
          idea: topic.trim(),
          audience: audience.trim() || "Creators and independent professionals",
          outcome: outcome.trim() || "A clear, actionable implementation playbook",
          goal,
          theme: "editorial_dark",
          price: price.trim(),
          url: url.trim()
        }
      });
      const created = res.project;
      await loadProjects();
      setSelectedId(created.id);
      setTopic("");
      setStatusMsg("Product package created! Preparing automatic Threads promotional drafts...");
      setSubTab("promote");

      // Automatically prepare grounded promotion drafts idempotently for the saved product
      await triggerAutoPromotion(created.id, false);
    } catch (err: any) {
      setErrorMsg(err?.message || "ProductWorks generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!selectedProject) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setIsSavingEdit(true);
    try {
      const updatedPlaybook = {
        ...selectedProject.playbook,
        title: editTitle.trim() || selectedProject.playbook?.title,
        subtitle: editSubtitle.trim()
      };
      const updatedStorefront = {
        ...selectedProject.storefront,
        productTitle: editTitle.trim() || selectedProject.storefront?.productTitle,
        checkoutDescription: editCheckoutDesc.trim()
      };
      const res = await ecosystemFetch<{ project: ProductWorksProject }>(
        `/api/funnelworks/projects/${selectedProject.id}`,
        {
          method: "PUT",
          body: {
            playbook: updatedPlaybook,
            storefrontCopy: updatedStorefront,
            audience: editAudience.trim(),
            outcome: editOutcome.trim(),
            price: editPrice.trim(),
            url: editUrl.trim()
          }
        }
      );
      setProjects((prev) => prev.map((p) => (p.id === res.project.id ? res.project : p)));
      setStatusMsg(`Saved edits (Product v${res.project.version || 2}). You can refresh Automatic Promotion drafts anytime.`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save edits.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const triggerAutoPromotion = async (projectId: string, forceRegenerate = false) => {
    setErrorMsg(null);
    setIsPromoting(true);
    try {
      const res = await ecosystemFetch<{
        idempotentHit: boolean;
        productVersion: number;
        drafts: ProductPromotionDraft[];
        generatedAt: string;
      }>(`/api/funnelworks/projects/${projectId}/promote`, {
        method: "POST",
        body: { forceRegenerate }
      });
      setPromoDrafts(res.drafts || []);
      setPromoMeta(
        `${res.idempotentHit ? "Loaded cached" : "Prepared fresh"} promotional drafts for product v${
          res.productVersion
        } · Grounded strictly in saved product fields (never auto-published).`
      );
      await loadProjects();
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to prepare product promotion drafts.");
    } finally {
      setIsPromoting(false);
    }
  };

  const handleTransferDraftToLibrary = async (draft: ProductPromotionDraft) => {
    if (!selectedProject) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setTransferringId(draft.id);
    try {
      const res = await ecosystemFetch<{ deduplicated: boolean; postId: string }>(
        `/api/funnelworks/projects/${selectedProject.id}/transfer-promo-to-library`,
        {
          method: "POST",
          body: {
            draftId: draft.id,
            label: draft.label,
            parts: draft.parts,
            sourceProductTitle: editTitle || selectedProject.playbook?.title
          }
        }
      );
      setPromoDrafts((prev) =>
        prev.map((d) => (d.id === draft.id ? { ...d, transferredToLibrary: true } : d))
      );
      setStatusMsg(
        res.deduplicated
          ? `"${draft.label}" is already saved in your ThreadsWorks Content Library as a draft.`
          : `"${draft.label}" transferred to ThreadsWorks Content Library as an editable draft (never auto-published).`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to transfer draft.");
    } finally {
      setTransferringId(null);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await ecosystemFetch(`/api/funnelworks/projects/${id}`, { method: "DELETE" });
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      setSelectedId(remaining[0]?.id || "");
      setStatusMsg("Product deleted.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete product.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ProductWorks 4-Tab Navigation: Create · Edit · Export · Promote */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="ProductWorks workflow">
          {[
            { id: "create" as const, label: "Create", icon: Plus },
            { id: "edit" as const, label: "Edit", icon: Edit3 },
            { id: "export" as const, label: "Export", icon: Download },
            { id: "promote" as const, label: "Promote (Auto)", icon: Megaphone }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                    : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && (
            <select
              value={selectedProject?.id || ""}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Select saved product"
              className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-1.5 text-xs text-slate-900 dark:text-zinc-100 max-w-[220px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.playbook?.title || p.storefront?.productTitle || "Saved Product"} (v{p.version || 1})
                </option>
              ))}
            </select>
          )}
          {onOpenOriginalStudio && (
            <button
              type="button"
              onClick={onOpenOriginalStudio}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Slide Preview Studio
            </button>
          )}
        </div>
      </div>

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

      {/* TAB 1: CREATE */}
      {subTab === "create" && (
        <form
          onSubmit={handleGenerateProduct}
          className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 space-y-4"
        >
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Create a Complete Digital Product Package
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
              Generates a downloadable 2-page PDF playbook, 7-slide PNG/ZIP carousel, storefront copy, companion posts, and automatically prepares 5 grounded Threads promotional drafts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                Product Idea or Topic <span className="text-indigo-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. A step-by-step weekend playbook helping solo consultants turn client questions into their first $29 digital guide."
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] p-3 text-xs text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Target Audience</label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Independent consultants and solo creators"
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Buyer Outcome</label>
              <input
                type="text"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="e.g. Publish and sell a finished 2-page playbook in 48 hours"
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                Real Price (Optional — leave blank to never invent a price)
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. $29 (optional)"
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                Approved Product URL (Optional — never invented if blank)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... (optional)"
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Package Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
              >
                <option value="impulse_product">Paid Starter Digital Product</option>
                <option value="lead_magnet">Free High-Value Lead Magnet</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isGenerating ? "Generating Product & Promo Drafts..." : "Create Digital Product Package"}
          </button>
        </form>
      )}

      {/* TAB 2: EDIT */}
      {subTab === "edit" && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 space-y-4">
          {!selectedProject ? (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              No saved ProductWorks package yet. Switch to Create to generate your first downloadable digital product.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    Edit Saved Product (v{selectedProject.version || 1})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Edits persist directly to Firestore and update future exports &amp; automatic promotions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteProject(selectedProject.id)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Product Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Subtitle</label>
                  <input
                    type="text"
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Target Audience</label>
                  <input
                    type="text"
                    value={editAudience}
                    onChange={(e) => setEditAudience(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Core Outcome</label>
                  <input
                    type="text"
                    value={editOutcome}
                    onChange={(e) => setEditOutcome(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Price (Optional)</label>
                  <input
                    type="text"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="Leave blank if unset"
                    className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Product URL (Optional)</label>
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="Leave blank if unset"
                    className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Storefront Description
                  </label>
                  <textarea
                    rows={4}
                    value={editCheckoutDesc}
                    onChange={(e) => setEditCheckoutDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-[#fafaf9] dark:bg-[#09090b] p-3 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdits}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Product Changes
              </button>
            </>
          )}
        </div>
      )}

      {/* TAB 3: EXPORT */}
      {subTab === "export" && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 space-y-4">
          {!selectedProject ? (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Create or select a saved ProductWorks package to download real files.
            </p>
          ) : (
            <>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Download Real Product Files — {selectedProject.playbook?.title || "Product"}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Export your edited 2-page PDF playbook, 7-slide PNG carousel + complete ZIP bundle, or Markdown/HTML storefront package.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => downloadPlaybookPdf(selectedProject)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] hover:border-indigo-500 text-left space-y-1.5 cursor-pointer"
                >
                  <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Download 2-Page PDF Playbook</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Ready-to-deliver PDF file</p>
                </button>

                <button
                  type="button"
                  onClick={() => downloadCompleteProductWorksZip(selectedProject)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] hover:border-indigo-500 text-left space-y-1.5 cursor-pointer"
                >
                  <FileArchive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Download Complete ZIP Bundle</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">7 PNG slides + PDF + storefront + posts</p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    exportStructuredAsset(
                      "md",
                      selectedProject.playbook?.title || "productworks-kit",
                      [
                        { label: "Subtitle", value: selectedProject.playbook?.subtitle || "" },
                        { label: "Storefront Description", value: selectedProject.storefront?.checkoutDescription || "" },
                        { label: "Companion Threads Post", value: selectedProject.companionPosts?.threads || "" }
                      ],
                      { appId: "productworks", provenance: "user_provided_fact" }
                    )
                  }
                  className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] hover:border-indigo-500 text-left space-y-1.5 cursor-pointer"
                >
                  <Download className="h-5 w-5 text-slate-700 dark:text-zinc-300" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Export Storefront Markdown</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Clean .md copy for StoreWorks or web</p>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: PROMOTE (ProductWorks Automatic Promotion) */}
      {subTab === "promote" && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 space-y-5">
          {!selectedProject ? (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Create or select a saved ProductWorks product to prepare Automatic Promotion drafts.
            </p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    ProductWorks Automatic Promotion
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                    Prepares 5 grounded Meta Threads drafts (educational, problem-awareness, storytelling, conversation starter, sales) strictly from your saved product. Drafts are NEVER auto-published.
                  </p>
                  {promoMeta && <p className="mt-1 text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">{promoMeta}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isPromoting}
                    onClick={() => triggerAutoPromotion(selectedProject.id, promoDrafts.length > 0)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
                  >
                    {isPromoting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {promoDrafts.length > 0 ? "Regenerate Drafts" : "Prepare 5 Promo Drafts"}
                  </button>
                  {onNavigateToThreadsWorksLibrary && (
                    <button
                      type="button"
                      onClick={onNavigateToThreadsWorksLibrary}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 cursor-pointer"
                    >
                      Open ThreadsWorks Library
                    </button>
                  )}
                </div>
              </div>

              {promoDrafts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                  {isPromoting
                    ? "Generating grounded promotional drafts from your saved product..."
                    : "Click 'Prepare 5 Promo Drafts' to generate promotional drafts for this product version."}
                </div>
              ) : (
                <div className="space-y-4">
                  {promoDrafts.map((draft, dIdx) => (
                    <div
                      key={draft.id}
                      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                            {draft.angle.replace(/_/g, " ")} · v{draft.sourceProductVersion}
                          </span>
                          <h4 className="text-sm font-bold text-slate-950 dark:text-white">{draft.label}</h4>
                        </div>
                        <button
                          type="button"
                          disabled={transferringId === draft.id}
                          onClick={() => handleTransferDraftToLibrary(draft)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
                        >
                          {transferringId === draft.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : draft.transferredToLibrary ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {draft.transferredToLibrary ? "In ThreadsWorks Library" : "Send to ThreadsWorks Library"}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {draft.parts.map((part, pIdx) => (
                          <textarea
                            key={pIdx}
                            rows={Math.max(2, Math.ceil(part.length / 90))}
                            value={part}
                            onChange={(e) => {
                              const nextText = e.target.value;
                              setPromoDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === dIdx
                                    ? {
                                        ...item,
                                        parts: item.parts.map((p, i) => (i === pIdx ? nextText : p))
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-2.5 text-xs leading-relaxed text-slate-900 dark:text-zinc-100"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
