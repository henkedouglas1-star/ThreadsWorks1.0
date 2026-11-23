export type RelevanceScore = "HIGH" | "MEDIUM" | "LOW" | "INTERNAL_ONLY";

export interface SourceFileChange {
  file: string;
  changeType: string;
  summary: string;
}

export interface ProductUpdate {
  id: string;
  title: string;
  category: string;
  sourceFiles: string[];
  whatChanged: string;
  previousProblem: string;
  creatorBenefit: string;
  creatorExperienceAfterUpdate: string;
  technicalSummary: string;
  relevanceScore: RelevanceScore;
  confidence: number;
  relatedChanges?: SourceFileChange[];
}

export interface GeneratedThreadPart {
  partIndex: number;
  text: string;
  characterCount: number;
  purpose: "hook" | "payoff" | "detail" | "takeaway";
}

export interface ProductUpdateReport {
  updates: ProductUpdate[];
  primaryUpdateId: string;
  theme: string;
  generatedPost: string;
  generatedParts: string[];
  lastProcessedAt: string;
  lastChangePostGeneratedAt: string;
  lastProcessedFiles: string[];
  totalFilesScanned: number;
}
