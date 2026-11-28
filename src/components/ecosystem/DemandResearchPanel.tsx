import React, { useEffect, useState } from "react";
import { ExternalLink, Search, Loader2 } from "lucide-react";
import { ecosystemFetch } from "../../services/ecosystemClient";

type Source = { title: string; url: string; snippet: string };
type Research = { topic: string; sources: Source[]; retrievedAt: string };

export function DemandResearchPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<Research | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    ecosystemFetch<{configured: boolean}>("/api/ecosystem/demand/research-status")
      .then(data => { if (active) setConfigured(data.configured); })
      .catch(() => { if (active) setError("Could not check live research availability. Refresh to retry."); });
    return () => { active = false; };
  }, []);

  async function run(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !configured || !topic.trim()) return;
    setBusy(true); setError(""); setResult(null);
    try {
      setResult(await ecosystemFetch<Research>("/api/ecosystem/demand/research", { method: "POST", body: { topic: topic.trim() } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-4 sm:p-5 space-y-4">
    <div className="space-y-2">
      <h2 className="text-lg font-bold text-slate-950 dark:text-white">Research real demand</h2>
      <p className="text-sm text-slate-600 dark:text-zinc-300">Find public conversations, competing solutions and market information with links you can inspect.</p>
      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3 text-sm text-slate-800 dark:text-zinc-200">
        <strong>Why this is worth paying for</strong>
        <p className="mt-1">Spend less time searching across websites and make better-informed product decisions before investing time or money building something. Check the original sources instead of relying only on AI guesses.</p>
      </div>
    </div>
    {configured === false && <p role="status" className="text-sm text-slate-600 dark:text-zinc-300">In development: the live search provider is not connected yet. Existing research planning tools remain available below.</p>}
    {configured === null && !error && <p role="status" className="text-sm">Checking research availability…</p>}
    <form onSubmit={run} className="space-y-2">
      <label htmlFor="demand-public-topic" className="block text-sm font-semibold">What do you want to research?</label>
      <input id="demand-public-topic" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={200} required disabled={!configured || busy} placeholder="e.g. challenges selling digital products" className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-3 text-sm disabled:opacity-50" />
      <p className="text-xs text-slate-500 dark:text-zinc-400">Only enter public research terms. Your query is sent to the search provider; do not include private customer or business information. A successful search uses one generation allowance on the Free plan.</p>
      <button type="submit" disabled={!configured || busy || !topic.trim()} className="w-full rounded-lg bg-indigo-600 text-white px-4 py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}{busy ? "Searching…" : "Find public sources"}</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {result && <div className="space-y-3" aria-live="polite">
      <h3 className="font-bold">Sources for {result.topic}</h3>
      <p className="text-xs text-slate-600 dark:text-zinc-400">Retrieved {new Date(result.retrievedAt).toLocaleString()}. Search snippets are leads for further investigation, not verified buyer demand, sales or endorsements.</p>
      {result.sources.length === 0 && <p>No matching sources found. Try a more specific public topic.</p>}
      {result.sources.map((source, i) => <article key={source.url} className="rounded-lg border border-slate-200 dark:border-zinc-700 p-3 space-y-2 break-words">
        <h4 className="font-semibold text-sm">{i+1}. {source.title}</h4>
        <p className="text-sm text-slate-600 dark:text-zinc-300">{source.snippet || "Open the source to inspect its details."}</p>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 dark:text-indigo-300">Open source <ExternalLink className="h-3 w-3"/></a>
      </article>)}
      {result.sources.length > 0 && <p className="text-sm">Next: read the most relevant sources and bring your own findings into Find Problems to Solve or Understand Your Customers below.</p>}
    </div>}
  </section>;
}
