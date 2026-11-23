import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  RefreshCw,
  Lightbulb,
  Layers,
  BarChart3,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Tag,
  Filter,
  Zap,
  TrendingUp,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Plus
} from 'lucide-react';
import {
  IntelligentContentMemoryProfile,
  ContentIdea,
  ContentGapOpportunity,
  SemanticSearchResultItem
} from '../../types/contentMemory';
import { UserProfile } from '../../types';
import { auth } from '../../firebase';
import { getRecentLibraryPostsForMemory } from '../../utils/contentMemoryHelper';

interface IntelligentContentMemoryViewProps {
  profile?: UserProfile | null;
  onNavigateToTab?: (tabId: string) => void;
  onLaunchComposerWithIdea?: (payload: {
    topic: string;
    pillarTitle?: string;
    format?: string;
    angle?: string;
    rawThought?: string;
  }) => void;
}

export function IntelligentContentMemoryView({
  profile,
  onNavigateToTab,
  onLaunchComposerWithIdea
}: IntelligentContentMemoryViewProps) {
  const [activeTab, setActiveTab] = useState<'ideas' | 'repetition' | 'gaps' | 'search'>('ideas');
  const [memoryProfile, setMemoryProfile] = useState<IntelligentContentMemoryProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SemanticSearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPillarFilter, setSearchPillarFilter] = useState('all');
  const [searchFormatFilter, setSearchFormatFilter] = useState('all');

  // Expanded Idea Accordion
  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);

  // Variation Generation Modal State
  const [selectedIdeaForVariation, setSelectedIdeaForVariation] = useState<ContentIdea | null>(null);
  const [selectedFormatForVariation, setSelectedFormatForVariation] = useState<string>('Step-by-Step Blueprint');
  const [generatingVariations, setGeneratingVariations] = useState<boolean>(false);
  const [generatedVariations, setGeneratedVariations] = useState<Array<{ title: string; hook: string; angle: string; draftPreview: string }>>([]);
  const [isVariationModalOpen, setIsVariationModalOpen] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const activeUid = profile?.uid || auth.currentUser?.uid || 'anonymous';

  // Fetch or refresh intelligent memory profile
  const fetchMemoryProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const localCachedPosts = getRecentLibraryPostsForMemory(60, activeUid);
      const res = await fetch('/api/content-memory/intelligent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUid,
          userProfile: profile,
          rawPosts: localCachedPosts
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.profile) {
        setMemoryProfile(data.profile);
      } else {
        throw new Error(data.error || 'Failed to distill intelligent memory');
      }
    } catch (err: any) {
      console.error('[IntelligentContentMemory] Fetch error:', err);
      setError(err.message || 'Unable to load intelligent content memory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemoryProfile();
  }, [activeUid]);

  // Handle Search Execution
  const handleExecuteSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : searchQuery).trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const localCachedPosts = getRecentLibraryPostsForMemory(60, activeUid);
      const res = await fetch('/api/content-memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUid,
          query: q,
          rawPosts: localCachedPosts,
          userProfile: profile,
          pillarFilter: searchPillarFilter !== 'all' ? searchPillarFilter : undefined,
          formatFilter: searchFormatFilter !== 'all' ? searchFormatFilter : undefined
        })
      });

      const data = await res.json();
      if (data.success && data.data?.results) {
        setSearchResults(data.data.results);
      }
    } catch (err) {
      console.warn('[IntelligentContentMemory] Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Trigger search on filter change if query is present
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const timer = setTimeout(() => {
        handleExecuteSearch();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchPillarFilter, searchFormatFilter]);

  // Handle Generate Unexplored Variations for an Idea
  const handleOpenVariationModal = (idea: ContentIdea, initialFormat?: string) => {
    setSelectedIdeaForVariation(idea);
    setSelectedFormatForVariation(initialFormat || idea.unusedFormats[0] || 'Step-by-Step Blueprint');
    setGeneratedVariations([]);
    setIsVariationModalOpen(true);
  };

  const handleGenerateVariations = async () => {
    if (!selectedIdeaForVariation) return;
    setGeneratingVariations(true);
    try {
      const res = await fetch('/api/content-memory/unexplored-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalConcept: selectedIdeaForVariation.canonicalConcept,
          summary: selectedIdeaForVariation.summary,
          format: selectedFormatForVariation,
          creatorIdentity: profile?.creatorIdentity
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.variations)) {
        setGeneratedVariations(data.variations);
      }
    } catch (err) {
      console.error('[IntelligentContentMemory] Variation generation failed:', err);
    } finally {
      setGeneratingVariations(false);
    }
  };

  // Launch into Composer with prefilled state
  const handleSendToComposer = (concept: string, format?: string, angle?: string, thought?: string, pillar?: string) => {
    if (onLaunchComposerWithIdea) {
      onLaunchComposerWithIdea({
        topic: concept,
        pillarTitle: pillar,
        format: format || 'Single Post',
        angle: angle || 'Strategic Variation',
        rawThought: thought || `Explore fresh angle for: "${concept}"`
      });
    } else if (onNavigateToTab) {
      onNavigateToTab('generator');
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Available unique pillars from ideas
  const availablePillars = useMemo(() => {
    if (!memoryProfile?.ideas) return [];
    const set = new Set<string>();
    memoryProfile.ideas.forEach(i => {
      if (i.primaryPillar) set.add(i.primaryPillar);
    });
    return Array.from(set);
  }, [memoryProfile]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Top Banner / Intelligence Overview Card */}
      <div className="rounded-2xl border border-border-primary bg-gradient-to-br from-bg-card via-bg-sidebar to-purple-50/60 dark:to-purple-950/20 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-7 w-7 rounded-lg bg-brand-surface flex items-center justify-center text-brand-text border border-brand-border">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                Intelligent Content Memory Brain
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-surface border border-brand-border text-brand-text">
                Layer 4 Universal
              </span>
            </div>
            <p className="text-sm text-text-secondary max-w-3xl leading-relaxed">
              Understands your canonical ideas, tracks repetition quality (strategic vs accidental), highlights high-performing variation opportunities, and discovers strategic content gaps.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchMemoryProfile}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary transition cursor-pointer disabled:opacity-50"
              title="Re-index library and sync memory"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Analyzing...' : 'Re-index Memory'}</span>
            </button>
          </div>
        </div>

        {/* Intelligence Key Metrics Bar */}
        {memoryProfile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border-primary">
            <div className="bg-bg-card rounded-xl p-3 border border-border-primary">
              <span className="text-[11px] font-medium text-text-muted block mb-0.5">Canonical Ideas</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-text-primary font-mono">{memoryProfile.totalIdeasIdentified}</span>
                <span className="text-[11px] text-text-muted">from {memoryProfile.totalPostsIndexed} posts</span>
              </div>
            </div>

            <div className="bg-bg-card rounded-xl p-3 border border-border-primary">
              <span className="text-[11px] font-medium text-text-muted block mb-0.5">Strategic Repetitions</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-status-success-text font-mono">
                  {memoryProfile.repetitionSummary.strategicRepetitions}
                </span>
                <span className="text-[11px] text-status-success-text font-medium">healthy variations</span>
              </div>
            </div>

            <div className="bg-bg-card rounded-xl p-3 border border-border-primary">
              <span className="text-[11px] font-medium text-text-muted block mb-0.5">Content Freshness</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-brand-text font-mono">
                  {memoryProfile.repetitionSummary.freshnessScore}%
                </span>
                <span className="text-[11px] text-text-muted">score</span>
              </div>
            </div>

            <div className="bg-bg-card rounded-xl p-3 border border-border-primary">
              <span className="text-[11px] font-medium text-text-muted block mb-0.5">Strategic Gaps</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-status-warning-text font-mono">{memoryProfile.gaps.length}</span>
                <span className="text-[11px] text-status-warning-text font-medium">opportunities</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-primary pb-3">
        {[
          { id: 'ideas', label: 'Canonical Ideas & Concepts', icon: Lightbulb, count: memoryProfile?.ideas.length },
          { id: 'repetition', label: 'Repetition & Variations', icon: Layers, count: memoryProfile?.repetitionSummary.strategicRepetitions },
          { id: 'gaps', label: 'Content Gaps & Balance', icon: Compass, count: memoryProfile?.gaps.length },
          { id: 'search', label: 'Conceptual Memory Search', icon: Search }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-bg-card text-text-secondary border border-border-primary hover:text-text-primary hover:bg-bg-card-hover'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-bg-app text-text-secondary border border-border-primary'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-text mx-auto" />
          <p className="text-sm font-semibold text-text-primary">Distilling Content Memory Brain...</p>
          <p className="text-xs text-text-muted">Analyzing canonical concepts, repetition patterns, and unexplored format variations.</p>
        </div>
      )}

      {/* TAB 1: CANONICAL IDEAS & CONCEPTS */}
      {!loading && activeTab === 'ideas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
              Canonical Idea Families ({memoryProfile?.ideas.length || 0})
            </h3>
            <span className="text-xs text-text-muted">
              Ranked by library usage and performance resonance
            </span>
          </div>

          {memoryProfile?.ideas && memoryProfile.ideas.length > 0 ? (
            <div className="space-y-3">
              {memoryProfile.ideas.map((idea) => {
                const isExpanded = expandedIdeaId === idea.id;
                const hasPerformance = idea.performanceSummary && idea.performanceSummary.sampleSize > 0;

                return (
                  <div
                    key={idea.id}
                    className="rounded-2xl border border-border-primary bg-bg-card hover:border-border-secondary transition duration-150 p-5 space-y-3 shadow-xs"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-text-primary">
                            {idea.canonicalConcept}
                          </h4>
                          {idea.primaryPillar && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-surface text-brand-text border border-brand-border">
                              {idea.primaryPillar}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            idea.repetitionType === 'strategic'
                              ? 'bg-status-success-bg text-status-success-text border-status-success-border'
                              : idea.repetitionType === 'foundational'
                              ? 'bg-status-info-bg text-status-info-text border-status-info-border'
                              : 'bg-bg-app text-text-secondary border-border-primary'
                          }`}>
                            {idea.usageCount} {idea.usageCount === 1 ? 'Post' : 'Variations'}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed max-w-3xl">
                          {idea.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenVariationModal(idea)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-text bg-brand-surface hover:bg-brand-surface-hover border border-brand-border transition cursor-pointer"
                          title="Generate new format variations for this idea"
                        >
                          <Zap className="h-3 w-3" />
                          <span>Explore Variations</span>
                        </button>
                        <button
                          onClick={() => setExpandedIdeaId(isExpanded ? null : idea.id)}
                          className="p-1.5 rounded-lg border border-border-primary hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition cursor-pointer"
                          title={isExpanded ? 'Collapse post list' : 'View constituent posts'}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Performance Pill Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      {/* Formats used */}
                      <div className="flex items-center gap-1 flex-wrap text-[11px] text-text-muted">
                        <span className="font-semibold text-text-secondary">Formats Used:</span>
                        {idea.formatsUsed.map(f => (
                          <span key={f} className="px-1.5 py-0.5 rounded bg-bg-app text-text-secondary border border-border-primary">
                            {f}
                          </span>
                        ))}
                      </div>

                      {/* Performance tags */}
                      {hasPerformance && (
                        <div className="flex items-center gap-1.5 text-[11px] ml-auto">
                          <span className="px-2 py-0.5 rounded bg-bg-app text-text-secondary border border-border-primary font-mono">
                            Median Views: <strong className="text-text-primary">{idea.performanceSummary?.medianViews}</strong>
                          </span>
                          {idea.performanceSummary?.baselineVariancePct !== undefined && idea.performanceSummary.baselineVariancePct !== 0 && (
                            <span className={`px-2 py-0.5 rounded border font-mono font-bold ${
                              idea.performanceSummary.baselineVariancePct > 0
                                ? 'bg-status-success-bg text-status-success-text border-status-success-border'
                                : 'bg-status-danger-bg text-status-danger-text border-status-danger-border'
                            }`}>
                              {idea.performanceSummary.baselineVariancePct > 0 ? '+' : ''}{idea.performanceSummary.baselineVariancePct}% vs Baseline
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Unused Formats Action Row */}
                    {idea.unusedFormats.length > 0 && (
                      <div className="p-3 rounded-xl bg-brand-surface border border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-brand-text-strong font-medium">
                          <Sparkles className="h-3.5 w-3.5 text-brand-text shrink-0" />
                          <span>Unexplored Formats:</span>
                          <div className="flex flex-wrap gap-1">
                            {idea.unusedFormats.slice(0, 3).map(uf => (
                              <button
                                key={uf}
                                onClick={() => handleOpenVariationModal(idea, uf)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-bg-card hover:bg-brand-surface-hover border border-brand-border text-brand-text transition cursor-pointer"
                              >
                                + {uf}
                              </button>
                            ))}
                          </div>
                        </div>

                        <span className="text-[10px] text-text-secondary italic">
                          {idea.repetitionAssessment}
                        </span>
                      </div>
                    )}

                    {/* Expandable Posts in this Idea */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border-primary space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                          Constituent Posts ({idea.variations.length})
                        </span>
                        <div className="space-y-2">
                          {idea.variations.map((v, vIdx) => (
                            <div
                              key={vIdx}
                              className="p-3 rounded-xl bg-bg-app border border-border-primary flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-text-primary">{v.title}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-bg-card text-text-secondary border border-border-primary">
                                    {v.format}
                                  </span>
                                  {v.strategicAngle && (
                                    <span className="text-[10px] font-medium text-brand-text">
                                      Angle: {v.strategicAngle}
                                    </span>
                                  )}
                                </div>
                                <p className="text-text-secondary italic">"{v.hook}"</p>
                              </div>

                              <button
                                onClick={() => handleSendToComposer(idea.canonicalConcept, v.format, v.strategicAngle, v.hook, idea.primaryPillar)}
                                className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-text-primary bg-bg-card hover:bg-bg-card-hover border border-border-primary transition cursor-pointer flex items-center gap-1"
                              >
                                <span>Iterate in Composer</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border-primary bg-bg-card space-y-2">
              <FileText className="h-8 w-8 text-text-muted mx-auto" />
              <p className="text-sm font-semibold text-text-primary">No content indexed yet</p>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                As you create and save posts in the Content Engine, Intelligent Memory will automatically distill canonical ideas and map variation opportunities.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REPETITION & VARIATIONS */}
      {!loading && activeTab === 'repetition' && memoryProfile && (
        <div className="space-y-6">
          {/* Repetition Philosophy Banner */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-status-success-text" />
              <h3 className="text-sm font-bold text-text-primary">
                Strategic Repetition vs. Accidental Duplication
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Audience authority requires compounding on core beliefs through multiple distinct angles (Case Studies, Step-by-Step Blueprints, Contrarian Takes). 
              ThreadsWorks protects your core message while ensuring you never reuse identical phrasing or fatigue your audience.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-status-success-bg border border-status-success-border space-y-1">
                <span className="text-xs font-bold text-status-success-text flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Strategic Repetition ({memoryProfile.repetitionSummary.strategicRepetitions})
                </span>
                <p className="text-[11px] text-text-secondary leading-normal">
                  Core thesis delivered through rotating formats, distinct frameworks, and deepening case evidence.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-status-warning-bg border border-status-warning-border space-y-1">
                <span className="text-xs font-bold text-status-warning-text flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Accidental Duplication ({memoryProfile.repetitionSummary.accidentalRepetitions})
                </span>
                <p className="text-[11px] text-text-secondary leading-normal">
                  High surface text overlap without added depth. Automatically flagged during draft generation.
                </p>
              </div>
            </div>
          </div>

          {/* Authentic Vocabulary & Signature Voice */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-3 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Protected Authentic Vocabulary & Voice (Preserved)
            </h4>
            <p className="text-xs text-text-muted">
              These recurring terms reflect your genuine tone of voice and are intentionally preserved across AI generation:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {memoryProfile.authenticVocabulary.map(word => (
                <span key={word} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-bg-app text-text-primary border border-border-primary">
                  {word}
                </span>
              ))}
            </div>
          </div>

          {/* Relationships Matrix */}
          {memoryProfile.relationships && memoryProfile.relationships.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Detected Post Relationships & Evolution
              </h4>
              <div className="space-y-2">
                {memoryProfile.relationships.slice(0, 8).map(rel => (
                  <div
                    key={rel.id}
                    className="p-3 rounded-xl border border-border-primary bg-bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-text-primary">"{rel.sourceTitle}"</span>
                        <span className="text-text-muted">↔</span>
                        <span className="font-semibold text-text-primary">"{rel.targetTitle}"</span>
                      </div>
                      <p className="text-text-secondary text-[11px]">{rel.rationale}</p>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-surface text-brand-text border border-brand-border self-start sm:self-auto">
                      {rel.relationshipType.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONTENT GAPS & BALANCE */}
      {!loading && activeTab === 'gaps' && memoryProfile && (
        <div className="space-y-6">
          {/* Actionable Content Gap Opportunities */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
              Strategic Opportunities & Gaps ({memoryProfile.gaps.length})
            </h3>
            <p className="text-xs text-text-muted">
              Identified coverage gaps based on your configured Brand DNA, Content Pillars, and delivery balance:
            </p>

            {memoryProfile.gaps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {memoryProfile.gaps.map((gap) => (
                  <div
                    key={gap.id}
                    className="p-5 rounded-2xl border border-brand-border bg-bg-card hover:border-purple-500/60 transition duration-150 flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-brand-surface text-brand-text flex items-center justify-center border border-brand-border">
                          <Compass className="h-3.5 w-3.5" />
                        </div>
                        <h4 className="text-sm font-bold text-text-primary">{gap.title}</h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {gap.description}
                      </p>
                      <div className="p-2.5 rounded-xl bg-bg-app border border-border-primary text-xs text-text-primary">
                        <strong className="text-brand-text block mb-0.5">Recommendation:</strong>
                        {gap.recommendation}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border-primary flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {gap.suggestedFormats.map(fmt => (
                          <span key={fmt} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-surface text-brand-text border border-brand-border">
                            {fmt}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => handleSendToComposer(
                          gap.targetPillar || gap.title,
                          gap.suggestedFormats[0],
                          gap.suggestedAngle,
                          gap.actionablePrompt,
                          gap.targetPillar
                        )}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>Draft This Gap</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-xl bg-bg-card border border-border-primary text-xs text-text-muted">
                No immediate structural gaps detected. Your library maintains balanced coverage across your configured pillars.
              </div>
            )}
          </div>

          {/* Delivery Stage Distribution (What vs Why vs How vs Proof vs Action) */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-3 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Delivery Stage Balance (What vs Why vs How vs Proof vs Action)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {[
                { label: 'WHAT (Concepts)', val: memoryProfile.coverage.deliveryTypeDistribution.what, color: 'text-status-info-text' },
                { label: 'WHY (Beliefs)', val: memoryProfile.coverage.deliveryTypeDistribution.why, color: 'text-brand-text' },
                { label: 'HOW (Tactical)', val: memoryProfile.coverage.deliveryTypeDistribution.how, color: 'text-status-success-text' },
                { label: 'PROOF (Case Studies)', val: memoryProfile.coverage.deliveryTypeDistribution.proof, color: 'text-status-warning-text' },
                { label: 'ACTION (Conversion)', val: memoryProfile.coverage.deliveryTypeDistribution.action, color: 'text-status-danger-text' }
              ].map(st => (
                <div key={st.label} className="p-3 rounded-xl bg-bg-app border border-border-primary text-center">
                  <span className="text-[10px] text-text-muted block mb-1">{st.label}</span>
                  <span className={`text-lg font-bold font-mono ${st.color}`}>{st.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONCEPTUAL MEMORY SEARCH */}
      {!loading && activeTab === 'search' && (
        <div className="space-y-5">
          {/* Search Controls Card */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-4 shadow-xs">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
                placeholder="Search your conceptual memory (e.g., 'small audiences', 'pricing model', 'onboarding bottleneck')..."
                className="w-full bg-bg-input border border-border-primary rounded-xl pl-10 pr-24 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-600"
              />
              <button
                onClick={() => handleExecuteSearch()}
                disabled={searchLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer disabled:opacity-50"
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-text-muted flex items-center gap-1 font-semibold">
                <Filter className="h-3 w-3" /> Filters:
              </span>

              {availablePillars.length > 0 && (
                <select
                  value={searchPillarFilter}
                  onChange={(e) => setSearchPillarFilter(e.target.value)}
                  className="bg-bg-input border border-border-primary rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-purple-600"
                >
                  <option value="all">All Content Pillars</option>
                  {availablePillars.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}

              <select
                value={searchFormatFilter}
                onChange={(e) => setSearchFormatFilter(e.target.value)}
                className="bg-bg-input border border-border-primary rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-purple-600"
              >
                <option value="all">All Formats</option>
                <option value="Single Post">Single Post</option>
                <option value="Multi-Part Thread">Multi-Part Thread</option>
                <option value="Step-by-Step">Step-by-Step</option>
                <option value="Case Study">Case Study</option>
              </select>
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Search Results ({searchResults.length})
              </h4>
              {searchQuery && (
                <span className="text-xs font-medium text-brand-text">
                  Concept Query: "{searchQuery}"
                </span>
              )}
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-border-primary bg-bg-card space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-text-primary text-sm">{res.post.title}</h5>
                          {res.matchedIdea && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-surface text-brand-text border border-brand-border">
                              Idea: {res.matchedIdea.canonicalConcept}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-bg-app text-text-secondary border border-border-primary">
                            Relevance: {Math.round(res.relevanceScore * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary italic">"{res.post.hook}"</p>
                      </div>

                      <button
                        onClick={() => handleSendToComposer(res.post.title, res.post.format, res.post.strategicAngle, res.post.singlePost, res.post.pillarTitle)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-bg-app hover:bg-bg-card-hover border border-border-primary text-text-primary transition cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>Iterate</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-bg-app border border-border-primary text-xs text-text-primary whitespace-pre-wrap font-sans max-h-32 overflow-y-auto">
                      {res.post.singlePost || res.post.hook}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                      <span>Reason: {res.matchReason}</span>
                      {res.post.format && <span>Format: {res.post.format}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border-primary bg-bg-card text-xs text-text-muted">
                No direct posts or ideas matched "{searchQuery}". Try a broader term or different filter.
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border-primary bg-bg-card text-xs text-text-muted">
                Enter a search query above to conceptually search your library.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VARIATION EXPLORATION MODAL */}
      {isVariationModalOpen && selectedIdeaForVariation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-primary">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-text">
                  Variation Intelligence Engine
                </span>
                <h3 className="text-base font-bold text-text-primary mt-0.5">
                  Explore Unused Variations for: "{selectedIdeaForVariation.canonicalConcept}"
                </h3>
              </div>
              <button
                onClick={() => setIsVariationModalOpen(false)}
                className="p-1.5 rounded-lg border border-border-primary hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-text-secondary">
                Select Format to Explore:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Step-by-Step Blueprint",
                  "Real-World Case Study",
                  "Contrarian Pattern Interrupt",
                  "Common Mistakes Breakdown",
                  "Myth-Busting & Paradigm Shift",
                  "Direct Actionable Checklist"
                ].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedFormatForVariation(fmt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      selectedFormatForVariation === fmt
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-bg-app text-text-secondary border border-border-primary hover:text-text-primary hover:bg-bg-card-hover'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Trigger */}
            <div className="flex justify-end">
              <button
                onClick={handleGenerateVariations}
                disabled={generatingVariations}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {generatingVariations ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{generatingVariations ? 'Generating Variations...' : `Generate ${selectedFormatForVariation} Variations`}</span>
              </button>
            </div>

            {/* Generated Variations List */}
            {generatedVariations.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-border-primary">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary block">
                  Generated Draft Variations ({generatedVariations.length})
                </span>
                <div className="space-y-3">
                  {generatedVariations.map((gv, gIdx) => (
                    <div
                      key={gIdx}
                      className="p-4 rounded-xl bg-bg-app border border-border-primary space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-text-primary">{gv.title}</span>
                        <span className="text-[10px] font-semibold text-brand-text bg-brand-surface px-2 py-0.5 rounded border border-brand-border">
                          {gv.angle}
                        </span>
                      </div>

                      <p className="text-xs text-brand-text-strong italic">"{gv.hook}"</p>
                      
                      <div className="p-3 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary whitespace-pre-wrap font-sans">
                        {gv.draftPreview}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => copyToClipboard(gv.draftPreview, gIdx)}
                          className="px-2.5 py-1 rounded-lg text-xs text-text-secondary hover:text-text-primary bg-bg-card hover:bg-bg-card-hover border border-border-primary transition cursor-pointer flex items-center gap-1"
                        >
                          {copiedIndex === gIdx ? <Check className="h-3 w-3 text-status-success-text" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedIndex === gIdx ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsVariationModalOpen(false);
                            handleSendToComposer(
                              selectedIdeaForVariation.canonicalConcept,
                              selectedFormatForVariation,
                              gv.angle,
                              gv.draftPreview,
                              selectedIdeaForVariation.primaryPillar
                            );
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer flex items-center gap-1"
                        >
                          <span>Open in Composer</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
