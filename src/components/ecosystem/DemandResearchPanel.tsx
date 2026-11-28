import React, { useEffect, useState } from "react";
import { ExternalLink, Search, Loader2 } from "lucide-react";
import { ecosystemFetch } from "../../services/ecosystemClient";
import { FormattedResponse } from "./FormattedResponse";
import type { EcosystemProject } from "../../types/sharedProjects";

type Source = { title: string; url: string; snippet: string };
type Research = { topic: string; sources: Source[]; retrievedAt: string; text: string; searchEntryPoint: string };

type KnowledgeDraft = { topic: string; sources: Source[]; generatedAt: string; knowledge: { findings: { insight: string; sourceIds: number[] }[]; opportunities: string[]; unknowns: string[]; nextActions: string[] } };

export function DemandResearchPanel({ projects }: { projects: EcosystemProject[] }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<Research | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [knowledgeTopic, setKnowledgeTopic] = useState("");
  const [independent, setIndependent] = useState(false);
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [saved, setSaved] = useState(false);

  async function analyze() {
    if (!knowledgeTopic.trim() || !notes.trim() || !independent || analyzing || saving || busy) return;
    setAnalyzing(true); setError(""); setDraft(null); setApproved(false); setSaved(false);
    try {
      setDraft(await ecosystemFetch<KnowledgeDraft>("/api/ecosystem/demand/knowledge", { method: "POST", body: { topic: knowledgeTopic.trim(), notes: notes.trim(), independentNotes: true } }));
    } catch (err) { setError(err instanceof Error ? err.message : "Analysis failed."); }
    finally { setAnalyzing(false); }
  }
  async function saveKnowledge() {
    if (!draft || !approved || !projectId || saving || saved) return;
    setSaving(true); setError("");
    try {
      await ecosystemFetch("/api/ecosystem/demand/knowledge/save", { method: "POST", body: { ...draft, notes: draft.sources[0]?.snippet, independentNotes: true, projectId, approved: true } });
      setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Saving failed."); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    let active = true;
    ecosystemFetch<{configured: boolean}>("/api/ecosystem/demand/research-status")
      .then(data => { if (active) setConfigured(data.configured); })
      .catch(() => { if (active) setError("Could not check live research availability. Refresh to retry."); });
    return () => { active = false; };
  }, []);

  async function run(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || analyzing || saving || !configured || !topic.trim()) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const next = await ecosystemFetch<Research>("/api/ecosystem/demand/research", { method: "POST", body: { topic: topic.trim() } });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-4 sm:p-5 space-y-4">
    <div className="space-y-2">
      <h2 className="text-lg font-bold text-slate-950 dark:text-white">Research real demand</h2>
      <p className="text-sm text-slate-600 dark:text-zinc-300">Explore current market information with Gemini and Google Search.</p>
      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3 text-sm text-slate-800 dark:text-zinc-200">
        <strong>Why this is worth paying for</strong>
        <p className="mt-1">Spend less time searching across websites and make better-informed product decisions before investing time or money building something. Check the original sources instead of relying only on AI guesses.</p>
      </div>
    </div>
    {configured === false && <p role="status" className="text-sm text-slate-600 dark:text-zinc-300">In development: the live search provider is not connected yet. Existing research planning tools remain available below.</p>}
    {configured === null && !error && <p role="status" className="text-sm">Checking research availability…</p>}
    <form onSubmit={run} className="space-y-2">
      <label htmlFor="demand-public-topic" className="block text-sm font-semibold">What do you want to research?</label>
      <input id="demand-public-topic" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={200} required disabled={!configured || busy || analyzing || saving} placeholder="e.g. challenges selling digital products" className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-3 text-sm disabled:opacity-50" />
      <p className="text-xs text-slate-500 dark:text-zinc-400">Only enter public research terms. Your query is sent to the search provider; do not include private customer or business information. A successful search uses one generation allowance on the Free plan.</p>
      <button type="submit" disabled={!configured || busy || analyzing || saving || !topic.trim()} className="w-full rounded-lg bg-indigo-600 text-white px-4 py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}{busy ? "Searching…" : "Research with Gemini"}</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {result && <div className="space-y-3" aria-live="polite">
      <h3 className="font-bold">Research: {result.topic}</h3>
      <p className="text-xs text-slate-600 dark:text-zinc-400">Retrieved {new Date(result.retrievedAt).toLocaleString()}. This is live AI research, not proof of customer purchases. It is not saved or passed to other AI tools.</p>
      <FormattedResponse value={result.text} />
      <h4 className="font-semibold">Search sources</h4>
      {result.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block break-words text-sm underline text-indigo-700 dark:text-indigo-300">{source.title} <ExternalLink className="inline h-3 w-3"/></a>)}
    </div>}
    <div className="space-y-3 border-t border-slate-200 dark:border-zinc-700 pt-4">
      <h3 className="text-lg font-bold">Create your own business knowledge</h3>
      <p className="text-sm">Turn your independently collected customer interviews, observations and experience into useful insights, product ideas and practical next steps. This works even when live search is disabled.</p>
      <label htmlFor="knowledge-topic" className="block text-sm font-semibold">What do you want to understand?</label>
      <input id="knowledge-topic" maxLength={200} value={knowledgeTopic} onChange={e=>{setKnowledgeTopic(e.target.value);setDraft(null);setSaved(false);setApproved(false);}} disabled={analyzing || saving} className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-transparent p-3 text-sm" placeholder="e.g. Why customers abandon their first product"/>
      <label htmlFor="knowledge-notes" className="block text-sm font-semibold">Your own research and observations</label>
      <textarea id="knowledge-notes" rows={5} maxLength={8000} value={notes} onChange={e=>{setNotes(e.target.value);setDraft(null);setSaved(false);setApproved(false);setIndependent(false);}} disabled={analyzing || saving} className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-transparent p-3 text-sm" placeholder="What have you heard from customers or learned from your own experience?"/>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={independent} disabled={analyzing || saving} onChange={e=>setIndependent(e.target.checked)}/>These are independently collected notes, not copied or derived from Google-grounded search output. I have permission to use them.</label>
      <button type="button" disabled={busy || analyzing || saving || !knowledgeTopic.trim() || !notes.trim() || !independent} onClick={analyze} className="rounded-lg bg-indigo-600 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50">{analyzing ? "Creating knowledge…" : "Create business knowledge"}</button>
      <p className="text-xs text-slate-500 dark:text-zinc-400">Successful analysis uses one Free generation allowance.</p>
    </div>
    {draft && <div className="space-y-4 border-t border-slate-200 dark:border-zinc-700 pt-4">
      <h3 className="text-lg font-bold">What you learned</h3>
      <p className="text-sm text-slate-600 dark:text-zinc-300">AI interpretations of your independent notes, not confirmed buyer demand. Review these ideas before relying on them.</p>
      {draft.knowledge.findings.map((f,i) => <article key={i} className="rounded-lg border border-slate-200 dark:border-zinc-700 p-3 space-y-2">
        <p className="text-sm">{f.insight}</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400">Based on your independently supplied notes</p>
      </article>)}
      {([{ title: "Possible opportunities", items: draft.knowledge.opportunities }, { title: "What we still don't know", items: draft.knowledge.unknowns }, { title: "What to do next", items: draft.knowledge.nextActions }]).map(section => <div key={section.title} className="space-y-2"><h4 className="font-semibold">{section.title}</h4><ul className="list-disc pl-5 space-y-2 text-sm">{section.items.map((item,i) => <li key={i}>{item}</li>)}</ul></div>)}
      <div className="rounded-lg border border-slate-200 dark:border-zinc-700 p-3 space-y-3">
        <h4 className="font-bold">Keep this knowledge for future work</h4>
        <p className="text-sm">Save reviewed ideas to your project's Shared Intelligence so connected tools can use them as research hypotheses, not established facts.</p>
        <label className="block text-sm font-semibold" htmlFor="demand-knowledge-project">Project</label>
        <select id="demand-knowledge-project" value={projectId} onChange={e => { setProjectId(e.target.value); setSaved(false); setApproved(false); }} disabled={saving} className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-transparent p-2 text-sm"><option value="">Choose a project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {!projects.length && <p className="text-sm">Create a Shared Creator Project first.</p>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={approved} disabled={saving} onChange={e => setApproved(e.target.checked)}/>I reviewed the draft and understand that these findings still require validation.</label>
        <button type="button" disabled={!projectId || !approved || saving || saved} onClick={saveKnowledge} className="rounded-lg bg-indigo-600 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50">{saved ? "Knowledge saved" : saving ? "Saving…" : "Save to Shared Intelligence"}</button>
        {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Your reviewed research has been saved.</p>}
      </div>
    </div>}
  </section>;
}
