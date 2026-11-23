import test from 'node:test';
import assert from 'node:assert/strict';
import { callGenerateContentWithRetry } from '../server/geminiClient';
import { tripQuotaCircuitBreaker } from '../server/aiCostOptimizationEngine';

test('strict writer preserves explicit token budget and does not forward internal flag', async()=>{
 let captured:any;
 const ai={models:{generateContent:async(params:any)=>{captured=params;return {text:'[]'};}}};
 await callGenerateContentWithRetry(ai,{strictContentGeneration:true,optimizationTaskId:'GENERATE_POSTS_BATCH',contents:'unique writer test',config:{maxOutputTokens:12000}});
 assert.equal(captured.config.maxOutputTokens,12000);
 assert.equal(captured.contents,'unique writer test');
 assert.equal('strictContentGeneration' in captured,false);
});
test('strict writer reports unavailable circuit instead of simulated posts', async()=>{
 let calls=0;
 tripQuotaCircuitBreaker('test circuit',1000);
 try {
  await assert.rejects(callGenerateContentWithRetry({models:{generateContent:async()=>{calls++;return {text:'[]'};}}},{strictContentGeneration:true,contents:'unique blocked writer test'}), /temporarily unavailable/);
  assert.equal(calls,0);
 } finally {tripQuotaCircuitBreaker('reset',0);}
});
test('strict writer propagates provider authentication failure without simulation', async()=>{
 tripQuotaCircuitBreaker('reset',0);
 const ai={models:{generateContent:async()=>{throw new Error('API key not valid');}}};
 try {
  await assert.rejects(callGenerateContentWithRetry(ai,{strictContentGeneration:true,contents:'unique auth test'}),/API key not valid/);
 } finally {tripQuotaCircuitBreaker('reset',0);}
});
test('gemini 3/4 standard and light calls default to ThinkingLevel.LOW while preserving explicit thinkingConfig overrides', async()=>{
 let defaultCaptured:any;
 let overrideCaptured:any;
 const ai={models:{generateContent:async(params:any)=>{
  if (!defaultCaptured) defaultCaptured=params;
  else overrideCaptured=params;
  return {text:'[]'};
 }}};
 await callGenerateContentWithRetry(ai,{strictContentGeneration:true,optimizationTaskId:'REVIEW_CONTENT_BATCH',optimizationComplexity:'LEVEL_1_LIGHT',contents:'low thinking default test',config:{maxOutputTokens:2500}});
 await callGenerateContentWithRetry(ai,{strictContentGeneration:true,optimizationTaskId:'GENERATE_POSTS_BATCH',optimizationComplexity:'LEVEL_2_STANDARD',contents:'explicit thinking override test',config:{maxOutputTokens:4000,thinkingConfig:{thinkingLevel:'HIGH'}}});
 assert.equal(defaultCaptured.config.thinkingConfig?.thinkingLevel,'LOW');
 assert.equal(overrideCaptured.config.thinkingConfig?.thinkingLevel,'HIGH');
});
