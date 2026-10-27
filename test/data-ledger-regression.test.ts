import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { getDb } from '../src/lib/db';
import { bulkInsertPlays, bulkUpsertTracks } from '../src/lib/db/queries/ingestion';
import { bulkApplyEnrichment } from '../src/lib/db/queries/enrichment';
import { parseHistoryRecords } from '../src/lib/history-parser';
dotenv.config({path:'.env.local',quiet:true});
const id = 'V1datafixture0000000001';
const sql = getDb();
async function fixture() { await bulkUpsertTracks([{id,name:'Fixture',artistName:'Fixture',albumName:'Fixture',durationMs:30000}]); }
async function clean() {await sql`DELETE FROM plays WHERE track_id = ${id}`; await sql`DELETE FROM tracks WHERE id = ${id}`;}
const entry = (playedAt:string,msPlayed=30000) => ({trackId:id,playedAt,msPlayed});
test('realistic export reimport, chronological chunks, exact overlap and maximum duration', async()=>{
  try {
    await fixture();
    const records = ['2020-01-01T00:00:00Z','2020-01-01T00:05:00Z'].map(ts=>({ts,ms_played:30000,master_metadata_track_name:'Fixture',master_metadata_album_artist_name:'Fixture',master_metadata_album_album_name:'Fixture',spotify_track_uri:`spotify:track:${id}`}));
    const parsed = parseHistoryRecords(records);
    assert.equal(parsed.length,2);
    assert.equal((await bulkInsertPlays(parsed.slice(0,1))).insertedCount,1);
    assert.equal((await bulkInsertPlays(parsed.slice(1))).insertedCount,1);
    assert.equal((await bulkInsertPlays(parsed)).insertedCount,0);
    await bulkInsertPlays([entry(records[1].ts,60000)]);
    await bulkInsertPlays([entry(records[1].ts,30000)]);
    const rows=await sql`SELECT ms_played FROM plays WHERE track_id = ${id} ORDER BY played_at`;
    assert.deepEqual(rows.map(r=>r.ms_played),[30000,60000]);
  } finally { await clean(); }
});
test('purge rollback retains both Plays and Track if Track delete fails',async()=>{
  try {
    await fixture(); await bulkInsertPlays([entry('2020-01-01T00:00:00Z')]);
    await sql`CREATE TABLE IF NOT EXISTS v1_remediation_purge_guard (track_id text PRIMARY KEY REFERENCES tracks(id))`;
    await sql`INSERT INTO v1_remediation_purge_guard VALUES (${id}) ON CONFLICT DO NOTHING`;
    await assert.rejects(bulkApplyEnrichment({enriched:[],delistedIds:[id]}));
    const rows=await sql`SELECT count(*)::int AS count FROM plays WHERE track_id = ${id}`;
    assert.equal(rows[0].count,1);
  } finally {await sql`DROP TABLE IF EXISTS v1_remediation_purge_guard`;await clean();}
});
test('recent Spotify metadata resolves a pending Track with authoritative duration',async()=>{
  try {
    await fixture();
    await bulkUpsertTracks([{id,name:'Official',artistName:'Official Artist',albumName:'Official Album',durationMs:20000,enrichmentStatus:'enriched'}]);
    let rows = await sql`SELECT duration_ms, name, enrichment_status FROM tracks WHERE id = ${id}`;
    assert.equal(rows[0].duration_ms,20000);
    assert.equal(rows[0].enrichment_status,'enriched');
    await bulkUpsertTracks([{id,name:'Historical',artistName:'Historical',albumName:'Historical',durationMs:90000}]);
    rows=await sql`SELECT duration_ms,name FROM tracks WHERE id = ${id}`;
    assert.equal(rows[0].duration_ms,20000); assert.equal(rows[0].name,'Official');
  } finally {await clean();}
});
test('purge waits for a concurrent import foreign-key lock and removes its committed Play',async()=>{
  try {
    await fixture(); await bulkInsertPlays([entry('2020-01-01T00:00:00Z')]);
    const importing=sql.transaction([
      sql`SELECT id FROM tracks WHERE id=${id} FOR KEY SHARE`,
      sql`SELECT pg_sleep(2) /* v1_import_ready_marker */`,
      sql`INSERT INTO plays (played_at,track_id,ms_played) VALUES ('2020-01-01T00:05:00Z',${id},30000)`,
    ]);
    const started=importing.then(()=>undefined);
    let locked=false;
    for(let attempt=0;attempt<12;attempt++) {
      const rows=await sql`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid()
        AND query LIKE '%v1_import_ready_marker%' AND wait_event='PgSleep') AS locked`;
      if(rows[0].locked) {locked=true;break;}
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert.equal(locked,true,'import must reach PgSleep after acquiring its foreign-key lock');
    await Promise.all([started,bulkApplyEnrichment({enriched:[],delistedIds:[id]})]);
    const rows=await sql`SELECT (SELECT count(*)::int FROM plays WHERE track_id=${id}) AS plays,(SELECT count(*)::int FROM tracks WHERE id=${id}) AS tracks`;
    assert.deepEqual(rows[0],{plays:0,tracks:0});
  } finally {await clean();}
});
test('forward-only recent playback response overlap stays idempotent before exact export overlap',async()=>{
  try {
    await fixture();
    const recent=(times:string[])=>times.map(played_at=>({played_at,track:{id,duration_ms:180000,name:'Fixture',artists:[{id:'artist',name:'Fixture'}],album:{id:'album',name:'Fixture',images:[]}}}));
    const toPlays=(items:ReturnType<typeof recent>)=>items.map(item=>entry(item.played_at,item.track.duration_ms));
    const first=recent(['2020-01-01T00:00:00.543Z','2020-01-01T00:03:00.123Z']);
    const next=recent(['2020-01-01T00:03:00.123Z','2020-01-01T00:06:00.789Z']);
    assert.equal((await bulkInsertPlays(toPlays(first))).insertedCount,2);
    assert.equal((await bulkInsertPlays(toPlays(next))).insertedCount,1);
    await bulkInsertPlays([entry('2020-01-01T00:03:00Z',60000)]);
    const rows=await sql`SELECT ms_played FROM plays WHERE track_id=${id} ORDER BY played_at`;
    assert.deepEqual(rows.map(r=>r.ms_played),[180000,180000,180000]);
  } finally {await clean();}
});
