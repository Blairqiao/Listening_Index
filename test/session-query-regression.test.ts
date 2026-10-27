import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { getDb } from '../src/lib/db';
import { bulkUpsertTracks } from '../src/lib/db/queries/ingestion';
import { getCurrentSession } from '../src/lib/db/queries/session';
import { getStreamLog } from '../src/lib/db/queries/stream-log';
dotenv.config({path:'.env.local',quiet:true});
test('complete Session context survives the old 600-row cutoff and Stream Log pagination',async()=>{
  const sql=getDb(); const trackId='V1sessionfixture0000001'; const base=Date.parse('2099-01-01T00:00:00Z');
  try {
    await bulkUpsertTracks([{id:trackId,name:'Fixture',artistName:'Fixture',albumName:'Fixture',durationMs:30000}]);
    const times=Array.from({length:605},(_,i)=>new Date(base+i*31000).toISOString());
    times.push(new Date(base+605*31000+3600000).toISOString());
    await sql`INSERT INTO plays (played_at,track_id,ms_played) SELECT t::timestamptz,${trackId},30000 FROM UNNEST(${times}::text[]) t`;
    const session=await getCurrentSession('UTC');
    assert.equal(session.sessions?.[1].trackCount,605);
    assert.equal('sittings' in session,false);
    assert.equal('dateStr' in session.sessions![0],false);
    assert.equal(session.sessions?.[1].runtimeMs,604*31000+30000);
    const small=await getStreamLog(3,'UTC'); const full=await getStreamLog(607,'UTC');
    assert.equal(small.entries[1].sessionGap?.runtimeMs,full.entries[1].sessionGap?.runtimeMs);
    assert.equal(small.entries[1].sessionGap!.trackCount,605);
  } finally { await sql`DELETE FROM plays WHERE track_id=${trackId}`;await sql`DELETE FROM tracks WHERE id=${trackId}`; }
});
