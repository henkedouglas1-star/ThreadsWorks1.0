import React, { useState } from "react";
import type { FunnelGoal, FunnelThemeId } from "./types";

export interface FunnelConcept {
  source: string;
  audience: string;
  outcome: string;
  title: string;
  creatorBrand?: string;
  goal: FunnelGoal;
  theme: FunnelThemeId;
}

interface Props {
  initialSource?: string;
  onApprove: (concept: FunnelConcept) => void;
  disabled?: boolean;
}

/**
 * ProductWorks concept review stage.
 */
export default function FunnelConceptView({ initialSource = "", onApprove, disabled = false }: Props) {
  const [source, setSource] = useState(initialSource);
  const [audience, setAudience] = useState("");
  const [outcome, setOutcome] = useState("");
  const [title, setTitle] = useState("");
  const [creatorBrand, setCreatorBrand] = useState("");
  const [goal, setGoal] = useState<FunnelGoal>("impulse_product");
  const [theme, setTheme] = useState<FunnelThemeId>("editorial_dark");

  const ready = source.trim().length >= 10 && audience.trim().length > 0 && outcome.trim().length > 0 && title.trim().length > 0;

  return (
    <section aria-labelledby="productworks-heading" className="rounded-2xl border border-border-primary bg-bg-card p-5 md:p-8 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Workspace / ProductWorks</p>
        <h2 id="productworks-heading" className="mt-2 text-2xl font-bold text-text-primary">Create digital products from a single idea.</h2>
        <p className="mt-2 text-sm text-text-secondary">Transform your knowledge, ideas, or existing social media content into a coordinated, downloadable digital product package with AI. Review and refine your product concept before generating. Concept reviews do not consume generation credits.</p>
      </div>
      <label className="block space-y-2 text-sm font-medium text-text-primary">
        Your idea or existing post
        <textarea value={source} maxLength={4000} onChange={e => setSource(e.target.value)} rows={5} placeholder="Paste a post, framework, or idea..." className="w-full rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary" />
        <span className="block text-xs text-text-muted">{source.length}/4000 characters</span>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-text-primary">Who is this for? (Audience)
          <input value={audience} maxLength={120} onChange={e => setAudience(e.target.value)} placeholder="e.g. creators launching their first digital product" className="w-full rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary" />
        </label>
        <label className="space-y-2 text-sm font-medium text-text-primary">What result will they achieve? (Outcome)
          <input value={outcome} maxLength={180} onChange={e => setOutcome(e.target.value)} placeholder="e.g. outline and launch a 7-day starter guide" className="w-full rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-text-primary">Product title
          <input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="e.g. The First Product Playbook" className="w-full rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary" />
        </label>
        <label className="space-y-2 text-sm font-medium text-text-primary">Optional creator / brand name
          <input value={creatorBrand} maxLength={60} onChange={e => setCreatorBrand(e.target.value)} placeholder="e.g. Douglas Henke" className="w-full rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-text-primary">Product goal
          <select value={goal} onChange={e => setGoal(e.target.value as FunnelGoal)} className="w-full rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary">
            <option value="lead_magnet">Free lead magnet</option><option value="impulse_product">Paid digital product</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-text-primary">Visual theme
          <select value={theme} onChange={e => setTheme(e.target.value as FunnelThemeId)} className="w-full rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary">
            <option value="editorial_dark">Editorial Dark</option><option value="swiss_light">Swiss Light</option><option value="terminal_contrast">Terminal Contrast</option><option value="warm_creator">Warm Creator</option>
          </select>
        </label>
      </div>
      <button type="button" disabled={disabled || !ready} onClick={() => onApprove({ source: source.trim(), audience: audience.trim(), outcome: outcome.trim(), title: title.trim(), creatorBrand: creatorBrand.trim() || undefined, goal, theme })} className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer">
        Approve concept and continue
      </button>
    </section>
  );
}
