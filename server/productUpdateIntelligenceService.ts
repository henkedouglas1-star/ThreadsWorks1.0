import fs from "fs";
import path from "path";
import { ProductUpdate, ProductUpdateReport, RelevanceScore } from "../src/types/productUpdate";
import { GoogleGenAI, Type } from "@google/genai";

import { getAI, callGenerateContentWithRetry } from "./geminiClient";

function parseGeminiJson(text: string): any {
  if (!text || typeof text !== "string") return null;
  let clean = text.trim();
  // Strip markdown code fences if present
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(clean);
  } catch (_) {
    return null;
  }
}

export interface FileChangeInfo {
  path: string;
  mtime: Date;
  size: number;
}

// 1. Filesystem scanner for code changes
export function scanWorkspaceCodeFiles(dir: string, fileList: FileChangeInfo[] = []): FileChangeInfo[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (
      file === "node_modules" ||
      file === "dist" ||
      file === ".git" ||
      file === "tmp" ||
      file === ".npm" ||
      file === ".cache" ||
      file === "functions"
    ) {
      continue;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      scanWorkspaceCodeFiles(filePath, fileList);
    } else {
      const ext = path.extname(file);
      if ([".ts", ".tsx", ".json", ".js", ".jsx", ".css"].includes(ext)) {
        if (ext === ".json" && file !== "package.json" && file !== "firebase-blueprint.json") {
          continue;
        }
        fileList.push({
          path: filePath,
          mtime: stat.mtime,
          size: stat.size
        });
      }
    }
  }
  return fileList;
}

// Feature Domain Grouping Definitions
interface FeatureGroupDefinition {
  id: string;
  title: string;
  category: string;
  relevanceScore: RelevanceScore;
  matches: (filePath: string) => boolean;
  defaultWhatChanged: string;
  defaultPreviousProblem: string;
  defaultCreatorBenefit: string;
  defaultCreatorExperience: string;
  defaultTechnicalSummary: string;
}

