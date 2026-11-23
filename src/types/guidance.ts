export interface ToolGuidanceResult {
  understoodDesire: string;
  identifiedProblem: string;
  strategicGuidance: string;
  recommendedToolId: string;
  recommendedToolName: string;
  whyThisTool: string;
  expectedResult: string;
  nextStepToolId?: string;
  nextStepToolName?: string;
  nextStepReason?: string;
  productUrl: string;
  nextProductUrl?: string;
}

export interface PresetDesireScenario {
  id: string;
  desire: string;
  category: "sales" | "creation" | "audience" | "systems" | "finance";
  shortLabel: string;
}
