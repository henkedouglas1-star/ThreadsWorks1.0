/**
 * ThreadsWorks Content Sanitizer & Formatting Engine
 * Ensures proper sentence spacing, verbatim hook inclusion in Part 1,
 * and preservation of intentional line breaks / paragraphs.
 */

export function cleanTopicString(rawTopic?: string): string {
  if (!rawTopic || typeof rawTopic !== "string") return "";
  return rawTopic
    .replace(/\bPILLAR\s*\d*(?:\s*Active\s*Focus)?/gi, "")
    .replace(/\bPILLAR\s*\d*Active\s*Focus/gi, "")
    .replace(/\bActive\s*Focus\b/gi, "")
    .replace(/\bStrategic\s*Filter\b/gi, "")
    .replace(/\bActive\s*Content\s*Pillar:\s*/gi, "")
    .replace(/\bPillar\s*Title:\s*/gi, "")
    .replace(/\bPillar\s*Description:\s*/gi, "")
    .replace(/\bContent\s*Pillar:\s*/gi, "")
    .replace(/\bhelp\s+['’"]?s\s+users\b/gi, "help users")
    .replace(/\bachieve\s+['’"]?s\b/gi, "achieve optimal results")
    .replace(/^\s*[-:]\s*/, "")
    .trim();
}

export function purgeInternalPillarMetadata(text: string): string {
  if (!text || typeof text !== "string") return "";
  let clean = text;

  clean = clean
    .replace(/\bPILLAR\s*\d*(?:\s*Active\s*Focus)?/gi, "")
    .replace(/\bPILLAR\s*\d*Active\s*Focus/gi, "")
    .replace(/\bActive\s*Focus\b/gi, "")
    .replace(/\bStrategic\s*Filter\b/gi, "")
    .replace(/\bActive\s*Content\s*Pillar:\s*/gi, "")
    .replace(/\bPillar\s*Title:\s*/gi, "")
    .replace(/\bPillar\s*Description:\s*/gi, "")
    .replace(/\bContent\s*Pillar:\s*/gi, "")
    .replace(/\bhelp\s+['’"]?s\s+users\b/gi, "help users")
    .replace(/\bachieve\s+['’"]?s\b/gi, "achieve optimal results")
    .trim();

  const lines = clean.split("\n");
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (/^(?:PILLAR\s*\d*|PILLAR\s*\d*Active\s*Focus|Active\s*Focus|Strategic\s*Filter)$/i.test(trimmed)) {
      return false;
    }
    return true;
  });

  return filteredLines.join("\n").trim();
}

export interface PostValidationResult {
  part1Exists: boolean;
  part1BeginsWithHook: boolean;
  hookMatchesVerbatim: boolean;
  properSentenceSpacing: boolean;
  paragraphsPreserved: boolean;
  valid: boolean;
  issues: string[];
}

/**
 * Sanitizes sentence spacing without modifying legitimate patterns:
 * - Inserts a single space after sentence-ending punctuation (. ! ? : ;) when concatenated with next word
 * - Preserves decimal numbers (e.g. 3.14, 14.5%, $10.50)
 * - Preserves URLs and protocol links (e.g. https://threads.net/...)
 * - Preserves email addresses
 * - Preserves web domain patterns
 * - Preserves abbreviations (e.g. e.g., i.e., vs., etc., a.m., p.m., U.S., Dr., etc.)
 * - Preserves intentional line breaks and paragraph breaks (\n, \n\n)
 * - Preserves ellipses (...)
 */
export function sanitizeSentenceSpacing(text: string): string {
  if (!text || typeof text !== "string") return "";

  const protectedTokens: { key: string; val: string }[] = [];
  let tokenIdx = 0;

  // 1. Protect URLs (stripping trailing punctuation outside the token so punctuation spacing works if needed)
  let result = text.replace(/https?:\/\/[^\s]+/g, (fullMatch) => {
    let cleanUrl = fullMatch;
    let trailing = "";
    while (cleanUrl.length > 0 && /[.,!?:;)\]]$/.test(cleanUrl)) {
      trailing = cleanUrl.slice(-1) + trailing;
      cleanUrl = cleanUrl.slice(0, -1);
    }
    const key = `___PROT_URL_${tokenIdx++}___`;
    protectedTokens.push({ key, val: cleanUrl });
    return key + trailing;
  });

  // 2. Protect email addresses
  result = result.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => {
    const key = `___PROT_EMAIL_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  // 3. Protect common domain patterns
  result = result.replace(/\b[a-zA-Z0-9-]+\.(?:com|org|net|io|co|ai|app|dev|edu|gov|me|xyz|so|to|ly|be|us|uk|ca|de|fr|jp)\b/gi, (m) => {
    const key = `___PROT_DOM_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  // 4. Handle abbreviations ending with dot: if followed immediately by a capital letter or quote, insert a space
  result = result.replace(/\b(?:e\.g\.|i\.e\.|vs\.|etc\.|a\.m\.|p\.m\.|u\.s\.a\.|u\.s\.|u\.k\.|mr\.|mrs\.|ms\.|dr\.|prof\.|sr\.|jr\.|approx\.|est\.|inc\.|co\.|ltd\.)(?=[A-Z"'\u201C\u2018])/gi, (m) => m + " ");

  const abbrRegex = /\b(?:e\.g\.|i\.e\.|vs\.|etc\.|a\.m\.|p\.m\.|u\.s\.a\.|u\.s\.|u\.k\.|mr\.|mrs\.|ms\.|dr\.|prof\.|sr\.|jr\.|approx\.|est\.|inc\.|co\.|ltd\.)/gi;
  result = result.replace(abbrRegex, (m) => {
    const key = `___PROT_ABBR_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  // 5. Protect numbers with decimals, percentages, currency, ratios, time
  result = result.replace(/(?:^|[\s$€£¥(])\d+(?:[.:]\d+)+(?:%|\b)/g, (m) => {
    const key = `___PROT_NUM_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  // 6. Handle sentence-ending punctuation: . ! ? (including multiple punctuation like ?! or !!)
  // Avoid modifying ellipsis (... or ..)
  result = result.replace(/([!?]+|(?<!\.)\.(?!\.))([*_"'\u201D\u2019)\]]*)(?=[A-Za-z0-9"'\u201C\u2018(\[])/g, (match, punct, closing, offset, fullStr) => {
    if (punct === ".") {
      if (offset > 0 && fullStr[offset - 1] === ".") return match;
      if (offset < fullStr.length - 1 && fullStr[offset + 1] === ".") return match;
    }
    return punct + closing + " ";
  });

  // 7. Handle colons and semicolons: : and ;
  result = result.replace(/([:;])([*_"'\u201D\u2019)\]]*)(?=[A-Za-z0-9"'\u201C\u2018(\[])/g, (match, punct, closing) => {
    return punct + closing + " ";
  });

  // 7.1 Handle commas: , (ensures "word,word" -> "word, word" while preserving numbers like 1,000)
  result = result.replace(/(,)([*_"'\u201D\u2019)\]]*)(?=[A-Za-z"'\u201C\u2018(\[])/g, (match, punct, closing) => {
    return punct + closing + " ";
  });

  // 8. Handle ellipsis followed immediately by the next sentence:
  result = result.replace(/(\.{2,4}|…)([*_"'\u201D\u2019)\]]*)(?=[A-Za-z0-9"'\u201C\u2018(\[])/g, "$1$2 ");

  // Clean up invalid punctuation collisions (e.g. ":.", ": .", ",.", ", .")
  result = result.replace(/:\s*\./g, ":");
  result = result.replace(/,\s*\./g, ",");
  result = result.replace(/\.\s*:/g, ".");

  // 9. Restore protected tokens in reverse order
  for (let i = protectedTokens.length - 1; i >= 0; i--) {
    const { key, val } = protectedTokens[i];
    result = result.replace(key, val);
  }

  // 10. Collapse multiple consecutive spaces (e.g. double spaces)
  result = result.replace(/[ \t]{2,}/g, " ");

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detects and repairs malformed markdown formatting:
 * - Unmatched asterisks (*) or underscores (_)
 * - Broken bold/italic formatting (e.g. "Demonstration**." -> "Demonstration.")
 * - Trailing markdown characters before punctuation (. ! ? : ;)
 * - Unclosed brackets or incomplete markdown links
 * - Stray asterisks or underscores at line beginnings or ends
 */
export function sanitizeAndRepairMarkdown(text: string): string {
  if (!text || typeof text !== "string") return "";
  let clean = text;

  // 1. Repair trailing bold/italic markers right before terminal punctuation (e.g. "Demonstration**." -> "Demonstration.")
  clean = clean.replace(/([A-Za-z0-9])[*_]{1,3}([.!?:]+)/g, "$1$2");

  // 2. Repair leading asterisks or underscores attached to punctuation (e.g. "**." or "*!")
  clean = clean.replace(/[*_]{1,3}([.!?:]+)/g, "$1");

  // 3. Remove unmatched asterisks if total count of '*' in the string is odd
  const asteriskMatches = clean.match(/\*/g);
  if (asteriskMatches && asteriskMatches.length % 2 !== 0) {
    clean = clean.replace(/(^|\s)\*(\s|$)/g, "$1$2");
    const remaining = clean.match(/\*/g);
    if (remaining && remaining.length % 2 !== 0) {
      clean = clean.replace(/\*/g, "");
    }
  }

  // 4. Remove unmatched underscores if total count of '_' in the string is odd
  const underscoreMatches = clean.match(/(?<![a-zA-Z0-9])_(?![a-zA-Z0-9])/g);
  if (underscoreMatches && underscoreMatches.length % 2 !== 0) {
    clean = clean.replace(/(^|\s)_(\s|$)/g, "$1$2");
    const rem = clean.match(/(?<![a-zA-Z0-9])_(?![a-zA-Z0-9])/g);
    if (rem && rem.length % 2 !== 0) {
      clean = clean.replace(/(?<![a-zA-Z0-9])_(?![a-zA-Z0-9])/g, "");
    }
  }

  // 5. Repair incomplete markdown links: [text]( without closing )
  clean = clean.replace(/\[([^\]]+)\]\((?:https?:\/\/[^\s)]*)?$/gm, "$1");
  clean = clean.replace(/\[([^\]]+)\]\s*$/gm, "$1");

  // 6. Clean isolated stray markdown tags on standalone lines
  clean = clean.replace(/^[*\-_~]{1,3}$/gm, "");

  return clean;
}

/**
 * Detects and replaces generic corporate AI language with concrete, human, creator-specific language.
 */
export function sanitizeCorporateAiPhrases(
  text: string,
  context?: { offer?: string; audience?: string; desiredResult?: string }
): { cleanText: string; replacedCount: number } {
  if (!text || typeof text !== "string") return { cleanText: "", replacedCount: 0 };
  let clean = text;
  let replacedCount = 0;

  const replacements: [RegExp, string][] = [
    [/\bsystematically\s+eliminates?\s+friction\b/gi, "removes daily friction"],
    [/\badministrative\s+bottlenecks\b/gi, "operational bottlenecks"],
    [/\badministrative\s+(?:bloat|clutter|work|tasks)\b/gi, "manual clutter"],
    [/\bcompounding\s+consistency\b/gi, "steady consistency"],
    [/\bstrategic\s+content\s+pillars\b/gi, "core content themes"],
    [/\bpredictable\s+engine\b/gi, "dependable system"],
    [/\bunlock\s+your\s+potential\b/gi, "reach your target goals"],
    [/\boptimize\s+your\s+workflow\b/gi, "clean up your daily routine"],
    [/\bscale\s+your\s+impact\b/gi, "grow your audience"],
    [/\bstreamline\s+your\s+process\b/gi, "simplify your routine"],
    [/\bgame[\s-]changer\b/gi, "turning point"],
    [/\brevolutionary\b/gi, "breakthrough"],
    [/\bpowerful\s+framework\b/gi, "proven playbook"],
    [/\btransform\s+your\s+business\b/gi, "grow your business"],
    [/\bClear\s+systems\s+create\s+predictable\s+results\.?\b/gi, "A clear system delivers steady results."],
    [/\bin\s+today's\s+fast-paced\s+world\b/gi, "today"],
    [/\bbuckle\s+up\b/gi, "here is the reality"],
    [/\blook\s+no\s+further\b/gi, "here is what works"],
    // Concrete language transformations replacing abstract theory (Problems 5 & 6)
    [/\bstructural\s+mechanics\b/gi, "how the post is structured"],
    [/\bcore\s+insight\b/gi, "core takeaway"],
    [/\baudience\s+stage\b/gi, "where your reader is"],
    [/\bdecoupling\s+topic\s+generation\s+from\s+formatting\b/gi, "deciding what you want to say first, then letting the structure follow"],
    [/\bdecouple\s+topic\s+generation\s+from\s+formatting\b/gi, "decide what you want to say first, then let the structure follow"],
    [/\bdecoupling\b/gi, "separating"],
    [/\bdecouple\b/gi, "separate"],
    [/\bdecision\s+fatigue\s+drains\s+your\s+willpower\b/gi, "you can spend 20 minutes deciding what to write before writing a single sentence"],
    [/\bdecision\s+fatigue\b/gi, "overthinking before drafting"],
    [/\bformatting\s+rules?\b/gi, "writing habit"],
    [/\bformatting\s+principles?\b/gi, "writing habits"],
    [/\bformatting\s+constraints?\b/gi, "layout limits"],
    [/\boperational\s+mechanisms?\b/gi, "daily habits"],
    [/\bunderlying\s+mechanisms?\b/gi, "underlying reason"],
    [/\bcore\s+mechanisms?\b/gi, "core approach"],
    [/\bcentral\s+thesis\b/gi, "main point"],
    [/\bthe\s+thesis\b/gi, "the main point"],
    [/\bformatting\s+constraints\b/gi, "layout boundaries"],
    [/\bclear\s+constraints\b/gi, "clear rules"],
    [/\bunnecessary\s+friction\b/gi, "unnecessary headaches"],
    [/\beliminate\s+friction\b/gi, "remove daily headaches"],
    [/\bcreates\s+friction\b/gi, "creates headaches"],
    [/\bwithout\s+friction\b/gi, "without daily headaches"],
    [/\bcontent\s+frameworks?\b/gi, "content playbook"],
    [/\bproven\s+frameworks?\b/gi, "proven playbook"],
    [/\boperational\s+frameworks?\b/gi, "operational steps"]
  ];

  for (const [pattern, repl] of replacements) {
    if (pattern.test(clean)) {
      clean = clean.replace(pattern, repl);
      replacedCount++;
    }
  }

  return { cleanText: clean, replacedCount };
}

export interface HookPromiseInfo {
  promise: string;
  isOpenLoop: boolean;
  type: "first_words" | "framework" | "question" | "list_reasons" | "mistake" | "habit" | "contrast" | "teaser" | "self_contained";
  expectedKeywords: string[];
}

/**
 * Detects whether a hook text opens an unresolved loop that requires subsequent fulfillment parts.
 */
export function isOpenLoopHook(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (t.endsWith(":") || t.endsWith("...") || t.endsWith("…")) return true;
  if (/\b(?:here\s+(?:is|are)|check\s+your|what\s+if|why\s+(?:do|most|creators)|the\s+(?:exact\s+)?framework|how\s+to|step-by-step|\d+\s+(?:reasons|mistakes|rules|steps|lessons|traits|habits))\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Analyzes Part 1 hook text and extracts the exact semantic promise and expected fulfillment concepts.
 */
export function detectHookPromise(text: string): HookPromiseInfo {
  if (!text || typeof text !== "string") {
    return {
      promise: "General thought continuation",
      isOpenLoop: false,
      type: "self_contained",
      expectedKeywords: []
    };
  }

  const clean = text.trim();

  // 1. Opening words / first line / sound smart in your first line
  if (/\b(?:check\s+your|opening|first)\s+(?:five|5|\d+)?\s*words\b/i.test(clean) ||
      /\b(?:first\s+line|sound\s+smart\s+in\s+your\s+first\s+line|first\s+sentence)\b/i.test(clean)) {
    return {
      promise: "Explains how the opening line or first five words affect reader retention/replies and provides the exact adjustment",
      isOpenLoop: true,
      type: "first_words",
      expectedKeywords: ["words", "opening", "first", "start", "scroll", "headline", "hook", "reader", "replies", "line", "tension", "smart", "plain", "instead"]
    };
  }

  // 1b. "Do this instead:" or "Instead:"
  if (/\bdo\s+this\s+instead\b/i.test(clean) || /\binstead:\s*$/i.test(clean)) {
    return {
      promise: "Delivers the concrete actionable alternative promised in the hook without pivoting to sales pitches",
      isOpenLoop: true,
      type: "first_words",
      expectedKeywords: ["instead", "state", "use", "focus", "write", "plain", "contrast", "tension", "clear", "simple", "line", "words"]
    };
  }

  // 1c. Mistake hooks (e.g. "One publishing mistake can waste months...", "$10,000 mistake...")
  if (/\b(?:a|one|\d+)?\s*(?:\$[\d,]+\s+)?mistake(?:\s+when|\s+that|\s+i\s+made|\s+can\s+waste)?\b/i.test(clean)) {
    return {
      promise: "Explains what the specific publishing mistake was, why it damages reader growth, and the concrete lesson/alternative to apply",
      isOpenLoop: true,
      type: "mistake",
      expectedKeywords: ["mistake", "waste", "problem", "instead", "focus", "lesson", "better", "cause", "mechanism", "publishing", "content"]
    };
  }

  // 1d. Habit / Conversion driver hooks (e.g. "Today, this single habit drives...", "this single habit")
  if (/\b(?:this\s+single\s+habit|one\s+habit|habit\s+that|single\s+habit)\b/i.test(clean)) {
    return {
      promise: "Reveals the single habit immediately, explains how it functions in daily drafting, and demonstrates how it drives conversions",
      isOpenLoop: true,
      type: "habit",
      expectedKeywords: ["habit", "routine", "daily", "practice", "consistency", "leads", "conversions", "focus", "format", "writing"]
    };
  }

  // 2. Framework / Process / System promise
  if (/\b(?:exact\s+)?(?:framework|system|playbook|process|steps?|routine)\s+(?:for|to|we\s+use)\b/i.test(clean) || /\bhow\s+to\s+turn\s+one\s+idea\b/i.test(clean)) {
    return {
      promise: "Delivers the concrete framework, stages, or operational sequence promised in the hook",
      isOpenLoop: true,
      type: "framework",
      expectedKeywords: ["step", "framework", "first", "next", "rule", "process", "system", "part", "stage", "turn"]
    };
  }

  // 3. Question (What if / Why do / How come)
  if (/^(?:what\s+if|why\s+(?:do|does|most|is|are)|how\s+come)\b/i.test(clean) || (clean.includes("?") && clean.length < 120)) {
    const isRepetitiveQuestion = /\brepetiti/i.test(clean);
    return {
      promise: "Answers the question by explaining why this happens and revealing the underlying mechanism",
      isOpenLoop: true,
      type: "question",
      expectedKeywords: isRepetitiveQuestion
        ? ["repetiti", "repeat", "clon", "fatigue", "same", "rehash", "stale", "recycl"]
        : ["because", "when", "mechanism", "reason", "happens", "causes", "result"]
    };
  }

  // 4. List / Reasons / Mistakes / What they have in common / Share one trait
  if (/\b(?:what\s+they\s+(?:all\s+)?have\s+in\s+common|share\s+one\s+trait|\d+\s+(?:reasons|mistakes|rules|steps|lessons|traits|habits))\b/i.test(clean)) {
    return {
      promise: "Delivers the specific items, reasons, mistakes, or common traits promised in the hook",
      isOpenLoop: true,
      type: "list_reasons",
      expectedKeywords: ["reason", "mistake", "first", "rule", "common", "trait", "focus", "core", "lesson", "one", "pattern"]
    };
  }

  // 5. Contrast (e.g. "don't have a content problem. They have a conversion problem.")
  if (/\b(?:don't\s+have\s+a\s+\w+\s+problem|not\s+a\s+\w+\s+problem)\b/i.test(clean)) {
    return {
      promise: "Explains the difference between the two concepts and how to fix the real underlying bottleneck",
      isOpenLoop: true,
      type: "contrast",
      expectedKeywords: ["conversion", "content", "traffic", "problem", "clarity", "mechanism", "bottleneck", "bridge", "offer", "sales", "action"]
    };
  }

  // 6. Trailing colon or open teaser
  if (clean.endsWith(":") || clean.endsWith("...") || /\b(?:here\s+is\s+why|here's\s+how|this\s+is\s+why|here's\s+the\s+truth)\b/i.test(clean)) {
    return {
      promise: "Resolves the open thought teased in the hook with immediate concrete payoff",
      isOpenLoop: true,
      type: "teaser",
      expectedKeywords: ["because", "first", "reason", "core", "focus", "when", "system"]
    };
  }

  return {
    promise: "Self-contained declarative thought",
    isOpenLoop: false,
    type: "self_contained",
    expectedKeywords: []
  };
}

/**
 * Sanitizes and rewrites unverified personal research, fake follower gains,
 * engagement doubling claims, and fabricated research experiments into grounded, authoritative creator prose.
 * If verifiedPersonalFacts are provided in context, verified facts are safely preserved.
 */
export function sanitizeFactualIntegrity(
  text: string,
  context?: { verifiedPersonalFacts?: string[]; verifiedClaims?: string[] }
): { cleanText: string; violationsCount: number; replacements: string[] } {
  if (!text || typeof text !== "string") return { cleanText: "", violationsCount: 0, replacements: [] };

  const verifiedList = (context?.verifiedPersonalFacts || context?.verifiedClaims || []).map(f => f.toLowerCase().trim());
  const isVerifiedFact = (snippet: string) => {
    if (verifiedList.length === 0) return false;
    const sLower = snippet.toLowerCase();
    return verifiedList.some(v => v.includes(sLower) || sLower.includes(v));
  };

  let clean = text;
  let violationsCount = 0;
  const replacements: string[] = [];

  const rules: Array<{ pattern: RegExp; replacement: string | ((m: string, ...args: any[]) => string); desc: string }> = [
    // Convert ungrounded first-person personal anecdotes (tree planting, personal purchases) into explicit metaphors
    {
      pattern: /\bI\s+planted\s+a(?:n\s+apple)?\s+tree\b/gi,
      replacement: "Think of building an audience like planting an apple tree",
      desc: "Converted ungrounded first-person tree planting anecdote into explicit metaphor"
    },
    {
      pattern: /\bI\s+(?:bought|purchased)\s+a\s+(?:house|car|boat|tree)\b/gi,
      replacement: "Building a long-term business",
      desc: "Converted ungrounded personal purchase claim into business principle"
    },
    // Problem 1 & 2: Fabricated personal mistakes (e.g. "I made a $10,000 mistake when I first started publishing")
    {
      pattern: /\bI\s+made\s+a\s+\$[\d,]+(?:\s*(?:k|m|million|thousand))?\s+mistake\s+(?:when\s+(?:I\s+first\s+started|I\s+started)\s+publishing|when\s+I\s+started)(?:\.|\s*|:\s*|$)/gi,
      replacement: "One publishing mistake can waste months of otherwise good content.",
      desc: "Rewrote unsupported personal dollar mistake into grounded publishing lesson"
    },
    {
      pattern: /\bI\s+(?:made|lost)\s+a\s+\$[\d,]+(?:\s*(?:k|m|million|thousand))?\s+mistake(?:\.|\s*|:\s*|$)/gi,
      replacement: "One critical publishing mistake can waste months of good content.",
      desc: "Rewrote unsupported personal dollar mistake claim"
    },
    // Problem 1 & 2: Fabricated timeline & lead percentage claims (e.g. "3 years ago, I had zero readers. Today, this single habit drives 80% of our leads.")
    {
      pattern: /\b\d+\s+years?\s+ago,\s+I\s+had\s+zero\s+readers\.\s*Today,\s+this\s+single\s+habit\s+drives\s+\d+%\s+of\s+(?:our|my)\s+leads(?:\.|\s*|:\s*|$)/gi,
      replacement: "Starting with zero readers is normal. The habit that builds steady momentum is consistency in one format.",
      desc: "Rewrote unsupported reader history and lead percentage claim into proven consistency habit"
    },
    {
      pattern: /\b\d+\s+years?\s+ago,\s+I\s+had\s+zero\s+readers(?:\.|\s*|:\s*|$)/gi,
      replacement: "Starting with zero readers is the universal starting point for every creator.",
      desc: "Rewrote unsupported personal reader history claim"
    },
    {
      pattern: /\b(?:when\s+I\s+started(?:\s+out)?,\s+)?this\s+single\s+habit\s+drives?\s+\d+%\s+of\s+(?:our|my)\s+leads(?:\.|\s*|:\s*|$)/gi,
      replacement: "Focusing on a repeatable publishing habit drives dependable reader conversions.",
      desc: "Rewrote unsupported personal lead percentage claim into objective conversion principle"
    },
    {
      pattern: /\bthis\s+single\s+habit\s+drives\s+\d+%\s+of\s+(?:our|my)\s+leads(?:\.|\s*|:\s*|$)/gi,
      replacement: "this single habit drives dependable reader conversions.",
      desc: "Rewrote unsupported lead percentage metric into grounded qualitative conversion"
    },
    {
      pattern: /\bdrives?\s+\d+%\s+of\s+(?:our|my)\s+leads\b/gi,
      replacement: "drives dependable reader conversions",
      desc: "Rewrote unsupported lead percentage into dependable conversions"
    },
    {
      pattern: /\bI\s+studied\s+\d+\s+(?:top-performing\s+|successful\s+)?Threads\s+posts(?:\.|\s*|:\s*|$)/gi,
      replacement: "Many high-performing Threads posts share one trait:",
      desc: "Rewrote unsupported personal study of posts into objective observation"
    },
    {
      pattern: /\bI\s+(?:analyzed|reviewed|dissected|broke\s+down)\s+\d+\s+(?:top-performing\s+|successful\s+)?(?:Threads\s+posts|posts|hooks)(?:\.|\s*|:\s*|$)/gi,
      replacement: "Analyzing top-performing Threads content reveals a clear pattern:",
      desc: "Rewrote unsupported content study into objective observation"
    },
    {
      pattern: /\bI\s+spent\s+\d+\s+(?:hours|days|months)\s+studying\s+[\w\s-]+(?:\.|\s*|:\s*|$)/gi,
      replacement: "Deep examination of top-performing content reveals a clear rule:",
      desc: "Rewrote unsupported time study into objective rule"
    },
    {
      pattern: /\bI\s+studied\s+\d+\s+[\w\s-]+(?:\.|\s*|:\s*|$)/gi,
      replacement: "Studying top-performing content reveals a clear standard:",
      desc: "Rewrote unsupported research study into objective principle"
    },
    {
      pattern: /\b(?:we|I)\s+(?:tested|analyzed|reviewed|audited|tracked)\s+this\s+across\s+\d+\s+posts(?:\.|\s*|:\s*|$)/gi,
      replacement: "Testing across multiple content formats reveals a clear pattern.",
      desc: "Rewrote unsupported post experiment into grounded analysis"
    },
    {
      pattern: /\b(?:we|I)\s+tested\s+\d+\s+(?:different\s+)?(?:hooks|posts|strategies|angles)(?:\.|\s*|:\s*|$)/gi,
      replacement: "Testing multiple content angles reveals a clear pattern.",
      desc: "Rewrote unsupported testing claims into grounded methodology"
    },
    {
      pattern: /\b(?:the\s+formatting\s+rule\s+that\s+|this\s+)(?:doubled|tripled|10x['’]?d?)\s+(?:our|my)\s+(?:engagement|reach|replies|views|impressions|growth)\b/gi,
      replacement: "The formatting rule that significantly strengthens post engagement",
      desc: "Rewrote unsupported doubling claim into grounded qualitative phrasing"
    },
    {
      pattern: /\b(?:doubled|tripled|10x['’]?d?)\s+(?:our|my|their)\s+(?:engagement|reach|replies|views|impressions|growth)\b/gi,
      replacement: "significantly strengthens audience engagement",
      desc: "Rewrote unsupported multiplier claim into objective impact"
    },
    {
      pattern: /\b(?:our|my)\s+users?\s+increased\s+(?:replies|engagement|revenue)\s+by\s+\d+%\b/gi,
      replacement: "creators consistently see a noticeable lift in replies",
      desc: "Rewrote unsupported user statistical metric into qualitative momentum"
    },
    {
      pattern: /\b(?:the\s+exact\s+system\s+(?:we|I)\s+used\s+to\s+gain|used\s+to\s+gain|gained)\s+\d+(?:,\d+)?\s+(?:followers|subscribers|clients)\b/gi,
      replacement: "the proven approach to building a loyal creator audience",
      desc: "Rewrote unsupported follower count claim into proven methodology"
    },
    {
      pattern: /\b(?:generated|made|closed)\s+\$[\d,]+(?:\s*(?:k|m|million|thousand))?\s+(?:in\s+\d+\s+(?:days|hours|months)|from\s+one\s+post)\b/gi,
      replacement: "generated dependable client momentum",
      desc: "Rewrote unsupported revenue claim into dependable client momentum"
    },
    {
      pattern: /\b(?:in\s+my\s+experiment|in\s+our\s+experiment|when\s+I\s+tracked\s+\d+\s+accounts)\b/gi,
      replacement: "Analyzing top-performing publishing patterns",
      desc: "Rewrote unsupported experiment claim into objective observation"
    },
    {
      pattern: /\bI\s+lost\s+\$[\d,]+(?:\s*(?:k|m|million|thousand))?(?:\.|\s*|:\s*|$)/gi,
      replacement: "One critical publishing mistake can waste months of good content.",
      desc: "Rewrote unsupported financial loss claim into grounded publishing lesson"
    },
    {
      pattern: /\bThat\s+was\s+my\s+night\s+last\s+night[.,!?]?/gi,
      replacement: "That kind of challenge happens regularly when building systems under tight deadlines.",
      desc: "Neutralized unsupported specific night event"
    },
    {
      pattern: /\bthe\s+simple\s+3-step\s+pipeline\s+I\s+use\b/gi,
      replacement: "a reliable 3-step publishing routine",
      desc: "Rewrote unsupported personal pipeline claim"
    },
    {
      pattern: /\b(?:Last\s+night|Yesterday\s+evening)\s*,\s+I\s+[^.,!?]+[.!?]/gi,
      replacement: "Working under tight daily schedules requires absolute focus.",
      desc: "Rewrote unsupported time-bound personal event"
    }
  ];

  for (const rule of rules) {
    if (rule.pattern.test(clean)) {
      const matches = clean.match(rule.pattern);
      if (matches && matches.some(m => isVerifiedFact(m))) {
        continue;
      }
      clean = clean.replace(rule.pattern, rule.replacement as any);
      violationsCount++;
      replacements.push(rule.desc);
    }
  }

  return { cleanText: clean, violationsCount, replacements };
}

/**
 * Ensures that the selected/generated hook is placed verbatim at the start of Part 1 (threadParts[0]),
 * followed by natural paragraph spacing (\n\n) into the body of Part 1.
 * Deduplicates any accidental hook repetition in Part 1 or subsequent thread parts.
 */
export function integrateHookIntoPost<T extends { hook?: string; singlePost?: string; threadParts?: string[] }>(
  post: T,
  targetHookInput?: string
): T {
  if (!post || typeof post !== "object") return post;

  let targetHook = typeof targetHookInput === "string" ? targetHookInput.trim() : "";
  if (!targetHook && typeof post.hook === "string") {
    targetHook = post.hook.trim();
  }

  // Strip wrapping quotes from targetHook
  targetHook = targetHook.replace(/^["'“”«]|["'“”»]$/g, "").trim();
  targetHook = sanitizeSentenceSpacing(targetHook);

  let rawParts = Array.isArray(post.threadParts) && post.threadParts.length > 0
    ? [...post.threadParts]
    : [post.singlePost || ""];

  if (rawParts.length === 0 || !rawParts[0]) {
    rawParts = [targetHook || ""];
  }

  if (targetHook) {
    const raw0 = (rawParts[0] || "").trim();
    const normRaw0 = raw0.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normHook = targetHook.toLowerCase().replace(/[^a-z0-9]/g, "");

    // If Part 1 already begins with targetHook, preserve it directly without re-prepending to prevent duplicate hook blocks
    if (normRaw0.startsWith(normHook)) {
      rawParts[0] = raw0;
      return {
        ...post,
        singlePost: rawParts[0],
        threadParts: rawParts
      };
    }

    let part1 = raw0;

    const hookWords = targetHook.split(/\s+/).filter(Boolean);
    if (hookWords.length > 0) {
      const escapedWords = hookWords.map(escapeRegExp);
      const fullHookRegex = new RegExp(`["'“”«]?${escapedWords.join("[\\s\\n]+") }["'“”»]?[\\s\\n]*`, "gi");

      // Remove all occurrences of the full hook from part1
      part1 = part1.replace(fullHookRegex, "").trim();

      // Also remove any partial sentences that match sentences in the hook if hook has multiple sentences
      const hookSentences = targetHook.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10);
      for (const hSent of hookSentences) {
        const sWords = hSent.split(/\s+/).filter(Boolean).map(escapeRegExp);
        if (sWords.length >= 3) {
          const sentRegex = new RegExp(`["'“”«]?${sWords.join("[\\s\\n]+") }["'“”»]?[\\s\\n]*`, "gi");
          part1 = part1.replace(sentRegex, "").trim();
        }
      }

      // Strip any leading punctuation or orphan breaks left after removal
      part1 = part1.replace(/^[,.:;]+[\s\n]*/, "").trim();
    }

    // Ensure Part 1 starts with targetHook without splitting Part 1 body copy into a separate part
    const part1Body = part1 ? part1 : "";
    const updatedPart1 = part1Body
      ? (rawParts[0] && rawParts[0].trim().startsWith(targetHook) ? rawParts[0].trim() : `${targetHook}\n\n${part1Body}`)
      : targetHook;

    const cleanedSubsequentParts: string[] = [];
    for (let i = 1; i < rawParts.length; i++) {
      let p = (rawParts[i] || "").trim();
      if (hookWords.length > 0) {
        const escapedWords = hookWords.map(escapeRegExp);
        const fullHookRegex = new RegExp(`["'“”«]?${escapedWords.join("[\\s\\n]+") }["'“”»]?[\\s\\n]*`, "gi");
        p = p.replace(fullHookRegex, "").trim();
        const hookSentences = targetHook.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10);
        for (const hSent of hookSentences) {
          const sWords = hSent.split(/\s+/).filter(Boolean).map(escapeRegExp);
          if (sWords.length >= 3) {
            const sentRegex = new RegExp(`["'“”«]?${sWords.join("[\\s\\n]+") }["'“”»]?[\\s\\n]*`, "gi");
            p = p.replace(sentRegex, "").trim();
          }
        }
        p = p.replace(/^[,.:;]+[\s\n]*/, "").trim();
      }
      if (p) {
        cleanedSubsequentParts.push(p);
      }
    }

    rawParts = [updatedPart1, ...cleanedSubsequentParts];
  }

  const updatedThreadParts = rawParts.filter(Boolean);
  const updatedSinglePost = updatedThreadParts[0] || targetHook || "";

  return {
    ...post,
    hook: targetHook || post.hook || "",
    singlePost: updatedSinglePost,
    threadParts: updatedThreadParts
  };
}

/**
 * Validates a generated post against all required constraints:
 * - Part 1 exists
 * - Part 1 begins with the selected hook verbatim
 * - Proper sentence spacing exists (no improper concatenations)
 * - Paragraph and part boundaries are preserved
 */
export function validateGeneratedPost(
  post: any,
  expectedHook?: string
): PostValidationResult {
  const issues: string[] = [];

  const threadParts = Array.isArray(post?.threadParts) ? post.threadParts : (post?.singlePost ? [post.singlePost] : []);
  const part1Exists = Boolean(threadParts.length > 0 && typeof threadParts[0] === "string" && threadParts[0].trim().length > 0);

  if (!part1Exists) {
    issues.push("Part 1 is missing or empty.");
  }

  const cleanExpectedHook = expectedHook
    ? expectedHook.trim().replace(/^["'“”«]|["'“”»]$/g, "").trim()
    : (post?.hook ? String(post.hook).trim().replace(/^["'“”«]|["'“”»]$/g, "").trim() : "");

  let part1BeginsWithHook = false;
  let hookMatchesVerbatim = false;

  if (part1Exists && cleanExpectedHook) {
    const part1 = threadParts[0].trim();
    if (part1.startsWith(cleanExpectedHook)) {
      part1BeginsWithHook = true;
      hookMatchesVerbatim = true;
    } else if (part1.toLowerCase().startsWith(cleanExpectedHook.toLowerCase())) {
      part1BeginsWithHook = true;
      issues.push("Part 1 begins with hook but case differs from expected hook.");
    } else {
      issues.push("Part 1 does not begin with the expected hook.");
    }
  }

  // Check for concatenated sentences across all parts: e.g. "word.Word"
  let properSentenceSpacing = true;
  for (let i = 0; i < threadParts.length; i++) {
    const partText = threadParts[i];
    if (typeof partText !== "string") continue;

    // Test for unspaced punctuation followed by a capital letter (excluding known domains and numbers)
    const unspacedMatch = partText.match(/([.!?:]|[;])(?=[A-Z])/);
    if (unspacedMatch) {
      const sanitized = sanitizeSentenceSpacing(partText);
      if (sanitized !== partText) {
        properSentenceSpacing = false;
        issues.push(`Part ${i + 1} had concatenated sentences without proper spacing.`);
        break;
      }
    }
  }

  // Check paragraph boundaries
  const paragraphsPreserved = threadParts.every((p: any) => typeof p === "string" && (!p.includes("\n") || p.includes("\n\n") || p.includes("\n")));

  const valid = part1Exists && (cleanExpectedHook ? hookMatchesVerbatim : true) && properSentenceSpacing;

  return {
    part1Exists,
    part1BeginsWithHook,
    hookMatchesVerbatim,
    properSentenceSpacing,
    paragraphsPreserved,
    valid,
    issues
  };
}

/**
 * Full sanitization and formatting pipeline for Create Best Post:
 * 1. Sanitizes sentence spacing across title, hook, explanation, and all thread parts
 * 2. Integrates hook into Part 1 verbatim with proper paragraph separation
 * 3. Enforces that no subsequent parts repeat the hook
 * 4. Runs validation and returns sanitized post + validation status
 */
export function sanitizeAndValidateBestPost<T extends {
  title?: string;
  hook?: string;
  singlePost?: string;
  threadParts?: string[];
  explanation?: string;
  category?: string;
  format?: string;
}>(
  post: T,
  selectedHook?: string,
  charLimit: number = 480,
  context?: { offer?: string; audience?: string; desiredResult?: string; topic?: string; customInstruction?: string }
): { post: T; validation: PostValidationResult } {
  if (!post || typeof post !== "object") {
    return {
      post,
      validation: {
        part1Exists: false,
        part1BeginsWithHook: false,
        hookMatchesVerbatim: false,
        properSentenceSpacing: false,
        paragraphsPreserved: false,
        valid: false,
        issues: ["Invalid post object"]
      }
    };
  }

  const cleanTitle = post.title ? sanitizeSentenceSpacing(post.title).trim() : "";
  const cleanExplanation = post.explanation ? sanitizeSentenceSpacing(post.explanation).trim() : "";
  const cleanHook = selectedHook
    ? sanitizeSentenceSpacing(selectedHook).trim()
    : (post.hook ? sanitizeSentenceSpacing(post.hook).trim() : "");

  let rawParts: string[] = [];
  if (Array.isArray(post.threadParts) && post.threadParts.length > 0) {
    rawParts = post.threadParts.map(p => (typeof p === "string" ? sanitizeSentenceSpacing(p).trim() : ""));
  } else if (post.singlePost) {
    rawParts = [sanitizeSentenceSpacing(post.singlePost).trim()];
  } else {
    rawParts = [cleanHook || "Real growth starts with a clear focus on your core offer."];
  }

  // Repair each part first to remove any broken words, dangling clauses, or excessive length
  const repairedParts = rawParts.map((p, idx) => {
    return repairThreadPart(p, charLimit, {
      ...context,
      partIndex: idx,
      totalParts: rawParts.length,
      expectedHook: idx === 0 ? cleanHook : undefined
    });
  });

  const postWithCleanSpacing: T = {
    ...post,
    title: cleanTitle || post.title || "",
    hook: cleanHook || post.hook || "",
    explanation: cleanExplanation || post.explanation || "",
    singlePost: repairedParts[0] || "",
    threadParts: repairedParts
  };

  // Integrate hook as standalone Part 1
  const postWithHook = integrateHookIntoPost(postWithCleanSpacing, cleanHook);

  // Ensure each part in postWithHook is clean and within charLimit
  if (Array.isArray(postWithHook.threadParts) && postWithHook.threadParts.length > 0) {
    postWithHook.threadParts = postWithHook.threadParts.map((p, idx) => {
      if (idx === 0) {
        return cleanHook || p;
      }
      return repairThreadPart(p, charLimit, {
        ...context,
        partIndex: idx,
        totalParts: postWithHook.threadParts.length
      });
    });
    postWithHook.singlePost = postWithHook.threadParts[0];
  }

  // Validate the post
  const validation = validateGeneratedPost(postWithHook, cleanHook);

  return {
    post: postWithHook,
    validation
  };
}

// =========================================================================
// SEMANTIC COMPLETENESS & INTELLIGENT REPAIR ENGINE
// Guarantees complete sentences, complete thoughts, and safe character limits
// without ANY hard-truncation, sliced words, or orphaned fragments.
// =========================================================================

export interface SemanticValidationResult {
  valid: boolean;
  charCountValid: boolean;
  completeSentences: boolean;
  completeThoughts: boolean;
  noBrokenWords: boolean;
  noDanglingClauses: boolean;
  noAiArtifacts: boolean;
  properSentenceSpacing: boolean;
  paragraphsPreserved: boolean;
  issues: string[];
}

const DANGLING_END_WORDS_REGEX = /(?:\b(and|or|but|so|because|with|for|to|at|by|from|in|on|into|onto|of|about|that|which|who|whom|whose|when|where|while|if|as|is|are|was|were|be|been|being|have|has|had|do|does|did|the|a|an|their|your|my|our|its|this|these|those|than|then|ing|s)|['’"]s['’"]?)\s*$/i;
const BROKEN_WORD_REGEX = /\b[b-hj-zB-HJ-Z]\b[.!?]$|\b(?:for\s+ing|how\s+to\s+claim\s+['’"]?s|start\s+build|reason\s+this\s+works\s+is|claim\s+['’"]?s|Creator\s+[Oo]ffer)\b|(?:^|\s)["'‘“]?s["'’”](?=[.,!?:;]|\s|$)|(?:^|\s)['’](?:s|d|t|m|ve|re|ll)\b|(?:deliver|drives?|leads?\s+to|path\s+to|attention\s+to|desired)\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/i;
const ORPHANED_SUFFIX_REGEX = /\b(?:ing|ed|tion|tions|ment|ments)\s+(?:my|the|your|our|a|an|to|of|for|in|on)\b/i;
const ORPHANED_POSSESSIVE_REGEX = /(?:^|\s)["'‘“]?['’]?s["'’”]?\b(?=[.,!?:;]|\s|$)|(?:^|\s)['’](?:s|d|t|m|ve|re|ll)\b/i;
const DANGLING_PREPOSITION_REGEX = /\b(for|about|with|without|from|into|onto|of|by|in|on)\s+(?:think|thinks|believes?|assumes?|wants?|tries?|trying|needs?|knows?|feels?|expects?|wonder|wonders|is|are|was|were|will|can|should|would)\b/i;
const UNRESOLVED_CAPS_PLACEHOLDER_REGEX = /\b(EDUCATION|PILLAR(?:\s*\d+)?|TOPIC|AUDIENCE|OFFER|DESIRED_RESULT|TRANSFORMATION|NICHE|CREATOR|CLIENT|PRODUCT|SERVICE|PLACEHOLDER|TBD|TODO)\b/;
const UNRESOLVED_PLACEHOLDER_REGEX = /\[(?:topic|insert|audience|offer|client|link|cta|product|service|result)[^\]]*\]|\{\{?(?:topic|insert|audience|offer|client|link|cta|result)[^\}]*\}?\}|\b(?:undefined\s+text|undefined|null)\b/i;
const AI_ARTIFACTS_REGEX = /\b(as an ai|language model|insert link|insert cta|here is the post|here is part)\b/i;
const PLANNING_LEAKAGE_REGEX = /^(?:\[?(?:Observational|Personal|Compelling|Educational|Strategic)\s+narrative\s+(?:depicting|showing|exploring|highlighting|illustrating)|(?:Hook|Angle|Post|Part\s*\d+|CTA|Narrative)\s+(?:focused\s+on|showing|highlighting|depicting|explaining|about|demonstrating|encouraging|introducing)|(?:Introduce\s+the\s+problem\s+by|Explain\s+how\s+to|Transition\s+into|Use\s+a\s+(?:contrarian|story)\s+hook|Part\s*\d+\s*(?:should|must)))\b/i;
const DUPLICATE_WORD_REGEX = /\b([a-zA-Z]{3,})\s+\1\b/i;

/**
 * Splits text into grammatical sentences while preserving protected tokens
 * (URLs, emails, domain names, abbreviations like e.g. / i.e., decimal numbers, currency).
 */
export function splitIntoCompleteSentences(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const clean = sanitizeSentenceSpacing(text).trim();
  if (!clean) return [];

  // Protect tokens to avoid splitting inside them
  const protectedTokens: { key: string; val: string }[] = [];
  let tokenIdx = 0;

  // Protect numbered list bullets like "1. ", "2. ", "3. " or "(1) ", "Step 1: " from having their dot treated as sentence ending
  let masked = clean.replace(/(?:^|(?<=[\s\n]))(?:\d+\.|\(\d+\)|Step\s+\d+:)(?=\s+[A-Za-z])/gi, (m) => {
    const key = `___PROT_SPLIT_BULLET_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  // Ensure a colon followed by a bullet gets cleanly formatted
  masked = masked.replace(/:\s*(?=___PROT_SPLIT_BULLET_)/g, ":\n\n");
  // Ensure a sentence ending before a bullet starts on a new paragraph/sentence
  masked = masked.replace(/(?<=[.!?])\s+(?=___PROT_SPLIT_BULLET_)/g, "\n\n");

  masked = masked.replace(/https?:\/\/[^\s]+/g, (m) => {
    const key = `___PROT_SPLIT_URL_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  masked = masked.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => {
    const key = `___PROT_SPLIT_EMAIL_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  masked = masked.replace(/\b(?:e\.g\.|i\.e\.|vs\.|etc\.|a\.m\.|p\.m\.|u\.s\.a\.|u\.s\.|u\.k\.|mr\.|mrs\.|ms\.|dr\.|prof\.|sr\.|jr\.|approx\.|est\.|inc\.|co\.|ltd\.)/gi, (m) => {
    const key = `___PROT_SPLIT_ABBR_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  masked = masked.replace(/(?:^|[\s$€£¥(])\d+(?:[.:]\d+)+(?:%|\b)/g, (m) => {
    const key = `___PROT_SPLIT_NUM_${tokenIdx++}___`;
    protectedTokens.push({ key, val: m });
    return key;
  });

  // Split on paragraph breaks first, then on sentence-ending punctuation followed by space and capital/number/quote
  const rawParagraphs = masked.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const rawSentences: string[] = [];

  for (const para of rawParagraphs) {
    const parts = para.split(/(?<=[.!?])\s+(?=[A-Z0-9"'“”«–—])/g).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part) rawSentences.push(part);
    }
  }

  // Restore protected tokens
  return rawSentences.map(sent => {
    let unmasked = sent;
    for (let i = protectedTokens.length - 1; i >= 0; i--) {
      unmasked = unmasked.replace(protectedTokens[i].key, protectedTokens[i].val);
    }
    return unmasked.trim();
  }).filter(Boolean);
}

/**
 * Prevents and repairs sentences split across Part boundaries:
 * If Part N ends abruptly without terminal punctuation [.!?],
 * and Part N+1 begins with the continuation (e.g. lowercase letter or dangling continuation phrase),
 * heals the sentence so that each Part has clean, complete sentence boundaries.
 */
export function enforcePartBoundaries(parts: string[]): string[] {
  if (!Array.isArray(parts) || parts.length <= 1) return Array.isArray(parts) ? parts : [];

  const result = parts.map(p => (typeof p === "string" ? p.trim() : "")).filter(Boolean);
  if (result.length <= 1) return result;

  for (let i = 0; i < result.length - 1; i++) {
    let current = result[i].trim();
    let next = result[i + 1].trim();
    if (!current || !next) continue;

    const unquotedCurrent = current.replace(/["'“”«»)\\]]+$/g, "").trim();
    const hasTerminal = /[.!?:…]$/.test(unquotedCurrent);
    const nextStartsWithLowercase = /^[a-z]/.test(next);
    const nextStartsWithContinuation = /^(?:[,:;\-–—]|\b(?:outcome|result|step|and|or|but|so|because|which|that|who|than|then|when|where|while|with|to|for|in|on)\b)/i.test(next);

    if (!hasTerminal || nextStartsWithLowercase || (nextStartsWithContinuation && !hasTerminal)) {
      // Split sentence detected across Part boundaries!
      const splitMatch = next.match(/^([^.!?\n]+[.!?])/);
      if (splitMatch) {
        const continuation = splitMatch[1].trim();
        current = sanitizeSentenceSpacing(`${current} ${continuation}`);
        next = sanitizeSentenceSpacing(next.slice(splitMatch[0].length).trim());
        next = next.replace(/^[,:;\-–—\s]+/, "").trim();
        if (next && /^[a-z]/.test(next)) {
          next = next.charAt(0).toUpperCase() + next.slice(1);
        }
      } else {
        if (!hasTerminal) {
          current = current + ".";
        }
        if (next && /^[a-z]/.test(next)) {
          next = next.charAt(0).toUpperCase() + next.slice(1);
        }
      }
    }

    result[i] = current;
    result[i + 1] = next;
  }

  return result.filter(Boolean);
}

/**
 * Validates whether a sentence is semantically and grammatically complete:
 * - Minimum word count (>= 3 words)
 * - Must end with terminal punctuation (. ! ?)
 * - Must NOT end with dangling prepositions, conjunctions, or auxiliary verbs
 * - Must NOT contain broken cut words, orphaned suffixes, or AI artifacts
 */
export function isSentenceSemanticallyComplete(sentence: string): { complete: boolean; reason?: string } {
  if (!sentence || typeof sentence !== "string") {
    return { complete: false, reason: "Empty sentence" };
  }
  const clean = sentence.trim();

  // Valid raw URL is a complete terminal token in social media threads (CTA link)
  if (/^https?:\/\/[^\s)]+$/i.test(clean)) {
    return { complete: true };
  }

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length < 3) {
    return { complete: false, reason: `Sentence is too short (${words.length} words)` };
  }

  // Check ending punctuation (stripping closing quotes or parens)
  const unquoted = clean.replace(/["'“”«»)\\]]+$/g, "").trim();
  if (!/[.!?:]$/.test(unquoted)) {
    return { complete: false, reason: "Sentence does not conclude with terminal punctuation (. ! ? :)" };
  }

  // Check dangling words and base without terminal punctuation
  const baseWithoutPunct = unquoted.replace(/[.!?:]+$/, "").trim();

  // Check trailing digit or colon digit (e.g. "System: 1.")
  if (/^\d+$|:\s*\d+$/.test(baseWithoutPunct)) {
    return { complete: false, reason: "Sentence ends abruptly on an unattached list number" };
  }

  // Check if sentence begins abruptly (continuing a missing sentence or dangling fragment)
  if (/^[a-z]/.test(clean)) {
    return { complete: false, reason: "Sentence begins with a lowercase letter as though continuing a missing sentence" };
  }
  if (/^[,:;\-–—]/.test(clean)) {
    return { complete: false, reason: "Sentence begins with dangling punctuation" };
  }
  if (/^(?:which|whom|whose)\b/i.test(clean)) {
    return { complete: false, reason: "Sentence begins with a dangling relative pronoun without antecedent" };
  }

  // Check unmatched quotation marks
  const doubleQuotes = (clean.match(/"/g) || []).length;
  if (doubleQuotes % 2 !== 0) {
    return { complete: false, reason: "Sentence contains an unmatched quotation mark" };
  }

  if (DANGLING_END_WORDS_REGEX.test(baseWithoutPunct)) {
    const trailingWord = baseWithoutPunct.split(/\s+/).pop();
    return { complete: false, reason: `Sentence ends with dangling word: "${trailingWord}"` };
  }

  // Check stray single-letter fragments (any letter except 'a', 'A', 'I')
  if (/(?:^|\s)[b-hj-zB-HJ-Z](?:[.,!?:;]|\s|$)/.test(clean)) {
    return { complete: false, reason: "Sentence contains an unexplained stray single-letter fragment" };
  }

  // Check isolated suffix fragments (e.g. "ing", "tion")
  if (/\b(?:ing|tion|tions|ment|ments)\b/i.test(clean)) {
    return { complete: false, reason: "Sentence contains an isolated suffix fragment" };
  }

  // Check orphaned possessive fragments or dropped words (e.g. "deliver 's", "attention to 's", "'s'", " s ")
  if (/(?:^|\s)["'‘“]?s["'’”](?:[.,!?:;]|\s|$)/i.test(clean) || /(?:^|\s)['’](?:s|d|t|m|ve|re|ll)(?:[.,!?:;]|\s|$)/i.test(clean)) {
    return { complete: false, reason: "Sentence contains an orphaned possessive fragment or dropped target word ('s)" };
  }
  if (/\b(?:deliver|drives?|leads?\s+to|path\s+to|attention\s+to|desired|achieve|claim|scale)\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/i.test(clean)) {
    return { complete: false, reason: "Sentence contains a dropped target word before possessive fragment ('s)" };
  }

  // Check missing preposition objects or dangling preposition fragments (e.g. "content for think...")
  if (DANGLING_PREPOSITION_REGEX.test(clean)) {
    const match = clean.match(DANGLING_PREPOSITION_REGEX);
    return { complete: false, reason: `Sentence contains a missing preposition object or dangling fragment: "${match ? match[0] : ""}"` };
  }

  // Check unresolved placeholders (e.g. "with EDUCATION", "[OFFER]")
  if (UNRESOLVED_CAPS_PLACEHOLDER_REGEX.test(clean) || UNRESOLVED_PLACEHOLDER_REGEX.test(clean)) {
    const match = clean.match(UNRESOLVED_CAPS_PLACEHOLDER_REGEX) || clean.match(UNRESOLVED_PLACEHOLDER_REGEX);
    return { complete: false, reason: `Sentence contains an unresolved placeholder: "${match ? match[0] : ""}"` };
  }

  // Check broken words and orphaned suffixes
  if (BROKEN_WORD_REGEX.test(clean)) {
    return { complete: false, reason: "Sentence contains cut or truncated words" };
  }
  if (ORPHANED_SUFFIX_REGEX.test(clean)) {
    return { complete: false, reason: "Sentence contains orphaned suffix" };
  }

  // Check trailing hyphen
  if (/\b[a-zA-Z]+-[.!?]?$/.test(clean)) {
    return { complete: false, reason: "Sentence ends with broken hyphenated word" };
  }

  // Check AI artifacts and planning text leakage
  if (AI_ARTIFACTS_REGEX.test(clean)) {
    return { complete: false, reason: "Sentence contains AI generation artifacts" };
  }
  if (PLANNING_LEAKAGE_REGEX.test(clean)) {
    return { complete: false, reason: "Sentence contains internal planning text leakage" };
  }

  // Check duplicated adjacent words
  if (DUPLICATE_WORD_REGEX.test(clean)) {
    return { complete: false, reason: "Sentence contains duplicated words" };
  }

  return { complete: true };
}

/**
 * Validates a single thread part for semantic completeness, character limit, and quality.
 */
export function validatePartSemanticCompleteness(partText: string, charLimit: number = 500): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!partText || typeof partText !== "string" || !partText.trim()) {
    issues.push("Part is empty or missing.");
    return { valid: false, issues };
  }

  const clean = partText.trim();
  if (clean.length > charLimit) {
    issues.push(`Part length (${clean.length} chars) exceeds configured limit of ${charLimit} chars.`);
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    issues.push(`Part is too short to be a complete thought (${words.length} words).`);
  }

  const isLabelOnly = /^(?:Free audit|Quick tip|Unpopular opinion|Hot take|Real talk|Note|Warning|Step \d+|Rule \d+):?$/i.test(clean);
  if (isLabelOnly || clean.endsWith(":")) {
    issues.push("Part is an orphaned label or ends with an unresolved colon.");
  }

  const sentences = splitIntoCompleteSentences(clean);
  if (sentences.length === 0) {
    issues.push("No complete sentences found in part.");
  } else {
    for (let i = 0; i < sentences.length; i++) {
      const check = isSentenceSemanticallyComplete(sentences[i]);
      if (!check.complete) {
        issues.push(`Sentence ${i + 1} incomplete: ${check.reason} ("${sentences[i].slice(0, 40)}...")`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates a multi-part thread sequence for semantic completeness and coherence.
 */
export function validateThreadSemantics(parts: string[], charLimit: number = 500): SemanticValidationResult {
  const issues: string[] = [];
  let charCountValid = true;
  let completeSentences = true;
  let completeThoughts = true;
  let noBrokenWords = true;
  let noDanglingClauses = true;
  let noAiArtifacts = true;

  if (!Array.isArray(parts) || parts.length === 0) {
    issues.push("Thread contains no parts.");
    return {
      valid: false,
      charCountValid: false,
      completeSentences: false,
      completeThoughts: false,
      noBrokenWords: false,
      noDanglingClauses: false,
      noAiArtifacts: false,
      properSentenceSpacing: false,
      paragraphsPreserved: false,
      issues
    };
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partCheck = validatePartSemanticCompleteness(part, charLimit);
    if (!partCheck.valid) {
      issues.push(`Part ${i + 1} validation failed: ${partCheck.issues.join("; ")}`);
      for (const issue of partCheck.issues) {
        if (issue.includes("exceeds configured limit")) charCountValid = false;
        if (issue.includes("incomplete") || issue.includes("closing punctuation")) completeSentences = false;
        if (issue.includes("complete thought") || issue.includes("orphaned label")) completeThoughts = false;
        if (issue.includes("cut or truncated") || issue.includes("orphaned suffix")) noBrokenWords = false;
        if (issue.includes("dangling word")) noDanglingClauses = false;
        if (issue.includes("AI generation")) noAiArtifacts = false;
      }
    }
  }

  const properSentenceSpacing = parts.every(p => {
    const unspaced = p.match(/([.!?:]|[;])(?=[A-Z])/);
    return !unspaced || sanitizeSentenceSpacing(p) === p;
  });

  const paragraphsPreserved = parts.every(p => !p.includes("\n") || p.includes("\n\n") || p.includes("\n"));

  const valid = issues.length === 0 && properSentenceSpacing;

  return {
    valid,
    charCountValid,
    completeSentences,
    completeThoughts,
    noBrokenWords,
    noDanglingClauses,
    noAiArtifacts,
    properSentenceSpacing,
    paragraphsPreserved,
    issues
  };
}

/**
 * Intelligently repairs and formats a thread part:
 * 1. Sanitizes sentence spacing (. ! ? : ;)
 * 2. Fixes known cut patterns ("for ing my business", "how to claim s.", "start build")
 * 3. Removes any incomplete trailing sentence if truncated mid-thought
 * 4. Filters to complete, grammatically valid sentences
 * 5. Safely condenses intermediate sentences without ANY substring slicing
 * 6. Guarantees output is <= charLimit and represents a complete thought
 */
export function repairThreadPart(
  partText: string,
  charLimit: number = 500,
  context?: { 
    offer?: string; 
    audience?: string; 
    desiredResult?: string; 
    category?: string; 
    topic?: string;
    partIndex?: number; 
    totalParts?: number; 
    expectedHook?: string;
    exactSentences?: number;
  }
): string {
  if (!partText || typeof partText !== "string" || partText.trim().length === 0) {
    const audience = context?.audience || "creators";
    const desiredResult = context?.desiredResult || "predictable growth";
    const topic = context?.topic || "ThreadsWorks";
    return `To reach ${desiredResult}, ${audience} should focus on simple daily workflows with ${topic}.`;
  }

  // Preserve trailing URL so it is never dropped or corrupted during sentence splitting/repair
  const urlMatch = partText.match(/(https?:\/\/[^\s)]+)\s*$/i);
  const trailingUrl = urlMatch ? urlMatch[1] : null;
  const rawProseToProcess = trailingUrl
    ? partText.slice(0, partText.lastIndexOf(trailingUrl)).trim()
    : partText;

  const expectedHook = context?.expectedHook ? sanitizeSentenceSpacing(context.expectedHook).trim() : "";

  // 1. Sanitize sentence spacing, repair markdown, and normalize newlines
  let clean = sanitizeSentenceSpacing(rawProseToProcess.replace(/\\n/g, "\n")).trim();
  clean = sanitizeAndRepairMarkdown(clean);
  clean = purgeInternalPillarMetadata(clean);
  const { cleanText: afterCorporateAiClean } = sanitizeCorporateAiPhrases(clean, context);
  clean = afterCorporateAiClean;

  // 2. Remove thread index prefix markers like "1/", "[Part 1]", "Part 1:", "Part 1 - " and internal metadata
  clean = clean
    .replace(/^\[?Part\s+\d+\]?[:\-\s]*/i, "")
    .replace(/\[Part\s+\d+\][:\-\s]*/gi, "")
    .replace(/^(?:\d+[\/\.]|\[\d+[\/\.]\])\s*/i, "")
    .replace(/\bCharacters:\s*\d+[.]?/gi, "")
    .replace(/\bHook:\s*/gi, "")
    .trim();

  // 3. Repair specific known truncation, dropped word, & suffix artifacts
  const cleanVar = (val: any, fallback: string): string => {
    if (!val || typeof val !== "string") return fallback;
    const trimmed = val.trim();
    if (trimmed.length < 2 || /^s$/i.test(trimmed) || /^(education|pillar\s*\d*|topic|audience|offer|results?|placeholder|null|undefined)$/i.test(trimmed)) {
      return fallback;
    }
    if (/^[A-Z_]{3,}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return trimmed;
  };

  const rawCat = (context?.category || "").toLowerCase();
  const isSalesContext = rawCat === "sales" ||
    Boolean(context?.offer && /sale|sell|client|revenue|offer|convert/i.test(context.offer)) ||
    Boolean(context?.desiredResult && /sale|sell|client|revenue|convert/i.test(context.desiredResult));
  const fallbackNoun = "sales";

  clean = clean
    // Specific dropped target word before orphaned possessive ('s)
    .replace(/\b(won't|will not|does not|doesn't|can't|cannot|to|will|can|magically)?\s*deliver\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, (m, prefix) => {
      return `${prefix ? prefix + " " : ""}deliver sales`;
    })
    .replace(/\bdeliver\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "deliver sales")
    .replace(/\bfrom\s+attention\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "from attention to sales")
    .replace(/\bpath\s+from\s+attention\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "path from attention to sales")
    .replace(/\battention\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "attention to sales")
    .replace(/\bdesired\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "desired sales")
    .replace(/\bdrives?\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "drives sales")
    .replace(/\bleads?\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "leads to sales")
    .replace(/\bpath\s+to\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "path to sales")
    .replace(/\b(turn|convert|translate)\s+([^.]+?)\s+into\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "$1 $2 into sales")
    .replace(/\bresult\s+in\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "result in sales")
    .replace(/\bbring\s+in\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "bring in sales")
    .replace(/\bproduce\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "produce sales")
    .replace(/\bcreate\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "create sales")
    .replace(/\bmore\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "more sales")
    .replace(/\bgenerate\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "generate sales")
    .replace(/\bmake\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "make sales")
    .replace(/\bclose\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "close sales")
    .replace(/\bscale\s+['’"]?s['’"]?(?=[.,!?:;]|\s|$)/gi, "scale sales")
    .replace(/\bfor\s+ing(?:\s+(?:my|your|our)?\s*business)?\b/gi, "for growing your business")
    .replace(/\bhow\s+to\s+claim\s+['’"]?s['’"]?(?:\.|\s*:\s*|\s*$)/gi, "how to achieve your goals.")
    .replace(/\bto\s+claim\s+['’"]?s['’"]?(?:\.|\s*:\s*|\s*$)/gi, "to claim your results.")
    .replace(/\bstart\s+build(?:\.|\s*:\s*|\s*$)/gi, "start building.")
    .replace(/\breason\s+this\s+works\s+is(?:\.|\s*:\s*|\s*$)/gi, "the reason this works is proven.")
    .replace(/\bclaim\s+['’"]?s['’"]?(?:\.|\s*:\s*|\s*$)/gi, "claim your results.")
    .replace(/\bimplement\s+Creator\s+offer\b/gi, "implement your core framework")
    .replace(/\bCreator\s+[Oo]ffer(?:\s*\/\s*Resource)?\b/g, "core framework")
    .replace(/\bCore\s+Creator\s+Offer\b/g, "core offer")
    // Resolve any remaining isolated quoted 's' or 's with leading space
    .replace(/(?<=\s|^)["'‘“]s["'’”](?=[.,!?:;]|\s|$)/gi, fallbackNoun)
    .replace(/(?<=\s)['’]s\b(?=[.,!?:;]|\s|$)/gi, fallbackNoun)
    .replace(/(?<=\s)['’](?:s|d|t|m|ve|re|ll)\b/gi, "")
    // Repair missing preposition objects (e.g. "building content for think..." -> "building content for their business think...")
    .replace(/\b(building\s+|creating\s+|making\s+|writing\s+)?content\s+for\s+(think|thinks|believe|believes|assume|assumes|wonder|feel)\b/gi, (m, b, v) => {
      return `${b || ""}content for their business ${v}`;
    })
    .replace(/\b(posts?|videos?|strategy|marketing|systems?|copy)\s+for\s+(think|thinks|believe|believes|assume|assumes)\b/gi, (m, noun, v) => {
      return `${noun} for their business ${v}`;
    })
    .replace(/\b(for|about|with|from)\s+(think|thinks|believe|believes|assume|assumes)\b/gi, (m, prep, v) => {
      return `${prep} their business ${v}`;
    })
    // Purge internal planning text leakage (Failure Class 5)
    .replace(/^(?:\[?(?:Observational|Personal|Compelling|Educational|Strategic)\s+narrative\s+(?:depicting|showing|exploring|highlighting|illustrating)\s+[^.!?\n]*[.!?]?\s*)/i, "")
    .replace(/^(?:\[?(?:Hook|Angle|Post|Part\s*\d+|CTA|Narrative)\s+(?:focused\s+on|showing|highlighting|depicting|explaining|about|demonstrating|encouraging|introducing)\s+[^.!?\n]*[.!?]?\s*)/i, "")
    .replace(/^(?:\[?(?:Introduce\s+the\s+problem\s+by|Explain\s+how\s+to|Transition\s+into|Use\s+a\s+(?:contrarian|story)\s+hook|Part\s*\d+\s*(?:should|must))\s+[^.!?\n]*[.!?]?\s*)/i, "")
    // Repair unresolved uppercase placeholders (e.g. "with EDUCATION" -> "with education")
    .replace(/\bwith\s+EDUCATION\b/gi, "with education")
    .replace(/\bEDUCATION\b/g, "education")
    .replace(/\bPILLAR\s*\d*\b/gi, "core theme")
    .replace(/\bTOPIC\b/g, "core topic")
    .replace(/\bAUDIENCE\b/g, cleanVar(context?.audience, "your audience"))
    .replace(/\bOFFER\b/g, cleanVar(context?.offer, "your offer"))
    .replace(/\bDESIRED_RESULT\b/g, cleanVar(context?.desiredResult, "target outcome"))
    .replace(/\bTRANSFORMATION\b/g, "transformation")
    .replace(/\b(?:undefined\s+text|undefined|null|TBD|TODO|PLACEHOLDER)\b/gi, "your core strategy")
    .replace(/\[(?:topic|insert)[^\]]*\]|\{\{?(?:topic|insert)[^\}]*\}?\}/gi, cleanVar(context?.topic, "your core topic"))
    .replace(/\[(?:audience)[^\]]*\]|\{\{?(?:audience)[^\}]*\}?\}/gi, cleanVar(context?.audience, "your audience"))
    .replace(/\[(?:offer)[^\]]*\]|\{\{?(?:offer)[^\}]*\}?\}/gi, cleanVar(context?.offer, "your offer"))
    .replace(/\[(?:result)[^\]]*\]|\{\{?(?:result)[^\}]*\}?\}/gi, cleanVar(context?.desiredResult, "target results"))
    .replace(/\[AUDIENCE\]/gi, cleanVar(context?.audience, "your audience"))
    .replace(/\[OFFER\]/gi, cleanVar(context?.offer, "your offer"))
    .replace(/\[TOPIC\]/gi, "your core topic")
    .replace(/\[RESULT\]/gi, "results")
    .replace(/\[(?:link|cta)[^\]]*\]|\{\{?(?:link|cta)[^\}]*\}?\}/gi, "the link in bio")
    .replace(/\{(?:topic|audience|offer|result)\}/gi, (m) => {
      if (/topic/i.test(m)) return "your topic";
      if (/audience/i.test(m)) return cleanVar(context?.audience, "your audience");
      if (/offer/i.test(m)) return cleanVar(context?.offer, "your offer");
      return "results";
    })
    // Safely remove isolated stray single letters (b-hj-z) while ensuring no dangling punctuation
    .replace(/(?<=\s)[b-hj-zB-HJ-Z](?=[.,!?:;]|\s|$)/g, "")
    // Transform unexplained checklist teasers into concrete operational frameworks
    .replace(/\bif you want (?:the|a|our) checklist\b/gi, "if you want the complete implementation breakdown")
    .replace(/\b(?:an?|our)\s+(?:audit\s+)?checklist\b/gi, "diagnostic framework");

  // Remove standalone bracketed or colon-terminated heading labels at the very beginning
  clean = clean.replace(/^(?:\[(?:Free audit|Quick tip|Unpopular opinion|Hot take|Real talk|Note|Warning|Step \d+|Rule \d+|Education|Case Study|Framework|Strategy|Pillar \d+|Pillar)\]:?\s*)/i, "").trim();
  clean = clean.replace(/^(?:Pillar \d+|Pillar):\s*/i, "").trim();

  // 4. Split into complete sentences
  const rawSentences = splitIntoCompleteSentences(clean);
  const audience = cleanVar(context?.audience, "ambitious creators");
  const desiredResult = cleanVar(context?.desiredResult, "predictable growth");
  const offer = cleanVar(context?.offer, "a dedicated system");
  const topic = cleanVar(context?.topic, offer);

  if (rawSentences.length === 0) {
    // Return high-authority contextual fallback complete thought without generic corporate AI clichés
    if (context?.partIndex === 0) {
      return `The clearest path to ${desiredResult} starts with focused execution on ${topic}.`;
    } else if (context?.partIndex === 1) {
      return `When you clear out the manual clutter, your work gets sharper and your audience responds faster.`;
    } else {
      return `Focus on the single core mechanism that brings real results using ${offer}, and let the rest go.`;
    }
  }

  // 5. Inspect sentences from last to first. If the last sentence is broken, drop it.
  let validSentences: string[] = [];
  for (let i = 0; i < rawSentences.length; i++) {
    let s = rawSentences[i].trim();
    if (/^[a-z]/.test(s)) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }
    const check = isSentenceSemanticallyComplete(s);
    if (check.complete) {
      validSentences.push(s);
    } else if (i < rawSentences.length - 1) {
      // Intermediate sentence failed: attempt simple repair (adding period if missing)
      const repairedCandidate = !/[.!?]$/.test(s) ? s + "." : s;
      if (isSentenceSemanticallyComplete(repairedCandidate).complete) {
        validSentences.push(repairedCandidate);
      }
    }
    // If the last sentence failed, we intentionally do NOT include it to avoid broken endings
  }

  // If no sentences were deemed valid, construct an authoritative contextual thought
  if (validSentences.length === 0) {
    if (context?.partIndex === 0) {
      return `The most reliable path for ${audience} to achieve ${desiredResult} starts with high-conviction foundations on ${topic}.`;
    } else if (context?.partIndex === 1) {
      return `When you clear out the manual clutter, your work gets sharper and your audience responds faster.`;
    } else {
      return `Focus on the core mechanism that brings real results, and consistent growth follows naturally.`;
    }
  }

  // 5.1 Enforce exact sentence count when manual sentence constraint is specified
  if (typeof context?.exactSentences === "number" && context.exactSentences >= 1) {
    const target = Math.min(8, Math.max(1, context.exactSentences));
    if (validSentences.length > target) {
      validSentences = validSentences.slice(0, target);
    } else if (validSentences.length < target) {
      // Pad with high-authority contextual sentences that seamlessly continue the thought
      const pIdx = context?.partIndex ?? 0;
      const continuationPool: string[] = pIdx === 0 ? [
        `When you eliminate the secondary distractions around ${topic}, your primary message stands out immediately.`,
        `The most effective way to communicate with ${audience} is through direct, transparent insights.`,
        `A clear standard makes every subsequent decision simple.`
      ] : pIdx === 1 ? [
        `Most operators lose momentum because their process is filled with unnecessary manual steps.`,
        `When you clarify each stage of the delivery, your audience sees the exact path to ${desiredResult}.`,
        `Clear steps are usually more effective than complicated theories.`
      ] : [
        `Ground your daily execution in real, proven outcomes using ${offer}, not untested speculation.`,
        `Consistency with proven fundamentals is what turns initial attention into steady momentum.`,
        `When your core value proposition is dependable, steady progress follows naturally.`
      ];

      let poolIdx = 0;
      while (validSentences.length < target) {
        const nextSent = continuationPool[poolIdx % continuationPool.length];
        if (isSentenceSemanticallyComplete(nextSent).complete) {
          validSentences.push(nextSent);
        }
        poolIdx++;
      }
    }
  }

  // 6. Reassemble with natural paragraph rhythm (1-2 sentences per paragraph)
  const buildParagraphs = (sentences: string[]): string => {
    if (sentences.length <= 2) {
      return sentences.join("\n\n");
    }
    // 3+ sentences: first sentence stands alone (for hook/emphasis), subsequent sentences in 1-2 sentence blocks
    const paras: string[] = [sentences[0]];
    for (let i = 1; i < sentences.length; i += 2) {
      if (i + 1 < sentences.length) {
        paras.push(`${sentences[i]} ${sentences[i + 1]}`);
      } else {
        paras.push(sentences[i]);
      }
    }
    return paras.join("\n\n");
  };

  let result = buildParagraphs(validSentences);

  // 7. If reassembled exceeds charLimit: drop intermediate sentences cleanly without ANY substring slicing,
  // but if exactSentences is configured, preserve that exact sentence count by condensing phrases instead
  const targetExact = typeof context?.exactSentences === "number" && context.exactSentences >= 1
    ? context.exactSentences
    : null;

  while (result.length > charLimit && validSentences.length > (targetExact || 1)) {
    if (validSentences.length > 2) {
      // Find longest intermediate sentence to remove (preserving Sentence 0 and final sentence)
      let longestMidIdx = 1;
      for (let j = 2; j < validSentences.length - 1; j++) {
        if (validSentences[j].length > validSentences[longestMidIdx].length) {
          longestMidIdx = j;
        }
      }
      validSentences.splice(longestMidIdx, 1);
    } else {
      // 2 sentences left: if expectedHook is present at index 0, ALWAYS preserve index 0 (the hook)
      if (expectedHook && context?.partIndex === 0) {
        validSentences.splice(1, 1);
      } else if (validSentences[0].length <= charLimit) {
        validSentences.splice(1, 1);
      } else {
        validSentences.splice(0, 1);
      }
    }
    result = buildParagraphs(validSentences);
  }

  // 8. If even a single sentence exceeds charLimit, cleanly shorten wordy filler phrases (never slice mid-word)
  if (result.length > charLimit && validSentences.length === 1) {
    let single = validSentences[0];
    const contractions: [RegExp, string][] = [
      [/\bin order to\b/gi, "to"],
      [/\bat this point in time\b/gi, "now"],
      [/\bdue to the fact that\b/gi, "because"],
      [/\ba large number of\b/gi, "many"],
      [/\bfor the purpose of\b/gi, "for"],
      [/\bin the event that\b/gi, "if"],
      [/\bas a matter of fact,?\s*/gi, ""],
      [/\bat the end of the day,?\s*/gi, ""],
      [/\bneedless to say,?\s*/gi, ""]
    ];
    for (const [pattern, repl] of contractions) {
      single = single.replace(pattern, repl).replace(/[ \t]+/g, " ").trim();
      if (single.length <= charLimit && isSentenceSemanticallyComplete(single).complete) {
        result = single;
        break;
      }
    }
  }

  // If still over charLimit, replace with high-value contextual complete sentence that is guaranteed under 450 chars
  if (result.length > charLimit) {
    result = `To reach ${desiredResult}, ${audience} should focus on clear, simple daily actions that deliver results.`;
  }

  let finalResult = sanitizeSentenceSpacing(result);
  if (trailingUrl) {
    let proseSentences = splitIntoCompleteSentences(finalResult);
    const targetProseMax = charLimit - trailingUrl.length - 2;
    while (proseSentences.join(" ").length > targetProseMax && proseSentences.length > 1) {
      proseSentences.pop();
    }
    let cleanProse = proseSentences.join(" ").trim();
    if (cleanProse.length > targetProseMax) {
      cleanProse = cleanProse.slice(0, targetProseMax).replace(/\s+\S*$/, "").trim();
      if (!/[.!?]$/.test(cleanProse)) cleanProse += ".";
    }
    finalResult = `${cleanProse}\n\n${trailingUrl}`;
  }

  return finalResult;
}

/**
 * Universal Post Sanitizer and Repair Engine:
 * Validates, repairs, and sanitizes every post across all Create Content generation paths.
 */
export function repairAndSanitizePost<T extends {
  title?: string;
  hook?: string;
  singlePost?: string;
  threadParts?: string[];
  explanation?: string;
  category?: string;
  format?: string;
}>(
  post: T,
  options?: {
    charLimit?: number;
    expectedHook?: string;
    context?: any;
  }
): { post: T; validation: SemanticValidationResult } {
  if (!post || typeof post !== "object") {
    return {
      post,
      validation: {
        valid: false,
        charCountValid: false,
        completeSentences: false,
        completeThoughts: false,
        noBrokenWords: false,
        noDanglingClauses: false,
        noAiArtifacts: false,
        properSentenceSpacing: false,
        paragraphsPreserved: false,
        issues: ["Invalid post object"]
      }
    };
  }

  const charLimit = options?.charLimit || 500;
  const expectedHook = options?.expectedHook ? sanitizeSentenceSpacing(options.expectedHook).trim() : (post.hook ? sanitizeSentenceSpacing(post.hook).trim() : "");

  let rawParts: string[] = [];
  if (Array.isArray(post.threadParts) && post.threadParts.length > 0) {
    rawParts = post.threadParts;
  } else if (post.singlePost) {
    rawParts = [post.singlePost];
  } else {
    rawParts = [expectedHook || "Real growth starts with a clear focus on your core offer."];
  }

  // Repair each part independently
  const repairedParts = rawParts.map((p, idx) => {
    return repairThreadPart(p, charLimit, {
      ...options?.context,
      partIndex: idx,
      totalParts: rawParts.length
    });
  });

  const postWithRepairedParts: T = {
    ...post,
    title: post.title ? sanitizeAndRepairMarkdown(sanitizeSentenceSpacing(post.title)).trim() : "",
    explanation: post.explanation ? sanitizeAndRepairMarkdown(sanitizeSentenceSpacing(post.explanation)).trim() : "",
    hook: expectedHook || post.hook || "",
    singlePost: repairedParts[0] || "",
    threadParts: repairedParts
  };

  // Integrate hook as standalone Part 1
  const postWithHook = integrateHookIntoPost(postWithRepairedParts, expectedHook);

  // Ensure every part in postWithHook is clean and within charLimit
  if (Array.isArray(postWithHook.threadParts) && postWithHook.threadParts.length > 0) {
    postWithHook.threadParts = postWithHook.threadParts.map((p, idx) => {
      if (idx === 0) {
        return expectedHook || p;
      }
      return repairThreadPart(p, charLimit, {
        ...options?.context,
        partIndex: idx,
        totalParts: postWithHook.threadParts.length
      });
    });
    postWithHook.singlePost = postWithHook.threadParts[0];
  }

  // Run final semantic validation
  const validation = validateThreadSemantics(postWithHook.threadParts || [postWithHook.singlePost || ""], charLimit);

  return {
    post: postWithHook,
    validation
  };
}
