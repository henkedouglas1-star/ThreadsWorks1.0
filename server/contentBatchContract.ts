/** Non-mutating contract & individual-draft validation boundary for the batch writer. Never invents or pads content. */
import {
  checkDraftNovelty,
  extractContentTokens,
  jaccardSets,
  type RollingDiversityLedger,
  type SlotDiversityAssignment
} from './writeDiversityEngine';
import {
  UNIVERSAL_AUTO_MAX_PARTS,
  UNIVERSAL_AUTO_MIN_PARTS,
  type EffectiveLengthPolicy,
  type WritingLengthPlan
} from './writeContextGate';

export type GenerationErrorCode =
  | 'PARSE_ERROR'
  | 'SCHEMA_ERROR'
  | 'CONTENT_VALIDATION_ERROR'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'REQUEST_ERROR';

export interface FailedDraftInfo {
  slotNumber: number;
  reasons: string[];
  errorCode: GenerationErrorCode;
}

function defaultHttpStatusForCode(code: GenerationErrorCode): number {
  switch (code) {
    case 'REQUEST_ERROR':
      return 400;
    case 'CONTENT_VALIDATION_ERROR':
      return 422;
    case 'PARSE_ERROR':
    case 'SCHEMA_ERROR':
      return 502;
    case 'PROVIDER_ERROR':
      return 503;
    case 'NETWORK_ERROR':
      return 504;
    default:
      return 500;
  }
}

export class GenerationPipelineError extends Error {
  public readonly code: GenerationErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly failedDrafts?: FailedDraftInfo[];
  public readonly validDraftCount?: number;
  public readonly requestedCount?: number;

