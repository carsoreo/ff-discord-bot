import fs from 'node:fs';

const BASE = 'https://api.sleeper.app/v1';
const PLAYERS_FILE = 'data/players.json';
const DAY = 24 * 60 * 60 * 1000;

export async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Sleeper ${path}: HTTP ${res.status}`);
  return res.json();
}

let cache; // { at, players }

// Sleeper asks that the ~5MB player map be fetched at most once a day, so it's cached on disk.
export async function getPlayers() {
  if (cache && Date.now() - cache.at < DAY) return cache.players;
  try {
    const { mtimeMs } = fs.statSync(PLAYERS_FILE);
    if (Date.now() - mtimeMs < DAY) {
      cache = { at: mtimeMs, players: JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')) };
      return cache.players;
    }
  } catch {}
  const players = await get('/players/nfl');
  fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players));
  cache = { at: Date.now(), players };
  return players;
}

// shortcut: ESPN's news feed is public but undocumented and may change; swap in a paid feed if it breaks.
export async function getNews() {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50');
  if (!res.ok) throw new Error(`ESPN news: HTTP ${res.status}`);
  return (await res.json()).articles ?? [];
}
