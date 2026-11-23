import { Type } from "@google/genai";
import { getAI, callGenerateContentWithRetry } from "./geminiClient";

export interface ClassifiableContentItem {
  id: string;
  title: string;
  body: string;
  currentTopic?: string;
  currentTopics?: string[];
  currentPillarTitle?: string;
}

export interface ContentClassificationResult {
  id: string;
  suggestedTopics: string[];
  suggestedPillarTitle: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface ClassifyOrganizationInput {
  items: ClassifiableContentItem[];
  availablePillars: Array<{ title: string; description?: string; coreExpertise?: string }>;
  creatorContext?: {
    offer?: string;
    audience?: string;
    customInstruction?: string;
  };
}

export interface ClassifyOrganizationResponse {
  results: ContentClassificationResult[];
  source: "ai" | "fallback";
  aiUnavailable: boolean;
  notice?: string;
}

export interface PlannerDayInput {
  dateKey: string;
  dayName: string;
  isOpen: boolean;
  isPast: boolean;
  existingTitles: string[];
}

export interface PlannerPostInput {
  id: string;
  title: string;
  hook?: string;
  bodyPreview: string;
  stage: string;
  topic?: string;
  topics?: string[];
  pillarTitle?: string;
  plannedDate?: string | null;
  scheduledFor?: string | null;
  publishedAt?: string | null;
}

export interface PlannerProfileInput {
  offer?: string;
  audience?: string;
  desiredResult?: string;
  voiceTone?: string;
  writingStyle?: string;
  customInstruction?: string;
  contentPillars?: Array<{ title: string; description?: string; coreExpertise?: string }>;
}

export interface WeeklyPlanRecommendation {
  dateKey: string;
  dayName: string;
  actionType: "assign_existing_draft" | "develop_saved_idea" | "generate_new";
  existingRecordId?: string;
  title: string;
  topic: string;
  pillarTitle?: string;
  angle: string;
  rationale: string;
  source: "ai" | "deterministic";
}

export interface WeeklyPlanInput {
  weekDays: PlannerDayInput[];
  existingPosts: PlannerPostInput[];
  profile?: PlannerProfileInput;
  requestedTopic?: string;
}

export interface WeeklyPlanResponse {
  recommendations: WeeklyPlanRecommendation[];
  editorialSummary: string;
  source: "ai" | "fallback";
  aiUnavailable: boolean;
  notice?: string;
}

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "you", "your", "are", "was",
  "were", "have", "has", "had", "not", "but", "from", "they", "their", "what",
  "when", "where", "which", "who", "how", "why", "can", "will", "just", "more",
  "about", "into", "out", "over", "then", "than", "also", "all", "one", "our",
  "make", "like", "time", "get", "use", "way", "new", "want", "because", "any",
  "posts", "post", "thread", "threads", "content", "general", "draft", "scheduled",
]);

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function titleCase(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeTopicLabel(raw: string): string {
  return (raw || "")
    .replace(/ThreadsWorks\s+(DNA\s+)?Content:\s*/gi, "")
    .replace(/\b(SCHEDULED|DRAFT|PUBLISHED|IDEA)\b/gi, "")
    .replace(/[^\w\s&/-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

/**
 * Deterministic fallback classifier used when Gemini is unavailable or fails.
 * Never fabricates external data; relies only on user's text and configured pillars.
 */
export function deterministicClassifyItems(
  input: ClassifyOrganizationInput
): ContentClassificationResult[] {
  const pillars = (input.availablePillars || []).filter((p) => p?.title?.trim());

  return input.items.map((item) => {
    const combined = `${item.title || ""} ${item.body || ""}`.trim();
    const tokens = tokenize(combined);
    const tokenSet = new Set(tokens);

    // Match best pillar by lexical overlap
    let bestPillar = item.currentPillarTitle || "";
    let bestScore = 0;

    for (const pillar of pillars) {
      const pTokens = tokenize(`${pillar.title} ${pillar.description || ""} ${pillar.coreExpertise || ""}`);
      let score = 0;
      for (const pt of pTokens) {
        if (tokenSet.has(pt)) score += 1;
      }
      if (combined.toLowerCase().includes(pillar.title.toLowerCase())) {
        score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPillar = pillar.title;
      }
    }

    // Extract top 2 frequent meaningful words as topic candidates if none exist
    const freq = new Map<string, number>();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    const existingCleanTopics = [
      ...(item.currentTopics || []),
      ...(item.currentTopic ? [item.currentTopic] : []),
    ]
      .map(sanitizeTopicLabel)
      .filter((t) => t.length >= 2 && t.toLowerCase() !== "general");

    const topKeywords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([word]) => titleCase(word));

    const suggestedTopics = Array.from(
      new Set([...existingCleanTopics, ...(bestPillar ? [bestPillar] : []), ...topKeywords])
    ).slice(0, 3);

    return {
      id: item.id,
      suggestedTopics: suggestedTopics.length > 0 ? suggestedTopics : ["Creator Insights"],
      suggestedPillarTitle: bestPillar,
      confidence: bestScore >= 2 ? "medium" : "low",
      reason: bestPillar
        ? `Matched keywords with your "${bestPillar}" pillar.`
        : "Grouped using key phrases from your post text.",
    };
  });
}

/**
 * Classifies content records into clean topics and matching content pillars using Gemini.
 * Gracefully falls back to deterministic matching if AI is unavailable.
 */
export async function classifyContentOrganization(
  input: ClassifyOrganizationInput
): Promise<ClassifyOrganizationResponse> {
  const safeItems = (input.items || []).slice(0, 25).map((item) => ({
    id: String(item.id || ""),
    title: String(item.title || "").slice(0, 140),
    body: String(item.body || "").slice(0, 600),
    currentTopic: item.currentTopic || "",
    currentTopics: Array.isArray(item.currentTopics) ? item.currentTopics.slice(0, 5) : [],
    currentPillarTitle: item.currentPillarTitle || "",
  })).filter((i) => i.id && (i.title || i.body));

  if (safeItems.length === 0) {
    return {
      results: [],
      source: "fallback",
      aiUnavailable: false,
    };
  }

  const pillars = (input.availablePillars || [])
    .filter((p) => p && typeof p.title === "string" && p.title.trim())
    .slice(0, 12);
  const validPillarNames = new Map<string, string>(
    pillars.map((p) => [p.title.trim().toLowerCase(), p.title.trim()])
  );

  try {
    const ai = getAI();
    const prompt = [
      "You are an editorial organizer for a Meta Threads creator workspace.",
      "Assign 1 to 3 concise, human-friendly topic tags (2-4 words each, no hashtags) and the single best-fitting content pillar from the creator's defined pillars (or empty string if none fit) for each content item.",
      "Rules:",
      "- Ground every suggestion strictly in the item's text and the creator's pillars.",
      "- Do not invent performance predictions, metrics, or facts not present in the items.",
      "- If available pillars are listed, suggestedPillarTitle MUST match one of their exact titles or be empty.",
      "",
      `Creator Context: Offer="${(input.creatorContext?.offer || "").slice(0, 200)}", Audience="${(input.creatorContext?.audience || "").slice(0, 200)}"`,
      `Available Pillars: ${pillars.length > 0 ? JSON.stringify(pillars.map((p) => ({ title: p.title, description: (p.description || "").slice(0, 160) }))) : "None configured"}`,
      "",
      `Items to classify: ${JSON.stringify(safeItems.map((i) => ({ id: i.id, title: i.title, text: i.body })))}`,
    ].join("\n");

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-4-hydrogen",
      strictContentGeneration: true,
      optimizationTaskId: "CONTENT_CLASSIFY",
      optimizationComplexity: "LEVEL_1_LIGHT",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  suggestedTopics: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  suggestedPillarTitle: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ["id", "suggestedTopics", "suggestedPillarTitle", "confidence", "reason"],
              },
            },
          },
          required: ["items"],
        },
      },
    });

    const rawText = typeof response?.text === "string" ? response.text : "";
    const parsed = JSON.parse(rawText);
    const aiItems: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const byId = new Map<string, ContentClassificationResult>();

    for (const entry of aiItems) {
      if (!entry || !entry.id) continue;
      const cleanTopics = (Array.isArray(entry.suggestedTopics) ? entry.suggestedTopics : [])
        .map((t: any) => sanitizeTopicLabel(String(t || "")))
        .filter((t: string) => t.length >= 2)
        .slice(0, 3);

      const rawPillar = String(entry.suggestedPillarTitle || "").trim();
      const matchedPillar =
        pillars.length > 0
          ? validPillarNames.get(rawPillar.toLowerCase()) || ""
          : rawPillar.slice(0, 60);

      const conf =
        entry.confidence === "high" || entry.confidence === "medium" || entry.confidence === "low"
          ? entry.confidence
          : "medium";

      byId.set(String(entry.id), {
        id: String(entry.id),
        suggestedTopics: cleanTopics.length > 0 ? cleanTopics : ["Creator Insights"],
        suggestedPillarTitle: matchedPillar,
        confidence: conf,
        reason: String(entry.reason || "Suggested from your post text.").slice(0, 140),
      });
    }

    const fallbackMap = new Map(
      deterministicClassifyItems({ ...input, items: safeItems }).map((r) => [r.id, r])
    );

    const results = safeItems.map((item) => byId.get(item.id) || fallbackMap.get(item.id)!);

    return {
      results,
      source: "ai",
      aiUnavailable: false,
    };
  } catch (err: any) {
    console.warn("[CONTENT_PLANNING] AI topic classification unavailable, using deterministic fallback:", err?.message || err);
    return {
      results: deterministicClassifyItems({ ...input, items: safeItems }),
      source: "fallback",
      aiUnavailable: true,
      notice: "AI topic suggestions are temporarily unavailable. Showing keyword-based suggestions instead.",
    };
  }
}

