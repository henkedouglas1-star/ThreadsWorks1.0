/**
    * Shared Intelligence Layer Typed Interfaces
    * Prepares future applications to contribute and retrieve shared context
    * without duplicating creator information.
    */
import { EcosystemCreatorIdentity } from "./creatorIdentity";
import { EcosystemProject } from "./sharedProjects";

export interface SharedIntelligenceContext {
  creator: EcosystemCreatorIdentity;
  activeProjects: EcosystemProject[];
  recentMemoryContext?: {
    partCount: number;
    lastGeneratedAt?: string;
  };
}
