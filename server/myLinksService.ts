import fs from "fs";
import { ContentDestination } from "../src/types";

export function logDebug(msg: string) {
  try {
    fs.appendFileSync("/tmp/mylinks_debug.log", msg + "\n");
  } catch (_) {}
}

export interface LinkMatchResult {
  destination: ContentDestination;
  reason: string;
}

export interface PostLinkReport {
  postIndex: number;
  partNumber: number | null;
  hasCta: boolean;
  ctaText: string;
  selectedDestination: ContentDestination | null;
  exactUrl: string | null;
  matchReason: string | null;
}

const DEFAULT_DESTINATIONS: ContentDestination[] = [
  {
    id: "create",
    name: "Create Content",
    url: "https://threadsworks.com/create",
    purpose: "Start creating content with ThreadsWorks post builder"
  },
  {
    id: "pricing",
    name: "ThreadsWorks Pro",
    url: "https://threadsworks.com/pricing",
    purpose: "Upgrade or learn about ThreadsWorks Pro pricing and plans"
  },
  {
    id: "content_pays_you",
    name: "Content Pays You",
    url: "https://contentpaysyou.com",
    purpose: "Learn more about Content Pays You creator ecosystem and strategy"
  }
];

export function selectBestDestination(
  post: any,
  destinations: ContentDestination[],
  usageCounts: Map<string, number> = new Map()
): LinkMatchResult | null {
  const effectiveDests = Array.isArray(destinations) && destinations.length > 0 ? destinations : DEFAULT_DESTINATIONS;
  const validDests = effectiveDests.filter(d => d && typeof d.url === "string" && d.url.trim().length > 0 && /^https?:\/\//i.test(d.url.trim()));
  if (validDests.length === 0) {
    return { destination: DEFAULT_DESTINATIONS[0], reason: "Defaulted to fallback destination" };
  }

  const parts: string[] = Array.isArray(post.threadParts) && post.threadParts.length > 0
    ? post.threadParts
    : (Array.isArray(post.parts) && post.parts.length > 0 ? post.parts : [post.singlePost || ""]);

  const title = (post.title || "").toLowerCase();
  const topic = (post.topic || post.idea || "").toLowerCase();
  const angle = (post.angle || post.strategicLens || "").toLowerCase();
  const cta = (post.cta || "").toLowerCase();
  const bodyText = parts.join(" ").toLowerCase();
  const combinedPostText = `${title} ${topic} ${angle} ${cta} ${bodyText}`;

  const PRICING_KEYWORDS = ["pricing", "price", "pro", "upgrade", "subscribe", "paid", "plan", "monthly", "tier", "$7", "checkout", "buy", "membership"];
  const CREATE_KEYWORDS = ["create", "creation", "start", "app", "tool", "workflow", "draft", "write", "builder", "generate", "turn idea", "blank page"];

  let bestDest: ContentDestination | null = null;
  let highestScore = -100;
  let bestReason = "";

  for (const dest of validDests) {
    let score = 0;
    const name = (dest.name || "").toLowerCase();
    const url = (dest.url || "").toLowerCase();
    const purpose = (dest.purpose || "").toLowerCase();
    const combinedDestText = `${name} ${url} ${purpose}`;

    let categoryMatch = false;

    if (PRICING_KEYWORDS.some(k => name.includes(k) || url.includes(k) || purpose.includes(k))) {
      if (PRICING_KEYWORDS.some(k => combinedPostText.includes(k))) {
        score += 15;
        categoryMatch = true;
      }
    }

    if (CREATE_KEYWORDS.some(k => name.includes(k) || url.includes(k) || purpose.includes(k))) {
      if (CREATE_KEYWORDS.some(k => combinedPostText.includes(k))) {
        score += 15;
        categoryMatch = true;
      }
    }

    const destWords = combinedDestText.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length > 3);
    for (const word of destWords) {
      if (combinedPostText.includes(word)) {
        score += 3;
      }
    }

    const usage = usageCounts.get(dest.url.trim()) || 0;
    const diversityPenalty = usage * 6;
    const finalScore = score - diversityPenalty;

    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestDest = dest;

      if (categoryMatch) {
        bestReason = `Matched intent between post subject and saved link '${dest.name}'`;
      } else {
        bestReason = `Selected highest-relevance saved destination '${dest.name}' with batch diversity preference`;
      }
    }
  }

  if (!bestDest) {
    bestDest = validDests[0];
    bestReason = `Defaulted to primary saved link '${bestDest.name}'`;
  }

  return {
    destination: bestDest,
    reason: bestReason
  };
}

