import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeTransaction, teamName, weeklyRecap } from '../src/format.js';

const players = {
  1: { full_name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
  2: { full_name: 'Puka Nacua', position: 'WR', team: 'LAR' },
  3: { first_name: 'Chicago', last_name: 'Bears', position: 'DEF', team: 'CHI' },
};
const names = { 1: 'Alpha', 2: 'Bravo' };

test('trade lists what each side gets, including picks and FAAB', () => {
  const text = describeTransaction({
    type: 'trade', roster_ids: [1, 2],
    adds: { 1: 2, 2: 1 }, drops: { 1: 1, 2: 2 },
    draft_picks: [{ season: '2027', round: 1, roster_id: 2, previous_owner_id: 2, owner_id: 1 }],
    waiver_budget: [{ sender: 1, receiver: 2, amount: 15 }],
  }, players, names);
  assert.equal(text, '🔄 **Trade**\n**Alpha** gets Puka Nacua (WR, LAR), 2027 Rd 1 pick (orig. Bravo)\n**Bravo** gets Bijan Robinson (RB, ATL), $15 FAAB');
});

test('waiver shows bid, adds and drops', () => {
  const text = describeTransaction({
    type: 'waiver', roster_ids: [1], adds: { 3: 1 }, drops: { 2: 1 }, settings: { waiver_bid: 7 },
  }, players, names);
  assert.equal(text, '📥 **Waiver claim** ($7 bid)\n**Alpha** adds Chicago Bears (DEF, CHI); drops Puka Nacua (WR, LAR)');
});

test('open teams get a placeholder name', () => {
  assert.equal(teamName({ roster_id: 4, owner_id: null }, {}), 'Open Team 4');
  assert.equal(teamName({ roster_id: 1, owner_id: 'u' }, { u: { display_name: 'sam', metadata: { team_name: 'Hurts So Good' } } }), 'Hurts So Good');
});

test('weekly recap picks out the week\'s standouts', () => {
  const matchups = [
    { roster_id: 1, matchup_id: 1, points: 120.5, starters: ['1'], players_points: { 1: 31.2 } },
    { roster_id: 2, matchup_id: 1, points: 80.25, starters: ['2'], players_points: { 2: 12 } },
    { roster_id: 3, matchup_id: 2, points: 101, starters: [], players_points: {} },
    { roster_id: 4, matchup_id: 2, points: 99.5, starters: [], players_points: {} },
  ];
  const rosters = [1, 2, 3, 4].map((id, i) => ({ roster_id: id, settings: { wins: 4 - i, losses: i, fpts: 500 } }));
  const text = weeklyRecap(7, matchups, rosters, { 1: 'Alpha', 2: 'Bravo', 3: 'Charlie', 4: 'Delta' }, players);
  assert.match(text, /Alpha 120.50 def. Bravo 80.25/);
  assert.match(text, /High score: Alpha \(120.50\)/);
  assert.match(text, /Low score: Bravo \(80.25\)/);
  assert.match(text, /Closest game: Charlie by 1.50/);
  assert.match(text, /Biggest blowout: Alpha by 40.25/);
  assert.match(text, /MVP: Bijan Robinson \(RB, ATL\) for Alpha \(31.20\)/);
  assert.match(text, /1\. Alpha 4-0[\s\S]*4\. Delta 1-3/);
  assert.ok(text.length < 1000);
  assert.equal(weeklyRecap(7, [{ roster_id: 1, points: 0 }], rosters, {}, players), null);
});
