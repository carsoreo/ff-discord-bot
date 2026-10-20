import fs from 'node:fs';
import { nameKey } from './format.js';

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

let espnIds; // { at, byKey }
const ESPN_POSITION = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K' };

// Sleeper's player data has no ESPN id for many players, so the rest are matched by name and position
// against ESPN's fantasy player list. Refreshed daily.
export async function getEspnIds(season) {
  if (espnIds && Date.now() - espnIds.at < DAY) return espnIds.byKey;
  const res = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/players?view=players_wl`, {
    headers: { 'X-Fantasy-Filter': JSON.stringify({ filterActive: { value: true } }) },
  });
  if (!res.ok) throw new Error(`ESPN player list: HTTP ${res.status}`);
  const byKey = {};
  for (const p of await res.json()) if (ESPN_POSITION[p.defaultPositionId]) byKey[nameKey(p.fullName, ESPN_POSITION[p.defaultPositionId])] = p.id;
  espnIds = { at: Date.now(), byKey };
  return byKey;
}

// shortcut: ESPN's fantasy news API is public but undocumented and may change without notice.
export async function getPlayerNews(espnId) {
  const res = await fetch(`https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?playerId=${espnId}&limit=5`);
  if (!res.ok) throw new Error(`ESPN news for ${espnId}: HTTP ${res.status}`);
  // "Rotowire" items are the short player updates Sleeper shows; "Story" and "Media" are articles and videos.
  return ((await res.json()).feed ?? []).filter((item) => item.type === 'Rotowire');
}
