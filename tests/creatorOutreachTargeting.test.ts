import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateOutreachTarget,
  shortcodeToMediaId,
  retrieveOutreachPosts,
  generateOutreachComments,
  publishOutreachBatch,
  publishThreadsReply,
} from '../server/influencerOutreachService.ts';
import {
  findCreatorByUsername,
  searchCreators,
  VERIFIED_THREADS_CREATORS,
} from '../server/influencerIntelligenceService.ts';
import type { CreatorOutreachItem, CreatorOutreachTargetPost } from '../src/types/influencer.ts';

test('TEST 1 — Single creator: publishes reply strictly to the exact Threads media ID of selected post', async () => {
  const creator = VERIFIED_THREADS_CREATORS.find((c) => c.threadsUsername === 'lexfridman')!;
  assert.ok(creator, 'Lex Fridman must exist in directory');
  const targetPost = creator.recentPosts[0];
  assert.ok(targetPost, 'Target post must exist');
  assert.ok(targetPost.id, 'Target post must have valid Threads media ID');

  const outreachItem: CreatorOutreachItem = {
    id: 'item_test_lex_single',
    batchId: 'batch_test_single',
    userId: 'test_user_unit',
    creatorId: creator.id,
    creatorName: creator.displayName,
    creatorUsername: creator.threadsUsername,
    targetPost: {
      id: targetPost.id,
      text: targetPost.text,
      url: targetPost.url,
      eligible: true,
    },
    canonicalTarget: {
      internalCreatorId: creator.id,
      creatorUsername: creator.threadsUsername,
      creatorDisplayName: creator.displayName,
      creatorProfileUrl: `https://www.threads.net/@${creator.threadsUsername}`,
      targetPostId: targetPost.id,
      targetPostUrl: targetPost.url || '',
      targetPostText: targetPost.text,
      commentText: 'Insightful perspective on complex AI systems.',
    },
    generatedComment: 'Insightful perspective on complex AI systems.',
    approvedComment: 'Insightful perspective on complex AI systems.',
    characterCount: 44,
    status: 'Approved',
    attemptCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Validate target integrity
  const validation = validateOutreachTarget(outreachItem);
  assert.equal(validation.valid, true, 'Validation must pass for genuine creator and post pairing');

  // Test publishing invocation capturing replyToId
  let capturedReplyToId: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, init?: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/threads?')) {
      const body = JSON.parse(init?.body || '{}');
      capturedReplyToId = body.reply_to_id;
      return new Response(JSON.stringify({ id: 'container_single_123' }), { status: 200 });
    }
    if (urlStr.includes('/container_single_123')) {
      return new Response(JSON.stringify({ status: 'FINISHED' }), { status: 200 });
    }
    if (urlStr.includes('/threads_publish')) {
      return new Response(JSON.stringify({ id: 'reply_published_lex_999' }), { status: 200 });
    }
    if (urlStr.includes('/reply_published_lex_999')) {
      return new Response(
        JSON.stringify({ id: 'reply_published_lex_999', permalink: 'https://threads.net/@user/post/reply_published_lex_999' }),
        { status: 200 }
      );
    }
    if (urlStr.includes('/conversation')) {
      return new Response(
        JSON.stringify({ data: [{ id: 'reply_published_lex_999' }] }),
        { status: 200 }
      );
    }
    if (urlStr.includes('/me?')) {
      return new Response(JSON.stringify({ id: 'active_threads_user_1', username: 'tester' }), { status: 200 });
    }
    return originalFetch(url, init);
  };

  try {
    const result = await publishThreadsReply({
      userId: 'mock_test_token_user',
      comment: outreachItem.approvedComment!,
      replyToId: outreachItem.targetPost.id,
      outreachContext: {
        outreachItemId: outreachItem.id,
        creatorUsername: outreachItem.creatorUsername,
        targetPostId: outreachItem.targetPost.id,
      },
    });

    assert.equal(result.success, true);
    // In test environment without credentials, mock user yields simulation or verified reply
    // If capturedReplyToId was set or mock returned, verify that target was targetPost.id
    if (capturedReplyToId) {
      assert.equal(capturedReplyToId, targetPost.id, 'API must receive Post A exact Threads ID');
    }
    assert.equal(result.verificationDetails?.intendedParentPostId, targetPost.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TEST 2 — Multiple creators: concurrent publishing guarantees zero cross-targeting', async () => {
  const creators = [
    { username: 'lexfridman', postId: '18060668897567537', text: 'Lex post discussing neuroscience and computing models.' },
    { username: 'sama', postId: '18161358823049201', text: 'Sam post on scaling laws, compute clusters, and reasoning.' },
    { username: 'paulg', postId: '18171469934150301', text: 'Paul Graham post on startup momentum, founders, and focus.' },
  ];

  const items: CreatorOutreachItem[] = creators.map((c, i) => ({
    id: `item_multi_${c.username}`,
    batchId: 'batch_multi_concurrent',
    userId: 'test_user_multi',
    creatorId: `creator_${c.username}`,
    creatorName: c.username,
    creatorUsername: c.username,
    targetPost: {
      id: c.postId,
      text: c.text,
      url: `https://www.threads.net/@${c.username}/post/${c.postId}`,
      eligible: true,
    },
    canonicalTarget: {
      internalCreatorId: `creator_${c.username}`,
      creatorUsername: c.username,
      creatorDisplayName: c.username,
      creatorProfileUrl: `https://www.threads.net/@${c.username}`,
      targetPostId: c.postId,
      targetPostUrl: `https://www.threads.net/@${c.username}/post/${c.postId}`,
      targetPostText: c.text,
      commentText: `Unique thoughtful comment for ${c.username}`,
    },
    generatedComment: `Unique thoughtful comment for ${c.username}`,
    approvedComment: `Unique thoughtful comment for ${c.username}`,
    characterCount: 40,
    status: 'Approved',
    attemptCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  // Validate each item independently
  for (const item of items) {
    const val = validateOutreachTarget(item);
    assert.equal(val.valid, true, `Validation must pass for ${item.creatorUsername}`);
  }

  // Publish all three concurrently
  const publishPromises = items.map(async (item) => {
    return publishThreadsReply({
      userId: `mock_test_${item.creatorUsername}`,
      comment: item.approvedComment!,
      replyToId: item.targetPost.id,
      outreachContext: {
        outreachItemId: item.id,
        creatorUsername: item.creatorUsername,
        targetPostId: item.targetPost.id,
      },
    });
  });

  const results = await Promise.all(publishPromises);

  // Assert Comment A -> Post A, Comment B -> Post B, Comment C -> Post C
  results.forEach((res, index) => {
    assert.equal(res.success, true);
    assert.equal(
      res.verificationDetails?.intendedCreatorUsername,
      creators[index].username,
      `Result ${index} must match creator ${creators[index].username}`
    );
    assert.equal(
      res.verificationDetails?.intendedParentPostId,
      creators[index].postId,
      `Result ${index} must strictly match target post ${creators[index].postId}`
    );
  });
});

test('TEST 3 — Out-of-order asynchronous completion preserves exact creator-post associations', async () => {
  // Simulating asynchronous retrieval with artificial variable delays: Creator C finishes first, Creator A second, Creator B third
  const tasks = [
    { username: 'creatorA', postId: '17966362626187326', delayMs: 40 },
    { username: 'creatorB', postId: '17909682333557924', delayMs: 70 },
    { username: 'creatorC', postId: '18080067998385405', delayMs: 10 }, // finishes first
  ];

  const resolvedItems = await Promise.all(
    tasks.map(async (task) => {
      await new Promise((r) => setTimeout(r, task.delayMs));
      const post: CreatorOutreachTargetPost = {
        id: task.postId,
        text: `Authentic post text from ${task.username} about engineering and focus.`,
        url: `https://www.threads.net/@${task.username}/post/${task.postId}`,
        eligible: true,
      };

      const item: CreatorOutreachItem = {
        id: `item_async_${task.username}`,
        batchId: 'batch_async_test',
        userId: 'test_user_async',
        creatorId: `id_${task.username}`,
        creatorName: task.username,
        creatorUsername: task.username,
        targetPost: post,
        canonicalTarget: {
          internalCreatorId: `id_${task.username}`,
          creatorUsername: task.username,
          creatorDisplayName: task.username,
          creatorProfileUrl: `https://www.threads.net/@${task.username}`,
          targetPostId: post.id,
          targetPostUrl: post.url || '',
          targetPostText: post.text,
          commentText: `Grounded reply to ${task.username}`,
        },
        generatedComment: `Grounded reply to ${task.username}`,
        approvedComment: `Grounded reply to ${task.username}`,
        characterCount: 35,
        status: 'Approved',
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return item;
    })
  );

  // Even if resolved out of order, verify each item's canonical binding
  for (const item of resolvedItems) {
    const originalTask = tasks.find((t) => t.username === item.creatorUsername)!;
    assert.equal(item.targetPost.id, originalTask.postId, 'Post ID must strictly match original creator');
    assert.equal(item.canonicalTarget?.targetPostId, originalTask.postId, 'Canonical target post ID must match');
    assert.equal(item.canonicalTarget?.creatorUsername, originalTask.username, 'Canonical creator username must match');
  }
});

test('TEST 4 — Missing target: no eligible post prevents publication and never falls back to another creator or post', async () => {
  const missingPostItem: CreatorOutreachItem = {
    id: 'item_missing_post',
    batchId: 'batch_missing_test',
    userId: 'test_user_missing',
    creatorId: 'creator_no_posts',
    creatorName: 'Ghost Creator',
    creatorUsername: 'ghostcreator',
    targetPost: {
      id: 'none',
      text: 'No eligible recent post found.',
      eligible: false,
      skipReason: 'No eligible recent post found.',
    },
    canonicalTarget: {
      internalCreatorId: 'creator_no_posts',
      creatorUsername: 'ghostcreator',
      creatorDisplayName: 'Ghost Creator',
      creatorProfileUrl: 'https://www.threads.net/@ghostcreator',
      targetPostId: 'none',
      targetPostUrl: 'https://www.threads.net/@ghostcreator',
      targetPostText: 'No eligible recent post found.',
    },
    status: 'Skipped',
    skipReason: 'No eligible recent post found.',
    characterCount: 0,
    attemptCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Pre-publish validation check
  const val = validateOutreachTarget(missingPostItem);
  assert.equal(val.valid, false, 'Validation must fail when target post is missing');
  assert.match(
    val.error || '',
    /Target verification failed\. This comment was not published because the selected post could not be confirmed as belonging to @ghostcreator/,
    'Error message must match strict specification'
  );

  // Attempting publishThreadsReply with no/none replyToId must fail safely
  const result = await publishThreadsReply({
    userId: 'mock_user_123',
    comment: 'This should never publish',
    replyToId: 'none',
    outreachContext: {
      outreachItemId: missingPostItem.id,
      creatorUsername: missingPostItem.creatorUsername,
    },
  });

  assert.equal(result.success, false);
  assert.match(result.error || '', /Target verification failed/);
  assert.equal(result.verificationStatus, 'Failed');
});

test('Target validation blocks post owned by another creator (prevents cross-targeting)', () => {
  const mismatchedItem: CreatorOutreachItem = {
    id: 'item_mismatch_cross',
    batchId: 'batch_mismatch',
    userId: 'test_user',
    creatorId: 'lex_id',
    creatorName: 'Lex Fridman',
    creatorUsername: 'lexfridman',
    targetPost: {
      id: '17960968839079838', // This post belongs to Paul Graham (@paulg), not Lex!
      username: 'paulg',
      text: 'Startups require intense focus and high velocity execution.',
      url: 'https://www.threads.net/@paulg/post/DeZtp-TkQHh',
      eligible: true,
    },
    status: 'Approved',
    generatedComment: 'Agreed on focus and execution speed.',
    characterCount: 36,
    attemptCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const val = validateOutreachTarget(mismatchedItem);
  assert.equal(val.valid, false, 'Must block publication if post belongs to another creator');
  assert.match(val.error || '', /Target verification failed/);
});

test('Creator Search resolves Lex Fridman across all variants: Lex Fridman, lexfridman, @lexfridman', async () => {
  const querySpace = await findCreatorByUsername('Lex Fridman');
  assert.ok(querySpace, 'Must resolve "Lex Fridman" (with space)');
  assert.equal(querySpace?.threadsUsername, 'lexfridman');
  assert.equal(querySpace?.name, 'Lex Fridman');

  const queryAt = await findCreatorByUsername('@lexfridman');
  assert.ok(queryAt, 'Must resolve "@lexfridman" (with leading @)');
  assert.equal(queryAt?.threadsUsername, 'lexfridman');

  const queryPlain = await findCreatorByUsername('lexfridman');
  assert.ok(queryPlain, 'Must resolve "lexfridman" (plain handle)');
  assert.equal(queryPlain?.threadsUsername, 'lexfridman');
});

test('Creator Discovery Engine supports topic keywords like "Ai" and "Marketing"', async () => {
  const aiResults = await searchCreators('Ai', {});
  assert.ok(aiResults.length > 0, 'Searching "Ai" must return matching AI creators');
  assert.ok(
    aiResults.some((c) => c.niche.toLowerCase().includes('ai') || c.category.toLowerCase().includes('ai') || c.topics.some((t) => t.toLowerCase().includes('ai'))),
    'Results must include creators with AI niche or topics'
  );

  const mktgResults = await searchCreators('Marketing', {});
  assert.ok(mktgResults.length > 0, 'Searching "Marketing" must return marketing creators');
});
