// Player stats for the Hall of Fame site, from weekly Yahoo lineups:
// lineups = { [year]: [{ w: week, t: teamId, p: [[playerId, name, slot, points], …] }] }
const BENCH = new Set(['BN', 'IR']);
const name = (n) => n.replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim(); // strips Yahoo's icon glyphs
const round2 = (n) => Math.round(n * 100) / 100;
const GRADES = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F', 'F'];

export function playerStats(history, lineups, top = 10) {
  const rows = [];
  for (const s of history.seasons) {
    const byId = Object.fromEntries(s.teams.map((t) => [t.id, t]));
    // Only weeks that count: the same finished weeks the scores use.
    const weeks = new Set(s.games.map((g) => g.week));
    for (const { w, t, p } of lineups[s.year] ?? []) {
      if (!weeks.has(w) || !byId[t]) continue;
      for (const [, name, slot, points] of p) rows.push({ year: s.year, week: w, team: t, manager: byId[t].manager, name, slot, points, started: !BENCH.has(slot) });
    }
  }
  if (!rows.length) return null;

  const bestGames = rows.filter((r) => r.started).toSorted((a, b) => b.points - a.points).slice(0, top);

  const benchWeeks = Object.values(Object.groupBy(rows.filter((r) => !r.started), (r) => `${r.year}|${r.week}|${r.team}`))
    .map((g) => ({ year: g[0].year, week: g[0].week, manager: g[0].manager, points: round2(g.reduce((a, r) => a + r.points, 0)), best: g.toSorted((a, b) => b.points - a.points)[0] }))
    .toSorted((a, b) => b.points - a.points).slice(0, top);

  // Each manager's MVPs: most points scored in their starting lineup, all seasons.
  const mvps = Object.entries(Object.groupBy(rows.filter((r) => r.started), (r) => r.manager)).map(([manager, rs]) => ({
    manager,
    players: Object.entries(Object.groupBy(rs, (r) => r.name))
      .map(([name, g]) => ({ name, points: round2(g.reduce((a, r) => a + r.points, 0)), seasons: [...new Set(g.map((r) => r.year))] }))
      .toSorted((a, b) => b.points - a.points).slice(0, 3),
  })).toSorted((a, b) => a.manager.localeCompare(b.manager));

  return { bestGames, benchWeeks, mvps, drafts: draftGrades(history, rows, top) };
}

// Draft value: points the player scored that season on any roster (bench included), so a pick traded away still counts.
// Keepers aren't real picks, so they're left out. Where Yahoo marked keepers, its marks are used. For a season it
// didn't mark (2023), a pick is a keeper if the same manager or team ended the season before with that player, or
// if it falls in the keeper rounds (where most marked keepers sit) and the player was on any roster at the end.
// A pick's surplus is how much higher it finished in the value ranking than where it was taken among real picks.
function draftGrades(history, rows, top) {
  const pts = {};
  for (const r of rows) pts[`${r.year}|${r.name}`] = (pts[`${r.year}|${r.name}`] ?? 0) + r.points;
  const finalRoster = {};
  for (const [year, rs] of Object.entries(Object.groupBy(rows, (r) => r.year))) {
    const last = Math.max(...rs.map((r) => r.week));
    finalRoster[year] = new Set(rs.filter((r) => r.week === last).flatMap((r) => [`m|${r.manager}|${r.name}`, `t|${r.team}|${r.name}`, `a|${r.name}`]));
  }
  const marked = history.seasons.filter((s) => s.draft.some((d) => d.keeper));
  const share = (r) => { const p = marked.flatMap((s) => s.draft.filter((d) => d.round === r)); return p.length ? p.filter((d) => d.keeper).length / p.length : 0; };
  const keeperRound = Math.min(...[...new Set(marked.flatMap((s) => s.draft.map((d) => d.round)))].filter((r) => share(r) >= 0.5), Infinity);
  const bySeason = {};
  for (const s of history.seasons) {
    if (!s.complete || !s.draft.length) continue;
    const prev = finalRoster[s.year - 1];
    const yahooMarked = s.draft.some((d) => d.keeper);
    const kept = (d) => yahooMarked ? d.keeper : !!prev && (prev.has(`m|${d.manager}|${name(d.player)}`) || prev.has(`t|${d.team}|${name(d.player)}`)
      || (d.round >= keeperRound && prev.has(`a|${name(d.player)}`)));
    const all = s.draft.map((d, i) => ({ year: s.year, overall: i + 1, round: d.round, pick: d.pick, player: name(d.player), manager: d.manager, keeper: kept(d), points: round2(pts[`${s.year}|${name(d.player)}`] ?? 0) }));
    const picks = all.filter((p) => !p.keeper);
    picks.forEach((p, i) => { p.slot = i + 1; });
    picks.toSorted((a, b) => b.points - a.points).forEach((p, i) => { p.surplus = p.slot - (i + 1); });
    const teams = Object.values(Object.groupBy(picks, (p) => p.manager)).map((g) => ({ manager: g[0].manager, points: round2(g.reduce((a, p) => a + p.points, 0)) }))
      .toSorted((a, b) => b.points - a.points).map((t, i, list) => ({ ...t, grade: GRADES[Math.floor((i * GRADES.length) / list.length)] }));
    bySeason[s.year] = {
      points: Object.fromEntries(all.map((p) => [p.overall, p.points])),
      keepers: all.filter((p) => p.keeper).map((p) => p.overall),
      teams,
      steals: picks.filter((p) => p.points > 0).toSorted((a, b) => b.surplus - a.surplus).slice(0, 5),
      busts: picks.filter((p) => p.round <= 3).toSorted((a, b) => a.surplus - b.surplus).slice(0, 5),
    };
  }
  const seasons = Object.values(bySeason);
  return {
    bySeason,
    steals: seasons.flatMap((s) => s.steals).toSorted((a, b) => b.surplus - a.surplus).slice(0, top),
    busts: seasons.flatMap((s) => s.busts).toSorted((a, b) => a.surplus - b.surplus).slice(0, top),
  };
}
