/**
 * Universal Content Memory Brain - Client Helper
 * Retrieves and prepares user's local content history for seamless,
 * behind-the-scenes memory augmentation across all generation requests.
 */

import { auth } from '../firebase';

export interface LightweightMemoryPost {
  id?: string;
  title?: string;
  hook?: string;
  singlePost?: string;
  threadParts?: string[];
  status?: string;
  createdAt?: any;
}

/**
 * Retrieve recent library posts from localStorage cache for instant zero-roundtrip memory injection
 */
export function getRecentOfflineLibraryPosts(explicitUid?: string, maxPosts: number = 40): LightweightMemoryPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const activeUid = explicitUid || auth.currentUser?.uid || localStorage.getItem('threads_last_known_uid') || 'anonymous';
    const key = `threads_saved_offline_library_${activeUid}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const cappedMax = Math.min(maxPosts, 15);
    return parsed
      .filter((p: any) => p && (p.singlePost || p.hook || p.title))
      .slice(0, cappedMax)
      .map((p: any) => ({
        id: p.id,
        title: (p.title || '').substring(0, 100),
        hook: (p.hook || (p.singlePost ? p.singlePost.split('\n\n')[0] : '')).substring(0, 180),
        status: p.status || 'Draft',
        createdAt: p.createdAt || null
      }));
  } catch (err) {
    console.warn('[ContentMemoryHelper] Failed to read cached library posts:', err);
    return [];
  }
}

export function getRecentLibraryPostsForMemory(maxPosts: number = 40, explicitUid?: string): LightweightMemoryPost[] {
  return getRecentOfflineLibraryPosts(explicitUid, maxPosts);
}