const FEATURE_GROUP_DEFINITIONS: FeatureGroupDefinition[] = [
  {
    id: "content-engine-intelligence",
    title: "Thread-Depth & Hook Fulfillment Engine",
    category: "Content Creation",
    relevanceScore: "HIGH",
    matches: (f) =>
      f.includes("contentIntegrityService") ||
      f.includes("contentSanitizer") ||
      f.includes("ContentEngineView") ||
      (f === "server.ts" && (f.includes("plannerPrompt") || f.includes("postPartsCount"))),
    defaultWhatChanged: "The engine now evaluates the depth of your idea to dynamically choose 1 to 8 parts, while guaranteeing that Part 2 directly delivers on the promise made in your Part 1 hook.",
    defaultPreviousProblem: "Threads posts were biased toward short 1-3 parts regardless of topic depth, and Part 2 sometimes drifted into unrelated software advice instead of fulfilling the hook.",
    defaultCreatorBenefit: "Your threads are automatically structured with the right length for the idea, and readers actually get what your hook promised on the very next swipe.",
    defaultCreatorExperience: "You pick how many posts to generate; ThreadsWorks figures out the depth, structure, and promise continuation without requiring manual configuration.",
    defaultTechnicalSummary: "Integrated 1-8 part-count planning heuristics, strict Part 2 hook promise resolution, and anti-hallucination factual validation."
  },
  {
    id: "workspace-lazy-load",
    title: "On-Demand Workspace & Modular Apps",
    category: "Performance & UX",
    relevanceScore: "HIGH",
    matches: (f) =>
      f.includes("DashboardView") ||
      (f.includes("AppChangePostView") && !f.includes("PublishModal")),
    defaultWhatChanged: "Creator apps inside Workspace now load on demand only when you click them, rather than initializing during main workspace mount.",
    defaultPreviousProblem: "Opening Workspace could trigger heavy component initialization and data checks before you even decided which tool to use.",
    defaultCreatorBenefit: "Opening Workspace is faster and lighter. Your creative environment stays distraction-free until you explicitly launch a specialized tool.",
    defaultCreatorExperience: "Instant workspace navigation with crisp modular cards that mount tools only when you tap them.",
    defaultTechnicalSummary: "Converted founder and creator tools to React.lazy on-demand mounting with cached state recovery."
  },
  {
    id: "threads-publishing-engine",
    title: "Deterministic Threads Publishing Engine",
    category: "Publishing & Distribution",
    relevanceScore: "HIGH",
    matches: (f) =>
      f.includes("PublishModal") ||
      f.includes("threadsApi") ||
      f.includes("publishToThreads"),
    defaultWhatChanged: "Publishing to Threads now runs through a strict deterministic state machine with live stage feedback, 15-second external timeouts, and duplicate protection.",
    defaultPreviousProblem: "Publishing could hang indefinitely on developer endpoint communication if Meta took too long or if a stale processing lock blocked retries.",
    defaultCreatorBenefit: "You always get a definitive result (Success, Failed, or Timed Out) within seconds, with clean retry protection so duplicate posts are never created.",
    defaultCreatorExperience: "When you tap Publish, you see real-time stages (validating -> creating -> processing -> published) and never an infinite spinner.",
    defaultTechnicalSummary: "Enforced server-side fetch timeouts, 60s idempotency TTL lock expiration, explicit client state machine, and error propagation."
  },
  {
    id: "calendar-scheduling-queue",
    title: "Publishing Calendar & Multi-Post Queue",
    category: "Distribution",
    relevanceScore: "HIGH",
    matches: (f) =>
      f.includes("CalendarView") ||
      f.includes("ScheduleModal") ||
      f.includes("AddAllToCalendarModal"),
    defaultWhatChanged: "Refined multi-post scheduling and manuscript timeline organization.",
    defaultPreviousProblem: "Managing drafts across multiple dates required repetitive manual scheduling steps.",
    defaultCreatorBenefit: "Batch-schedule entire weeks of content with 1-click timeline organization.",
    defaultCreatorExperience: "A clean visual calendar showing exactly when your manuscripts go live.",
    defaultTechnicalSummary: "Optimized scheduling dispatcher intervals and batch timeline synchronization."
  },
  {
    id: "conversion-studio",
    title: "Conversion Studio & Keyword DM Prompts",
    category: "Monetization",
    relevanceScore: "HIGH",
    matches: (f) =>
      f.includes("CallToActionView") ||
      f.includes("CtaAndLinkManager") ||
      f.includes("cta-studio"),
    defaultWhatChanged: "Formulate low-friction next steps and keyword DM conversion hooks that turn engaged readers into inbound conversations.",
    defaultPreviousProblem: "Posts often ended abruptly with generic links that readers scrolled right past.",
    defaultCreatorBenefit: "Higher reply and DM conversion rates with contextual, natural call-to-actions.",
    defaultCreatorExperience: "One-click conversion prompts tailored to your specific audience and offer.",
    defaultTechnicalSummary: "Refined CTA keyword synthesizer and placement rules."
  },
  {
    id: "creator-memory-workflow",
    title: "ThreadsWorks Learning Engine & Lifecycle Board",
    category: "Intelligence & Memory",
    relevanceScore: "HIGH",
    matches: (f) =>
      f.includes("MemoryWorkflowView") ||
      f.includes("PipelineKanbanView") ||
      f.includes("contentMemoryService"),
    defaultWhatChanged: "Permanent content lifecycle engine that learns from every post you draft, publish, and analyze.",
    defaultPreviousProblem: "Ideas and published learnings were scattered across notes and separate tools.",
    defaultCreatorBenefit: "ThreadsWorks remembers your winning angles and incorporates what works into future posts.",
    defaultCreatorExperience: "A unified kanban view where your best thoughts continuously evolve into high-performing content.",
    defaultTechnicalSummary: "Added multi-stage lifecycle persistence and cross-session memory caching."
  },
  {
    id: "strategy-brand-audit",
    title: "Strategic Brand Audit & Continuous Performance Intelligence",
    category: "Strategy",
    relevanceScore: "HIGH",
    matches: (f) =>
      f.includes("StrategyView") ||
      f.includes("IntelligenceView") ||
      f.includes("strategicDiagnosticEngine"),
    defaultWhatChanged: "Continuous performance diagnostics that identify growth bottlenecks and pinpoint high-leverage content actions.",
    defaultPreviousProblem: "Creators lacked clear visibility into which specific content pillars were driving actual follower growth.",
    defaultCreatorBenefit: "Clear, diagnostic recommendations based on your actual audience engagement data.",
    defaultCreatorExperience: "Actionable strategic priorities that remove the guesswork from your weekly content plan.",
    defaultTechnicalSummary: "Upgraded diagnostic decision matrix and real-time performance ingestion."
  },
  {
    id: "influencer-intelligence",
    title: "Creator Discovery & Strategic Collaboration",
    category: "Audience Growth",
    relevanceScore: "MEDIUM",
    matches: (f) => f.includes("Influencer"),
    defaultWhatChanged: "Smart discovery and collaborative hook formulation for targeted creator partnerships.",
    defaultPreviousProblem: "Finding aligned creators and crafting partnership outreach was manual and time-consuming.",
    defaultCreatorBenefit: "Faster collaboration setup with creators whose audiences naturally overlap with yours.",
    defaultCreatorExperience: "Streamlined creator cards with tailored collaboration suggestions.",
    defaultTechnicalSummary: "Integrated partnership intelligence filters and collaborative outreach templates."
  },
  {
    id: "internal-testing-maintenance",
    title: "Internal Test Suite & Build Verification",
    category: "Internal Infrastructure",
    relevanceScore: "INTERNAL_ONLY",
    matches: (f) =>
      f.includes("test-") ||
      f.includes("scripts/") ||
      f.endsWith(".d.ts") ||
      f === "tsconfig.json" ||
      f === "vite.config.ts" ||
      f === "package.json",
    defaultWhatChanged: "Automated regression verification tests and build architecture hardening.",
    defaultPreviousProblem: "Manual verification was needed to confirm semantic continuity across changes.",
    defaultCreatorBenefit: "Under-the-hood stability improvements ensuring zero regressions across creation workflows.",
    defaultCreatorExperience: "Reliable background operation with strict automated quality checks.",
    defaultTechnicalSummary: "Updated TypeScript compilation rules, test suites, and linting constraints."
  }
];

