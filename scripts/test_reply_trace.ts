import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = getApps().length === 0 ? initializeApp(config) : getApp();
const db = getFirestore(app, config.firestoreDatabaseId);

async function runTrace() {
  const userId = "vtMSWyRs4YbUqwwCZsdW3Tvv2wk2";
  const secureSnap = await db.collection("connections_secure").doc(userId).get();
  const token = secureSnap.data()?.threadsAccessToken;
  const connSnap = await db.collection("connections").doc(userId).get();
  const threadsUserId = connSnap.data()?.threadsUserId;

  console.log("Authenticated User:", { userId, threadsUserId });

  // Test targets:
  // Target A: Own post (18124080449486329 - shortcode DeiCOgTAX4M)
  // Target B: Zuck post from VERIFIED_CREATORS (17960968839079838)
  // Target C: Mosseri post from VERIFIED_CREATORS (18080067998385405)
  // Target D: Shortcode directly (DeZtp-TkQHh)
  // Target E: Bogus decoded shortcode (4006434140014576097)

  const targets = [
    { label: "Target B (Zuck post ID: 17960968839079838)", id: "17960968839079838" },
    { label: "Target C (Mosseri post ID: 18080067998385405)", id: "18080067998385405" },
    { label: "Target D (Shortcode directly: DeZtp-TkQHh)", id: "DeZtp-TkQHh" },
    { label: "Target E (Bogus decoded shortcode: 4006434140014576097)", id: "4006434140014576097" },
  ];

  for (const target of targets) {
    console.log("\n=======================================================");
    console.log("TESTING:", target.label);
    const payload = {
      media_type: "TEXT",
      text: "Testing reply traceability for ThreadsWorks Creator Outreach.",
      reply_to_id: target.id,
      access_token: token,
    };

    console.log("Sanitized outgoing request:", {
      endpoint: `https://graph.threads.net/v1.0/${threadsUserId}/threads`,
      method: "POST",
      media_type: payload.media_type,
      textPresent: Boolean(payload.text),
      reply_to_id: payload.reply_to_id,
      authenticatedThreadsUserId: threadsUserId,
    });

    try {
      const res = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("Meta Response HTTP Status:", res.status);
      const text = await res.text();
      console.log("Meta Response Body:", text);
    } catch (err: any) {
      console.error("Fetch error:", err.message);
    }
  }
}

runTrace();
