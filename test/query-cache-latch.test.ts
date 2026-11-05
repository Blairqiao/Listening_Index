import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLatchCache } from '../src/lib/db/queries/cache';

test('N010: cache invalidation detaches in-flight reads and prevents repopulation with stale results', async () => {
  let callCount = 0;
  let resolveFirstRead: ((val: string) => void) | null = null;

  const fetcher = async () => {
    callCount++;
    if (callCount === 1) {
      return new Promise<string>((resolve) => {
        resolveFirstRead = resolve;
      });
    }
    return `fresh-value-${callCount}`;
  };

  const cache = new AsyncLatchCache<string>(60_000, fetcher);

  // 1. Start in-flight read 1
  const read1Promise = cache.get();
  assert.equal(callCount, 1, 'First read must trigger fetcher');
  assert.ok(resolveFirstRead, 'First read fetcher must be paused');

  // 2. Invalidate cache while read 1 is still in-flight
  cache.invalidate();

  // 3. Start read 2 after invalidation
  const read2Promise = cache.get();

  // Read 2 must not wait on or join read 1's promise; it must immediately trigger a fresh fetch
  assert.equal(callCount, 2, 'Second read after invalidation must trigger a new fetcher call');

  // 4. Resolve read 1 with stale data
  const resolve1 = resolveFirstRead as unknown as (val: string) => void;
  resolve1('stale-value-1');

  const [res1, res2] = await Promise.all([read1Promise, read2Promise]);
  assert.equal(res1, 'stale-value-1');
  assert.equal(res2, 'fresh-value-2', 'Read 2 must receive fresh value, not stale value');

  // 5. Subsequent read must return the fresh cached value, not stale
  const read3 = await cache.get();
  assert.equal(read3, 'fresh-value-2', 'Subsequent read must be fresh-value-2');
});
