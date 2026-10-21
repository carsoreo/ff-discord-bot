import fs from 'node:fs';
import { Client, GatewayIntentBits, ChannelType, Events, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { get, getPlayers, getPlayerNews, getEspnIds } from './sleeper.js';
import { teamName, playerName, nameKey, describeTransaction, tradeBlockText, weeklyRecap, sleeperWeek, playerUpdateText } from './format.js';
import { getYahooWeek } from './yahoo.js';

for (const key of ['DISCORD_TOKEN', 'GUILD_ID', 'LEAGUE_ID']) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env (see .env.example)`);
}
const { DISCORD_TOKEN, GUILD_ID, LEAGUE_ID } = process.env;

const STATE_FILE = 'data/state.json';
fs.mkdirSync('data', { recursive: true });
const state = {
  channels: { teams: {} }, // Discord channel ids: category, transactions, tradeBlock, teams[rosterId].{category,moves,news}
  owners: {}, // rosterId -> Sleeper owner_id, to spot people joining
  links: {}, // Discord user id -> rosterId
  blocks: {}, // rosterId -> [{ id, asking }]
  blockMsgs: {}, // rosterId -> message id in #trade-block
  injuries: {}, // playerId -> last seen injury_status
  ...(fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}),
};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

let league = { rosters: [], names: {}, ownerOf: {}, usersById: {} };
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const send = (channelId, content) =>
  client.channels.cache.get(channelId)?.send({ content, allowedMentions: { parse: [] } });

// Posts trades and weekly recaps to GroupMe when GROUPME_BOT_ID is set. GroupMe has no markdown and caps posts at 1000 chars.
async function groupme(text) {
  if (!process.env.GROUPME_BOT_ID) return;
  const res = await fetch('https://api.groupme.com/v3/bots/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: process.env.GROUPME_BOT_ID, text: text.replaceAll('**', '').slice(0, 1000) }),
  }).catch((err) => ({ ok: false, status: err.message }));
  if (!res.ok) console.error(`GroupMe post failed: ${res.status}`);
}

async function ensureChannels(guild) {
  const c = state.channels;
  c.teams ??= {};
  // Creates the channel if it's missing, otherwise keeps its name and category in sync
  // (a team renamed, or an open team got claimed).
  async function sync(id, name, opts) {
    const ch = id && guild.channels.cache.get(id);
    if (!ch) return (await guild.channels.create({ name, ...opts })).id;
    if (ch.name !== name) await ch.setName(name);
    if (opts.parent && ch.parentId !== opts.parent) await ch.setParent(opts.parent, { lockPermissions: false }); // syncing perms would need Manage Roles
    return id;
  }
  const category = { type: ChannelType.GuildCategory };
  c.category = await sync(c.category, 'League', category);
  c.transactions = await sync(c.transactions, 'transactions', { parent: c.category });
  c.tradeBlock = await sync(c.tradeBlock, 'trade-block', { parent: c.category });
  for (const r of league.rosters) {
    const t = (c.teams[r.roster_id] ??= { moves: c.team?.[r.roster_id] }); // reuse the old single team channel
    t.category = await sync(t.category, league.names[r.roster_id].trim().slice(0, 100), category);
    t.moves = await sync(t.moves, 'team-moves', { parent: t.category, topic: "This team's trades, waivers and pickups" });
    t.news = await sync(t.news, 'player-news', { parent: t.category, topic: "News and injury updates for this team's players" });
    save(); // per team, so a failure partway can't orphan channels on the next run
  }
  delete c.team;
  save();
}

async function postTradeBlock(rid) {
  const ch = client.channels.cache.get(state.channels.tradeBlock);
  await ch.messages.delete(state.blockMsgs[rid]).catch(() => {});
  const content = tradeBlockText(league.names[rid], state.blocks[rid] ?? [], await getPlayers());
  const msg = await ch.send({ content, allowedMentions: { parse: [] } });
  state.blockMsgs[rid] = msg.id;
  save();
}

async function refreshLeague(guild) {
  const [users, rosters] = await Promise.all([get(`/league/${LEAGUE_ID}/users`), get(`/league/${LEAGUE_ID}/rosters`)]);
  const usersById = Object.fromEntries(users.map((u) => [u.user_id, u]));
  const ownerOf = {};
  for (const r of rosters) for (const p of r.players ?? []) ownerOf[p] = r.roster_id;
  league = { rosters, usersById, ownerOf, names: Object.fromEntries(rosters.map((r) => [r.roster_id, teamName(r, usersById)])) };
  await ensureChannels(guild);

  for (const r of rosters) {
    const rid = r.roster_id;
    if (rid in state.owners && !state.owners[rid] && r.owner_id) {
      await send(state.channels.teams[rid].moves, `👋 **${usersById[r.owner_id]?.display_name}** joined the league and claimed this team!`);
    }
    state.owners[rid] = r.owner_id ?? null;
    // Players traded or dropped come off the block automatically.
    const block = state.blocks[rid] ?? [];
    const kept = block.filter((e) => ownerOf[e.id] === rid);
    if (kept.length !== block.length) {
      state.blocks[rid] = kept;
      await postTradeBlock(rid);
    }
  }
  save();
}

async function pollTransactions() {
  const first = !state.seenTx; // first run: remember existing history instead of spamming it
  state.seenTx ??= [];
  const seen = new Set(state.seenTx);
  const round = Math.max(1, (await get('/state/nfl')).leg ?? 1);
  const rounds = round > 1 ? [round - 1, round] : [round];
  const txs = (await Promise.all(rounds.map((r) => get(`/league/${LEAGUE_ID}/transactions/${r}`)))).flat();
  const players = await getPlayers();
  for (const tx of txs.sort((a, b) => a.status_updated - b.status_updated)) {
    if (tx.status !== 'complete' || seen.has(tx.transaction_id)) continue;
    state.seenTx.push(tx.transaction_id);
    if (first) continue;
    const text = describeTransaction(tx, players, league.names);
    await send(state.channels.transactions, text);
    if (tx.type === 'trade') await groupme(text);
    for (const rid of tx.roster_ids) await send(state.channels.teams[rid].moves, text);
  }
  save();
}

// Once a week's games are final, post its top scorers and biggest blowout to GroupMe.
// Reads the Yahoo league while YAHOO_LEAGUE_ID is set, otherwise the Sleeper league.
async function postWeeklyRecap() {
  let data;
  if (process.env.YAHOO_LEAGUE_ID) {
    data = await getYahooWeek(process.env.YAHOO_LEAGUE_ID);
  } else {
    const nfl = await get('/state/nfl');
    if (!['regular', 'post'].includes(nfl.season_type) || nfl.week < 2) return;
    const week = nfl.week - 1;
    data = { id: `sleeper-${nfl.season}-${week}`, ...sleeperWeek(week, await get(`/league/${LEAGUE_ID}/matchups/${week}`), league.names, await getPlayers()) };
  }
  if (!data || state.recap === data.id) return;
  const text = weeklyRecap(data);
  if (text) await groupme(text);
  state.recap = data.id;
  save();
}

async function pollNews() {
  state.seenNews ??= [];
  state.newsPlayers ??= {}; // players whose news backlog has been recorded
  const seen = new Set(state.seenNews);
  const players = await getPlayers();
  const espnIds = await getEspnIds((await get('/state/nfl')).season).catch((err) => (console.error(err.message), {}));
  for (const [pid, rid] of Object.entries(league.ownerOf)) {
    const p = players[pid];
    const espnId = p?.espn_id ?? espnIds[nameKey(p?.full_name, p?.position)];
    if (!espnId) continue; // team defenses, and anyone ESPN's list doesn't have
    let items;
    try {
      items = await getPlayerNews(espnId);
    } catch (err) {
      console.error(err.message);
      continue;
    }
    // First look at a player (new to a roster): remember their backlog instead of posting it.
    const post = state.newsPlayers[pid];
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      state.seenNews.push(item.id);
      if (post) await send(state.channels.teams[rid].news, playerUpdateText(playerName(players, pid), item));
    }
    state.newsPlayers[pid] = true;
  }
  state.seenNews = state.seenNews.slice(-3000); // ~5 items per rostered player

  // shortcut: injury changes only show up when the daily player map refreshes; ESPN news usually covers them sooner.
  for (const [pid, rid] of Object.entries(league.ownerOf)) {
    const status = players[pid]?.injury_status ?? null;
    if (pid in state.injuries && state.injuries[pid] !== status) {
      await send(state.channels.teams[rid].news, `🚑 **${playerName(players, pid)}**: ${state.injuries[pid] ?? 'Healthy'} → ${status ?? 'Healthy'}`);
    }
    state.injuries[pid] = status;
  }
  save();
}

const commands = [
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your Sleeper team')
    .addStringOption((o) => o.setName('sleeper_username').setDescription('Your Sleeper username').setRequired(true)),
  new SlashCommandBuilder()
    .setName('tradeblock')
    .setDescription('Manage your trade block')
    .addSubcommand((s) => s.setName('add').setDescription('Put a player on your trade block')
      .addStringOption((o) => o.setName('player').setDescription('Player on your roster').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('asking').setDescription('What you want back (optional)').setMaxLength(100)))
    .addSubcommand((s) => s.setName('remove').setDescription('Take a player off your trade block')
      .addStringOption((o) => o.setName('player').setDescription('Player on your block').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('clear').setDescription('Empty your trade block')),
];

async function handleCommand(i) {
  const reply = (content) => i.reply({ content, flags: MessageFlags.Ephemeral });
  if (i.commandName === 'link') {
    const username = i.options.getString('sleeper_username');
    const user = await get(`/user/${encodeURIComponent(username)}`);
    const roster = user && league.rosters.find((r) => r.owner_id === user.user_id || r.co_owners?.includes(user.user_id));
    if (!roster) return reply(`No team in this league belongs to Sleeper user \`${username}\`. Join the league on Sleeper first.`);
    state.links[i.user.id] = roster.roster_id;
    save();
    return reply(`Linked you to **${league.names[roster.roster_id]}**.`);
  }

  const rid = state.links[i.user.id];
  if (!rid) return reply('Run `/link` with your Sleeper username first.');
  const block = (state.blocks[rid] ??= []);
  const sub = i.options.getSubcommand();
  const pid = i.options.getString('player');
  const name = pid && playerName(await getPlayers(), pid);
  if (sub === 'add') {
    if (league.ownerOf[pid] !== rid) return reply("That player isn't on your roster.");
    const asking = i.options.getString('asking');
    const existing = block.find((e) => e.id === pid);
    if (existing) existing.asking = asking;
    else block.push({ id: pid, asking });
  } else if (sub === 'remove') {
    if (!block.some((e) => e.id === pid)) return reply("That player isn't on your trade block.");
    state.blocks[rid] = block.filter((e) => e.id !== pid);
  } else {
    state.blocks[rid] = [];
  }
  await postTradeBlock(rid);
  return reply(sub === 'clear' ? 'Trade block cleared.' : `${sub === 'add' ? 'Added' : 'Removed'} ${name}.`);
}

