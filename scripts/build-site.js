// Builds the league Hall of Fame page: data/yahoo-history.json (+ optional data/yahoo-lineups.json for player stats
// and data/managers.json aliases) → data/site/index.html
// Usage: node scripts/build-site.js [path/to/yahoo-history.json]
import fs from 'node:fs';
import { buildHistory, headToHead } from '../src/history.js';
import { playerStats } from '../src/players.js';

const src = process.argv[2] ?? 'data/yahoo-history.json';
const aliases = fs.existsSync('data/managers.json') ? JSON.parse(fs.readFileSync('data/managers.json', 'utf8')) : {};
const h = buildHistory(JSON.parse(fs.readFileSync(src, 'utf8')), aliases);

const lineups = fs.existsSync('data/yahoo-lineups.json') ? JSON.parse(fs.readFileSync('data/yahoo-lineups.json', 'utf8')) : {};
const players = playerStats(h, lineups);

const names = h.managers.map((m) => m.manager);
const rivalries = {};
for (const a of names) for (const b of names) if (a !== b) {
  const r = headToHead(h, a, b);
  if (r.games.length) rivalries[`${a}|${b}`] = { w: r.wins, l: r.losses, t: r.ties, games: r.games.map((g) => [g.year, g.week, g.playoff ? 1 : 0, g.me.points, g.them.points]) };
}
const data = {
  league: 'The Boys', built: new Date().toISOString().slice(0, 10),
  managers: h.managers, records: h.records, awards: h.awards, rivalries, players,
  seasons: h.seasons.map((s) => ({ year: s.year, complete: s.complete, champion: s.champion?.manager, teams: s.teams, draft: s.draft.map((d) => [d.round, d.pick, d.player, d.manager]) })),
};

fs.mkdirSync('data/site', { recursive: true });
const html = fs.readFileSync(new URL('../site/template.html', import.meta.url), 'utf8')
  .replace('/*DATA*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync('data/site/index.html', html);
console.log(`Built data/site/index.html: ${h.seasons.length} seasons, ${names.length} managers${players ? ', player stats' : ''}.`);