  constructor(
    code: GenerationErrorCode,
    message: string,
    options?: {
      httpStatus?: number;
      retryable?: boolean;
      failedDrafts?: FailedDraftInfo[];
      validDraftCount?: number;
      requestedCount?: number;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'GenerationPipelineError';
    this.code = code;
    this.httpStatus = options?.httpStatus ?? defaultHttpStatusForCode(code);
    this.retryable = options?.retryable ?? code !== 'REQUEST_ERROR';
    this.failedDrafts = options?.failedDrafts;
    this.validDraftCount = options?.validDraftCount;
    this.requestedCount = options?.requestedCount;
    if (options?.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}

export function classifyProviderOrNetworkError(err: unknown): GenerationPipelineError | null {
  if (!err) return null;
  if (err instanceof GenerationPipelineError) {
    if (err.code === 'PROVIDER_ERROR' || err.code === 'NETWORK_ERROR' || err.code === 'REQUEST_ERROR') {
      return err;
    }
    return null;
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();
  const status = Number((err as any)?.status || (err as any)?.code || 0);

  // Network / timeout / abort failures
  if (
    status === 504 ||
    status === 408 ||
    lower.includes('did not complete in time') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed') ||
    lower.includes('socket hang up') ||
    lower.includes('network error') ||
    (err instanceof Error && err.name === 'AbortError')
  ) {
    const isTimeout = status === 504 || status === 408 || lower.includes('time');
    return new GenerationPipelineError('NETWORK_ERROR', rawMessage, {
      httpStatus: isTimeout ? 504 : 502,
      retryable: true,
      cause: err
    });
  }

  // Provider auth / quota / rate limit / service unavailability
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api key') ||
    lower.includes('api_key') ||
    lower.includes('permission denied') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return new GenerationPipelineError('PROVIDER_ERROR', rawMessage, {
      httpStatus: status === 401 ? 401 : 403,
      retryable: false,
      cause: err
    });
  }

  if (
    status === 429 ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    const isDaily = lower.includes('daily') || lower.includes('billing') || lower.includes('credit');
    return new GenerationPipelineError('PROVIDER_ERROR', rawMessage, {
      httpStatus: 429,
      retryable: !isDaily,
      cause: err
    });
  }

  if (
    status === 503 ||
    status === 404 ||
    lower.includes('temporarily unavailable') ||
    lower.includes('ai generation is unavailable') ||
    lower.includes('ai review is unavailable') ||
    lower.includes('model is overloaded') ||
    lower.includes('high demand') ||
    lower.includes('model_not_found') ||
    lower.includes('safety filter') ||
    lower.includes('service unavailable')
  ) {
    return new GenerationPipelineError('PROVIDER_ERROR', rawMessage, {
      httpStatus: status === 404 ? 502 : 503,
      retryable: status !== 404,
      cause: err
    });
  }

  return null;
}

export function resolveBatchRequest(body: any): string {
  for (const value of [body.contentRequest, body.topic, body.prompt, body.theme, body.idea]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  throw new GenerationPipelineError('REQUEST_ERROR', 'Enter a content request before generating posts.', {
    httpStatus: 400,
    retryable: false
  });
}

const HYPOTHETICAL_MARKER_RE =
  /\b(?:imagine|suppose|picture|hypothetically|hypothetical|thought experiment|for example|for instance|say (?:a|you|someone|your)|let'?s say|what if|if (?:a|you|your|someone)|consider a|take a hypothetical|pretend)\b/i;

const INVENTED_CUSTOMER_INTERACTION_PATTERNS: Array<{ pattern: RegExp; label: string; sourceKeywords: RegExp }> = [
  {
    pattern:
      /\b(?:a|one of (?:my|our)|several|many|two|three|yesterday a|last week a|today a)\s+(?:customer|client|user|subscriber|buyer|reader|member)s?\s+(?:dm'?d|messaged|emailed|reached out|told me|asked me|wrote to|replied to|sent (?:me|us)|submitted a (?:support )?ticket|contacted support)\b/i,
    label: 'invents customer interactions not present in supplied facts',
    sourceKeywords: /\b(?:customer|client|user|subscriber|buyer|reader|member)s?\s+(?:dm|messag|email|reach|told|ask|wrote|repli|sent|ticket|support)/i
  },
  {
    pattern:
      /\b(?:my|our)\s+(?:support\s+(?:team|inbox|tickets?)|customers?|clients?)\s+(?:told me|keep telling me|always say|frequently ask|asked me|messaged me|emailed me|dm'?d me|reported)\b/i,
    label: 'invents customer or support interactions not present in supplied facts',
    sourceKeywords: /\b(?:support\s+(?:team|inbox|ticket)|customer|client).*(?:told|ask|messag|email|dm|report)/i
  },
  {
    pattern:
      /\b(?:had a|got a|received a|answered a)\s+(?:call|dm|message|email|support ticket|ticket|note)\s+from\s+(?:a|one of (?:my|our))\s+(?:customer|client|user|buyer|subscriber)\b/i,
    label: 'invents customer or support interactions not present in supplied facts',
    sourceKeywords: /\b(?:call|dm|message|email|ticket|note)\s+from\s+.*(?:customer|client|user|buyer|subscriber)/i
  },
  {
    pattern:
      /\b(?:we|i)\s+(?:got|received|handled|answered)\s+\d+\s+(?:support\s+)?(?:tickets|dms|emails|messages|inquiries)\b/i,
    label: 'invents support interaction volume not present in supplied facts',
    sourceKeywords: /\b\d+\s+(?:support\s+)?(?:tickets|dms|emails|messages|inquiries)\b/i
  }
];

const INVENTED_TESTIMONIAL_PATTERNS: Array<{ pattern: RegExp; label: string; sourceKeywords: RegExp }> = [
  {
    pattern:
      /\b(?:a|one of (?:my|our))\s+(?:customer|client|user|student|member)s?\s+(?:went from|grew from|made \$|earned \$|doubled|tripled|increased (?:their|his|her)|gained \d+|saved \d+|closed \d+)\b/i,
    label: 'invents a customer testimonial or unverified client outcome',
    sourceKeywords: /\b(?:customer|client|user|student|member).*(?:went from|grew|made \$|earned \$|doubled|tripled|increased|gained|saved|closed)/i
  },
  {
    pattern: /\b(?:client|customer)\s+(?:testimonial|review|quote)\s*:/i,
    label: 'invents a customer testimonial not present in supplied facts',
    sourceKeywords: /\b(?:testimonial|review|quote)\b/i
  }
];

const QUANTIFIED_RESULT_RE =
  /\b(?:grew|gained|increased|boosted|generated|earned|closed|converted|reached|drove|lifted|improved)\s+(?:by\s+|over\s+|more than\s+)?(\d[\d,]*(?:\.\d+)?(?:%|x|\s*(?:followers|views|impressions|leads|clients|customers|sales|dms|downloads|signups|subscribers|tickets|bookings|calls)))\b/gi;

const PERCENTAGE_RE = /\b(\d+(?:\.\d+)?%)/g;
const DOLLAR_RE = /(\$\d[\d,]*(?:\.\d+)?[kKmM]?)\b/g;

function normalizeTokenForMatch(token: string): string {
  return token.toLowerCase().replace(/,/g, '').trim();
}

/**
 * High-precision deterministic check for fabricated customer interactions, testimonials,
 * support tickets, and unsupported metrics, while explicitly allowing hypotheticals
 * and user-provided facts present in sourceTexts.
 */
export function checkUnsupportedClaims(text: string, sourceTexts: string[] = []): string[] {
  const defects: string[] = [];
  const combinedSource = sourceTexts.filter(Boolean).join('\n');
  const normalizedSource = combinedSource.toLowerCase().replace(/,/g, '');

  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);

  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    let priorSentenceWasHypothetical = false;

    for (const sentence of sentences) {
      const isHypothetical =
        HYPOTHETICAL_MARKER_RE.test(sentence) || priorSentenceWasHypothetical;

      if (!isHypothetical) {
        for (const rule of INVENTED_CUSTOMER_INTERACTION_PATTERNS) {
          const match = sentence.match(rule.pattern);
          if (match && !rule.sourceKeywords.test(combinedSource)) {
            defects.push(`${rule.label} ("${match[0]}")`);
          }
        }

        for (const rule of INVENTED_TESTIMONIAL_PATTERNS) {
          const match = sentence.match(rule.pattern);
          if (match && !rule.sourceKeywords.test(combinedSource)) {
            defects.push(`${rule.label} ("${match[0]}")`);
          }
        }

        for (const match of sentence.matchAll(PERCENTAGE_RE)) {
          const token = normalizeTokenForMatch(match[1]);
          // Allow standalone rhetorical "100%" (e.g., "100% clear") when not framed as a metric claim ("by 100%", "100% of")
          const idx = match.index ?? 0;
          const before = sentence.slice(Math.max(0, idx - 12), idx).toLowerCase();
          const after = sentence.slice(idx + match[1].length, idx + match[1].length + 10).toLowerCase();
          const isRhetorical100 =
            token === '100%' &&
            !/\b(?:by|up|down|grew|boosted|increased|saved|cut|over|about|nearly)\s*$/.test(before) &&
            !/^\s+of\b/.test(after);
          if (token && !isRhetorical100 && !normalizedSource.includes(token)) {
            defects.push(`uses unsupported metric "${match[1]}" not present in supplied facts`);
          }
        }

        for (const match of sentence.matchAll(DOLLAR_RE)) {
          const token = normalizeTokenForMatch(match[1]);
          // Allow benign zero-cost idiom "$0"
          if (token === '$0') continue;
          if (token && !normalizedSource.includes(token)) {
            defects.push(`uses unsupported financial figure "${match[1]}" not present in supplied facts`);
          }
        }

        for (const match of sentence.matchAll(QUANTIFIED_RESULT_RE)) {
          const full = match[0];
          const numToken = normalizeTokenForMatch(match[1]);
          // Avoid double-reporting if percentage already caught it
          if (numToken.endsWith('%')) continue;
          if (numToken && !normalizedSource.includes(numToken)) {
            defects.push(`uses unsupported quantified result "${full}" not present in supplied facts`);
          }
        }
      }

      priorSentenceWasHypothetical = HYPOTHETICAL_MARKER_RE.test(sentence);
    }
  }

  return Array.from(new Set(defects));
}

/**
 * Counts human-readable sentences in a Threads part safely (ignoring dots in URLs,
 * decimals, common abbreviations, and numbered-list prefixes).
 */
export function countPartSentences(text: string): number {
  const cleaned = String(text || '')
    .replace(/https?:\/\/[^\s<>]+/g, ' ')
    .trim();
  if (!cleaned) return 0;

  const lines = cleaned
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  let total = 0;
  for (const line of lines) {
    // Strip leading bullet or list numbering so "1. First step." counts as 1 sentence
    const withoutBullet = line.replace(/^(?:[-*•–—]\s+|\d+[.)]\s+)/, '').trim();
    if (!withoutBullet) continue;
    // Mask decimals, common abbreviations, and ellipsis so they don't trigger false splits
    const masked = withoutBullet
      .replace(/(\d)\.(\d)/g, '$1<dot>$2')
      .replace(/\b(?:e\.g|i\.e|vs|etc|mr|mrs|ms|dr|st|jr|sr|no|fig|u\.s|a\.m|p\.m)\./gi, m => m.replace(/\./g, '<dot>'))
      .replace(/\.{2,}/g, '<ellipsis>');
    const segments = masked
      .split(/(?<=[.!?]["'”’)\]]*)\s+/)
      .map(s => s.trim())
      .filter(s => /[a-z0-9]/i.test(s));
    total += Math.max(1, segments.length);
  }
  return total;
}

/**
 * Deterministic check for within-post repetitive filler sentences, redundant thread parts,
 * and unfinished explanations (e.g., dangling colon or "continued in next part" on final part).
 */
export function checkStructuralCompletenessAndRepetition(parts: string[]): string[] {
  const defects: string[] = [];
  if (!Array.isArray(parts) || parts.length === 0) return defects;

  // 1. Check final part for unfinished trailing headers or dangling teasers
  const lastPart = String(parts[parts.length - 1] || '').trim();
  const lastWithoutTrailingUrl = lastPart.replace(/\s*https?:\/\/[^\s<>]+\s*$/, '').trim();
  if (lastWithoutTrailingUrl.endsWith(':') && lastPart === lastWithoutTrailingUrl) {
    defects.push('Final part ends with a dangling colon instead of completing the explanation.');
  }
  if (
    /\b(?:continued\s+in\s+(?:the\s+)?next\s+(?:part|post)|more\s+in\s+(?:the\s+)?next\s+(?:part|post)|next,?\s+we['’]?ll\s+(?:cover|break\s+down|look\s+at)|stay\s+tuned\s+for\s+part\s+\d+)\b/i.test(
      lastWithoutTrailingUrl
    )
  ) {
    defects.push('Final part leaves the explanation unfinished with a teaser for a missing next part.');
  }

  // 2. Check for repeated / near-duplicate sentences within the same post
  const seenSentences: Array<{ norm: string; tokens: Set<string>; partIdx: number }> = [];
  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const raw = String(parts[pIdx] || '')
      .replace(/https?:\/\/[^\s<>]+/g, ' ')
      .trim();
    const sentences = raw
      .split(/(?:\n+|(?<=[.!?])\s+)/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const norm = sentence
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const tokens = new Set(extractContentTokens(sentence));
      if (norm.length < 30 || tokens.size < 4) continue;

      const duplicate = seenSentences.find(prev => {
        if (prev.norm === norm) return true;
        return jaccardSets(prev.tokens, tokens) >= 0.8;
      });
      if (duplicate) {
        defects.push(
          `Post repeats near-identical filler sentence across ${
            duplicate.partIdx === pIdx ? `Part ${pIdx + 1}` : `Part ${duplicate.partIdx + 1} and Part ${pIdx + 1}`
          }.`
        );
        break;
      }
      seenSentences.push({ norm, tokens, partIdx: pIdx });
    }
    if (defects.length > 0) break;
  }

  // 3. Check for exact or near-duplicate parts in multi-part threads (unnecessary thread padding)
  if (parts.length >= 2 && defects.length === 0) {
    const normalizedParts = parts.map(p =>
      String(p || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
    );
    for (let i = 0; i < normalizedParts.length; i++) {
      for (let j = i + 1; j < normalizedParts.length; j++) {
        if (normalizedParts[i] && normalizedParts[i] === normalizedParts[j]) {
          defects.push(`Part ${j + 1} is an exact duplicate of Part ${i + 1}.`);
          return defects;
        }
      }
    }

    const partTokenSets = parts.map(p => new Set(extractContentTokens(p)));
    for (let i = 0; i < partTokenSets.length; i++) {
      if (partTokenSets[i].size < 6) continue;
      for (let j = i + 1; j < partTokenSets.length; j++) {
        if (partTokenSets[j].size < 6) continue;
        if (jaccardSets(partTokenSets[i], partTokenSets[j]) >= 0.72) {
          defects.push(`Part ${j + 1} largely repeats Part ${i + 1} instead of adding a new point.`);
          return defects;
        }
      }
    }
  }

  return defects;
}

export interface SingleDraftValidationOptions {
  slotNumber: number;
  characterLimit: number;
  partCount?: number;
  minParts?: number;
  maxParts?: number;
  exactSentencesPerPart?: number;
  maxSentencesPerPart?: number;
  checkInternalRepetition?: boolean;
  allowedUrls?: string[];
  priorHooks?: string[];
  sourceTexts?: string[];
  lockedHook?: string;
  ctaOff?: boolean;
  enforceGroundedness?: boolean;
  enforceNovelty?: boolean;
  acceptedDrafts?: any[];
  diversityLedger?: RollingDiversityLedger;
  topicText?: string;
}

export interface DeterministicCorrectionResult {
  candidate: Record<string, any>;
  corrections: string[];
}

/**
 * Applies ONLY provably safe, non-destructive deterministic corrections before spending an LLM repair call.
 * Hard invariants:
 * - NEVER compresses multi-part threads to 1 part.
 * - NEVER truncates parts that exceed characterLimit.
 * - NEVER invents prose or manufactures filler parts.
 */
export function applySafeDeterministicCorrections(
  post: Record<string, any>,
  options: Pick<SingleDraftValidationOptions, 'ctaOff' | 'lockedHook'>
): DeterministicCorrectionResult {
  const corrections: string[] = [];
  const next: Record<string, any> = { ...post };

  if (Array.isArray(next.threadParts)) {
    const trimmedParts = next.threadParts.map((part: unknown) =>
      typeof part === 'string' ? part.trim() : part
    );
    const firstPart = typeof trimmedParts[0] === 'string' ? trimmedParts[0] : '';

    // 1. Deterministically derive singlePost = threadParts[0] when omitted or out of sync
    if (firstPart && next.singlePost !== firstPart) {
      next.singlePost = firstPart;
      corrections.push('derived_single_post');
    }

    // 2. Safe hook alignment ONLY when hook shares opening words with threadParts[0]
    //    (e.g. model appended an ellipsis/quote or left hook trailing punctuation slightly off)
    if (firstPart && typeof next.hook === 'string') {
      const rawHook = next.hook.trim();
      if (rawHook && !firstPart.startsWith(rawHook)) {
        const strippedHook = rawHook.replace(/^[“”"'`]+|[“”"'`]+$/g, '').replace(/\.{3,}$|…+$/g, '').trim();
        if (strippedHook.length >= 12 && firstPart.startsWith(strippedHook)) {
          next.hook = strippedHook;
          corrections.push('aligned_hook_prefix');
        }
      }
    }

    // 3. Safe CTA-Off benign metadata normalization ONLY when cta is empty and decision is a harmless synonym (e.g. "none", "off", "no")
    //    Explicit non-empty CTA text or ctaDecision === "include" remains a strict CTA-Off violation for targeted repair.
    if (options.ctaOff) {
      const rawCta = typeof next.cta === 'string' ? next.cta.trim() : '';
      const rawDecision = typeof next.ctaDecision === 'string' ? next.ctaDecision.trim().toLowerCase() : '';
      if (rawCta.length === 0 && rawDecision && rawDecision !== 'omit' && rawDecision !== 'include') {
        next.cta = '';
        next.ctaDecision = 'omit';
        corrections.push('normalized_cta_omit_decision');
      }
    }
  }

  return { candidate: next, corrections };
}

export function validateSingleDraft(candidate: unknown, options: SingleDraftValidationOptions): any {
  const label = `Post ${options.slotNumber}`;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new GenerationPipelineError('SCHEMA_ERROR', `${label} is not a valid draft object.`);
  }

  const { candidate: post, corrections } = applySafeDeterministicCorrections(
    candidate as Record<string, any>,
    { ctaOff: options.ctaOff, lockedHook: options.lockedHook }
  );

  if (!Array.isArray(post.threadParts) || !post.threadParts.length) {
    throw new GenerationPipelineError('SCHEMA_ERROR', `${label} has no valid parts.`);
  }

  if (post.title !== undefined && typeof post.title !== 'string') {
    throw new GenerationPipelineError('SCHEMA_ERROR', `${label} has an invalid title field.`);
  }
  if (post.cta !== undefined && typeof post.cta !== 'string') {
    throw new GenerationPipelineError('SCHEMA_ERROR', `${label} has an invalid cta field.`);
  }
  if (post.ctaDecision !== undefined && typeof post.ctaDecision !== 'string') {
    throw new GenerationPipelineError('SCHEMA_ERROR', `${label} has an invalid ctaDecision field.`);
  }

  // Trim outer whitespace only: no sentence stripping, truncation, hook replacement or padding.
  const parts = post.threadParts.map((part: unknown) => {
    if (typeof part !== 'string' || !part.trim()) {
      throw new GenerationPipelineError('SCHEMA_ERROR', 'Generation returned an empty part.');
    }
    const text = part.trim();
    if (text.length > options.characterLimit) {
      throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', `Part exceeds ${options.characterLimit} characters.`);
    }
    if (/\b(?:Perspective|Direction|Principle)\s*#?\d+\s*:/i.test(text)) {
      throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Internal planning label in content.');
    }
    if (/\bstart here\s*:/i.test(text) && !/\bstart here\s*:\s*https?:\/\//i.test(text)) {
      throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Destination invitation is missing its URL.');
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
      const url = match[0].replace(/[.,;!?)]+$/, '');
      if (!(options.allowedUrls || []).includes(url)) {
        throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Post contains an unauthorized URL.');
      }
    }
    // Detect copied instruction paragraphs, not ordinary shared topic words.
    for (const source of options.sourceTexts || []) {
      const paragraphs = source.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length >= 180);
      if (paragraphs.some(p => text.includes(p))) {
        throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Source context copied verbatim into a post.');
      }
    }
    return text;
  });

  if (options.partCount && parts.length !== options.partCount) {
    throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Requested thread length was not followed.');
  }
  const effectiveMinParts = !options.partCount ? (options.minParts ?? UNIVERSAL_AUTO_MIN_PARTS) : undefined;
  const effectiveMaxParts = !options.partCount ? (options.maxParts ?? UNIVERSAL_AUTO_MAX_PARTS) : undefined;
  if (effectiveMinParts && parts.length < effectiveMinParts) {
    throw new GenerationPipelineError(
      'CONTENT_VALIDATION_ERROR',
      `${label} has ${parts.length} part(s), fewer than the ${effectiveMinParts}-part minimum required for this topic's depth.`
    );
  }
  if (effectiveMaxParts && parts.length > effectiveMaxParts) {
    throw new GenerationPipelineError(
      'CONTENT_VALIDATION_ERROR',
      `${label} expanded to ${parts.length} parts, exceeding the ${effectiveMaxParts}-part limit for this request.`
    );
  }

  if (options.exactSentencesPerPart) {
    for (let idx = 0; idx < parts.length; idx++) {
      const actualSentences = countPartSentences(parts[idx]);
      if (actualSentences !== options.exactSentencesPerPart) {
        throw new GenerationPipelineError(
          'CONTENT_VALIDATION_ERROR',
          `${label} Part ${idx + 1} has ${actualSentences} sentence(s), but ${options.exactSentencesPerPart} sentence(s) per part were explicitly requested.`
        );
      }
    }
  } else if (options.maxSentencesPerPart) {
    // Allow a 1-sentence natural phrasing margin in auto mode while blocking dense walls of text
    const autoCeiling = options.maxSentencesPerPart + 1;
    for (let idx = 0; idx < parts.length; idx++) {
      const actualSentences = countPartSentences(parts[idx]);
      if (actualSentences > autoCeiling) {
        throw new GenerationPipelineError(
          'CONTENT_VALIDATION_ERROR',
          `${label} Part ${idx + 1} has ${actualSentences} sentences, exceeding readable pacing (max ${autoCeiling} sentences per part).`
        );
      }
    }
  }

  if (options.checkInternalRepetition) {
    const structuralDefects = checkStructuralCompletenessAndRepetition(parts);
    if (structuralDefects.length > 0) {
      throw new GenerationPipelineError(
        'CONTENT_VALIDATION_ERROR',
        `${label}: ${structuralDefects.join('; ')}`
      );
    }
  }

  if (options.lockedHook && !parts[0].startsWith(options.lockedHook)) {
    throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Locked opening was not preserved.');
  }

  const hook = typeof post.hook === 'string' ? post.hook.trim() : '';
  if (!hook) {
    throw new GenerationPipelineError('SCHEMA_ERROR', `${label} is missing a valid hook.`);
  }
  if (!parts[0].startsWith(hook)) {
    throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Hook must match the actual opening text.');
  }

  const seen = new Set((options.priorHooks || []).map(normalizeHook));
  const key = normalizeHook(hook);
  if (seen.has(key)) {
    throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'Repeated hook across the batch.');
  }

  const cta = typeof post.cta === 'string' ? post.cta.trim() : '';
  const ctaDecision = typeof post.ctaDecision === 'string' ? post.ctaDecision.trim().toLowerCase() : '';
  if (options.ctaOff && (cta.length > 0 || ctaDecision === 'include')) {
    throw new GenerationPipelineError(
      'CONTENT_VALIDATION_ERROR',
      `${label} includes a CTA while CTA preferences are Off.`
    );
  }

  if (options.enforceGroundedness) {
    const unsupported = checkUnsupportedClaims(parts.join('\n\n'), options.sourceTexts || []);
    if (unsupported.length > 0) {
      throw new GenerationPipelineError(
        'CONTENT_VALIDATION_ERROR',
        `${label} ${unsupported.join('; ')}`
      );
    }
  }

  if (options.enforceNovelty) {
    const novelty = checkDraftNovelty(
      { title: typeof post.title === 'string' ? post.title : undefined, hook, threadParts: parts },
      {
        slotNumber: options.slotNumber,
        acceptedDrafts: options.acceptedDrafts || [],
        ledger: options.diversityLedger,
        topicText: options.topicText,
        lockedHook: options.lockedHook
      }
    );
    if (!novelty.passed) {
      throw new GenerationPipelineError(
        'CONTENT_VALIDATION_ERROR',
        novelty.defects.join('; ')
      );
    }
  }

  return {
    ...post,
    hook,
    singlePost: parts[0],
    threadParts: parts,
    parts,
    cta,
    ctaDecision: ctaDecision || (post.ctaDecision ?? ''),
    structuralFormat: parts.length === 1 ? 'single' : 'thread',
    ...(corrections.length > 0 ? { _deterministicCorrections: corrections } : {})
  };
}

export function normalizeBatchPosts(
  raw: unknown,
  expected: number,
  options: {
    characterLimit: number;
    partCount?: number;
    minParts?: number;
    maxParts?: number;
    exactSentencesPerPart?: number;
    maxSentencesPerPart?: number;
    checkInternalRepetition?: boolean;
    allowedUrls?: string[];
    priorHooks?: string[];
    sourceTexts?: string[];
    lockedHook?: string;
    ctaOff?: boolean;
    enforceGroundedness?: boolean;
  }
): any[] {
  if (!Array.isArray(raw) || raw.length !== expected) {
    throw new GenerationPipelineError(
      'SCHEMA_ERROR',
      `Incomplete generation: expected ${expected} posts, received ${Array.isArray(raw) ? raw.length : 0}.`
    );
  }
  const accumulatedHooks = [...(options.priorHooks || [])];
  return raw.map((post, index) => {
    const normalized = validateSingleDraft(post, {
      slotNumber: index + 1,
      characterLimit: options.characterLimit,
      partCount: options.partCount,
      minParts: options.minParts,
      maxParts: options.maxParts,
      exactSentencesPerPart: options.exactSentencesPerPart,
      maxSentencesPerPart: options.maxSentencesPerPart,
      checkInternalRepetition: options.checkInternalRepetition,
      allowedUrls: options.allowedUrls,
      priorHooks: accumulatedHooks,
      sourceTexts: options.sourceTexts,
      lockedHook: index === 0 ? options.lockedHook : undefined,
      ctaOff: options.ctaOff,
      enforceGroundedness: options.enforceGroundedness
    });
    accumulatedHooks.push(normalized.hook);
    return normalized;
  });
}

function normalizeHook(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export interface DraftReviewResult {
  slotNumber: number;
  passed: boolean;
  defects: string[];
}

export interface ValidatedChunkOptions {
  slotNumbers: number[];
  priorAcceptedDrafts: any[];
  validation: Omit<SingleDraftValidationOptions, 'slotNumber' | 'priorHooks' | 'lockedHook'> & {
    lockedHook?: string;
  };
  generateChunk: (schemaRetryFeedback?: string) => Promise<unknown>;
  reviewDrafts: (
    drafts: Array<{ slotNumber: number; draft: any }>,
    acceptedDrafts: any[]
  ) => Promise<DraftReviewResult[]>;
  repairDraft: (ctx: {
    slotNumber: number;
    draft: any;
    defects: string[];
    acceptedDrafts: any[];
  }) => Promise<unknown>;
  replaceDraft: (ctx: {
    slotNumber: number;
    failedDraft: any;
    defects: string[];
    acceptedDrafts: any[];
  }) => Promise<unknown>;
  maxRepairAttempts?: number;
  maxReplacementAttempts?: number;
  maxMalformedChunkRetries?: number;
  allowPartialChunk?: boolean;
}

export interface ValidatedChunkResult {
  acceptedDrafts: any[];
  failedSlots: FailedDraftInfo[];
  stats: {
    initialValidCount: number;
    repairedCount: number;
    replacedCount: number;
    failedCount: number;
  };
}

function unwrapSingleDraftCandidate(raw: unknown, slotNumber: number): unknown {
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new GenerationPipelineError('SCHEMA_ERROR', `Post ${slotNumber} returned an empty array instead of a draft object.`);
    }
    return raw[0];
  }
  if (!raw || typeof raw !== 'object') {
    throw new GenerationPipelineError('SCHEMA_ERROR', `Post ${slotNumber} output did not match the expected draft object schema.`);
  }
  return raw;
}

async function runStructuredReviewWithRetry(
  reviewDrafts: ValidatedChunkOptions['reviewDrafts'],
  candidates: Array<{ slotNumber: number; draft: any }>,
  acceptedDrafts: any[]
): Promise<Map<number, DraftReviewResult>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const results = await reviewDrafts(candidates, acceptedDrafts);
      if (!Array.isArray(results)) {
        throw new GenerationPipelineError('SCHEMA_ERROR', 'Editorial review returned a non-array response.');
      }
      const bySlot = new Map<number, DraftReviewResult>();
      for (const item of results) {
        if (
          !item ||
          typeof item !== 'object' ||
          !Number.isInteger(item.slotNumber) ||
          typeof item.passed !== 'boolean' ||
          !Array.isArray(item.defects) ||
          item.defects.some(d => typeof d !== 'string')
        ) {
          throw new GenerationPipelineError('SCHEMA_ERROR', 'Editorial review entry did not match required schema.');
        }
        bySlot.set(item.slotNumber, {
          slotNumber: item.slotNumber,
          passed: item.passed && item.defects.length === 0,
          defects: item.defects.map(d => d.trim()).filter(Boolean)
        });
      }
      const missingSlots = candidates.filter(c => !bySlot.has(c.slotNumber)).map(c => c.slotNumber);
      if (missingSlots.length > 0) {
        throw new GenerationPipelineError(
          'SCHEMA_ERROR',
          `Editorial review omitted required evaluation for slot(s): ${missingSlots.join(', ')}.`
        );
      }
      return bySlot;
    } catch (err) {
      const infraErr = classifyProviderOrNetworkError(err);
      if (infraErr) throw infraErr;
      lastErr = err;
    }
  }
  if (lastErr instanceof GenerationPipelineError) throw lastErr;
  throw new GenerationPipelineError(
    'SCHEMA_ERROR',
    lastErr instanceof Error ? lastErr.message : 'Invalid editorial review response.',
    { cause: lastErr }
  );
}

/**
 * Writer + independent editorial check.
 * - 3-arg legacy overload: chunk-level check with at most one revision (preserved for backwards compatibility).
 * - Options overload: individual draft validation, valid draft preservation, targeted repair,
 *   full revalidation, and fresh replacement if repair fails. Never allows unvalidated drafts through.
 */
export async function writeValidatedChunk(
  write: (feedback: string) => Promise<unknown>,
  validate: (raw: unknown) => any[],
  review: (posts: any[]) => Promise<string[]>
): Promise<any[]>;
export async function writeValidatedChunk(
  options: ValidatedChunkOptions
): Promise<ValidatedChunkResult>;
export async function writeValidatedChunk(
  writeOrOptions: ((feedback: string) => Promise<unknown>) | ValidatedChunkOptions,
  validate?: (raw: unknown) => any[],
  review?: (posts: any[]) => Promise<string[]>
): Promise<any[] | ValidatedChunkResult> {
  // Legacy 3-argument signature
  if (typeof writeOrOptions === 'function') {
    const write = writeOrOptions;
    let feedback = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      // Provider/auth/quota failures propagate immediately; do not retry as writing defects.
      const raw = await write(feedback);
      try {
        const posts = validate!(raw);
        const issues = await review!(posts);
        if (issues.length) throw new Error(issues.join('; '));
        return posts;
      } catch (error) {
        const infraErr = classifyProviderOrNetworkError(error);
        if (infraErr) throw error;
        feedback = error instanceof Error ? error.message : 'Invalid generated content.';
      }
    }
    throw new GenerationPipelineError(
      'CONTENT_VALIDATION_ERROR',
      `Content could not pass validation after one revision: ${feedback}`
    );
  }

  // Individual-draft validated chunk pipeline
  const options = writeOrOptions;
  const maxRepairAttempts = options.maxRepairAttempts ?? 1;
  const maxReplacementAttempts = options.maxReplacementAttempts ?? 1;
  const maxMalformedChunkRetries = options.maxMalformedChunkRetries ?? 1;

  const acceptedBySlot = new Map<number, any>();
  const failedSlots: FailedDraftInfo[] = [];
  const stats = {
    initialValidCount: 0,
    repairedCount: 0,
    replacedCount: 0,
    failedCount: 0
  };

  const getSortedAccepted = () =>
    Array.from(acceptedBySlot.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, draft]) => draft);

  const getAllAccepted = () => [...options.priorAcceptedDrafts, ...getSortedAccepted()];
  const getAllAcceptedHooks = () => getAllAccepted().map(d => d.hook);

  // 1. Generate raw chunk (retry once only on PARSE_ERROR or non-array SCHEMA_ERROR)
  let rawArray: unknown[] | null = null;
  let chunkEnvelopeError: GenerationPipelineError | null = null;
  let schemaRetryFeedback: string | undefined;

  for (let attempt = 0; attempt <= maxMalformedChunkRetries; attempt++) {
    try {
      const raw = await options.generateChunk(schemaRetryFeedback);
      if (!Array.isArray(raw)) {
        throw new GenerationPipelineError(
          'SCHEMA_ERROR',
          `Expected a JSON array of ${options.slotNumbers.length} Threads drafts, but received ${raw === null ? 'null' : typeof raw}.`
        );
      }
      rawArray = raw;
      chunkEnvelopeError = null;
      break;
    } catch (err) {
      const infraErr = classifyProviderOrNetworkError(err);
      if (infraErr) throw infraErr;
      if (err instanceof GenerationPipelineError) {
        chunkEnvelopeError = err;
      } else if (err instanceof SyntaxError) {
        chunkEnvelopeError = new GenerationPipelineError('PARSE_ERROR', err.message, { cause: err });
      } else {
        throw err;
      }
      schemaRetryFeedback = `Previous output failed parsing/schema validation (${chunkEnvelopeError.message}). Return ONLY a valid JSON array of ${options.slotNumbers.length} Threads draft objects matching the required schema.`;
    }
  }

  // If chunk output was completely unparseable / non-array even after retry
  if (!rawArray) {
    const err = chunkEnvelopeError || new GenerationPipelineError('SCHEMA_ERROR', 'Model output did not match expected draft array schema.');
    for (const slotNumber of options.slotNumbers) {
      failedSlots.push({ slotNumber, reasons: [err.message], errorCode: err.code });
      stats.failedCount++;
    }
    if (!options.allowPartialChunk) {
      throw new GenerationPipelineError(err.code, err.message, {
        httpStatus: err.httpStatus,
        retryable: err.retryable,
        failedDrafts: failedSlots,
        validDraftCount: 0,
        requestedCount: options.slotNumbers.length
      });
    }
    return { acceptedDrafts: [], failedSlots, stats };
  }

  // 2. Validate each draft individually (preserving structurally valid siblings)
  const structurallyValid: Array<{ slotNumber: number; draft: any }> = [];
  const pendingRecovery: Array<{
    slotNumber: number;
    draft: any;
    defects: string[];
    errorCode: GenerationErrorCode;
  }> = [];
  const tentativeHooks = [...getAllAcceptedHooks()];

  for (let i = 0; i < options.slotNumbers.length; i++) {
    const slotNumber = options.slotNumbers[i];
    if (i >= rawArray.length) {
      pendingRecovery.push({
        slotNumber,
        draft: null,
        defects: [`Post ${slotNumber} was omitted from the generated array.`],
        errorCode: 'SCHEMA_ERROR'
      });
      continue;
    }
    try {
      const normalized = validateSingleDraft(rawArray[i], {
        ...options.validation,
        slotNumber,
        priorHooks: tentativeHooks,
        acceptedDrafts: [...options.priorAcceptedDrafts, ...structurallyValid.map(s => s.draft)],
        lockedHook: slotNumber === 1 ? options.validation.lockedHook : undefined,
        enforceGroundedness: options.validation.enforceGroundedness ?? true
      });
      structurallyValid.push({ slotNumber, draft: normalized });
      tentativeHooks.push(normalized.hook);
    } catch (err) {
      const pipelineErr =
        err instanceof GenerationPipelineError
          ? err
          : new GenerationPipelineError('CONTENT_VALIDATION_ERROR', err instanceof Error ? err.message : String(err));
      pendingRecovery.push({
        slotNumber,
        draft: rawArray[i],
        defects: [pipelineErr.message],
        errorCode: pipelineErr.code
      });
    }
  }

  // 3. Semantic / editorial review on structurally valid drafts individually
  if (structurallyValid.length > 0) {
    const reviewMap = await runStructuredReviewWithRetry(
      options.reviewDrafts,
      structurallyValid,
      getAllAccepted()
    );

    for (const candidate of structurallyValid) {
      const outcome = reviewMap.get(candidate.slotNumber);
      if (outcome && outcome.passed && outcome.defects.length === 0) {
        // Lock in valid draft immediately — never regenerated or discarded!
        acceptedBySlot.set(candidate.slotNumber, candidate.draft);
        stats.initialValidCount++;
      } else {
        pendingRecovery.push({
          slotNumber: candidate.slotNumber,
          draft: candidate.draft,
          defects:
            outcome && outcome.defects.length > 0
              ? outcome.defects
              : [`Post ${candidate.slotNumber} failed editorial validation.`],
          errorCode: 'CONTENT_VALIDATION_ERROR'
        });
      }
    }
  }

  // 4. Targeted repair -> full revalidation -> replacement ONLY for failing slots
  for (const item of pendingRecovery) {
    let resolved = false;
    let latestDraft = item.draft;
    let latestDefects = [...item.defects];
    let latestErrorCode: GenerationErrorCode = item.errorCode;

    // 4A. Targeted repair (when we have an existing draft object to fix)
    if (latestDraft && typeof latestDraft === 'object') {
      for (let attempt = 0; attempt < maxRepairAttempts && !resolved; attempt++) {
        try {
          const rawRepaired = await options.repairDraft({
            slotNumber: item.slotNumber,
            draft: latestDraft,
            defects: latestDefects,
            acceptedDrafts: getAllAccepted()
          });
          const candidate = unwrapSingleDraftCandidate(rawRepaired, item.slotNumber);
          const validated = validateSingleDraft(candidate, {
            ...options.validation,
            slotNumber: item.slotNumber,
            priorHooks: getAllAcceptedHooks(),
            acceptedDrafts: getAllAccepted(),
            lockedHook: item.slotNumber === 1 ? options.validation.lockedHook : undefined,
            enforceGroundedness: options.validation.enforceGroundedness ?? true
          });
          const reviewMap = await runStructuredReviewWithRetry(
            options.reviewDrafts,
            [{ slotNumber: item.slotNumber, draft: validated }],
            getAllAccepted()
          );
          const outcome = reviewMap.get(item.slotNumber);
          if (outcome && outcome.passed && outcome.defects.length === 0) {
            acceptedBySlot.set(item.slotNumber, validated);
            stats.repairedCount++;
            resolved = true;
          } else {
            latestDraft = validated;
            latestDefects =
              outcome && outcome.defects.length > 0
                ? outcome.defects
                : [`Post ${item.slotNumber} failed editorial revalidation after repair.`];
            latestErrorCode = 'CONTENT_VALIDATION_ERROR';
          }
        } catch (err) {
          const infraErr = classifyProviderOrNetworkError(err);
          if (infraErr) throw infraErr;
          if (err instanceof GenerationPipelineError) {
            latestDefects = [err.message];
            latestErrorCode = err.code;
          } else if (err instanceof SyntaxError) {
            latestDefects = [err.message];
            latestErrorCode = 'PARSE_ERROR';
          } else {
            throw err;
          }
        }
      }
    }

    // 4B. Fresh replacement if repair failed (or draft was missing)
    for (let attempt = 0; attempt < maxReplacementAttempts && !resolved; attempt++) {
      try {
        const rawReplacement = await options.replaceDraft({
          slotNumber: item.slotNumber,
          failedDraft: latestDraft,
          defects: latestDefects,
          acceptedDrafts: getAllAccepted()
        });
        const candidate = unwrapSingleDraftCandidate(rawReplacement, item.slotNumber);
        const validated = validateSingleDraft(candidate, {
          ...options.validation,
          slotNumber: item.slotNumber,
          priorHooks: getAllAcceptedHooks(),
          acceptedDrafts: getAllAccepted(),
          lockedHook: item.slotNumber === 1 ? options.validation.lockedHook : undefined,
          enforceGroundedness: options.validation.enforceGroundedness ?? true
        });
        const reviewMap = await runStructuredReviewWithRetry(
          options.reviewDrafts,
          [{ slotNumber: item.slotNumber, draft: validated }],
          getAllAccepted()
        );
        const outcome = reviewMap.get(item.slotNumber);
        if (outcome && outcome.passed && outcome.defects.length === 0) {
          acceptedBySlot.set(item.slotNumber, validated);
          stats.replacedCount++;
          resolved = true;
        } else {
          latestDraft = validated;
          latestDefects =
            outcome && outcome.defects.length > 0
              ? outcome.defects
              : [`Replacement for Post ${item.slotNumber} failed editorial validation.`];
          latestErrorCode = 'CONTENT_VALIDATION_ERROR';
        }
      } catch (err) {
        const infraErr = classifyProviderOrNetworkError(err);
        if (infraErr) throw infraErr;
        if (err instanceof GenerationPipelineError) {
          latestDefects = [err.message];
          latestErrorCode = err.code;
        } else if (err instanceof SyntaxError) {
          latestDefects = [err.message];
          latestErrorCode = 'PARSE_ERROR';
        } else {
          throw err;
        }
      }
    }

    // Never allow unvalidated content through!
    if (!resolved) {
      failedSlots.push({
        slotNumber: item.slotNumber,
        reasons: latestDefects,
        errorCode: latestErrorCode
      });
      stats.failedCount++;
    }
  }

  const acceptedDrafts = getSortedAccepted();
  if (failedSlots.length > 0 && !options.allowPartialChunk) {
    const primaryCode = failedSlots[0].errorCode;
    const summary = failedSlots
      .map(f => `Post ${f.slotNumber}: ${f.reasons.join('; ')}`)
      .join(' | ');
    throw new GenerationPipelineError(
      primaryCode,
      `Draft validation failed after repair and replacement: ${summary}`,
      {
        failedDrafts: failedSlots,
        validDraftCount: acceptedDrafts.length,
        requestedCount: options.slotNumbers.length
      }
    );
  }

  return { acceptedDrafts, failedSlots, stats };
}