async function handleAutocomplete(i) {
  const rid = state.links[i.user.id];
  const players = await getPlayers();
  const ids = i.options.getSubcommand() === 'remove'
    ? (state.blocks[rid] ?? []).map((e) => e.id)
    : league.rosters.find((r) => r.roster_id === rid)?.players ?? [];
  const q = i.options.getFocused().toLowerCase();
  await i.respond(ids
    .map((id) => ({ name: playerName(players, id).slice(0, 100), value: id }))
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, 25));
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isAutocomplete()) await handleAutocomplete(i);
    else if (i.isChatInputCommand()) await handleCommand(i);
  } catch (err) {
    console.error(err);
    if (i.isRepliable() && !i.replied) await i.reply({ content: 'Something went wrong, try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

function every(ms, fn) {
  const run = () => fn().catch((err) => console.error(err)).finally(() => setTimeout(run, ms));
  run();
}

client.once(Events.ClientReady, async () => {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.commands.set(commands.map((c) => c.toJSON()));
  await refreshLeague(guild);
  console.log(`Logged in as ${client.user.tag}, tracking ${league.rosters.length} teams`);
  every(2 * 60 * 1000, async () => { await refreshLeague(guild); await pollTransactions(); });
  every(60 * 60 * 1000, postWeeklyRecap); // hourly: a recap only changes once a week
  every(10 * 60 * 1000, pollNews); // one ESPN request per rostered player
});

client.login(DISCORD_TOKEN);