/**
 * Deterministic fallback weekly planner obeying all AI Planning Rules.
 */
export function buildDeterministicWeeklyPlanServer(input: WeeklyPlanInput): WeeklyPlanRecommendation[] {
  const openDays = (input.weekDays || []).filter((d) => d.isOpen && !d.isPast);
  if (openDays.length === 0) return [];

  const posts = input.existingPosts || [];
  const cleanReqTopic = (input.requestedTopic || "").trim();
  const pillars = (input.profile?.contentPillars || []).filter((p) => p?.title?.trim());

  const scheduledOrPlannedIds = new Set(
    posts
      .filter((p) => p.stage === "Planned" || p.stage === "Scheduled" || p.stage === "Published")
      .map((p) => p.id)
  );

  const readyAndDrafts = posts
    .filter((p) => (p.stage === "Ready" || p.stage === "Draft") && !scheduledOrPlannedIds.has(p.id))
    .sort((a, b) => (a.stage === "Ready" ? -1 : 1) - (b.stage === "Ready" ? -1 : 1));

  const savedIdeas = posts.filter((p) => p.stage === "Idea" && !scheduledOrPlannedIds.has(p.id));

  const angles = [
    "Educational Breakdown",
    "Practical Framework",
    "Contrarian Insight",
    "Behind-the-Scenes Process",
    "Actionable Checklist",
    "Common Misconception",
    "Direct Conversation Starter",
  ];

  const usedIds = new Set<string>();
  const recommendations: WeeklyPlanRecommendation[] = [];

  openDays.forEach((day, idx) => {
    // 1. Prefer reusing existing Ready/Draft posts first
    const draftMatch =
      readyAndDrafts.find((d) => {
        if (usedIds.has(d.id)) return false;
        if (!cleanReqTopic) return true;
        return `${d.title} ${d.bodyPreview} ${d.topic || ""}`
          .toLowerCase()
          .includes(cleanReqTopic.toLowerCase());
      }) || (!cleanReqTopic ? readyAndDrafts.find((d) => !usedIds.has(d.id)) : undefined);

    if (draftMatch) {
      usedIds.add(draftMatch.id);
      recommendations.push({
        dateKey: day.dateKey,
        dayName: day.dayName,
        actionType: "assign_existing_draft",
        existingRecordId: draftMatch.id,
        title: draftMatch.title,
        topic: sanitizeTopicLabel(draftMatch.topic || "") || draftMatch.pillarTitle || "Saved Draft",
        pillarTitle: draftMatch.pillarTitle || undefined,
        angle: angles[idx % angles.length],
        rationale:
          draftMatch.stage === "Ready"
            ? "Uses your Ready draft so you publish finished work before creating new posts."
            : "Promotes an existing draft from your library to fill this open day.",
        source: "deterministic",
      });
      return;
    }

    // 2. Next prefer developing saved Ideas
    const ideaMatch = savedIdeas.find((idea) => !usedIds.has(idea.id));
    if (ideaMatch) {
      usedIds.add(ideaMatch.id);
      recommendations.push({
        dateKey: day.dateKey,
        dayName: day.dayName,
        actionType: "develop_saved_idea",
        existingRecordId: ideaMatch.id,
        title: ideaMatch.title,
        topic: cleanReqTopic || sanitizeTopicLabel(ideaMatch.topic || "") || ideaMatch.title.slice(0, 40),
        pillarTitle: ideaMatch.pillarTitle || pillars[idx % Math.max(pillars.length, 1)]?.title,
        angle: angles[idx % angles.length],
        rationale: "Turns one of your saved ideas into a focused post for this open day.",
        source: "deterministic",
      });
      return;
    }

    // 3. Otherwise recommend generating a fresh post aligned with user's pillars/topic
    const pillar = pillars.length > 0 ? pillars[idx % pillars.length] : undefined;
    const topicLabel = cleanReqTopic || pillar?.title || input.profile?.offer || "Creator Strategy";
    recommendations.push({
      dateKey: day.dateKey,
      dayName: day.dayName,
      actionType: "generate_new",
      title: `${angles[idx % angles.length]}: ${topicLabel}`,
      topic: topicLabel.slice(0, 50),
      pillarTitle: pillar?.title,
      angle: angles[idx % angles.length],
      rationale: cleanReqTopic
        ? `Addresses your requested topic ("${cleanReqTopic}") with a distinct editorial angle.`
        : pillar
        ? `Maintains balanced coverage of your "${pillar.title}" content pillar.`
        : "Fills an open day on your weekly calendar with a fresh content angle.",
      source: "deterministic",
    });
  });

  return recommendations;
}