export function resolveDestination(
  post: any,
  destinations: ContentDestination[],
  usageCounts: Map<string, number> = new Map()
): LinkMatchResult | null {
  const effectiveDests = Array.isArray(destinations) && destinations.length > 0 ? destinations : DEFAULT_DESTINATIONS;
  const validDests = effectiveDests.filter(d => d && typeof d.url === "string" && d.url.trim().length > 0 && /^https?:\/\//i.test(d.url.trim()));
  if (validDests.length === 0) return { destination: DEFAULT_DESTINATIONS[0], reason: "Defaulted to fallback destination" };

  if (post.preferredLinkId) {
    const matchedById = validDests.find(d => d.id === post.preferredLinkId || d.name?.toLowerCase().includes(post.preferredLinkId.toLowerCase()));
    if (matchedById) {
      return { destination: matchedById, reason: `Matched explicit preferredLinkId '${post.preferredLinkId}'` };
    }
  }

  return selectBestDestination(post, validDests, usageCounts);
}

/**
 * Applies exact YOUR LINKS destination to a post, ensuring full saved links are included in generated content output.
 */
export function applyMyLinksToPost(
  post: any,
  destinations: ContentDestination[],
  usageCounts: Map<string, number> = new Map()
): {
  repairedPost: any;
  linkReport: PostLinkReport;
} {
  const urlRegex = /https?:\/\/[^\s)]+/gi;
  const postId = post.id || post.planId || "post_unknown";
  const postIndex = post.postIndex || 1;
  const effectiveDestinations = Array.isArray(destinations) && destinations.length > 0 ? destinations : DEFAULT_DESTINATIONS;

  let parts: string[] = Array.isArray(post.threadParts) && post.threadParts.length > 0
    ? [...post.threadParts]
    : (Array.isArray(post.parts) && post.parts.length > 0 ? [...post.parts] : [post.singlePost || ""]);

  const hookText = (parts[0] || post.hook || "").trim();

  // Strip all existing URLs and CTA debris from earlier parts
  for (let i = 0; i < parts.length; i++) {
    parts[i] = (parts[i] || "")
      .replace(urlRegex, "")
      .replace(/\b(?:Link:|URL:|Website:|Resource:)\s*$/gim, "")
      .trim();

    // If subsequent part accidentally repeats the Part 1 hook block, strip it
    if (i > 0 && hookText.length > 15) {
      const pLower = parts[i].toLowerCase();
      const hLower = hookText.toLowerCase();
      if (pLower.startsWith(hLower)) {
        parts[i] = parts[i].slice(hookText.length).replace(/^[:.\s\n]+/, "").trim();
      }
    }
  }

  const cleanPostOfCompetingCtas = (text: string, isAttachingDestinationCta: boolean = false): string => {
    let clean = text
      .replace(urlRegex, "")
      .replace(/(?:^|\n|\.\s+|!\s+|\?\s*|\s+)(?:reply|comment|drop)\s+['"]?[A-Za-z0-9_-]{1,}['"]?[^.\n!]*[.!?]?/gi, "")
      .replace(/(?:want\s+to\s+see|if\s+you\s+want|want\s+to\s+set\s+up|want\s+to\s+build)\s+[^.\n]*(?:drop|reply|comment)\s+[A-Za-z0-9_-]+[^.\n!]*[.!?]?/gi, "")
      .replace(/\b(?:drop|reply|comment)\s+a?\s*(?:comment|reply|dm|below|system|pipeline|blueprint|keyword)?[.!?]?\s*$/gi, "")
      .replace(/\b(?:drop|reply|comment)\s+[A-Za-z0-9_-]{1,}\s+(?:below|to\s+get|for\s+the|and\s+I|if\s+you)[^.\n!]*[.!?]?/gi, "")
      .replace(/\bdrop\s+[A-Za-z0-9_-]{1,}\s+below[.!?]?/gi, "")
      .replace(/\breply\s+[A-Za-z0-9_-]{1,}\s+(?:if|to|below)[^.\n!]*[.!?]?/gi, "")
      .replace(/\b(?:get\s+our\s+exact|if\s+you\s+want\s+our\s+exact|if\s+you\s+want\s+the)\s+[^.\n]*(?:blueprint|system|guide|setup)[.!?]?/gi, "")
      .replace(/If you want to (?:build your next post|turn your next idea|streamline how you go)[^.?!\n]*:?\s*/gi, "")
      .replace(/\bstart here:?\s*/gi, "")
      .replace(/(?:check\s+out|visit|explore|see|find|get)\s+(?:the\s+)?[a-zA-Z0-9\s_-]*(?:at|via|here:)\s*[a-zA-Z0-9.-]+\.(?:com|org|io|co|net)[.!?]?/gi, "")
      .replace(/\b(?:threadsworks\.com|contentpaysyou\.com)\b/gi, "")
      .replace(/\b(?:at|via|on|from)\s+[.:,]?\s*$/gi, "")
      .replace(/\b(?:at|via|on|from)\s+[.:,]?\s*(?=\n|$)/gi, "")
      .replace(/\bbelowif\b/gi, "below if")
      .replace(/\b(?:send\s+me\s+a\s+dm|dm\s+me|send\s+a\s+message|my\s+dms\s+are\s+open)[.!?]?/gi, "")
      .replace(/\b(?:Link|URL|Website|Resource):\s*$/gim, "")
      .trim();

    if (isAttachingDestinationCta) {
      clean = clean
        .replace(/(?:^|\n|\.\s+|!\s+)(?:What|How|Which|Do|Have|Did|Are|Can|Could|Would)\b[^.!?\n]*\?\s*$/i, "")
        .replace(/(?:^|\n|\.\s+|!\s+)(?:If you want|Let me know|Send me|Reach out|DM me|Message me|Share below|Comment below)\b[^.!\n]*[.!?]?\s*$/gi, "")
        .trim();
    }

    return clean;
  };

  // Determine whether post should receive a Destination CTA vs Natural Ending
  let shouldHaveDestinationCta = false;
  if (
    post.allowedCtaType === "destination_url" ||
    post.allowedCtaType === "destination_link" ||
    post.ctaType === "destination_url" ||
    post.ctaType === "destination_link" ||
    post.ctaType === "direct_link"
  ) {
    shouldHaveDestinationCta = true;
  } else if (
    post.allowedCtaType === "none" ||
    post.allowedCtaType === "value_question" ||
    post.allowedCtaType === "natural_ending" ||
    post.ctaType === "none" ||
    post.ctaType === "value_question" ||
    post.ctaType === "natural_ending"
  ) {
    shouldHaveDestinationCta = false;
  } else if (post.ctaDecision) {
    shouldHaveDestinationCta = post.ctaDecision === "include";
  } else {
    // Default balanced distribution: post 2, 4, 6 (1-indexed) receive destination link
    shouldHaveDestinationCta = postIndex === 2 || postIndex === 4 || postIndex === 6;
  }

  if (!shouldHaveDestinationCta) {
    // Natural ending: strip all competing CTAs, keyword triggers, and promotional URLs
    for (let i = 0; i < parts.length; i++) {
      parts[i] = cleanPostOfCompetingCtas(parts[i], false);
    }
    const cleanParts = parts.filter(p => p.length > 0);
    const finalParts = cleanParts.length > 0 ? cleanParts : [parts[0] || hookText];

    return {
      repairedPost: {
        ...post,
        singlePost: finalParts[0],
        threadParts: finalParts,
        parts: finalParts,
        cta: ""
      },
      linkReport: {
        postIndex,
        partNumber: parts.findIndex(p => /\?/.test(p) || /share below|let me know|what do you|which /i.test(p)) >= 0 ? parts.findIndex(p => /\?/.test(p) || /share below|let me know|what do you|which /i.test(p)) + 1 : null,
        hasCta: parts.some(p => /\?/.test(p) || /share below|let me know|what do you|which /i.test(p)),
        ctaText: (() => {
          const matchingPart = parts.find(p => /\?/.test(p) || /share below|let me know|what do you|which /i.test(p));
          if (!matchingPart) return "";
          const sentences = matchingPart.split(/(?<=[.!?])\s+/);
          return sentences.find(s => /\?/.test(s) || /share below|let me know|what do you|which /i.test(s)) || matchingPart;
        })(),
        selectedDestination: null,
        exactUrl: null,
        matchReason: parts.some(p => /\?/.test(p)) ? "Natural ending with conversational engagement question" : "Natural ending without destination CTA"
      }
    };
  }

  // Post has destination CTA: resolve best matching Your Links record
  const matchResult = resolveDestination(post, effectiveDestinations, usageCounts);
  const selectedDest = matchResult ? matchResult.destination : effectiveDestinations[0];

  const storedUrl = (
    selectedDest.url ||
    (selectedDest as any).link ||
    (selectedDest as any).href ||
    (selectedDest as any).targetUrl ||
    ""
  ).trim();

  const exactUrl = storedUrl.startsWith("http")
    ? storedUrl
    : (storedUrl ? `https://${storedUrl}` : (DEFAULT_DESTINATIONS[0].url));

  const linkName = (selectedDest.name || selectedDest.id || "ThreadsWorks").trim();
  const resolvedLinkId = selectedDest.id || linkName;

  // Exact CTA assembly as mandated: "If you want to build your next post with [Name], start here:\n\n[FULL SAVED URL]"
  const finalCta = `If you want to build your next post with ${linkName}, start here:\n\n${exactUrl}`;

  // Clean all parts of competing CTAs, keyword triggers, raw domain mentions, and questions
  for (let i = 0; i < parts.length; i++) {
    parts[i] = cleanPostOfCompetingCtas(parts[i], i === parts.length - 1);
  }

  let targetPartIdx = 0;

  const maxProseLen = 500 - finalCta.length - 2;

  const condenseProseToFit = (prose: string, maxLen: number): string => {
    if (prose.length <= maxLen) return prose;
    const sentences = prose.split(/(?<=[.!?])\s+/);
    let acc = "";
    for (const s of sentences) {
      if ((acc + (acc ? " " : "") + s).trim().length <= maxLen) {
        acc = (acc + (acc ? " " : "") + s).trim();
      } else {
        break;
      }
    }
    if (acc.length >= 20) return acc;
    let cut = prose.slice(0, maxLen).replace(/\s+\S*$/, "").trim();
    if (!/[.!?]$/.test(cut)) cut += ".";
    return cut;
  };

  if (parts.length === 1) {
    const singleClean = parts[0];
    if (singleClean.length + finalCta.length + 2 <= 500) {
      parts = [`${singleClean}\n\n${finalCta}`];
      targetPartIdx = 0;
    } else {
      const condensed = condenseProseToFit(singleClean, maxProseLen);
      parts = [`${condensed}\n\n${finalCta}`];
      targetPartIdx = 0;
    }
  } else {
    const lastIdx = parts.length - 1;
    const cleanLastBody = parts[lastIdx];

    if (!cleanLastBody) {
      parts[lastIdx] = finalCta;
      targetPartIdx = lastIdx;
    } else if (cleanLastBody.length + finalCta.length + 2 <= 500) {
      parts[lastIdx] = `${cleanLastBody}\n\n${finalCta}`;
      targetPartIdx = lastIdx;
    } else {
      const condensed = condenseProseToFit(cleanLastBody, maxProseLen);
      parts[lastIdx] = `${condensed}\n\n${finalCta}`;
      targetPartIdx = lastIdx;
    }
  }

  // Guarantee across all parts that finalCta / URL is present ONLY ONCE
  let seenUrlCount = 0;
  for (let i = 0; i < parts.length; i++) {
    if (i !== targetPartIdx) {
      parts[i] = parts[i].replace(urlRegex, "").trim();
    } else {
      seenUrlCount++;
    }
  }

  logDebug(JSON.stringify({
    postId,
    ctaType: "destination",
    ctaText: finalCta,
    resolvedLinkId,
    resolvedUrl: exactUrl,
    partIndexInserted: targetPartIdx + 1,
    finalPartText: parts[targetPartIdx],
    finalPartLength: parts[targetPartIdx].length
  }));

  return {
    repairedPost: {
      ...post,
      singlePost: parts[0],
      threadParts: parts,
      parts: parts,
      cta: finalCta
    },
    linkReport: {
      postIndex,
      partNumber: targetPartIdx + 1,
      hasCta: true,
      ctaText: finalCta,
      selectedDestination: selectedDest,
      exactUrl: exactUrl,
      matchReason: matchResult ? matchResult.reason : `Selected saved destination '${linkName}'`
    }
  };
}

export function applyMyLinksToBatch(
  posts: any[],
  destinations: ContentDestination[]
): {
  posts: any[];
  reports: PostLinkReport[];
  urlStats: Record<string, number>;
} {
  const processedPosts: any[] = [];
  const reports: PostLinkReport[] = [];
  const usageCounts = new Map<string, number>();

  for (let i = 0; i < posts.length; i++) {
    const rawPost = { ...posts[i], postIndex: i + 1 };
    const { repairedPost, linkReport } = applyMyLinksToPost(rawPost, destinations, usageCounts);
    linkReport.postIndex = i + 1;
    processedPosts.push(repairedPost);
    reports.push(linkReport);

    if (linkReport.exactUrl) {
      const current = usageCounts.get(linkReport.exactUrl) || 0;
      usageCounts.set(linkReport.exactUrl, current + 1);
    }
  }

  const urlStats: Record<string, number> = {};
  for (const [url, count] of usageCounts.entries()) {
    urlStats[url] = count;
  }

  return {
    posts: processedPosts,
    reports,
    urlStats
  };
}