export interface ValidatedBatchOptions {
  totalCount: number;
  chunkSize: number;
  allowPartialResults?: boolean;
  validation: ValidatedChunkOptions['validation'];
  generateChunk: (ctx: {
    slotNumbers: number[];
    acceptedDrafts: any[];
    schemaRetryFeedback?: string;
  }) => Promise<unknown>;
  reviewDrafts: ValidatedChunkOptions['reviewDrafts'];
  repairDraft: ValidatedChunkOptions['repairDraft'];
  replaceDraft: ValidatedChunkOptions['replaceDraft'];
  maxRepairAttempts?: number;
  maxReplacementAttempts?: number;
  maxMalformedChunkRetries?: number;
  onBeforeStep?: () => void;
}

export interface ValidatedBatchResult {
  status: 'complete' | 'partial';
  posts: any[];
  requestedCount: number;
  acceptedCount: number;
  failedSlots: FailedDraftInfo[];
  stats: {
    initialValidCount: number;
    repairedCount: number;
    replacedCount: number;
    failedCount: number;
  };
}

export async function generateValidatedBatch(options: ValidatedBatchOptions): Promise<ValidatedBatchResult> {
  const acceptedDrafts: any[] = [];
  const allFailedSlots: FailedDraftInfo[] = [];
  const totalStats = {
    initialValidCount: 0,
    repairedCount: 0,
    replacedCount: 0,
    failedCount: 0
  };

  for (let offset = 0; offset < options.totalCount; offset += options.chunkSize) {
    options.onBeforeStep?.();
    const expected = Math.min(options.chunkSize, options.totalCount - offset);
    const slotNumbers = Array.from({ length: expected }, (_, i) => offset + i + 1);

    const chunkResult = await writeValidatedChunk({
      slotNumbers,
      priorAcceptedDrafts: acceptedDrafts,
      validation: options.validation,
      generateChunk: schemaRetryFeedback => {
        options.onBeforeStep?.();
        return options.generateChunk({ slotNumbers, acceptedDrafts, schemaRetryFeedback });
      },
      reviewDrafts: (drafts, prior) => {
        options.onBeforeStep?.();
        return options.reviewDrafts(drafts, prior);
      },
      repairDraft: ctx => {
        options.onBeforeStep?.();
        return options.repairDraft(ctx);
      },
      replaceDraft: ctx => {
        options.onBeforeStep?.();
        return options.replaceDraft(ctx);
      },
      maxRepairAttempts: options.maxRepairAttempts,
      maxReplacementAttempts: options.maxReplacementAttempts,
      maxMalformedChunkRetries: options.maxMalformedChunkRetries,
      allowPartialChunk: Boolean(options.allowPartialResults)
    });

    acceptedDrafts.push(...chunkResult.acceptedDrafts);
    allFailedSlots.push(...chunkResult.failedSlots);
    totalStats.initialValidCount += chunkResult.stats.initialValidCount;
    totalStats.repairedCount += chunkResult.stats.repairedCount;
    totalStats.replacedCount += chunkResult.stats.replacedCount;
    totalStats.failedCount += chunkResult.stats.failedCount;
  }

  if (acceptedDrafts.length === 0) {
    const primaryCode = allFailedSlots[0]?.errorCode || 'CONTENT_VALIDATION_ERROR';
    const summary = allFailedSlots
      .map(f => `Post ${f.slotNumber}: ${f.reasons.join('; ')}`)
      .join(' | ');
    throw new GenerationPipelineError(
      primaryCode,
      summary
        ? `No drafts could pass validation after repair and replacement: ${summary}`
        : 'No valid drafts were produced.',
      {
        failedDrafts: allFailedSlots,
        validDraftCount: 0,
        requestedCount: options.totalCount
      }
    );
  }

  if (acceptedDrafts.length < options.totalCount && !options.allowPartialResults) {
    const primaryCode = allFailedSlots[0]?.errorCode || 'CONTENT_VALIDATION_ERROR';
    const summary = allFailedSlots
      .map(f => `Post ${f.slotNumber}: ${f.reasons.join('; ')}`)
      .join(' | ');
    throw new GenerationPipelineError(
      primaryCode,
      `Only ${acceptedDrafts.length} of ${options.totalCount} drafts passed validation: ${summary}`,
      {
        failedDrafts: allFailedSlots,
        validDraftCount: acceptedDrafts.length,
        requestedCount: options.totalCount
      }
    );
  }

  return {
    status: acceptedDrafts.length === options.totalCount ? 'complete' : 'partial',
    posts: acceptedDrafts,
    requestedCount: options.totalCount,
    acceptedCount: acceptedDrafts.length,
    failedSlots: allFailedSlots,
    stats: totalStats
  };
}