/**
 * Generates grounded AI weekly plan recommendations strictly for open days.
 * Obeys all ThreadsWorks AI Planning Rules and falls back cleanly if AI is unavailable.
 */
export async function generateWeeklyPlanRecommendations(
  input: WeeklyPlanInput
): Promise<WeeklyPlanResponse> {
  const openDays = (input.weekDays || []).filter((d) => d.isOpen && !d.isPast);

  if (openDays.length === 0) {
    return {
      recommendations: [],
      editorialSummary: "All upcoming days in this week already have planned or scheduled content.",
      source: "fallback",
      aiUnavailable: false,
    };
  }

  const posts = (input.existingPosts || []).slice(0, 80);
  const validOpenDateKeys = new Set(openDays.map((d) => d.dateKey));
  const openDayByKey = new Map(openDays.map((d) => [d.dateKey, d]));

  const readyOrDraftPosts = posts.filter((p) => p.stage === "Ready" || p.stage === "Draft");
  const savedIdeas = posts.filter((p) => p.stage === "Idea");
  const recentPublishedOrScheduled = posts
    .filter((p) => p.stage === "Published" || p.stage === "Scheduled" || p.stage === "Planned")
    .slice(0, 20);

  const validDraftIds = new Map(readyOrDraftPosts.map((p) => [p.id, p]));
  const validIdeaIds = new Map(savedIdeas.map((p) => [p.id, p]));
  const configuredPillars = (input.profile?.contentPillars || [])
    .filter((p) => p?.title?.trim())
    .slice(0, 10);
  const validPillarMap = new Map(
    configuredPillars.map((p) => [p.title.trim().toLowerCase(), p.title.trim()])
  );

  try {
    const ai = getAI();
    const prompt = [
      "You are the editorial planner inside ThreadsWorks for a Meta Threads creator.",
      "Recommend one content action for each OPEN day listed below.",
      "",
      "STRICT PLANNING RULES:",
      "1. ONLY output recommendations for the exact open dateKeys provided. Never modify or overwrite filled days.",
      "2. Respect the creator's Creator Context, voice, and content pillars.",
      "3. If a requestedFocusTopic is provided, prioritize it across recommendations.",
      "4. Avoid repeating topics or hooks already covered in recentScheduledOrPublished.",
      "5. PREFER reusing suitable existing Ready or Draft posts (actionType='assign_existing_draft' with exact existingRecordId) before recommending saved ideas (actionType='develop_saved_idea' with exact existingRecordId), and only recommend 'generate_new' when no suitable draft/idea fits.",
      "6. Never assign the same existingRecordId to two different days.",
      "7. Vary content angles across the week (e.g., Educational Breakdown, Practical Framework, Contrarian Insight, Story/Process, Actionable Checklist).",
      "8. NEVER invent engagement predictions, viral probabilities, view estimates, analytics numbers, or performance guarantees.",
      "9. Keep rationales objective, neutral, concise (1 sentence), and grounded strictly in the creator's actual library and pillars.",
      "",
      `Requested Focus Topic: ${input.requestedTopic ? `"${input.requestedTopic.slice(0, 140)}"` : "None"}`,
      `Creator Context: ${JSON.stringify({
        offer: (input.profile?.offer || "").slice(0, 200),
        audience: (input.profile?.audience || "").slice(0, 200),
        desiredResult: (input.profile?.desiredResult || "").slice(0, 200),
        voiceTone: (input.profile?.voiceTone || "").slice(0, 120),
        writingStyle: (input.profile?.writingStyle || "").slice(0, 120),
        customInstruction: (input.profile?.customInstruction || "").slice(0, 400),
      })}`,
      `Content Pillars: ${JSON.stringify(configuredPillars.map((p) => ({ title: p.title, description: (p.description || "").slice(0, 140) })))}`,
      `Open Days to Fill: ${JSON.stringify(openDays.map((d) => ({ dateKey: d.dateKey, dayName: d.dayName })))}`,
      `Already Filled Days This Week: ${JSON.stringify((input.weekDays || []).filter((d) => !d.isOpen).map((d) => ({ dayName: d.dayName, titles: d.existingTitles })))}`,
      `Available Ready & Draft Posts: ${JSON.stringify(readyOrDraftPosts.slice(0, 25).map((p) => ({ id: p.id, stage: p.stage, title: p.title.slice(0, 100), topic: p.topic || "", pillarTitle: p.pillarTitle || "", preview: p.bodyPreview.slice(0, 160) })))}`,
      `Available Saved Ideas: ${JSON.stringify(savedIdeas.slice(0, 20).map((p) => ({ id: p.id, title: p.title.slice(0, 100), topic: p.topic || "", pillarTitle: p.pillarTitle || "", preview: p.bodyPreview.slice(0, 160) })))}`,
      `Recent Scheduled/Planned/Published (do not repeat): ${JSON.stringify(recentPublishedOrScheduled.map((p) => ({ stage: p.stage, title: p.title.slice(0, 90), topic: p.topic || "", pillarTitle: p.pillarTitle || "" })))}`,
    ].join("\n");

    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-4-hydrogen",
      strictContentGeneration: true,
      optimizationTaskId: "WEEKLY_PLAN_RECOMMEND",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: prompt,
      config: {
        temperature: 0.35,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            editorialSummary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dateKey: { type: Type.STRING },
                  actionType: { type: Type.STRING },
                  existingRecordId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  pillarTitle: { type: Type.STRING },
                  angle: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ["dateKey", "actionType", "title", "topic", "angle", "rationale"],
              },
            },
          },
          required: ["editorialSummary", "recommendations"],
        },
      },
    });

    const rawText = typeof response?.text === "string" ? response.text : "";
    const parsed = JSON.parse(rawText);
    const rawRecs: any[] = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

    const usedDateKeys = new Set<string>();
    const usedRecordIds = new Set<string>();
    const validated: WeeklyPlanRecommendation[] = [];

    for (const rec of rawRecs) {
      const dateKey = String(rec?.dateKey || "").trim();
      if (!validOpenDateKeys.has(dateKey) || usedDateKeys.has(dateKey)) continue;
      const dayMeta = openDayByKey.get(dateKey)!;

      let actionType: WeeklyPlanRecommendation["actionType"] =
        rec?.actionType === "assign_existing_draft" ||
        rec?.actionType === "develop_saved_idea" ||
        rec?.actionType === "generate_new"
          ? rec.actionType
          : "generate_new";

      let existingRecordId = rec?.existingRecordId ? String(rec.existingRecordId).trim() : undefined;

      if (actionType === "assign_existing_draft") {
        if (!existingRecordId || !validDraftIds.has(existingRecordId) || usedRecordIds.has(existingRecordId)) {
          actionType = "generate_new";
          existingRecordId = undefined;
        } else {
          usedRecordIds.add(existingRecordId);
        }
      } else if (actionType === "develop_saved_idea") {
        if (!existingRecordId || !validIdeaIds.has(existingRecordId) || usedRecordIds.has(existingRecordId)) {
          actionType = "generate_new";
          existingRecordId = undefined;
        } else {
          usedRecordIds.add(existingRecordId);
        }
      } else {
        existingRecordId = undefined;
      }

      const rawPillar = String(rec?.pillarTitle || "").trim();
      const matchedPillar =
        configuredPillars.length > 0
          ? validPillarMap.get(rawPillar.toLowerCase()) || undefined
          : rawPillar || undefined;

      const linkedRecord = existingRecordId
        ? validDraftIds.get(existingRecordId) || validIdeaIds.get(existingRecordId)
        : undefined;

      usedDateKeys.add(dateKey);
      validated.push({
        dateKey,
        dayName: dayMeta.dayName,
        actionType,
        ...(existingRecordId ? { existingRecordId } : {}),
        title: linkedRecord?.title || String(rec?.title || "Planned Post").slice(0, 120),
        topic: sanitizeTopicLabel(String(rec?.topic || linkedRecord?.topic || "")) || "General",
        pillarTitle: linkedRecord?.pillarTitle || matchedPillar,
        angle: String(rec?.angle || "Educational Breakdown").slice(0, 60),
        rationale: String(rec?.rationale || "Suggested to balance your weekly publishing mix.").slice(0, 220),
        source: "ai",
      });
    }

    // Backfill any open day missed by AI using deterministic fallback
    if (validated.length < openDays.length) {
      const missingDays = openDays.filter((d) => !usedDateKeys.has(d.dateKey));
      const remainingPosts = posts.filter((p) => !usedRecordIds.has(p.id));
      const backfill = buildDeterministicWeeklyPlanServer({
        ...input,
        weekDays: missingDays,
        existingPosts: remainingPosts,
      });
      validated.push(...backfill);
    }

    validated.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return {
      recommendations: validated,
      editorialSummary:
        String(parsed?.editorialSummary || "").slice(0, 260) ||
        `Prepared ${validated.length} grounded recommendations for your open days this week.`,
      source: "ai",
      aiUnavailable: false,
    };
  } catch (err: any) {
    console.warn("[CONTENT_PLANNING] AI weekly plan unavailable, using deterministic fallback:", err?.message || err);
    const fallbackRecs = buildDeterministicWeeklyPlanServer(input);
    return {
      recommendations: fallbackRecs,
      editorialSummary:
        fallbackRecs.length > 0
          ? `Prepared ${fallbackRecs.length} plan suggestions from your saved drafts, ideas, and content pillars.`
          : "No open days remaining in this week.",
      source: "fallback",
      aiUnavailable: true,
      notice: "AI weekly planning is temporarily unavailable. Showing smart suggestions built from your existing library instead.",
    };
  }
}
