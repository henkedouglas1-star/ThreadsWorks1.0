/**
 * ThreadsWorks Shared Strategic Diagnostic Engine (Layer 5)
 * Absorbs the Brand Audit Analysis Framework into the core ThreadsWorks intelligence.
 * Implements: Diagnose Before Recommend, Root-Cause Analysis, Evidence Classification, and Strategic Memory.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile } from "../src/types";

export interface StrategicFinding {
  category: string;
  finding: string;
  evidence: string;
  evidenceType: "VERIFIED_FINDING" | "OBSERVATION" | "INTERPRETATION" | "HYPOTHESIS" | "CONSULTING_ASSUMPTION" | "UNKNOWN";
  confidence: "LOW" | "MODERATE" | "HIGH";
  impact: "LOW" | "MEDIUM" | "HIGH";
  suspectedRootCause: string;
  priority: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrategicDiagnosis {
  userId: string;
  businessObjective: string;
  primaryConstraint: string;
  confidence: "LOW" | "MODERATE" | "HIGH";
  evidenceCount: number;
  assumptionsCount: number;
  unknownsCount: number;
  recommendedAction: string;
  priorities: string[];
  evidenceList: StrategicFinding[];
  opportunities: any[];
  historyLog: {
    previousConstraint: string | null;
    currentConstraint: string;
    transitionReason: string;
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

/**
 * ThreadsWorks Integrated Intelligence Registry
 */
export const INTELLIGENCE_REGISTRY = [
  {
    capability: "Root Cause Diagnosis",
    description: "Evaluates symptoms (e.g. low sales, poor conversion) against evidence to isolate the true primary business constraint.",
    sourcePlugin: "Brand Audit Analysis",
    currentServiceModule: "StrategicDiagnosticEngine",
    workspacesUsingIt: ["Business -> Strategy", "Sell Workspace", "Grow Workspace", "ThreadsWorks AI / Brain"],
    inputs: ["UserProfile", "ContentMemory", "PerformanceMetrics", "PreviousDiagnosis"],
    outputs: ["PrimaryConstraint", "Confidence", "EvidenceList", "RecommendedNextAction"],
    status: "ACTIVE",
    overlapNotes: "Consolidates all diagnostics across Grow, Sell, and Create to prevent conflicting tactical prescriptions.",
    extensionNotes: "Can be extended in the future by adding formal numeric health indexes or automated CRM funnel queries."
  },
  {
    capability: "Evidence & Confidence Classification",
    description: "Categorizes diagnostic data points (Verified Finding, Observation, Hypothesis, Labeled Assumption, etc.) and gauges certainty qualitatively (LOW, MODERATE, HIGH) based on evidence completeness.",
    sourcePlugin: "Brand Audit Analysis",
    currentServiceModule: "EvidenceConfidenceService",
    workspacesUsingIt: ["Strategy Workspace", "AI Copilot"],
    inputs: ["StrategicFindings", "Hypotheses"],
    outputs: ["ClassifiedEvidence", "ConfidenceBreakdown", "MaterialityVerdict"],
    status: "ACTIVE",
    overlapNotes: "Forces AI models to separate fact from inference and label assumptions clearly before outputting copy or suggestions.",
    extensionNotes: "Integrates with connected accounts to auto-promote Hypotheses to Verified Findings when hard metrics align."
  },
  {
    capability: "Strategic Priority Sequencing",
    description: "Determines sequence of recommended improvements based on downstream leverage, dependencies, and business resource constraints.",
    sourcePlugin: "Brand Audit Analysis",
    currentServiceModule: "StrategicPrioritizationEngine",
    workspacesUsingIt: ["Strategy Workspace", "ThreadsWorks AI / Brain"],
    inputs: ["DiagnosticConstraints", "Opportunities"],
    outputs: ["SequencedPrioritiesList", "ActionRoadmap"],
    status: "ACTIVE",
    overlapNotes: "Used by the AI Brain to decide what tasks to present first to the creator to prevent tactical overload.",
    extensionNotes: "Will integrate with project roadmap trackers to build step-by-step interactive tasks."
  }
];

import { getAI, callGenerateContentWithRetry } from "./geminiClient";

