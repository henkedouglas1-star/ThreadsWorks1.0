/**
 * ContentPaysUs Client Shared Intelligence Service Helper
 * Connects frontend application components (such as ThreadsWorks Content Engine)
 * to the shared intelligence retrieval and contribution service.
 */

import { auth } from "../firebase";

export async function fetchSharedIntelligenceContext(
  appId: string = "threadsworks",
  projectId?: string,
  taskType: string = "content_generation",
  domains: string[] = ["creator", "commercial", "content", "performance"]
): Promise<any | null> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const token = await currentUser.getIdToken();

    const response = await fetch("/api/intelligence/context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        appId,
        projectId,
        taskType,
        domains
      })
    });

    if (!response.ok) {
      console.warn("[SHARED_INTELLIGENCE_CLIENT] Context fetch note:", response.status);
      return null;
    }

    const data = await response.json();
    return data.context || null;
  } catch (err) {
    console.warn("[SHARED_INTELLIGENCE_CLIENT] Failed to fetch shared context:", err);
    return null;
  }
}
