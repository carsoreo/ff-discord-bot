// Builds the league Hall of Fame page: data/yahoo-history.json (+ optional data/yahoo-lineups.json for player stats,
// data/yahoo-trades.json for trades,
// and data/managers.json aliases) → data/site/index.html
// Usage: node scripts/build-site.js [path/to/yahoo-history.json]
import fs from 'node:fs';
import { buildHistory, headToHead } from '../src/history.js';
import { playerStats, nameOnly } from '../src/players.js';
import { tradeStats } from '../src/trades.js';

const src = process.argv[2] ?? 'data/yahoo-history.json';
const aliases = fs.existsSync('data/managers.json') ? JSON.parse(fs.readFileSync('data/managers.json', 'utf8')) : {};
const h = buildHistory(JSON.parse(fs.readFileSync(src, 'utf8')), aliases);

const lineups = fs.existsSync('data/yahoo-lineups.json') ? JSON.parse(fs.readFileSync('data/yahoo-lineups.json', 'utf8')) : {};
// Sleeper's player list (cached by the bot) gives positions for drafted players who never started.
const positions = {};
if (fs.existsSync('data/players.json')) {
  for (const p of Object.values(JSON.parse(fs.readFileSync('data/players.json', 'utf8')))) {
    if (!['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position)) continue;
    const n = p.position === 'DEF' ? p.last_name : p.full_name; // Yahoo calls defenses by nickname ("Patriots")
    if (n) positions[nameOnly(n)] ??= p.position;
  }
}
const players = playerStats(h, lineups, 10, positions);
const trades = fs.existsSync('data/yahoo-trades.json') ? tradeStats(h, lineups, JSON.parse(fs.readFileSync('data/yahoo-trades.json', 'utf8'))) : null;

const names = h.managers.map((m) => m.manager);
const rivalries = {};
for (const a of names) for (const b of names) if (a !== b) {
  const r = headToHead(h, a, b);
  if (r.games.length) rivalries[`${a}|${b}`] = { w: r.wins, l: r.losses, t: r.ties, games: r.games.map((g) => [g.year, g.week, g.playoff ? 1 : 0, g.me.points, g.them.points]) };
}
const data = {
  league: 'The Boys', built: new Date().toISOString().slice(0, 10),
  managers: h.managers, records: h.records, awards: h.awards, rivalries, players, trades,
  seasons: h.seasons.map((s) => ({ year: s.year, complete: s.complete, champion: s.champion?.manager, teams: s.teams, draft: s.draft.map((d) => [d.round, d.pick, d.player, d.manager]) })),
};

fs.mkdirSync('data/site', { recursive: true });
const html = fs.readFileSync(new URL('../site/template.html', import.meta.url), 'utf8')
  .replace('/*DATA*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync('data/site/index.html', html);
console.log(`Built data/site/index.html: ${h.seasons.length} seasons, ${names.length} managers${players ? ', player stats' : ''}${trades ? ', trades' : ''}.`);
