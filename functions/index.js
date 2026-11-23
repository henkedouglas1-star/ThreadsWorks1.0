/**
 * Firebase Cloud Functions v2 - Automated Scheduled Post Dispatcher for ThreadsWorks
 * Matches modern Node.js / Firebase Functions v2 standards.
 * 
 * Frequency: Every 5 minutes.
 * Decoupled, production-ready, and highly robust error handling.
 */

// =========================================================================
// STABILIZATION LAYER: Explicit Global Fetch Scope Binding
// Required for environments running Node <18 or CJS container sandboxes that do not
// automatically expose globalThis.fetch in global namespace.
// =========================================================================
if (!globalThis.fetch) {
  const { fetch, Headers, Request, Response } = require("undici");
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
  console.log("[RUNTIME_INIT] Undici global fetch polyfill explicitly bound.");
}

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");

// Initialize Firebase Admin SDK if not already initialized in the function execution context
let adminApp;
try {
  adminApp = getApps().length === 0 ? initializeApp() : getApps()[0];
} catch (e) {
  adminApp = getApps()[0];
}

const databaseId = "ai-studio-threadsworks-b76f7533-a28e-409a-9ce3-3b12bcbfbf3d";
const db = getFirestore(adminApp, databaseId);

// Helper to delay between sequential thread executions or during polling
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Robust parser to handle Firestore Timestamp objects, JSON-serialized Timestamps, strings, numbers, etc.
function parseScheduledDate(scheduledForVal) {
  if (!scheduledForVal) return null;
  
  if (scheduledForVal instanceof Date) {
    return scheduledForVal;
  }
  
  if (typeof scheduledForVal.toDate === "function") {
    return scheduledForVal.toDate();
  }
  
  if (typeof scheduledForVal === "object") {
    const secs = scheduledForVal.seconds ?? scheduledForVal._seconds;
    if (typeof secs === "number") {
      return new Date(secs * 1000);
    }
  }
  
  const d = new Date(scheduledForVal);
  if (!isNaN(d.getTime())) {
    return d;
  }
  
  return null;
}

/**
 * Scheduled Cloud Function running every 5 minutes to scan, reclaim, and publish due posts.
 * Includes extended execution limits (timeoutSeconds: 300) to prevent mid-sequence timeouts.
 */
