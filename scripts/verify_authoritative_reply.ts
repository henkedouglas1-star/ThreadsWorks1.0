import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { publishThreadsReply, shortcodeToMediaId } from "../server/influencerOutreachService";
import { VERIFIED_THREADS_CREATORS } from "../server/influencerIntelligenceService";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = getApps().length === 0 ? initializeApp(config) : getApp();
const db = getFirestore(app, config.firestoreDatabaseId);

async function runEndToEndVerification() {
  console.log("=== STEP 1: TRACE ONE REPLY ONLY ===");
  const userId = "vtMSWyRs4YbUqwwCZsdW3Tvv2wk2";
  
  // Fetch real credentials
  const [connSnap, secureSnap] = await Promise.all([
    db.collection("connections").doc(userId).get(),
    db.collection("connections_secure").doc(userId).get(),
  ]);
  
  const token = secureSnap.data()?.threadsAccessToken;
  const threadsUserId = connSnap.data()?.threadsUserId;
  const threadsUsername = connSnap.data()?.threadsUsername;

  console.log("Authenticated User Profile:", {
    userId,
    threadsUserId,
    threadsUsername,
    hasToken: Boolean(token),
  });

  if (!token || !threadsUserId) {
    throw new Error("Missing Threads access token or user ID");
  }

  // STEP 2: VERIFY THE TARGET POST ID
  console.log("\n=== STEP 2: VERIFY THE TARGET POST ID ===");
  // Select creator: Mark Zuckerberg (@zuck) from VERIFIED_THREADS_CREATORS
  const zuckCreator = VERIFIED_THREADS_CREATORS.find((c) => c.threadsUsername === "zuck")!;
  const targetPost = zuckCreator.recentPosts[0]; // { id: "17960968839079838", shortcode: "DeZtp-TkQHh", ... }

  console.log("Selected Creator Post Object from Directory:", {
    id: targetPost.id,
    shortcode: targetPost.shortcode,
    permalink: targetPost.url,
    username: zuckCreator.threadsUsername,
    text: targetPost.text.slice(0, 80) + "...",
  });

  // Verify resolution
  const replyToIdActuallySent = shortcodeToMediaId(targetPost.id);
  console.log("Diagnostic Comparison:", {
    "targetPost.id": targetPost.id,
    "targetPost.shortcode": targetPost.shortcode,
    "targetPost.permalink": targetPost.url,
    replyToIdActuallySent,
    "isMatch": replyToIdActuallySent === targetPost.id,
    "isValidMetaGraphId": Boolean(replyToIdActuallySent && /^1[789]\d{14,16}$/.test(replyToIdActuallySent)),
  });

  if (!replyToIdActuallySent || replyToIdActuallySent !== targetPost.id) {
    throw new Error(`Target post ID verification failed: ${replyToIdActuallySent} !== ${targetPost.id}`);
  }

  // STEP 3, 4, 5, 6, 7, 8: EXECUTE PUBLICATION VIA publishThreadsReply
  console.log("\n=== STEPS 3 - 8: CALLING publishThreadsReply ===");
  const testReplyText = `Insightful perspective on frontier reasoning models @${zuckCreator.threadsUsername}. Operational persistence across multi-day tasks is where the real leverage compounds.`;

  const result = await publishThreadsReply({
    userId,
    comment: testReplyText,
    replyToId: targetPost.id,
    idempotencyKey: `verify_reply_${Date.now()}`,
  });

  console.log("\n=== EXECUTION RESULT ===");
  console.log("Result:", JSON.stringify(result, null, 2));

  if (!result.success || !result.postId) {
    throw new Error(`Reply publication failed: ${result.error}`);
  }

  // STEP 7: VERIFY THE PUBLISHED MEDIA OBJECT DIRECTLY ON META
  console.log("\n=== STEP 7: INDEPENDENT VERIFICATION OF PUBLISHED OBJECT ===");
  const mediaRes = await fetch(
    `https://graph.threads.net/v1.0/${result.postId}?fields=id,media_type,text,permalink&access_token=${token}`
  );
  console.log("Meta GET /<PUBLISHED_MEDIA_ID> status:", mediaRes.status);
  const mediaData = await mediaRes.json();
  console.log("Meta Published Object Data:", mediaData);

  if (mediaRes.status !== 200 || mediaData.id !== result.postId) {
    throw new Error(`Meta media object verification failed! Received: ${JSON.stringify(mediaData)}`);
  }

  // STEP 8: VERIFY IT IS ACTUALLY ATTACHED AS A REPLY TO THE TARGET POST
  console.log("\n=== STEP 8: VERIFY ATTACHMENT IN TARGET POST CONVERSATION ===");
  const convRes = await fetch(
    `https://graph.threads.net/v1.0/${targetPost.id}/conversation?fields=id,text,permalink&access_token=${token}`
  );
  console.log("Meta GET /<TARGET_POST_ID>/conversation status:", convRes.status);
  const convData = await convRes.json();
  const replyMatch = convData.data?.find((item: any) => item.id === result.postId);

  console.log("Attachment Result:", {
    targetPostId: targetPost.id,
    publishedReplyId: result.postId,
    foundInConversationChain: Boolean(replyMatch),
    conversationItem: replyMatch,
  });

  if (!replyMatch) {
    throw new Error("Reply verification failed: Published post is not attached to target post conversation!");
  }

  console.log("\nSUCCESS: All 8 steps verified empirically with live Meta Graph API!");
}

runEndToEndVerification().catch((e) => {
  console.error("FATAL ERROR in verification:", e);
  process.exit(1);
});
