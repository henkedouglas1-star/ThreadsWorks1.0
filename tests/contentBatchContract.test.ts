import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolveBatchRequest, normalizeBatchPosts, writeValidatedChunk } from '../server/contentBatchContract.ts';
const post = (text = 'A clear idea can stand on its own.') => ({ title: 'An idea', hook: text, threadParts: [text], cta: '' });
const validate = (raw: unknown) => normalizeBatchPosts(raw, 1, { characterLimit: 500 });
test('request is independent of creator background', () => {
 assert.equal(resolveBatchRequest({contentRequest:'Explain bird migration', topic:'Birds', customInstruction:'I sell software'}), 'Explain bird migration');
 assert.equal(resolveBatchRequest({topic:'Explain birds',customInstruction:'Biography'}),'Explain birds');
 assert.throws(() => resolveBatchRequest({customInstruction:'Biography'}));
});
test('incomplete 32-post response is rejected, not padded', () => {
 assert.throws(() => normalizeBatchPosts(Array.from({length:9}, (_,i)=>post(`Idea ${i}.`)),32,{characterLimit:500}), /expected 32/);
});
test('valid short post and first person facts are unchanged', () => {
 const p = post('I work at Peet’s Coffee.');
 assert.deepEqual(validate([p])[0].threadParts,p.threadParts);
});
test('rejects oversized parts without truncating', () => {
 assert.throws(() => validate([post('x'.repeat(501))]), /exceeds/);
});
test('rejects internal filler labels', () => {
 assert.throws(() => validate([post('Principle #32: Execution focus')]), /planning label/);
});
test('destination intro cannot point to a question', () => {
 assert.throws(()=>validate([post('Start here: What would you try?')]), /missing its URL/);
 assert.throws(()=>validate([post('Start here:')]), /missing its URL/);
});
test('approved URL survives without footer rewriting', () => {
 const text='Read the guide. Start here:\n\nhttps://example.com/guide';
 assert.equal(normalizeBatchPosts([post(text)],1,{characterLimit:500,allowedUrls:['https://example.com/guide']})[0].singlePost,text);
 assert.throws(()=>validate([post(text)]), /unauthorized URL/);
});
test('copied background paragraphs are rejected', () => {
 const source='These are my writing instructions. '.repeat(8);
 assert.throws(()=>normalizeBatchPosts([post(source)],1,{characterLimit:500,sourceTexts:[source]}), /copied/);
});
test('duplicate hooks are rejected across chunks',()=>{
 assert.throws(()=>normalizeBatchPosts([post()],1,{characterLimit:500,priorHooks:['A clear idea can stand on its own!']}), /Repeated hook/);
});
test('format and locked opening are enforced',()=>{
 assert.throws(()=>normalizeBatchPosts([post()],1,{characterLimit:500,partCount:2}), /thread length/);
 assert.throws(()=>normalizeBatchPosts([post()],1,{characterLimit:500,lockedHook:'Locked opening'}), /Locked opening/);
});
test('semantic findings cause one rewrite through the same validator', async()=>{
 let writes=0, reviews=0;
 const result=await writeValidatedChunk(async feedback=>{
  writes++; if(writes===2) assert.match(feedback,/unsupported anecdote/);
  return [post(writes===1?'I planted an apple tree.':'Think of growth like tending a garden.')];
 },validate,async()=>++reviews===1?['unsupported anecdote: no supplied tree-planting experience']:[]);
 assert.equal(writes,2); assert.equal(result[0].singlePost,'Think of growth like tending a garden.');
});
test('repair exhaustion is finite and does not manufacture content', async()=>{
 let writes=0;
 await assert.rejects(writeValidatedChunk(async()=>{writes++;return [];},validate,async()=>[]), /after one revision/);
 assert.equal(writes,2);
});
test('provider failures propagate without a writing retry', async()=>{
 let writes=0;
 await assert.rejects(writeValidatedChunk(async()=>{writes++;throw new Error('quota');},validate,async()=>[]), /quota/);
 assert.equal(writes,1);
});
test('active endpoint and frontend no longer mutate accepted V3 content',()=>{
 const server=readFileSync(new URL('../server.ts',import.meta.url),'utf8');
 const route=server.slice(server.indexOf('app.post("/api/generate-posts-batch"'),server.indexOf('// Helper function to transform Hooks'));
 for(const obsolete of ['verifyAndRepairPost(', 'applyMyLinksToBatch(', 'validateAndEnforceBatchUniqueness(']) assert.equal(route.includes(obsolete),false);
 assert.ok(route.indexOf('normalizeBatchPosts(generatedPosts') < route.indexOf('await commitGeneration'));
 const client=readFileSync(new URL('../src/components/ContentEngineView.tsx',import.meta.url),'utf8');
 assert.equal(client.includes('Principle #${missingIdx'),false);
 assert.ok(client.slice(client.indexOf('const parsedPosts = finalPostsArray.map')).includes('data.generatorVersion === "V3" ? { post:'));
});

test('generation prompts do not hardcode an individual creator identity', () => {
 const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
 const rulebook = readFileSync(new URL('../rulebook.ts', import.meta.url), 'utf8');
 assert.equal(server.includes("Douglas C. Henke's digital entrepreneur"), false);
 assert.equal(rulebook.includes("Douglas C. Henke's digital entrepreneur"), false);
});

test('removed Cash Machine integration cannot influence post generation', () => {
 const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
 assert.equal(server.includes('cashMachine') || server.includes('CashMachine') || server.includes('/api/cash-machine'), false);
 const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
 const contentEngine = readFileSync(new URL('../src/components/ContentEngineView.tsx', import.meta.url), 'utf8');
 const rulebook = readFileSync(new URL('../rulebook.ts', import.meta.url), 'utf8');
 for (const source of [app, contentEngine, rulebook]) {
  assert.equal(/cashMachine|CashMachine|cash-machine/i.test(source), false);
 }
 assert.equal(existsSync(new URL('../server/cashMachineService.ts', import.meta.url)), false);
});

test('active V3 writer includes grounded creative guidance without replacing its validation contract', () => {
 const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
 const route = server.slice(server.indexOf('app.post("/api/generate-posts-batch"'), server.indexOf('// Helper function to transform Hooks'));
 assert.ok(route.includes('creativeGuidance: { prioritize:'));
 assert.ok(route.includes('Do not invent anecdotes to add specificity.'));
 assert.ok(route.includes('writeValidatedChunk('));
 assert.ok(route.includes('normalizeBatchPosts(generatedPosts'));
});


test('CI offline mode prevents Firestore access in creator services', () => {
 const discovery = readFileSync(new URL('../server/creatorDiscoveryEngine.ts', import.meta.url), 'utf8');
 const outreach = readFileSync(new URL('../server/influencerOutreachService.ts', import.meta.url), 'utf8');
 const intelligence = readFileSync(new URL('../server/influencerIntelligenceService.ts', import.meta.url), 'utf8');
 for (const source of [discovery, outreach, intelligence]) {
  assert.ok(source.includes("process.env.THREADSWORKS_TEST_OFFLINE === '1'"));
 }
});