exports.onThreadsSchedule = onSchedule({
  schedule: "every 5 minutes",
  timeoutSeconds: 300,
  memory: "256MiB"
}, async (event) => {
  const now = new Date();
  console.log(`[SCHEDULER_RUN] Commencing scheduler dispatch scan. Current Server Time: ${now.toISOString()}`);

  try {
    const postsRef = db.collection("posts");

    // A. STALE RECOVERY MODULE
    console.log("[RECOVERY_SCAN] Scanning for active 'Publishing' jobs that may have stalled...");
    const staleSnapshot = await postsRef
      .where("status", "==", "Publishing")
      .where("isPublished", "==", false)
      .get();

    if (!staleSnapshot.empty) {
      const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
      let recoveredCount = 0;

      for (const docSnap of staleSnapshot.docs) {
        const postData = docSnap.data();
        const lastUpdated = postData.updatedAt ? new Date(postData.updatedAt).getTime() : 0;
        
        let scheduledTime = 0;
        if (postData.scheduledFor) {
          const parsed = parseScheduledDate(postData.scheduledFor);
          if (parsed) {
            scheduledTime = parsed.getTime();
          }
        }
        
        const baselineTime = Math.max(lastUpdated, scheduledTime);

        if (baselineTime && baselineTime < fifteenMinutesAgo) {
          console.log(`[RECOVERY] Stale in-flight job detected: Doc ID: ${docSnap.id}. Resetting status back to 'Scheduled' for rotation.`);
          await docSnap.ref.update({
            status: "Scheduled",
            error: "Recovered from stalled publishing queue. Re-queued for retry.",
            updatedAt: new Date().toISOString()
          });
          recoveredCount++;
        }
      }
      if (recoveredCount > 0) {
        console.log(`[RECOVERY_COMPLETE] Successfully unlocked ${recoveredCount} stale 'Publishing' document(s).`);
      }
    }

    // B. QUEUE SCAN
    console.log("[QUEUE_SCAN] Querying queue for pending posts ready to go live...");
    const snapshot = await postsRef
      .where("status", "in", ["Scheduled", "scheduled", "SCHEDULED"])
      .where("isPublished", "==", false)
      .get();

    if (snapshot.empty) {
      console.log("[QUEUE_SCAN] No pending or due posts requiring dispatch at this interval.");
      return;
    }

    const currentTime = Date.now();
    const currentIso = new Date(currentTime).toISOString();
    const eligibleDocs = [];

    for (const docSnap of snapshot.docs) {
      const postData = docSnap.data() || {};
      const scheduledForVal = postData.scheduledFor;
      if (!scheduledForVal) continue;

      const scheduledDate = parseScheduledDate(scheduledForVal);
      const scheduledTime = (scheduledDate && !isNaN(scheduledDate.getTime())) ? scheduledDate.getTime() : 0;
      const scheduledIso = (scheduledDate && !isNaN(scheduledDate.getTime())) ? scheduledDate.toISOString() : "Invalid Date";

      const isEligible = scheduledTime > 0 && scheduledTime <= currentTime;

      console.log(`[SCHEDULER_DIAGNOSTIC] Document ID: ${docSnap.id} | scheduledFor ISO: ${scheduledIso} | Current server ISO: ${currentIso} | scheduledTime (ms): ${scheduledTime} | currentTime (ms): ${currentTime} | Eligible: ${isEligible}`);

      if (isEligible) {
        eligibleDocs.push(docSnap);
      }
    }

    if (eligibleDocs.length === 0) {
      console.log("[QUEUE_SCAN] No pending or due posts requiring dispatch at this interval based on scheduledTime vs currentTime.");
      return;
    }

    console.log(`[QUEUE_SCAN] Detected ${eligibleDocs.length} due post(s) to process.`);

    for (const docSnap of eligibleDocs) {
      const postId = docSnap.id;
      console.log(`[DISPATCH_LOCK] Attempting transaction lock for post ID: ${postId}`);

      // STRICT TRANSACTION-BASED ATOMIC LOCK
      const isLocked = await db.runTransaction(async (transaction) => {
        const docRef = docSnap.ref;
        const freshSnap = await transaction.get(docRef);
        if (!freshSnap.exists) return false;
        
        const freshData = freshSnap.data() || {};
        const currentStatus = freshData.status;
        const isAlreadyPublished = freshData.isPublished;
        
        if (!isAlreadyPublished && (currentStatus === "Scheduled" || currentStatus === "scheduled" || currentStatus === "SCHEDULED")) {
          const sDate = parseScheduledDate(freshData.scheduledFor);
          const graceWindowMs = 24 * 60 * 60 * 1000;
          if (sDate && sDate.getTime() < Date.now() - graceWindowMs) {
            transaction.update(docRef, {
              status: "Missed",
              error: "This post missed its scheduled time by more than 24 hours. Reschedule it or publish it now.",
              errorMessage: "This post missed its scheduled time by more than 24 hours. Reschedule it or publish it now.",
              updatedAt: new Date().toISOString()
            });
            return false;
          }
          transaction.update(docRef, {
            status: "Publishing",
            updatedAt: new Date().toISOString()
          });
          return true;
        }
        return false;
      });

      if (!isLocked) {
        console.log(`[DISPATCH_SKIPPED] Post ID ${postId} was already locked or modified by another worker.`);
        continue;
      }

      const freshDocSnap = await docSnap.ref.get();
      const postData = freshDocSnap.data() || {};

      const hasText = !!((postData.text && typeof postData.text === "string" && postData.text.trim() !== "") ||
                      (postData.singlePost && typeof postData.singlePost === "string" && postData.singlePost.trim() !== "") ||
                      (postData.content && typeof postData.content === "string" && postData.content.trim() !== "") ||
                      (postData.threadParts && Array.isArray(postData.threadParts) && postData.threadParts.some(p => typeof p === "string" && p.trim() !== "")));
      const hasMediaType = !!(postData.media_type && typeof postData.media_type === "string" && postData.media_type.trim() !== "");

      if (!hasText && !hasMediaType) {
        console.log(`[DISPATCH_FAILED] Post ID ${postId} failed Meta API validation requirements.`);
        await docSnap.ref.update({
          status: "Failed",
          error: "Payload validation failed: The parameter text or media_type is required.",
          updatedAt: new Date().toISOString()
        });
        continue;
      }

      const userId = postData.userId;

      try {
        if (!userId || userId === "anonymous") {
          throw new Error("Missing valid, non-anonymous User ID associated with scheduled post.");
        }

        const [connSnap, secureSnap] = await Promise.all([
          db.collection("connections").doc(userId).get(),
          db.collection("connections_secure").doc(userId).get()
        ]);

        if (!connSnap.exists || !secureSnap.exists) {
          throw new Error("Meta connection credentials or OAuth Access Tokens not found for this user account.");
        }

        const connData = connSnap.data() || {};
        const secureData = secureSnap.data() || {};

        const token = secureData.threadsAccessToken;
        const threadsUserId = connData.threadsUserId;

        if (!token) {
          throw new Error("OAuth access token is empty or invalid in connections_secure.");
        }
        if (!threadsUserId) {
          throw new Error("Meta threadsUserId is empty or invalid in connections.");
        }

        console.log(`[CRON_DISPATCH] Dynamic retrieval of canonical Threads User ID for user: ${userId}`);
        const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${token}`);
        if (!meRes.ok) {
          const errText = await meRes.text();
          throw new Error(`Meta active token identity fetch failed: ${errText}. Please re-authenticate your Threads account.`);
        }
        const meData = await meRes.json();
        const activeThreadsUserId = meData.id ? String(meData.id) : threadsUserId;

        if (meData.id && String(meData.id) !== String(threadsUserId)) {
          console.log(`[CRON_ID_DISCREPANCY] Stored ID (${threadsUserId}) differs from canonical ID (${meData.id}). Syncing Firestore...`);
          try {
            await db.collection("connections").doc(userId).update({
              threadsUserId: String(meData.id),
              lastConnectedAt: new Date().toISOString()
            });
          } catch (dbErr) {
            console.error("Failed to update connections document with canonical threadsUserId in functions:", dbErr);
          }
        }

        let partsList = [];
        if (postData.threadParts && Array.isArray(postData.threadParts)) {
          partsList = postData.threadParts
            .filter((p) => typeof p === "string" && p.trim() !== "")
            .map((p) => p.trim());
        } else if (postData.singlePost && typeof postData.singlePost === "string") {
          partsList = [postData.singlePost.trim()];
        } else if (postData.text && typeof postData.text === "string") {
          partsList = [postData.text.trim()];
        }

        if (partsList.length === 0) {
          throw new Error("The scheduled post does not contain any valid text elements to publish.");
        }

        console.log(`[DISPATCH_READY] Preparing 2-step Meta Handshake with ${partsList.length} part(s).`);

        const publishedIds = [];
        let previousPostId = null;

        for (let i = 0; i < partsList.length; i++) {
          const partText = partsList[i];

          if (i > 0) {
            await delay(2000);
          }

          console.log(`[HANDSHAKE_A] Creating container for part ${i + 1}/${partsList.length}...`);
          const createContainerUrl = `https://graph.threads.net/v1.0/${activeThreadsUserId}/threads`;
          
          const createBody = {
            media_type: "TEXT",
            text: partText,
            access_token: token
          };

          if (previousPostId) {
            createBody.reply_to_item_id = previousPostId;
          }

          const createRes = await fetch(createContainerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createBody)
          });

          if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Meta media container creation failed at part ${i + 1}: ${errText}`);
          }

          const createData = await createRes.json();
          const containerId = createData.id;

          if (!containerId) {
            throw new Error(`Meta API returned empty Creation/Container ID for part ${i + 1}`);
          }

          let isReady = false;
          let attempts = 0;
          const maxAttempts = 12;

          while (attempts < maxAttempts) {
            await delay(attempts === 0 ? 1500 : 2500);
            attempts++;

            const statusRes = await fetch(`https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${token}`);
            if (!statusRes.ok) continue;

            const statusData = await statusRes.json();
            const lastStatus = statusData.status || "IN_PROGRESS";

            if (lastStatus === "FINISHED" || lastStatus === "PUBLISHED") {
              isReady = true;
              break;
            } else if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
              throw new Error(`Terminal container processing failure: ${statusData.error_message || "Unknown Meta container processing error"}`);
            }
          }

          if (!isReady) {
            console.warn(`[WARNING] Container status polling timed out for container: ${containerId}. Proceeding with publication handshake.`);
          }

          console.log(`[HANDSHAKE_B] Publishing container ID: ${containerId} to live feed...`);
          const publishUrl = `https://graph.threads.net/v1.0/${activeThreadsUserId}/threads_publish?creation_id=${containerId}&access_token=${token}`;
          
          const publishRes = await fetch(publishUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });

          if (!publishRes.ok) {
            const errText = await publishRes.text();
            throw new Error(`Meta publication dispatch failed at part ${i + 1}: ${errText}`);
          }

          const publishData = await publishRes.json();
          const publishedId = publishData.id;

          if (!publishedId) {
            throw new Error(`Meta API responded without confirming final post ID for part ${i + 1}`);
          }

          publishedIds.push(publishedId);
          previousPostId = publishedId;
          console.log(`[HANDSHAKE_SUCCESS] Successfully published part ${i + 1}. Live Thread Post ID: ${publishedId}`);
        }

        await docSnap.ref.update({
          status: "Published",
          isPublished: true,
          publishedIds: publishedIds,
          publishedAt: new Date().toISOString(),
          idempotencyKey: `sched_${postId}_${Date.now()}`,
          error: null,
          errorMessage: null,
          updatedAt: new Date().toISOString()
        });

        await db.collection("publishes").doc(`sched_${postId}`).set({
          userId,
          status: "success",
          postId: publishedIds[0],
          publishedIds,
          parts: partsList,
          threadsUserId: activeThreadsUserId,
          createdAt: new Date().toISOString()
        });

        console.log(`[DISPATCH_SUCCESS] Post ID: ${postId} has been successfully published to the Threads feed.`);

      } catch (err) {
        const failMessage = err.message || String(err);
        console.error(`[DISPATCH_FAILED] Error publishing post ${postId}:`, failMessage);

        await docSnap.ref.update({
          status: "Failed",
          error: failMessage,
          errorMessage: failMessage,
          updatedAt: new Date().toISOString()
        });

        await db.collection("publishes").doc(`sched_${postId}`).set({
          userId,
          status: "failed",
          error: failMessage,
          parts: postData.threadParts || [postData.singlePost || ""],
          createdAt: new Date().toISOString()
        });
      }
    }

  } catch (error) {
    console.error("[SCHEDULER_CRITICAL_FATAL] Global scheduling runner failed:", error);
  }
});
