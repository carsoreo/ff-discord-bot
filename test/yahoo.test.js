import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, recapWeek } from '../src/yahoo.js';

test('the Yahoo recap covers last week, and the final week once the season is over', () => {
  assert.equal(recapWeek({ start_week: '1', current_week: '9', end_week: '17', is_finished: 0 }), 8);
  assert.equal(recapWeek({ start_week: '1', current_week: '1', end_week: '17' }), null); // nothing finished yet
  assert.equal(recapWeek({ start_week: '1', current_week: '17', end_week: '17', is_finished: 1 }), 17);
});

test("flatten turns Yahoo's wrappers into plain objects and arrays", () => {
  assert.deepEqual(flatten([]), []);
  assert.deepEqual(flatten({ count: 0 }), []);
  assert.deepEqual(flatten([{ a: 1 }, { b: '2' }, []]), { a: 1, b: '2' });
  assert.deepEqual(flatten({ '0': { x: 1 }, '1': { y: 2 }, count: 2 }), [{ x: 1 }, { y: 2 }]);
  assert.deepEqual(flatten({ league: [{ name: 'L' }, { '0': { week: '3' } }] }), { league: { name: 'L', week: '3' } });
  assert.equal(flatten(null), null);
});
