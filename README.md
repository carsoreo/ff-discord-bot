# move-the-chains

[![test](https://github.com/carsoreo/move-the-chains/actions/workflows/test.yml/badge.svg)](https://github.com/carsoreo/move-the-chains/actions/workflows/test.yml)

**CO Fantasy Bot** connects a [Sleeper](https://sleeper.com) fantasy football league to a Discord server and, optionally, a GroupMe chat.

- **On Discord:** every team gets its own channels for roster moves and player news, and the league shares channels for transactions and a trade block.
- **On GroupMe:** the bot posts trade alerts and a weekly recap.

The league's history site lives in its own repo, [gold-jacket](https://github.com/carsoreo/gold-jacket).

## Features

### Discord

- **Team channels.** A **League** category holds the shared channels:
  - `#welcome`: read-only setup steps, kept up to date by the bot.
  - `#transactions` and `#trade-block`.

  Each Sleeper team gets its own category, named after the team, with:
  - `#team-moves`: that team's trades, waiver claims and pickups.
  - `#player-news`: news and injury updates for that team's players.
- **New owners.** Unclaimed teams show as "Open Team N". When someone claims a team on Sleeper, its category is renamed and the bot welcomes them.
- **Transactions.** Every two minutes the bot checks Sleeper and posts completed moves to `#transactions` and to each team involved:
  - Trades, including draft picks and FAAB.
  - Waiver claims, with the winning bid.
  - Free-agent pickups and commissioner moves.
- **Player news.** Every ten minutes, short fantasy updates from ESPN's free fantasy news feed, plus injury status changes, go to the `#player-news` of the team that rosters the player.
- **Linking and roles.** `/link sleeper_username` connects a Discord account to a Sleeper team, mentions the member in their team channel, and gives them the server's **Manager** role. The league's commissioner also gets **Commissioner**.
- **Trade block.**
  - `/tradeblock add|remove|clear` manages a team's block, with player names autocompleted from its roster and an optional asking price.
  - Each team keeps one message in `#trade-block`.
  - Players drop off the block when they're traded or released.

### GroupMe

- **Trade alert:** "🚨🚨 A NEW TRADE IS PENDING 🚨🚨" when a trade is proposed, with no details.
- **Weekly recap** once a week's games are final:

```
🏈 Week 7 recap

🔥 Top scorers:
1. Christian McCaffrey (RB, SF): 34.80 for The Durham Haribon
2. Amon-Ra St. Brown (WR, DET): 29.60 for Ryan's Ravenous Team
3. Jahmyr Gibbs (RB, DET): 24.90 for The Downtown Champs

📈 Most points: The Durham Haribon (142.36)
😂😂 BUM OF THE WEEK: Ryan's Ravenous Team (88.12) 😂😂

💥 Biggest blowout: The Durham Haribon beat Ryan's Ravenous Team by 54.24 (142.36 to 88.12)

🏆 Standings:
1. The Durham Haribon 6-1 (820.00)
2. Ryan's Ravenous Team 5-2 (803.07)
...
```

Top scorers count starters only. Standings use Sleeper's tiebreaker: wins, then points for.

### Notes

- On first run the bot records existing transactions and news without posting them, so a fresh start doesn't flood the channels.
- Sleeper caches its API for up to ten minutes, so new moves can take that long to appear.
- `npm run recap -- [week] [leagueId]` prints a recap without posting it. It defaults to the last finished week.

## Setup

Requirements:
- [Node.js](https://nodejs.org) 22 or newer.
- A Discord server you manage.
- A Sleeper league.

### 1. Create the Discord bot

1. At https://discord.com/developers/applications, choose **New Application** and name it.
2. On the **Bot** tab, choose **Reset Token** and copy the token. Discord shows it only once.
3. On the **General Information** tab, copy the **Application ID**.
4. Invite the bot with this link, replacing `APP_ID`:
   ```
   https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot+applications.commands&permissions=268504080
   ```
   This grants View Channels, Send Messages, Read Message History, Manage Channels and Manage Roles.
5. Create **Manager** and **Commissioner** roles in your server, and move the bot's role above them.
6. Turn on **User Settings → Advanced → Developer Mode**, then right-click your server and choose **Copy Server ID**.

### 2. Configure and run

```bash
git clone https://github.com/carsoreo/move-the-chains.git
cd move-the-chains
npm install
cp .env.example .env
```

| Setting | Value |
|---|---|
| `DISCORD_TOKEN` | The bot token from step 1.2 |
| `GUILD_ID` | The server ID from step 1.6 |
| `LEAGUE_ID` | The number in your Sleeper league's URL (`sleeper.com/leagues/<LEAGUE_ID>`). Each new season has a new ID. |
| `GROUPME_BOT_ID` | Optional. See step 3. |
| `SITE_URL` | Optional. A league history site to link in `#welcome`. |

Start it with `npm start`, and run `npm test` to check the formatting logic.

`.env` holds your secrets, and `data/state.json` holds the bot's memory: channels, links, trade blocks and what it has posted. Both are gitignored. Back up `data/state.json`; without it the bot forgets links and trade blocks.

### 3. Connect GroupMe (optional)

1. At https://dev.groupme.com/bots, choose **Create Bot**, pick your group, and leave **Callback URL** blank.
2. Set `GROUPME_BOT_ID` to its Bot ID and restart. Keep the ID private: anyone with it can post as the bot.

### 4. Host it on Oracle Cloud (free)

Oracle's **Always Free** tier includes a small server that easily runs the bot, which peaks at about 130 MB of memory.

1. Create an SSH key:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/oracle_ff_bot
   ```
2. Sign up at https://www.oracle.com/cloud/free/. A card is needed for verification, but Always Free resources aren't charged.
3. Create the network: **Networking → Virtual cloud networks → Start VCN Wizard → Create VCN with Internet Connectivity**.
4. Create the server under **Compute → Instances → Create instance**:
   - **Image:** Canonical Ubuntu 24.04
   - **Shape:** VM.Standard.E2.1.Micro (Always Free-eligible), in an availability domain that offers it
   - **Networking:** the new VCN's public subnet, with a public IPv4 address
   - **SSH keys:** the contents of `~/.ssh/oracle_ff_bot.pub`
5. Install the bot, replacing `SERVER_IP`:
   ```bash
   ssh -i ~/.ssh/oracle_ff_bot ubuntu@SERVER_IP
   sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git
   sudo npm install -g pm2
   git clone https://github.com/carsoreo/move-the-chains.git && cd move-the-chains && npm ci --omit=dev && mkdir -p data
   ```
6. Copy your settings and the bot's memory. Stop any local copy first, or both will post everything:
   ```bash
   scp -i ~/.ssh/oracle_ff_bot .env ubuntu@SERVER_IP:move-the-chains/.env
   scp -i ~/.ssh/oracle_ff_bot data/state.json ubuntu@SERVER_IP:move-the-chains/data/state.json
   ```
7. Start it and keep it running across crashes and reboots:
   ```bash
   cd move-the-chains && chmod 600 .env
   pm2 start npm --name ff-bot -- start && pm2 save
   pm2 startup   # then run the command it prints
   ```

To deploy an update, run on the server:

```bash
cd move-the-chains && git pull && npm ci --omit=dev && pm2 restart ff-bot
```

After editing `.env`, for example for a new season's `LEAGUE_ID`, run `pm2 restart ff-bot --update-env`.

## Yahoo leagues

The weekly recap can read a Yahoo league instead of Sleeper. Yahoo only serves fantasy data to approved apps, so apply at https://sports.yahoo.com/developer/access/ first.

1. Create an app at https://developer.yahoo.com/apps/create/:
   - **Redirect URI:** `https://localhost:8080`
   - **API Permissions:** Fantasy Sports → Read
2. In `.env`, set:
   - `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` from the app.
   - `YAHOO_LEAGUE_ID` to the league number from the Yahoo URL.
3. Run `npm run yahoo-auth` and follow the prompts. It saves `YAHOO_REFRESH_TOKEN` to `.env`.

Remove `YAHOO_LEAGUE_ID` to switch the recap back to Sleeper.

## License

[MIT](LICENSE)