export interface ValidatedSingleWriteOptions {
  validation: Omit<SingleDraftValidationOptions, 'slotNumber' | 'priorHooks' | 'acceptedDrafts'>;
  priorAcceptedDrafts?: any[];
  generateDraft: (schemaRetryFeedback?: string) => Promise<unknown>;
  reviewDraft?: (draft: any) => Promise<DraftReviewResult>;
  repairDraft: (ctx: { draft: any; defects: string[] }) => Promise<unknown>;
  replaceDraft: (ctx: { failedDraft: any; defects: string[] }) => Promise<unknown>;
  maxRepairAttempts?: number;
  maxReplacementAttempts?: number;
}

/**
 * Unified single-draft validated execution wrapper for single-post Write routes
 * (/api/regenerate-single-post, /api/create-best-post, /api/generate-threads, etc.).
 * Reuses writeValidatedChunk directly so single-post routes enforce the exact same
 * non-mutating validation, targeted repair, fresh replacement, and typed error contract.
 */
export async function executeValidatedSingleWrite(options: ValidatedSingleWriteOptions): Promise<any> {
  const result = await writeValidatedChunk({
    slotNumbers: [1],
    priorAcceptedDrafts: options.priorAcceptedDrafts || [],
    validation: options.validation,
    generateChunk: async schemaRetryFeedback => {
      const raw = await options.generateDraft(schemaRetryFeedback);
      return Array.isArray(raw) ? raw : [raw];
    },
    reviewDrafts: async drafts => {
      if (!options.reviewDraft) {
        return drafts.map(d => ({ slotNumber: d.slotNumber, passed: true, defects: [] }));
      }
      const res = await options.reviewDraft(drafts[0].draft);
      return [{ slotNumber: drafts[0].slotNumber, passed: res.passed, defects: res.defects }];
    },
    repairDraft: async ({ draft, defects }) => options.repairDraft({ draft, defects }),
    replaceDraft: async ({ failedDraft, defects }) => options.replaceDraft({ failedDraft, defects }),
    maxRepairAttempts: options.maxRepairAttempts ?? 1,
    maxReplacementAttempts: options.maxReplacementAttempts ?? 1,
    maxMalformedChunkRetries: 1,
    allowPartialChunk: false
  });

  if (!result.acceptedDrafts[0]) {
    throw new GenerationPipelineError('CONTENT_VALIDATION_ERROR', 'No validated draft was produced.');
  }
  return result.acceptedDrafts[0];
}

