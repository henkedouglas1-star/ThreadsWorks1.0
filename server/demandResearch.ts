export interface DemandSource {
  title: string;
  url: string;
  snippet: string;
}

export function normalizeDemandSources(payload: unknown): DemandSource[] {
  const results = (payload as { web?: { results?: unknown[] } } | null)?.web?.results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const sources: DemandSource[] = [];
  for (const entry of results.slice(0, 20)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.url !== "string" || typeof row.title !== "string") continue;
    let url: URL;
    try { url = new URL(row.url); } catch { continue; }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) continue;
    url.hash = "";
    if (seen.has(url.href)) continue;
    const title = row.title.trim().slice(0, 300);
    if (!title) continue;
    seen.add(url.href);
    sources.push({ title, url: url.href, snippet: typeof row.description === "string" ? row.description.trim().slice(0, 800) : "" });
    if (sources.length === 8) break;
  }
  return sources;
}

// Only the explicit public search term is sent to the search provider.
// Never forward private creator context, customer notes, auth tokens or project data.
export async function searchDemandSources(topic: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<DemandSource[]> {
  const query = topic.trim();
  if (!query || query.length > 200) throw new Error("Enter a public research topic of 1–200 characters.");
  if (!apiKey.trim()) throw new Error("Live research is not configured.");
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("text_decorations", "false");
  const response = await fetcher(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey.trim() },
    signal: AbortSignal.timeout(12000),
    redirect: "error"
  });
  if (!response.ok) throw new Error("Live research provider is unavailable. Please try again later.");
  return normalizeDemandSources(await response.json());
}