// Helper to determine change type
function detectChangeType(filePath: string): string {
  return "modified";
}

// 2. Group raw files into logical ProductUpdate objects
export function groupFilesIntoProductUpdates(files: FileChangeInfo[]): ProductUpdate[] {
  const groupMap = new Map<string, { def: FeatureGroupDefinition; sourceFiles: string[] }>();
  const unmatchedFiles: string[] = [];

  for (const file of files) {
    const p = file.path.replace(/^\.\//, "");
    let matched = false;

    for (const def of FEATURE_GROUP_DEFINITIONS) {
      if (def.matches(p)) {
        if (!groupMap.has(def.id)) {
          groupMap.set(def.id, { def, sourceFiles: [] });
        }
        groupMap.get(def.id)!.sourceFiles.push(p);
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmatchedFiles.push(p);
    }
  }

  // Handle any unmatched files gracefully under general platform improvements
  if (unmatchedFiles.length > 0) {
    const isInternal = unmatchedFiles.every(f => f.includes("config") || f.includes(".json") || f.endsWith(".css"));
    const def: FeatureGroupDefinition = {
      id: "platform-foundation",
      title: "Core Platform Refinements",
      category: "Platform",
      relevanceScore: isInternal ? "LOW" : "MEDIUM",
      matches: () => true,
      defaultWhatChanged: "Refined backend response handling and interface stability.",
      defaultPreviousProblem: "Minor platform edge cases under varied network conditions.",
      defaultCreatorBenefit: "Smoother overall application reliability and responsiveness.",
      defaultCreatorExperience: "Faster, more consistent interactions across the app.",
      defaultTechnicalSummary: `Updated ${unmatchedFiles.length} file(s): ${unmatchedFiles.join(", ")}`
    };
    groupMap.set(def.id, { def, sourceFiles: unmatchedFiles });
  }

  // Convert map into structured ProductUpdate array
  const updates: ProductUpdate[] = [];
  for (const [id, { def, sourceFiles }] of groupMap.entries()) {
    updates.push({
      id,
      title: def.title,
      category: def.category,
      sourceFiles,
      whatChanged: def.defaultWhatChanged,
      previousProblem: def.defaultPreviousProblem,
      creatorBenefit: def.defaultCreatorBenefit,
      creatorExperienceAfterUpdate: def.defaultCreatorExperience,
      technicalSummary: def.defaultTechnicalSummary,
      relevanceScore: def.relevanceScore,
      confidence: 0.95,
      relatedChanges: sourceFiles.map(f => ({
        file: f,
        changeType: detectChangeType(f),
        summary: `Updated logic in ${path.basename(f)}`
      }))
    });
  }

  // Sort: HIGH first, then MEDIUM, then LOW, then INTERNAL_ONLY
  const scoreOrder: Record<RelevanceScore, number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
    INTERNAL_ONLY: 3
  };

  updates.sort((a, b) => scoreOrder[a.relevanceScore] - scoreOrder[b.relevanceScore]);
  return updates;
}

// 3. Select the single coherent primary update for the generated Threads post
export function selectPrimaryUpdate(updates: ProductUpdate[]): ProductUpdate | null {
  // Prefer the highest-ranked HIGH or MEDIUM update
  const audienceUpdates = updates.filter(u => u.relevanceScore === "HIGH" || u.relevanceScore === "MEDIUM");
  if (audienceUpdates.length > 0) {
    return audienceUpdates[0];
  }
  return updates[0] || null;
}

// 4. Generate a Benefit-First, Entertaining Threads Post or Multi-Part Thread for the chosen update
export async function generateProductUpdatePost(
  primaryUpdate: ProductUpdate,
  allAudienceUpdates: ProductUpdate[] = []
): Promise<{ post: string; parts: string[]; theme: string }> {
  const ai = getAI();

  const prompt = `
You are the ThreadsWorks Product Storyteller, writing in Douglas C. Henke's voice (digital entrepreneur, social media strategist, peer-to-peer, confident, positive reinforcement, objective outcomes).
Your objective: Take ONE specific product update and explain the CREATOR BENEFIT in an entertaining, conversational Threads post (single post or 2-3 part thread).

CRITICAL RULE: ONE GENERATED POST = ONE COHERENT PRODUCT STORY.
DO NOT combine unrelated updates! Only write about this PRIMARY UPDATE:

UPDATE TITLE: ${primaryUpdate.title}
CATEGORY: ${primaryUpdate.category}
PREVIOUS FRICTION: ${primaryUpdate.previousProblem}
WHAT CHANGED: ${primaryUpdate.whatChanged}
CREATOR BENEFIT: ${primaryUpdate.creatorBenefit}
CREATOR EXPERIENCE NOW: ${primaryUpdate.creatorExperienceAfterUpdate}

POST GUIDELINES:
1. FOCUS ON CREATOR OUTCOMES:
   - What was the friction?
   - What changed?
   - What does the creator notice now?
   - Never use empty clichés like "boosts productivity", "seamless experience", "enhanced workflow".
2. ABSOLUTELY NO TECHNICAL JARGON:
   - FORBIDDEN: filenames (.tsx, .ts), commit messages, regex, endpoints, Firestore, state machines, architecture jargon.
3. CONVERSATIONAL & ENTERTAINING:
   - Direct, punchy, conversational, peer-to-peer.
   - Use short 1-2 sentence paragraphs with whitespace.
   - 1-3 emojis max.
4. THREAD STRUCTURE (1 to 3 parts):
   - Part 1 (The Hook): A relatable creator observation or friction.
   - Part 2 (The Payoff): Immediately explains the change and how it works.
   - Part 3 (Optional Takeaway): The outcome or takeaway for creators.
   - EVERY PART MUST BE STRICTLY UNDER 500 CHARACTERS (configured limit: up to 500 chars per part).

Return strictly a JSON object:
{
  "theme": "short 3-6 word summary of the creator benefit",
  "parts": [
    "Part 1 text (max 500 chars)",
    "Part 2 text (max 500 chars)"
  ]
}
`;

  try {
    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      optimizationTaskId: "PRODUCT_UPDATE_ANALYSIS",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            theme: { type: Type.STRING },
            parts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["theme", "parts"]
        }
      }
    });

    const parsed = parseGeminiJson(response.text || "");
    if (parsed && Array.isArray(parsed.parts) && parsed.parts.length > 0) {
      const cleanedParts = parsed.parts
        .map((p: any) => String(p).trim().replace(/^["'`]|["'`]$/g, ""))
        .filter((p: string) => p.length > 0)
        .map((p: string) => (p.length > 490 ? p.slice(0, 485) + "..." : p));

      if (cleanedParts.length > 0) {
        return {
          post: cleanedParts.join("\n\n"),
          parts: cleanedParts,
          theme: parsed.theme || primaryUpdate.title
        };
      }
    }
  } catch (err: any) {
    console.warn("[PRODUCT_UPDATE_AI_FALLBACK] AI generation note, using benefit fallback:", err?.message || err);
  }

  // Grounded benefit fallback customized specifically to the chosen update
  return getGroundedFallbackPost(primaryUpdate);
}

// Grounded fallback posts tailored to each feature domain
export function getGroundedFallbackPost(update: ProductUpdate): { post: string; parts: string[]; theme: string } {
  let parts: string[] = [];

  if (update.id === "content-engine-intelligence") {
    parts = [
      `The hardest part of drafting a thread shouldn't be deciding how many parts it needs.\n\nThreadsWorks now evaluates the actual depth of your idea and chooses the right structure automatically (1 to 8 parts).`,
      `Even better: Part 2 now immediately fulfills whatever promise your hook made.\n\nIf you promise a 3-step breakdown, Part 2 actually starts the breakdown instead of drifting into generic advice.\n\nFewer settings. Faster drafting. Stronger reader retention. ⚡`
    ];
  } else if (update.id === "workspace-lazy-load") {
    parts = [
      `ThreadsWorks used to initialize workspace tools before you even opened them.\n\nThat worked, but it meant the app was doing background work you hadn't asked for yet.`,
      `Now Workspace tools load on demand when you actually click them.\n\nOpening your dashboard is faster and lighter, and you're not waiting on tools you aren't using. 🧹`
    ];
  } else if (update.id === "threads-publishing-engine") {
    parts = [
      `Publishing to Threads shouldn't leave you wondering if your post went through.\n\nWe upgraded our direct publishing engine with live stage feedback and 15-second external timeouts.`,
      `You get a definitive result in seconds—and built-in duplicate protection ensures retrying never accidentally creates identical posts on your profile. 🚀`
    ];
  } else if (update.id === "conversion-studio") {
    parts = [
      `Most posts lose readers on the last line with generic link dumps.\n\nConversion Studio now synthesizes low-friction keyword DM prompts and contextual next steps that invite conversation naturally. ✨`
    ];
  } else if (update.id === "calendar-scheduling-queue") {
    parts = [
      `Batch content planning should be effortless.\n\nThe publishing calendar now organizes your manuscripts into a visual timeline with automated queue pacing. Less manual scheduling, more time creating. 📅`
    ];
  } else {
    parts = [
      `${update.title} is now live in ThreadsWorks. 🧠\n\n${update.whatChanged}\n\n${update.creatorBenefit}`
    ];
  }

  const post = parts.join("\n\n");
  return {
    post,
    parts,
    theme: update.title
  };
}

// 5. Complete Report Pipeline
export async function buildProductUpdateReport(
  forceAll = false,
  regenerateOnly = false,
  existingReport: ProductUpdateReport | null = null
): Promise<ProductUpdateReport> {
  let updates: ProductUpdate[] = [];

  if (regenerateOnly && existingReport && existingReport.updates && existingReport.updates.length > 0) {
    updates = existingReport.updates;
  } else {
    const allFiles = scanWorkspaceCodeFiles(".");
    allFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const relevantFiles = allFiles.filter(f =>
      (f.path.startsWith("src/") || f.path.startsWith("server/") || f.path === "server.ts") &&
      !f.path.includes("test-") &&
      !f.path.endsWith(".d.ts")
    );

    const lastTime = (existingReport?.lastProcessedAt && !forceAll)
      ? new Date(existingReport.lastProcessedAt).getTime()
      : 0;

    let changed = relevantFiles.filter(f => f.mtime.getTime() > lastTime);
    if (changed.length === 0 || forceAll) {
      changed = relevantFiles.slice(0, 10);
    }

    updates = groupFilesIntoProductUpdates(changed);
  }

  const primaryUpdate = selectPrimaryUpdate(updates) || updates[0];
  const audienceUpdates = updates.filter(u => u.relevanceScore === "HIGH" || u.relevanceScore === "MEDIUM");

  const { post, parts, theme } = await generateProductUpdatePost(primaryUpdate, audienceUpdates);

  const report: ProductUpdateReport = {
    updates,
    primaryUpdateId: primaryUpdate.id,
    theme,
    generatedPost: post,
    generatedParts: parts,
    lastProcessedAt: new Date().toISOString(),
    lastChangePostGeneratedAt: new Date().toISOString(),
    lastProcessedFiles: updates.flatMap(u => u.sourceFiles),
    totalFilesScanned: updates.reduce((acc, u) => acc + u.sourceFiles.length, 0)
  };

  return report;
}