/**
 * Standardized HTTP error responder for all Write endpoints.
 * Separates PARSE_ERROR, SCHEMA_ERROR, CONTENT_VALIDATION_ERROR, PROVIDER_ERROR, NETWORK_ERROR, and REQUEST_ERROR.
 */
export function sendPipelineErrorResponse(res: any, err: unknown, fallbackMessage: string = 'Generation failed'): any {
  const classified =
    err instanceof GenerationPipelineError
      ? err
      : classifyProviderOrNetworkError(err) ||
        new GenerationPipelineError(
          err instanceof SyntaxError ? 'PARSE_ERROR' : 'CONTENT_VALIDATION_ERROR',
          err instanceof Error ? err.message : String(err || fallbackMessage),
          { httpStatus: err instanceof SyntaxError ? 502 : 500 }
        );

  return res.status(classified.httpStatus).json({
    error: classified.message || fallbackMessage,
    errorCode: classified.code,
    retryable: classified.retryable,
    ...(classified.failedDrafts ? { failedDrafts: classified.failedDrafts } : {}),
    ...(classified.validDraftCount !== undefined ? { validDraftCount: classified.validDraftCount } : {}),
    ...(classified.requestedCount !== undefined ? { requestedCount: classified.requestedCount } : {})
  });
}

export type UniversalGenerationMode = 'single' | 'batch' | 'regenerate' | 'best_post' | 'thread';

