
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp();
const db = getFirestore(app);

async function listPosts() {
  const posts = await db.collection("posts")
    .where("status", "==", "Scheduled")
    .get();
    
  posts.forEach(doc => {
    console.log(JSON.stringify({id: doc.id, ...doc.data()}));
  });
}

listPosts();
