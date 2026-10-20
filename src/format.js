export function teamName(roster, usersById) {
  const user = usersById[roster.owner_id];
  if (!user) return `Open Team ${roster.roster_id}`;
  return user.metadata?.team_name || user.display_name;
}

export function playerName(players, id) {
  const p = players[id];
  if (!p) return id;
  return `${p.full_name ?? `${p.first_name} ${p.last_name}`} (${p.position ?? '?'}, ${p.team ?? 'FA'})`;
}

const LABEL = { trade: '🔄 **Trade**', waiver: '📥 **Waiver claim**', free_agent: '🆓 **Free agent pickup**', commissioner: '🛠️ **Commissioner move**' };

export function describeTransaction(tx, players, names) {
  const lines = tx.roster_ids.map((rid) => {
    const forRoster = (map, want) => Object.entries(map ?? {}).filter(([, r]) => r === want).map(([p]) => playerName(players, p));
    const picks = (tx.draft_picks ?? [])
      .filter((d) => d.owner_id === rid)
      .map((d) => `${d.season} Rd ${d.round} pick${d.roster_id !== rid ? ` (orig. ${names[d.roster_id] ?? `Team ${d.roster_id}`})` : ''}`);
    const faab = (tx.waiver_budget ?? []).filter((w) => w.receiver === rid).map((w) => `$${w.amount} FAAB`);
    const gets = [...forRoster(tx.adds, rid), ...picks, ...faab];
    // In a trade one side's drops are the other side's adds, so only list what each team gets.
    const drops = tx.type === 'trade' ? [] : forRoster(tx.drops, rid);
    const parts = [];
    if (gets.length) parts.push(`${tx.type === 'trade' ? 'gets' : 'adds'} ${gets.join(', ')}`);
    if (drops.length) parts.push(`drops ${drops.join(', ')}`);
    return parts.length ? `**${names[rid] ?? `Team ${rid}`}** ${parts.join('; ')}` : null;
  }).filter(Boolean);
  const bid = tx.type === 'waiver' && tx.settings?.waiver_bid != null ? ` ($${tx.settings.waiver_bid} bid)` : '';
  return `${LABEL[tx.type] ?? tx.type}${bid}\n${lines.join('\n')}`;
}

export function tradeBlockText(name, entries, players) {
  if (!entries.length) return `🏷️ **${name}** has nothing on the trade block.`;
  const lines = entries.map((e) => `• ${playerName(players, e.id)}${e.asking ? ` (asking: ${e.asking})` : ''}`);
  return `🏷️ **${name}** trade block:\n${lines.join('\n')}`;
}

export function weeklyRecap(week, matchups, rosters, names, players) {
  const scored = matchups.filter((m) => m.points > 0);
  if (!scored.length) return null; // empty rosters or no games yet
  const name = (rid) => names[rid] ?? `Team ${rid}`;
  const pts = (n) => n.toFixed(2);
  const games = Object.values(Object.groupBy(scored.filter((m) => m.matchup_id), (m) => m.matchup_id))
    .filter((g) => g.length === 2)
    .map((g) => g.toSorted((a, b) => b.points - a.points));
  const lines = [`🏈 Week ${week} recap`];
  for (const [w, l] of games) lines.push(`${name(w.roster_id)} ${pts(w.points)} ${w.points === l.points ? 'tied' : 'def.'} ${name(l.roster_id)} ${pts(l.points)}`);

  const byPoints = scored.toSorted((a, b) => b.points - a.points);
  lines.push('', `🔥 High score: ${name(byPoints[0].roster_id)} (${pts(byPoints[0].points)})`);
  lines.push(`🧊 Low score: ${name(byPoints.at(-1).roster_id)} (${pts(byPoints.at(-1).points)})`);
  if (games.length) {
    const byMargin = games.toSorted((a, b) => (a[0].points - a[1].points) - (b[0].points - b[1].points));
    const [close, blowout] = [byMargin[0], byMargin.at(-1)];
    lines.push(`😬 Closest game: ${name(close[0].roster_id)} by ${pts(close[0].points - close[1].points)}`);
    lines.push(`💥 Biggest blowout: ${name(blowout[0].roster_id)} by ${pts(blowout[0].points - blowout[1].points)}`);
  }
  let mvp;
  for (const m of scored) {
    for (const p of m.starters ?? []) {
      const v = m.players_points?.[p] ?? 0;
      if (!mvp || v > mvp.v) mvp = { p, v, rid: m.roster_id };
    }
  }
  if (mvp) lines.push(`⭐ MVP: ${playerName(players, mvp.p)} for ${name(mvp.rid)} (${pts(mvp.v)})`);

  // Top 3 and last place keep the post under GroupMe's 1000-char limit.
  const pf = (r) => (r.settings.fpts ?? 0) + (r.settings.fpts_decimal ?? 0) / 100;
  const standings = rosters.toSorted((a, b) => (b.settings.wins - a.settings.wins) || (pf(b) - pf(a)));
  const row = (r) => `${standings.indexOf(r) + 1}. ${name(r.roster_id)} ${r.settings.wins}-${r.settings.losses}${r.settings.ties ? `-${r.settings.ties}` : ''}`;
  lines.push('', 'Standings:', ...standings.slice(0, 3).map(row), `…`, row(standings.at(-1)));
  return lines.join('\n');
}
