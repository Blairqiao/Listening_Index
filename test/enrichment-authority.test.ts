import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { loadTs } from './helpers/load-ts';
test('enrichment route rejects anonymous cron, empty work and rotated keys before engine invocation',async()=>{
 let key='current-key';let calls=0;
 const stubs={
  '@/lib/db':{isDbConfigured:()=>true},
  '@/lib/db/queries':{getCronKey:async()=>key},
  '@/lib/enrichment':{runEnrichmentBatch:async()=>{calls++;return {progress:{pending:1},isComplete:false};}},
  '@/lib/spotify':{isOwnerSpotifyConfigured:async()=>true},
 };
 const route=loadTs('src/app/api/upload/enrich/route.ts',stubs);
 const request=(body:unknown,token?:string)=>new NextRequest('http://127.0.0.1:8888/api/upload/enrich',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 for(const body of [{},{source:'cron'},{source:'cron',trackIds:['track']}]) {
  const response=await route.POST(request(body));assert.equal(response.status,401);assert.equal(calls,0);
 }
 assert.equal((await route.POST(request({source:'cron'},'wrong'))).status,401);assert.equal(calls,0);
 assert.equal((await route.POST(request({source:'dynamic',trackIds:['track']}))).status,200);assert.equal(calls,1);
 assert.equal((await route.POST(request({source:'dynamic'}))).status,400);assert.equal(calls,1);
 assert.equal((await route.POST(request({source:'cron'},key))).status,200);assert.equal(calls,2);
 key='rotated-key';assert.equal((await route.POST(request({source:'cron'},'current-key'))).status,401);assert.equal(calls,2);
});
test('concurrent initial cron key requests return the authoritative first key',async()=>{
 let key:string|null=null;
 const sql=async(strings:TemplateStringsArray,...values:unknown[])=>{
   const text=strings.join('?');
   if(text.includes('SELECT cron_key'))return [];
   if(text.includes('INSERT INTO site_settings')){
     const proposed=values.find(v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v)) as string;
     if(text.includes('COALESCE(site_settings.cron_key'))key=key||proposed;else key=proposed;
     return [{cron_key:key}];
   }
   return [];
 };
 const config=loadTs('src/lib/db/queries/config.ts',{'../index':{getDb:()=>sql,isDbConfigured:()=>true},'@/config':{siteConfig:{}},'./schema':{ensureTablesExist:async()=>undefined},'./cache':{siteConfigCache:{invalidate:()=>undefined}}});
 const keys=await Promise.all(Array.from({length:8},()=>config.getCronKey()));
 assert.equal(new Set(keys).size,1);assert.equal(keys[0],key);
});