export interface UniversalGenerationContract {
  generationMode: UniversalGenerationMode;
  requestedBatchSize: number;
  chunkSize: number;
  chunkCount: number;
  partsMode: 'auto' | 'explicit';
  minParts: number;
  maxParts: number;
  explicitPartCount: number | null;
  characterLimit: number;
  ctaOff: boolean;
  businessRelevance?: string;
  slotPlanSummary: Array<{
    slotNumber: number;
    targetParts: number;
    lensId: string;
    structuralShape: string;
  }>;
}

/**
 * Token-budget adaptive chunk sizing for multi-post generation requests.
 * Balances round-trip latency against output token limits so standard auto batches
 * run in fewer sequential chunks (up to 4 posts/chunk when estimated parts stay under
 * the per-chunk token ceiling) while deep/tutorial or explicit 7–10-part batches stay
 * small (1–2 posts/chunk) to prevent truncation or timeouts.
 */
export function computeAdaptiveChunkSize(
  totalCount: number,
  writingPlan: Pick<WritingLengthPlan, 'partCountMode' | 'recommendedParts' | 'maxParts'> & {
    profile?: WritingLengthPlan['profile'];
  },
  slotPlan?: Array<{ targetParts?: number }>
): number {
  const safeTotal = Math.max(1, Math.floor(totalCount));
  if (safeTotal <= 1) return 1;

  if (writingPlan.partCountMode === 'explicit') {
    if (writingPlan.recommendedParts <= 1) return Math.min(4, safeTotal);
    if (writingPlan.recommendedParts === 2) return Math.min(3, safeTotal);
    if (writingPlan.recommendedParts >= 7) return 1;
    return Math.min(2, safeTotal);
  }

  // Deep tutorial or heavy recommended auto profiles stay at <= 2 posts/chunk to avoid truncation.
  if (writingPlan.profile === 'complex_tutorial' || writingPlan.recommendedParts >= 6) {
    return Math.min(2, safeTotal);
  }

  // Estimate average parts per post from slotPlan (when supplied) or writingPlan.recommendedParts.
  // Keep estimated total parts per chunk <= 18 (~9k chars, well inside single-call JSON budget).
  const TARGET_MAX_PARTS_PER_CHUNK = 18;
  const plannedTargets = Array.isArray(slotPlan)
    ? slotPlan.map(s => Number(s?.targetParts)).filter(n => Number.isFinite(n) && n >= 1)
    : [];
  const avgParts =
    plannedTargets.length > 0
      ? plannedTargets.reduce((sum, n) => sum + n, 0) / plannedTargets.length
      : Math.max(1, writingPlan.recommendedParts || 4);

  const budgetChunkSize = Math.floor(TARGET_MAX_PARTS_PER_CHUNK / Math.max(1, avgParts));
  return Math.min(safeTotal, Math.max(2, Math.min(4, budgetChunkSize)));
}

