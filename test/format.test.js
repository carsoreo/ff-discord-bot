import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeTransaction, teamName, weeklyRecap, sleeperWeek, playerUpdateText, nameKey } from '../src/format.js';
import { flatten, yahooGames, yahooStarters } from '../src/yahoo.js';

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

test('weekly recap shows the top 3 scorers and the biggest blowout', () => {
  const matchups = [
    { roster_id: 1, matchup_id: 1, points: 120.5, starters: ['1', '0'], players_points: { 1: 31.2 } },
    { roster_id: 2, matchup_id: 1, points: 80.25, starters: ['2'], players_points: { 2: 12 } },
    { roster_id: 3, matchup_id: 2, points: 101, starters: ['3'], players_points: { 3: 25 } },
    { roster_id: 4, matchup_id: 2, points: 99.5, starters: [], players_points: {} },
  ];
  const text = weeklyRecap(sleeperWeek(7, matchups, { 1: 'Alpha', 2: 'Bravo', 3: 'Charlie', 4: 'Delta' }, players));
  assert.equal(text, [
    '🏈 Week 7 recap', '', '🔥 Top scorers:',
    '1. Bijan Robinson (RB, ATL): 31.20 for Alpha',
    '2. Chicago Bears (DEF, CHI): 25.00 for Charlie',
    '3. Puka Nacua (WR, LAR): 12.00 for Bravo',
    '', '💥 Biggest blowout: Alpha beat Bravo by 40.25 (120.50 to 80.25)',
  ].join('\n'));
  assert.equal(weeklyRecap(sleeperWeek(7, [{ roster_id: 1, matchup_id: 1, points: 0, starters: [] }], {}, players)), null);
});

test("Yahoo's nested JSON flattens into games and starters", () => {
  // Trimmed from the shapes Yahoo's Fantasy API returns for a scoreboard and a roster with weekly stats.
  const team = (key, name, total) => ({ team: [[{ team_key: key }, { team_id: '1' }, { name }, []], { team_points: { coverage_type: 'week', week: '6', total } }] });
  const scoreboard = flatten({ '0': { matchups: { '0': { matchup: { week: '6', status: 'postevent', '0': { teams: { '0': team('461.l.1.t.1', 'The Steins', '101.90'), '1': team('461.l.1.t.2', 'Never Bark Alone', '62.84'), count: 2 } } } }, count: 1 } }, week: '6' });
  assert.deepEqual(yahooGames(scoreboard), [[
    { key: '461.l.1.t.1', name: 'The Steins', points: 101.9 },
    { key: '461.l.1.t.2', name: 'Never Bark Alone', points: 62.84 },
  ]]);
  const player = (full, pos, abbr, slot, total) => ({ player: [[{ player_key: 'x' }, { name: { full } }, { editorial_team_abbr: abbr }, { display_position: pos }], { selected_position: [{ coverage_type: 'week' }, { position: slot }] }, { player_points: { coverage_type: 'week', total } }] });
  const roster = flatten({ coverage_type: 'week', week: '6', '0': { players: { '0': player("Ja'Marr Chase", 'WR', 'Cin', 'WR', '38.2'), '1': player('Drake Maye', 'QB', 'NE', 'BN', '30'), count: 2 } } });
  assert.deepEqual(yahooStarters(roster, 'The Steins'), [{ name: "Ja'Marr Chase (WR, CIN)", team: 'The Steins', points: 38.2 }]);
  assert.deepEqual(yahooStarters(flatten({ '0': { players: [] } }), 'Empty'), []);
});

test('player updates show the blurb and trimmed analysis without HTML', () => {
  const text = playerUpdateText('Jared Goff (QB, DET)', {
    headline: 'Goff completed 19 of 30 passes for 271 yards.',
    story: '<p>The Lions&#39; offense &amp; Goff broke out.</p> <p>' + 'More detail. '.repeat(80) + '</p>',
  });
  assert.match(text, /^📰 \*\*Jared Goff \(QB, DET\)\*\*\nGoff completed 19 of 30 passes for 271 yards\.\n> The Lions' offense & Goff broke out\. More detail\./);
  assert.ok(text.endsWith('…') && text.length < 850);
  assert.equal(playerUpdateText('X', { headline: 'Just a blurb.' }), '📰 **X**\nJust a blurb.');
});

test('player names match across Sleeper and ESPN spellings', () => {
  assert.equal(nameKey('Kenneth Walker', 'RB'), nameKey('Kenneth Walker III', 'RB'));
  assert.equal(nameKey('Aaron Jones', 'RB'), nameKey('Aaron Jones Sr.', 'RB'));
  assert.equal(nameKey("Ja'Marr Chase", 'WR'), nameKey('JaMarr Chase', 'WR'));
  assert.notEqual(nameKey('Josh Allen', 'QB'), nameKey('Josh Allen', 'LB'));
});
