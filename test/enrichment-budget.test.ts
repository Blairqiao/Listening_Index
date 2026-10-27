import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';
function harness(remaining=700) {
  const calls:string[]=[];let debits=0;
  const pending=Array.from({length:14},(_,i)=>({id:`seed-${i}`,name:'Track',artistName:'Artist',albumName:'Album',albumGroupKey:`group-${i}`}));
  const queries={
    getActiveApiCooldown:async()=>({active:false}),
    checkAndIncrementApiQuota:async(_bucket:string,count:number)=>{if(debits+count>remaining)return {allowed:false,remaining:remaining-debits};debits+=count;return {allowed:true,remaining:remaining-debits};},
    getPendingTracksForEnrichment:async(limit:number)=>pending.slice(0,limit),
    getPendingTracksInAlbum:async(key:string)=>[{id:key.replace('group','seed'),name:'Track',artistName:'Artist'},{id:`${key}-b`,name:'B',artistName:'Artist'},{id:`${key}-c`,name:'C',artistName:'Artist'}],
    bulkApplyEnrichment:async()=>undefined,recordApiCooldown:async()=>undefined,
    getEnrichmentProgress:async()=>({pending:14,enriched:0,delisted:0,total:14}),
  };
  const engine=loadTs('src/lib/enrichment.ts',{'@/lib/db/queries':queries,'@/lib/spotify':{getAccessToken:async()=>'test-token'},'@/lib/db/server-cache':{clearServerCache:()=>undefined}});
  const fetch=async(url:RequestInfo|URL)=>{calls.push(String(url));return Response.json(String(url).includes('/albums/')?{items:[],next:'https://api.spotify.com/v1/albums/album/tracks?offset=50'}:{name:'Track',duration_ms:1000,artists:[{id:'artist',name:'Artist'}],album:{id:'album',name:'Album',images:[]}});};
  return {engine,fetch,calls,get debits(){return debits;}};
}
test('cron ceiling counts Album seed, pages and fallback requests',async()=>{
 const h=harness(); const previous=globalThis.fetch;globalThis.fetch=h.fetch;
 try {await h.engine.runEnrichmentBatch({bucket:'cron'});assert.equal(h.calls.length,14);assert.equal(h.debits,14);} finally {globalThis.fetch=previous;}
});
test('persistent denial stops Spotify calls and reports a UTC reset timestamp',async()=>{
 const h=harness(1);const previous=globalThis.fetch;globalThis.fetch=h.fetch;
 try {const result=await h.engine.runEnrichmentBatch({bucket:'cron'});assert.equal(h.calls.length,1);assert.equal(result.quotaReached,true);assert.ok(Date.parse(result.quotaResetAt)>Date.now());} finally {globalThis.fetch=previous;}
});
