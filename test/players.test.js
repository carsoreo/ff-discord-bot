import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory } from '../src/history.js';
import { playerStats } from '../src/players.js';

const team = (id, manager, rank) => ({ id, name: `${manager} FC`, manager, rank, wins: 1, losses: 1, ties: 0, pf: 200, pa: 200 });
const season = {
  year: 2024, playoffStart: 3,
  teams: [team(1, 'Ann', 1), team(2, 'Bob', 2)],
  weeks: [1, 2, 3].map((week) => ({ week, games: [[{ team: 1, points: 100 }, { team: 2, points: 90 }]] })),
  draft: [
    { round: 1, pick: 1, player: 'Bust', team: 1 }, { round: 1, pick: 2, player: 'Star', team: 2 },
    { round: 2, pick: 1, player: 'Sleeper', team: 1 }, { round: 2, pick: 2, player: 'Filler', team: 2 },
  ],
};
const lineups = { 2024: [1, 2, 3].flatMap((w) => [
  { w, t: 1, p: [[1, 'Bust', 'RB', 2], [3, 'Sleeper', 'WR', 30], [5, 'Benchwarmer', 'BN', 40]] },
  { w, t: 2, p: [[2, 'Star', 'QB', 25], [4, 'Filler', 'BN', 1]] },
]) };

test('player stats: best games, bench points, MVPs and draft value', () => {
  const s = playerStats(buildHistory([season]), lineups);
  assert.equal(s.bestGames[0].name, 'Sleeper'); // bench players don't count as a best game
  assert.equal(s.benchWeeks[0].points, 40);
  assert.equal(s.mvps.find((m) => m.manager === 'Ann').players[0].name, 'Sleeper');
  const d = s.drafts.bySeason[2024];
  assert.equal(d.steals[0].player, 'Sleeper'); // 3rd pick, best value
  assert.equal(d.busts[0].player, 'Bust');
  assert.equal(d.points[1], 6); // 3 weeks x 2 points
  assert.equal(d.teams[0].manager, 'Ann');
});

test("keepers are left out of draft value: Yahoo's marks where it has them", () => {
  const marked = { ...season, draft: season.draft.map((d) => (d.player === 'Sleeper' ? { ...d, keeper: true } : d)) };
  const d = playerStats(buildHistory([marked]), lineups).drafts.bySeason[2024];
  assert.deepEqual(d.keepers, [3]);
  assert.ok(!d.steals.some((p) => p.player === 'Sleeper'));
});

test('unmarked seasons infer keepers from last season’s final rosters', () => {
  const prev = { ...season, year: 2023, draft: [] };
  const lu = { ...lineups, 2023: [{ w: 3, t: 2, p: [[4, 'Filler', 'BN', 0]] }] }; // Bob's team ended 2023 holding Filler
  const d = playerStats(buildHistory([prev, season]), lu).drafts.bySeason[2024];
  assert.deepEqual(d.keepers, [4]);
});

test("Yahoo's keeper icon glyph in a drafted name still matches the lineups", () => {
  const glyph = { ...season, draft: season.draft.map((d) => (d.player === 'Star' ? { ...d, player: 'Star ' } : d)) };
  assert.equal(playerStats(buildHistory([glyph]), lineups).drafts.bySeason[2024].points[2], 75);
});

test('no lineups means no player stats', () => {
  assert.equal(playerStats(buildHistory([season]), {}), null);
});
