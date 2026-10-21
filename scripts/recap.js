// Prints a week's recap (top 3 scorers, biggest blowout) from a Sleeper league without posting it anywhere.
// Usage: npm run recap -- [week] [leagueId]   (defaults: last finished week, LEAGUE_ID from .env)
import { get, getPlayers } from '../src/sleeper.js';
import { teamName, sleeperWeek, weeklyRecap } from '../src/format.js';

const [weekArg, leagueArg] = process.argv.slice(2);
const leagueId = leagueArg ?? process.env.LEAGUE_ID;
const week = Number(weekArg ?? (await get('/state/nfl')).week - 1);
if (!leagueId || !(week >= 1)) throw new Error('Usage: npm run recap -- [week] [leagueId]');

const [league, users, rosters, matchups] = await Promise.all([
  get(`/league/${leagueId}`), get(`/league/${leagueId}/users`), get(`/league/${leagueId}/rosters`), get(`/league/${leagueId}/matchups/${week}`),
]);
const usersById = Object.fromEntries(users.map((u) => [u.user_id, u]));
const names = Object.fromEntries(rosters.map((r) => [r.roster_id, teamName(r, usersById)]));
console.log(`${league.name}, week ${week}\n`);
console.log(weeklyRecap(sleeperWeek(week, matchups, names, await getPlayers(), rosters)) ?? 'No scores for this week yet.');
