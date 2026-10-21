export function teamName(roster, usersById) {
  const user = usersById[roster.owner_id];
  if (!user) return `Open Team ${roster.roster_id}`;
  return user.metadata?.team_name || user.display_name;
}

// Matches players across Sleeper and ESPN, which spell suffixes differently ("Kenneth Walker" vs "Kenneth Walker III").
export const nameKey = (name, position) =>
  `${(name ?? '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '')}|${position}`;

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

const plain = (html) => (html ?? '')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/\s+/g, ' ').trim();

export function playerUpdateText(name, item) {
  const analysis = plain(item.story);
  const short = analysis.length > 700 ? `${analysis.slice(0, 700).replace(/\s+\S*$/, '')}…` : analysis;
  return `📰 **${name}**\n${plain(item.headline)}${short ? `\n> ${short}` : ''}`;
}

// The same week shape from either league source: { week, games: [[{ name, points }, …]], starters: [{ name, team, points }] }.
export function sleeperWeek(week, matchups, names, players) {
  const name = (rid) => names[rid] ?? `Team ${rid}`;
  const games = Object.values(Object.groupBy(matchups.filter((m) => m.matchup_id), (m) => m.matchup_id))
    .map((g) => g.map((m) => ({ name: name(m.roster_id), points: m.points ?? 0 })));
  const starters = matchups.flatMap((m) => (m.starters ?? [])
    .filter((p) => p !== '0') // Sleeper's placeholder for an empty starting slot
    .map((p) => ({ name: playerName(players, p), team: name(m.roster_id), points: m.players_points?.[p] ?? 0 })));
  return { week, games, starters };
}

export function weeklyRecap({ week, games, starters }) {
  if (!starters.some((s) => s.points > 0)) return null; // empty rosters or no games yet
  const pts = (n) => n.toFixed(2);
  const lines = [`🏈 Week ${week} recap`, '', '🔥 Top scorers:'];
  starters.toSorted((a, b) => b.points - a.points).slice(0, 3)
    .forEach((s, i) => lines.push(`${i + 1}. ${s.name}: ${pts(s.points)} for ${s.team}`));
  const played = games.filter((g) => g.length === 2).map((g) => g.toSorted((a, b) => b.points - a.points));
  if (played.length) {
    const [w, l] = played.toSorted((a, b) => (b[0].points - b[1].points) - (a[0].points - a[1].points))[0];
    lines.push('', `💥 Biggest blowout: ${w.name} beat ${l.name} by ${pts(w.points - l.points)} (${pts(w.points)} to ${pts(l.points)})`);
  }
  return lines.join('\n');
}
