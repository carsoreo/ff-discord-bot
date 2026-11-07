import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { get, getPlayerNews, getEspnIds } from '../src/sleeper.js';
import { nameKey } from '../src/format.js';

// fetch is stubbed: these tests never touch the network.
const realFetch = globalThis.fetch;
let calls;
const respond = (body, status = 200) => { globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(JSON.stringify(body), { status }); }; };
beforeEach(() => { calls = []; });
afterEach(() => { globalThis.fetch = realFetch; });

test('Sleeper requests go to the v1 API and fail loudly on errors', async () => {
  respond({ week: 9 });
  assert.deepEqual(await get('/state/nfl'), { week: 9 });
  assert.equal(calls[0], 'https://api.sleeper.app/v1/state/nfl');
  respond({}, 503);
  await assert.rejects(get('/state/nfl'), /Sleeper \/state\/nfl: HTTP 503/);
});

test('player news keeps only the short Rotowire updates', async () => {
  respond({ feed: [{ id: 1, type: 'Rotowire' }, { id: 2, type: 'Story' }, { id: 3, type: 'Media' }] });
  assert.deepEqual((await getPlayerNews(123)).map((i) => i.id), [1]);
  respond({});
  assert.deepEqual(await getPlayerNews(123), []);
  respond({}, 500);
  await assert.rejects(getPlayerNews(123), /ESPN news for 123: HTTP 500/);
});

test("ESPN ids are matched by name and position, skip positions the bot doesn't track, and are cached for a day", async () => {
  respond([
    { id: 10, fullName: 'Kenneth Walker III', defaultPositionId: 2 },
    { id: 11, fullName: 'Somebody', defaultPositionId: 16 }, // team defense
  ]);
  const ids = await getEspnIds(2026);
  assert.equal(ids[nameKey('Kenneth Walker', 'RB')], 10);
  assert.equal(Object.keys(ids).length, 1);
  await getEspnIds(2026);
  assert.equal(calls.length, 1); // second call came from the cache
});