export function createUniversalGenerationContract(params: {
  generationMode: UniversalGenerationMode;
  requestedBatchSize: number;
  writingPlan: WritingLengthPlan;
  characterLimit: number;
  ctaOff: boolean;
  businessRelevance?: string;
  slotPlan: SlotDiversityAssignment[];
}): UniversalGenerationContract {
  const chunkSize = computeAdaptiveChunkSize(params.requestedBatchSize, params.writingPlan, params.slotPlan);
  const chunkCount = Math.ceil(Math.max(1, params.requestedBatchSize) / chunkSize);
  return {
    generationMode: params.generationMode,
    requestedBatchSize: params.requestedBatchSize,
    chunkSize,
    chunkCount,
    partsMode: params.writingPlan.partCountMode,
    minParts: params.writingPlan.minParts,
    maxParts: params.writingPlan.maxParts,
    explicitPartCount: params.writingPlan.partCountMode === 'explicit' ? params.writingPlan.recommendedParts : null,
    characterLimit: params.characterLimit,
    ctaOff: params.ctaOff,
    businessRelevance: params.businessRelevance,
    slotPlanSummary: params.slotPlan.map(slot => ({
      slotNumber: slot.slotNumber,
      targetParts: slot.targetParts ?? params.writingPlan.recommendedParts,
      lensId: slot.lensId,
      structuralShape: slot.structuralShape
    }))
  };
}

