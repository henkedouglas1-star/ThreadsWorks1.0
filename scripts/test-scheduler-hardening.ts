
import assert from "assert";

// Mocking the claim logic within the server
interface Post {
  id: string;
  status: "Scheduled" | "Publishing" | "Published" | "Missed";
  isPublished: boolean;
  scheduledFor: Date;
}

const posts: Post[] = [
  {
    id: "post-1",
    status: "Scheduled",
    isPublished: false,
    scheduledFor: new Date(Date.now() - 1000) // Overdue
  }
];

async function simulateAtomicClaim(postId: string, workerId: string): Promise<boolean> {
  // Simulate transaction:
  const post = posts.find(p => p.id === postId);
  if (!post) return false;
  if (post.status !== "Scheduled") return false;

  // Simulate transactional check
  console.log(`[${workerId}] Checking status: ${post.status}`);
  
  // Simulate delay to allow race
  await new Promise(r => setTimeout(r, 100));
  
  // If post is still "Scheduled", update
  if (post.status === "Scheduled") {
    console.log(`[${workerId}] Claiming post!`);
    post.status = "Publishing";
    return true;
  }
  
  console.log(`[${workerId}] Claim failed: status is now ${post.status}`);
  return false;
}

async function runTest() {
  console.log("=== RUNNING CONCURRENCY TEST ===");
  
  const worker1 = simulateAtomicClaim("post-1", "Worker-1");
  const worker2 = simulateAtomicClaim("post-1", "Worker-2");

  const [res1, res2] = await Promise.all([worker1, worker2]);
  
  console.log(`Results: Worker-1 succeeded: ${res1}, Worker-2 succeeded: ${res2}`);
  
  // Strict assertion: exactly one worker must succeed
  const successes = [res1, res2].filter(Boolean).length;
  assert.strictEqual(successes, 1, "Exactly one worker should succeed!");
  
  console.log("=== TEST PASSED: ONLY ONE WORKER CLAIMED ===");
}

runTest().catch(console.error);
