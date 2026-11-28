/**
    * Reusable ContentPaysUs Creator Identity Interface
    * Consumed across the ecosystem by ThreadsWorks, ProductWorks, and future applications.
    */
import { UserProfile } from "../types";

export interface EcosystemCreatorIdentity {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  brandProfile: {
    offer: string;
    audience: string;
    desiredResult: string;
    writingStyle: string;
    customInstruction?: string;
    rawVoice?: string;
  };
  connectedPlatforms: {
    threads?: {
      username: string;
      connected: boolean;
      verified: boolean;
    };
  };
  subscriptionStatus: "free" | "active" | "pro";
}

export function adaptProfileToIdentity(profile: UserProfile | null, email: string, subscriptionStatus: string): EcosystemCreatorIdentity {
  return {
    uid: profile?.uid || "",
    email: profile?.email || email,
    brandProfile: {
      offer: profile?.offer || "",
      audience: profile?.audience || "",
      desiredResult: profile?.desiredResult || "",
      writingStyle: profile?.writingStyle || "",
      customInstruction: profile?.customInstruction || "",
      rawVoice: profile?.rawVoice || ""
    },
    connectedPlatforms: {
      threads: {
        username: "",
        connected: false,
        verified: false
      }
    },
    subscriptionStatus: (subscriptionStatus as any) || "free"
  };
}