export interface GenerationBatchDiagnostics {
  requestId: string;
  generationMode: UniversalGenerationMode;
  effectiveLengthPolicy: EffectiveLengthPolicy;
  writingPlan: {
    profile: WritingLengthPlan['profile'];
    substanceLevel?: WritingLengthPlan['substanceLevel'];
    partCountMode: WritingLengthPlan['partCountMode'];
    minParts: number;
    maxParts: number;
    recommendedParts: number;
  };
  requestedPostCount: number;
  acceptedPostCount: number;
  chunkSize: number;
  chunkCount: number;
  plannedPartCounts: number[];
  actualPartCounts: number[];
  modelCallCount: number;
  repairAttempts: number;
  replacementAttempts: number;
  validationOutcome: 'complete' | 'partial' | 'failed';
  failedSlotCount: number;
  errorCode?: GenerationErrorCode;
  totalDurationMs: number;
}

/**
 * Builds a strictly privacy-safe structured diagnostic summary for generation runs.
 * NEVER includes private Creator Context, contentRequest text, credentials, or user PII.
 */
export function buildGenerationBatchDiagnostics(params: {
  requestId: string;
  generationMode: UniversalGenerationMode;
  writingPlan: WritingLengthPlan;
  requestedPostCount: number;
  acceptedPosts: Array<{ threadParts?: unknown[] }>;
  chunkSize: number;
  chunkCount: number;
  slotPlan: Array<{ targetParts?: number }>;
  modelCallCount: number;
  repairAttempts: number;
  replacementAttempts?: number;
  failedSlotCount?: number;
  validationOutcome: 'complete' | 'partial' | 'failed';
  errorCode?: GenerationErrorCode;
  totalDurationMs: number;
}): GenerationBatchDiagnostics {
  const effectiveLengthPolicy: EffectiveLengthPolicy =
    params.writingPlan.effectiveLengthPolicy ??
    (params.writingPlan.partCountMode === 'explicit'
      ? 'explicit_setting'
      : params.writingPlan.profile === 'short_observation'
        ? 'auto_compact_observation'
        : 'auto_1_to_10');

  return {
    requestId: params.requestId,
    generationMode: params.generationMode,
    effectiveLengthPolicy,
    writingPlan: {
      profile: params.writingPlan.profile,
      ...(params.writingPlan.substanceLevel ? { substanceLevel: params.writingPlan.substanceLevel } : {}),
      partCountMode: params.writingPlan.partCountMode,
      minParts: params.writingPlan.minParts,
      maxParts: params.writingPlan.maxParts,
      recommendedParts: params.writingPlan.recommendedParts
    },
    requestedPostCount: params.requestedPostCount,
    acceptedPostCount: params.acceptedPosts.length,
    chunkSize: params.chunkSize,
    chunkCount: params.chunkCount,
    plannedPartCounts: params.slotPlan.map(s => Number(s?.targetParts) || params.writingPlan.recommendedParts),
    actualPartCounts: params.acceptedPosts.map(p => (Array.isArray(p?.threadParts) ? p.threadParts.length : 0)),
    modelCallCount: params.modelCallCount,
    repairAttempts: params.repairAttempts,
    replacementAttempts: params.replacementAttempts ?? 0,
    validationOutcome: params.validationOutcome,
    failedSlotCount: params.failedSlotCount ?? 0,
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
    totalDurationMs: Math.max(0, Math.round(params.totalDurationMs))
  };
}

export function logGenerationBatchDiagnostics(diagnostics: GenerationBatchDiagnostics): void {
  console.info('[CONTENT_ENGINE_DIAGNOSTICS]', JSON.stringify(diagnostics));
}

export interface UniversalBatchValidationOptions {
  expectedCount: number;
  explicitPartCount?: number;
  minParts?: number;
  maxParts?: number;
  characterLimit?: number;
}

/**
 * Universal, quota-free batch validation contract for all supported batch sizes (1, 4, 8, 16, 32, etc.).
 * Enforces exact post count, non-empty parts, character limits, no exact duplicate parts, and
 * explicit or automatic 1–10 part bounds. Does NOT enforce mandatory part-count diversity quotas:
 * multiple posts may naturally share the same part count whenever content depth warrants it.
 */
export function validateUniversalBatch(
  posts: unknown[],
  options: UniversalBatchValidationOptions
): void {
  const expectedCount = options.expectedCount;
  if (!Array.isArray(posts) || posts.length !== expectedCount) {
    throw new GenerationPipelineError(
      'CONTENT_VALIDATION_ERROR',
      `Generation requested ${expectedCount} post(s) but returned ${Array.isArray(posts) ? posts.length : 0} valid draft(s).`,
      { requestedCount: expectedCount, validDraftCount: Array.isArray(posts) ? posts.length : 0 }
    );
  }

  const minParts = options.explicitPartCount ?? options.minParts ?? UNIVERSAL_AUTO_MIN_PARTS;
  const maxParts = options.explicitPartCount ?? options.maxParts ?? UNIVERSAL_AUTO_MAX_PARTS;
  const characterLimit = options.characterLimit ?? 500;

  for (let i = 0; i < posts.length; i++) {
    const parts = (posts[i] as any)?.threadParts;
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new GenerationPipelineError(
        'CONTENT_VALIDATION_ERROR',
        `Post ${i + 1} has no valid threadParts array.`,
        { requestedCount: expectedCount }
      );
    }

    if (options.explicitPartCount !== undefined && parts.length !== options.explicitPartCount) {
      throw new GenerationPipelineError(
        'CONTENT_VALIDATION_ERROR',
        `Post ${i + 1} returned ${parts.length} part(s), but ${options.explicitPartCount} part(s) were explicitly requested.`,
        { requestedCount: expectedCount }
      );
    }

    if (parts.length < minParts || parts.length > maxParts) {
      throw new GenerationPipelineError(
        'CONTENT_VALIDATION_ERROR',
        `Post ${i + 1} must contain ${minParts}–${maxParts} thread parts (received ${parts.length}).`,
        { requestedCount: expectedCount }
      );
    }

    const seenNormalized = new Set<string>();
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      if (typeof part !== 'string' || !part.trim()) {
        throw new GenerationPipelineError(
          'CONTENT_VALIDATION_ERROR',
          `Post ${i + 1} Part ${p + 1} is empty or invalid.`,
          { requestedCount: expectedCount }
        );
      }
      const trimmed = part.trim();
      if (trimmed.length > characterLimit) {
        throw new GenerationPipelineError(
          'CONTENT_VALIDATION_ERROR',
          `Post ${i + 1} Part ${p + 1} exceeds the ${characterLimit}-character limit.`,
          { requestedCount: expectedCount }
        );
      }
      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
      if (seenNormalized.has(normalized)) {
        throw new GenerationPipelineError(
          'CONTENT_VALIDATION_ERROR',
          `Post ${i + 1} contains duplicate thread parts.`,
          { requestedCount: expectedCount }
        );
      }
      seenNormalized.add(normalized);
    }
  }
}

/**
 * Eight-post AI Decide contract (backwards-compatible wrapper over validateUniversalBatch).
 * Supports 1–10 parts per post and allows multiple posts to naturally share the same part count
 * without imposing artificial diversity quotas.
 */
export function validateEightPostAiDecideBatch(posts: unknown[]): void {
  validateUniversalBatch(posts, {
    expectedCount: 8,
    minParts: UNIVERSAL_AUTO_MIN_PARTS,
    maxParts: UNIVERSAL_AUTO_MAX_PARTS
  });
}

/**
 * Preserved export for backwards compatibility.
 * Mandatory single-part quotas have been removed so natural depth and content quality come first.
 */
export function enforceEightPostAiDecideReview(
  reviews: unknown,
  _drafts: Array<{ slotNumber: number; draft: { threadParts?: unknown[] } }>,
  _acceptedPrior: Array<{ threadParts?: unknown[] }>
): unknown {
  return reviews;
}