export function createStrategicDiagnosticEngine(serverDb: any) {
  const getAiClient = () => getAI();

  /**
   * Retrieves previous diagnosis for continuity
   */
  async function getPreviousDiagnosis(userId: string): Promise<StrategicDiagnosis | null> {
    if (!serverDb || userId === "anonymous") return null;
    try {
      const snap = await serverDb
        .collection("strategic_diagnoses")
        .doc(userId)
        .get();
      if (snap.exists) {
        return snap.data() as StrategicDiagnosis;
      }
    } catch (err) {
      console.warn("Error getting previous diagnosis:", err);
    }
    return null;
  }

  /**
   * Performs strategic bottleneck analysis and root-cause evidence evaluation using Gemini Flash
   */
  async function performStrategicDiagnosis(
    userId: string,
    profile: UserProfile | null,
    rawPosts: any[],
    timeframe: string = "30d"
  ): Promise<StrategicDiagnosis> {
    const nowStr = new Date().toISOString();
    const previous = await getPreviousDiagnosis(userId);

    // Build context parameters
    const objective = profile?.desiredResult || "Increase qualified customer acquisition";
    const coreOffer = profile?.offer || "Core Product Service Portfolio";
    const targetAudience = profile?.audience || "Target Segment";
    const voiceTone = profile?.creatorIdentity?.tone || profile?.writingStyle || "Professional and Authoritative";
    
    // Abstract of published/draft posts
    const postSnippet = rawPosts.slice(0, 15).map((p, idx) => ({
      index: idx + 1,
      title: p.topic || p.title || "Draft",
      snippet: (p.text || p.singlePost || "").substring(0, 100),
      pillar: p.pillar || p.pillarTitle || "General"
    }));

    const prompt = `You are the ThreadsWorks Core Strategic AI consulting engine (Brand Audit Intelligence layer).
Your goal is to perform a rigorous strategic audit and bottleneck diagnosis on a creator's brand and business state.

User Business Context:
- Business Objective: "${objective}"
- Target Customer/Audience: "${targetAudience}"
- Primary Core Offer: "${coreOffer}"
- Desired Transformation Outcome: "${profile?.creatorIdentity?.whatYouHelpThemDo || "Growth and Brand Authority"}"
- Stated Keywords/Pillars: "${profile?.keywords || "Strategy, Systems, Content Execution"}"
- Voice / Persona Tone: "${voiceTone}"

Recent Content Activity Snippets:
${JSON.stringify(postSnippet, null, 2)}

Previous Active Diagnosis Constraint: "${previous?.primaryConstraint || "None Recorded"}"

DIAGNOSTIC PROCESS (Root-Cause Bottleneck Loop):
For this creator, analyze the potential strategic constraints preventing their objective of "${objective}":
1. Acquisition Bottleneck (No traffic/views, low audience reach)
2. Conversion/Offer Bottleneck (Has views/traffic, but offer positioning is weak, confusing, or CTA is irrelevant)
3. Trust/Positioning Bottleneck (Has content, but messaging feels generic, lacks authority, or has low-quality evidence/proof)
4. Customer Journey/Friction Bottleneck (Onboarding or CTA process is too complex or disconnected)

CRITICAL FRAMEWORK RULES:
- DIAGNOSE BEFORE RECOMMEND: Do not jump to telling them to post more content if their core positioning or offer conversion is the bottleneck. Low views doesn't just mean "post more", it might mean "wrong angles".
- EVIDENCE CLASSIFICATION: Qualify all findings into:
  * "VERIFIED_FINDING" (Directly proven by post snippets, analytics, or profile info)
  * "OBSERVATION" (Directly visible in content, e.g. "We see no mention of price")
  * "INTERPRETATION" (Meaning derived from observation, e.g. "Suggests price anxiety is unaddressed")
  * "HYPOTHESIS" (Plausible strategic theory requiring future test/validation)
  * "CONSULTING_ASSUMPTION" (Working assumption needed to proceed with analysis)
  * "UNKNOWN" (Missing variable with insufficient data to responsively infer)
- QUALITATIVE CONFIDENCE (LOW, MODERATE, HIGH):
  * "HIGH" if there are 3+ direct verified findings and minimal unknown assumptions.
  * "MODERATE" if there are a few observations but some consulting assumptions are needed.
  * "LOW" if major variables are completely unknown.
- BOTTLENECK CLASSIFICATION: Isolate exactly ONE dominant "primaryConstraint" and 2-3 prioritized "priorities" to address it.
- TRACE RECOMMENDATION: The "recommendedAction" must directly solve the "primaryConstraint".
- CONTINUITY / REVISION: If the previous constraint was "${previous?.primaryConstraint || "None"}", evaluate if new evidence justifies changing it or retaining it. Explain the transition reason clearly.

You must return strictly a valid JSON object following this exact schema:
{
  "businessObjective": "Fully distilled short objective",
  "primaryConstraint": "What is the single dominant constraint/bottleneck right now? (Be specific and direct, no fluff)",
  "confidence": "LOW" | "MODERATE" | "HIGH",
  "recommendedAction": "Highly actionable, prioritized next strategic action to solve the primary constraint. Must direct the user exactly what to execute.",
  "priorities": ["1st priority (core focus)", "2nd priority", "3rd priority"],
  "evidenceCount": 12,
  "assumptionsCount": 2,
  "unknownsCount": 1,
  "evidenceList": [
    {
      "category": "Pillar, Offer, Position, Audience, Conversion, etc.",
      "finding": "Short direct finding title",
      "evidence": "Detailed supporting signal or explanation",
      "evidenceType": "VERIFIED_FINDING" | "OBSERVATION" | "INTERPRETATION" | "HYPOTHESIS" | "CONSULTING_ASSUMPTION" | "UNKNOWN",
      "confidence": "LOW" | "MODERATE" | "HIGH",
      "impact": "LOW" | "MEDIUM" | "HIGH",
      "suspectedRootCause": "What underlying operational cause generated this symptom?",
      "priority": 1,
      "source": "Audit Layer Analysis"
    }
  ],
  "transitionReason": "If previous constraint changed or was retained, provide the strategic context/reason. Otherwise, 'Initial baseline strategic audit conducted.'"
}
`;

    const ai = getAiClient();
    const response = await callGenerateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      optimizationTaskId: "STRATEGIC_DIAGNOSIS",
      optimizationComplexity: "LEVEL_2_STANDARD",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            businessObjective: { type: Type.STRING },
            primaryConstraint: { type: Type.STRING },
            confidence: { type: Type.STRING, enum: ["LOW", "MODERATE", "HIGH"] },
            recommendedAction: { type: Type.STRING },
            priorities: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            evidenceCount: { type: Type.INTEGER },
            assumptionsCount: { type: Type.INTEGER },
            unknownsCount: { type: Type.INTEGER },
            evidenceList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  finding: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  evidenceType: { type: Type.STRING, enum: ["VERIFIED_FINDING", "OBSERVATION", "INTERPRETATION", "HYPOTHESIS", "CONSULTING_ASSUMPTION", "UNKNOWN"] },
                  confidence: { type: Type.STRING, enum: ["LOW", "MODERATE", "HIGH"] },
                  impact: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
                  suspectedRootCause: { type: Type.STRING },
                  priority: { type: Type.INTEGER },
                  source: { type: Type.STRING }
                },
                required: ["category", "finding", "evidence", "evidenceType", "confidence", "impact", "suspectedRootCause", "priority", "source"]
              }
            },
            transitionReason: { type: Type.STRING }
          },
          required: [
            "businessObjective",
            "primaryConstraint",
            "confidence",
            "recommendedAction",
            "priorities",
            "evidenceCount",
            "assumptionsCount",
            "unknownsCount",
            "evidenceList",
            "transitionReason"
          ]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");

    // Continuity and Revision history logging
    let history = previous?.historyLog || [];
    if (previous && previous.primaryConstraint !== parsed.primaryConstraint) {
      history.unshift({
        previousConstraint: previous.primaryConstraint,
        currentConstraint: parsed.primaryConstraint,
        transitionReason: parsed.transitionReason || "Updated with fresh content memory indicators.",
        timestamp: nowStr
      });
    } else if (!previous) {
      history.push({
        previousConstraint: null,
        currentConstraint: parsed.primaryConstraint,
        transitionReason: parsed.transitionReason || "Initial baseline strategic audit conducted.",
        timestamp: nowStr
      });
    }

    // Map opportunities if available
    const opportunities = previous?.opportunities || [];

    const finalDiagnosis: StrategicDiagnosis = {
      userId,
      businessObjective: parsed.businessObjective || objective,
      primaryConstraint: parsed.primaryConstraint,
      confidence: (parsed.confidence as "LOW" | "MODERATE" | "HIGH") || "MODERATE",
      evidenceCount: parsed.evidenceCount || parsed.evidenceList?.length || 0,
      assumptionsCount: parsed.assumptionsCount || 0,
      unknownsCount: parsed.unknownsCount || 0,
      recommendedAction: parsed.recommendedAction,
      priorities: parsed.priorities || [],
      evidenceList: (parsed.evidenceList || []).map((ev: any) => ({
        ...ev,
        createdAt: nowStr,
        updatedAt: nowStr
      })),
      opportunities,
      historyLog: history.slice(0, 10), // Limit history array size
      createdAt: previous?.createdAt || nowStr,
      updatedAt: nowStr
    };

    // Save back to Firestore database
    if (serverDb && userId !== "anonymous") {
      try {
        await serverDb
          .collection("strategic_diagnoses")
          .doc(userId)
          .set(finalDiagnosis);
      } catch (err) {
        console.error("Failed saving strategic diagnosis in firestore:", err);
      }
    }

    return finalDiagnosis;
  }

  return {
    getPreviousDiagnosis,
    performStrategicDiagnosis
  };
}
