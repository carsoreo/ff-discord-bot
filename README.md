# ff-discord-bot

[![test](https://github.com/carsoreo/ff-discord-bot/actions/workflows/test.yml/badge.svg)](https://github.com/carsoreo/ff-discord-bot/actions/workflows/test.yml)

**CO Fantasy Bot** connects a [Sleeper](https://sleeper.com) fantasy football league to a Discord server and a GroupMe chat. Each team gets its own corner of Discord with its roster moves and news about its players. League-wide transactions and a trade block live in shared channels. GroupMe gets the fun stuff: trade alerts and a weekly recap.

It runs 24/7 on a free Oracle Cloud server, so nobody's computer has to stay on.

## What it does

### Discord
- **Channels for every team.** A **League** category holds `#welcome` (read-only setup steps for new members, kept up to date by the bot), `#transactions` and `#trade-block`. Each Sleeper team gets its own category, named after the team, with:
  - `#team-moves`: that team's trades, waiver claims and pickups
  - `#player-news`: short updates and injury changes for that team's players
- **New owners.** Unclaimed teams show up as "Open Team N". When someone joins the league on Sleeper and claims a team, its category is renamed and the bot welcomes them.
- **Transactions.** Completed trades (players, draft picks, FAAB), waiver claims (with the winning bid), free-agent pickups and commissioner moves are posted to `#transactions` and to each involved team's `#team-moves`. Checked every 2 minutes.
- **Player news.** Short fantasy updates from ESPN's free fantasy news API (the same Rotowire-written blurbs the Sleeper app shows, no opinion articles), plus injury status changes, go to the `#player-news` of whichever team rosters the player. Checked every 10 minutes.
- **Trade block.**
  - `/link sleeper_username` connects your Discord account to your Sleeper team, and the bot @mentions you in your team's `#team-moves` so you can find your channels.
  - **Roles:** linking gives you the server's **Manager** role, and the Sleeper league's commissioner also gets **Commissioner**. Create those two roles yourself, give the bot's role **Manage Roles**, and keep the bot's role above them in the role list.
  - `/tradeblock add|remove|clear` manages your trade block. Player names autocomplete from your roster, and you can add what you're asking for.
  - Each team keeps one message in `#trade-block`. Players come off the block on their own once they're traded or dropped.

### GroupMe (optional)
- **Trade alert:** `🚨🚨 A NEW TRADE IS PENDING 🚨🚨` as soon as a trade shows up in Sleeper. No details, so the people involved can post them.
- **Weekly recap,** once a week's games are final:

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

Top scorers count starters only. Standings are ranked by wins, then points for, the same tiebreaker Sleeper uses.

### Good to know
- On its first run the bot records existing transactions, news and trades without posting them, so a fresh start doesn't flood the channels.
- Sleeper caches its API for up to ~10 minutes, so a new move can take that long to show up.
- Preview a recap without posting it anywhere:
  ```bash
  npm run recap -- [week] [leagueId]
  ```
  It defaults to the last finished week of `LEAGUE_ID`.

## Setup

You need [Node.js](https://nodejs.org) 22 or newer, a Discord server you manage, and a Sleeper league.

### 1. Create the Discord bot
1. Go to https://discord.com/developers/applications → **New Application** and name it.
2. **Bot** tab → **Reset Token** → copy the token. Discord shows it only once.
3. **General Information** tab → copy the **Application ID**.
4. Invite the bot to your server by opening this link with your Application ID in place of `APP_ID`:
   ```
   https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot+applications.commands&permissions=68624
   ```
   `68624` grants View Channels, Send Messages, Read Message History and Manage Channels, which is all the bot needs.
5. In Discord turn on **User Settings → Advanced → Developer Mode**, then right-click your server → **Copy Server ID**.

### 2. Configure and run it locally
```bash
git clone https://github.com/carsoreo/ff-discord-bot.git
cd ff-discord-bot
npm install
cp .env.example .env
```
Fill in `.env`:

| Setting | Where it comes from |
|---|---|
| `DISCORD_TOKEN` | Step 1.2 |
| `GUILD_ID` | Step 1.5 |
| `LEAGUE_ID` | The long number in your Sleeper league's URL (`sleeper.com/leagues/<LEAGUE_ID>/…`). Sleeper gives each new season a new ID. |
| `GROUPME_BOT_ID` | Optional, see step 3. Leave blank to keep GroupMe off. |

Then `npm start`. The bot creates its channels and logs `Logged in as … tracking N teams`. Run `npm test` to check the formatting logic.

`.env` holds your secrets and `data/` holds the bot's memory (`state.json`: channels, `/link`s, trade blocks, what's been posted). Both are gitignored. **Back up `data/state.json`**; without it the bot forgets links and trade blocks.

### 3. Connect GroupMe (optional)
1. Go to https://dev.groupme.com/bots → **Create Bot**, pick your group, name it, and leave **Callback URL** blank.
2. Put its **Bot ID** in `.env` as `GROUPME_BOT_ID` and restart. Anyone with this ID can post as the bot, so keep it private.

### 4. Host it 24/7 on Oracle Cloud (free)
Oracle's **Always Free** tier includes a small server that's plenty for this bot: it uses about 130 MB of memory at peak.

1. **Make an SSH key** on your computer:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/oracle_ff_bot
   ```
2. **Sign up** at https://www.oracle.com/cloud/free/. It needs a card for verification but doesn't charge for Always Free resources. Don't click **Upgrade** unless you want paid resources.
3. **Create the network first.** In the console go to **Networking → Virtual cloud networks → Actions → Start VCN Wizard → Create VCN with Internet Connectivity**. This avoids a console bug where a network made from the instance form can't get a public IP.
4. **Create the server.** Go to **Compute → Instances → Create instance**:
   - **Availability domain:** the one the form says offers `VM.Standard.E2.1.Micro` (AD-2 in Ashburn)
   - **Image:** Canonical Ubuntu 24.04
   - **Shape:** Specialty and previous generation → **VM.Standard.E2.1.Micro** (marked *Always Free-eligible*)
   - **Networking:** your new VCN and its **public subnet**, with **Automatically assign public IPv4 address** on
   - **SSH keys:** paste the contents of `~/.ssh/oracle_ff_bot.pub`
   - **Create**, then copy the **Public IP address** once the instance is Running. If you get "out of capacity", try another availability domain or retry later.
5. **Install the bot** on the server, with your server's IP in place of `SERVER_IP`:
   ```bash
   ssh -i ~/.ssh/oracle_ff_bot ubuntu@SERVER_IP
   # on the server: 1 GB of swap for headroom, Node 22, git and pm2
   sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git
   sudo npm install -g pm2
   git clone https://github.com/carsoreo/ff-discord-bot.git && cd ff-discord-bot && npm ci --omit=dev && mkdir -p data
   ```
6. **Copy your settings and the bot's memory** from your computer. **Stop the local bot first**; two copies would double-post everything.
   ```bash
   scp -i ~/.ssh/oracle_ff_bot .env ubuntu@SERVER_IP:ff-discord-bot/.env
   scp -i ~/.ssh/oracle_ff_bot data/state.json ubuntu@SERVER_IP:ff-discord-bot/data/state.json
   ```
7. **Start it, and keep it running through crashes and reboots:**
   ```bash
   ssh -i ~/.ssh/oracle_ff_bot ubuntu@SERVER_IP
   cd ff-discord-bot && chmod 600 .env
   pm2 start npm --name ff-bot -- start && pm2 save
   pm2 startup   # then run the command it prints
   ```

**Day to day** (from your computer):
```bash
# see what it's doing
ssh -i ~/.ssh/oracle_ff_bot ubuntu@SERVER_IP "pm2 logs ff-bot --lines 30 --nostream"
# deploy new code after pushing to GitHub
ssh -i ~/.ssh/oracle_ff_bot ubuntu@SERVER_IP "cd ff-discord-bot && git pull && npm ci --omit=dev && pm2 restart ff-bot"
# after editing the server's .env (e.g. a new season's LEAGUE_ID)
ssh -i ~/.ssh/oracle_ff_bot ubuntu@SERVER_IP "pm2 restart ff-bot --update-env"
```

## Versions and releases

The bot uses [semantic versioning](https://semver.org): **major.minor.patch**. The version lives in `package.json`, the server prints it on startup (`CO Fantasy Bot v1.0.0: logged in as …`), and every release has a git tag and an entry in [CHANGELOG.md](CHANGELOG.md).

- **patch** (1.0.0 → 1.0.1): bug fixes and wording tweaks
- **minor** (1.0.0 → 1.1.0): new features that don't change how anything is set up
- **major** (1.0.0 → 2.0.0): changes that need setup work, like new required `.env` settings or renamed channels

To release, add the changes to `CHANGELOG.md`, commit, then:
```bash
npm version minor          # or patch / major: bumps package.json, commits, and tags vX.Y.Z
git push --follow-tags
```
Then deploy to the server as above, and check the startup line shows the new version.

## Yahoo recaps (optional, waiting on Yahoo)

The weekly recap can read a Yahoo league instead of Sleeper. **As of 2026 Yahoo only serves fantasy data to apps it has approved**; self-serve apps get `403 This application is not authorized`. Apply at https://sports.yahoo.com/developer/access/ first.

1. Create an app at https://developer.yahoo.com/apps/create/ with **Redirect URI** `https://localhost:8080` and **API Permissions → Fantasy Sports → Read**.
2. Put its Client ID and Client Secret in `.env` as `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET`, and the league number from the Yahoo URL as `YAHOO_LEAGUE_ID`.
3. Run `npm run yahoo-auth` and follow the prompts. It saves `YAHOO_REFRESH_TOKEN` to `.env`.

Remove `YAHOO_LEAGUE_ID` to switch the recap back to Sleeper. Yahoo recaps don't include standings.
