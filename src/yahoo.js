// Yahoo Fantasy API. Needs YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET (from developer.yahoo.com/apps) and
// YAHOO_REFRESH_TOKEN (from `npm run yahoo-auth`).
export const REDIRECT_URI = 'https://localhost:8080';
export const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

export const basicAuth = () =>
  `Basic ${Buffer.from(`${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`).toString('base64')}`;

let token; // { value, expires }

async function accessToken() {
  if (token && Date.now() < token.expires) return token.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: process.env.YAHOO_REFRESH_TOKEN, redirect_uri: REDIRECT_URI }),
  });
  if (!res.ok) throw new Error(`Yahoo token refresh: HTTP ${res.status}`);
  const json = await res.json();
  // shortcut: assumes Yahoo keeps handing back the same refresh token (it does today); persist json.refresh_token if that changes.
  token = { value: json.access_token, expires: Date.now() + (json.expires_in - 60) * 1000 };
  return token.value;
}

async function yget(path) {
  const res = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/${path}?format=json`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (!res.ok) throw new Error(`Yahoo ${path}: HTTP ${res.status}`);
  return flatten((await res.json()).fantasy_content);
}

// Yahoo's JSON wraps everything in arrays of one-key objects and {"0": …, "count": n} maps.
// This turns those into plain objects and arrays.
export function flatten(x) {
  if (Array.isArray(x)) {
    if (!x.length) return [];
    return Object.assign({}, ...x.map(flatten).filter((v) => v && typeof v === 'object' && !Array.isArray(v)));
  }
  if (!x || typeof x !== 'object') return x;
  if ('count' in x) return Object.keys(x).filter((k) => /^\d+$/.test(k)).map((k) => flatten(x[k]));
  const out = {};
  for (const [k, v] of Object.entries(x)) {
    if (/^\d+$/.test(k)) Object.assign(out, flatten(v));
    else out[k] = flatten(v);
  }
  return out;
}

const list = (x) => (Array.isArray(x) ? x : []);

export function yahooGames(scoreboard) {
  return list(scoreboard.matchups).map(({ matchup }) =>
    list(matchup.teams).map(({ team }) => ({ key: team.team_key, name: team.name, points: Number(team.team_points?.total ?? 0) })));
}

export function yahooStarters(roster, teamName) {
  return list(roster.players)
    .map(({ player }) => player)
    .filter((p) => !['BN', 'IR'].includes(p.selected_position?.position))
    .map((p) => ({
      name: `${p.name.full} (${p.display_position}, ${(p.editorial_team_abbr ?? 'FA').toUpperCase()})`,
      team: teamName,
      points: Number(p.player_points?.total ?? 0),
    }));
}

// The last finished week of a Yahoo league: every matchup's score and every starter's points.
export async function getYahooWeek(leagueId) {
  const { game } = await yget('game/nfl');
  const key = `${game.game_key}.l.${leagueId}`;
  const { league } = await yget(`league/${key}`);
  const week = Number(league.current_week) - 1;
  if (week < Number(league.start_week)) return null;
  const games = yahooGames((await yget(`league/${key}/scoreboard;week=${week}`)).league.scoreboard);
  const starters = [];
  for (const t of games.flat()) {
    const { team } = await yget(`team/${t.key}/roster;week=${week}/players/stats;type=week;week=${week}`);
    starters.push(...yahooStarters(team.roster, t.name));
  }
  return { id: `yahoo-${league.season}-${week}`, week, games, starters };
}
