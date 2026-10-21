# ff-discord-bot

Discord bot for my fantasy football league (Sleeper).

## What it does

- Creates a **League** category with `#transactions` and `#trade-block`, plus a category per Sleeper team with `#team-moves` and `#player-news`.
  Unclaimed teams show up as "Open Team N". When someone joins on Sleeper, the category is renamed and the bot announces the new owner.
- Posts completed trades, waiver claims (with FAAB bid) and free-agent moves to `#transactions` and to each involved team's `#team-moves`. Polls every 2 minutes.
- Posts short player updates from ESPN's free fantasy news API (the same Rotowire-written blurbs Sleeper shows, no articles) and injury status changes to the `#player-news` of the team that rosters the player. Polls every 10 minutes.
- `/link sleeper_username` connects your Discord account to your team.
- Optional: set `GROUPME_BOT_ID` (from https://dev.groupme.com/bots) to post a "🚨🚨 A NEW TRADE IS PENDING 🚨🚨" alert when a trade appears (no details) and a weekly recap (top 3 scorers, highest-scoring team, bum of the week, biggest blowout, standings) to a GroupMe chat. The recap reads a Yahoo league while `YAHOO_LEAGUE_ID` is set, otherwise the Sleeper league.
- `/tradeblock add|remove|clear` keeps one message per team in `#trade-block`. Players come off the block on their own once they're traded or dropped.

On the first run the bot records past transactions and news as seen without posting them.

`npm run recap -- [week] [leagueId]` prints a week's top 3 scorers, highest-scoring team, bum of the week (lowest), biggest blowout and standings from Sleeper without posting anything. It defaults to the last finished week of `LEAGUE_ID`.

## Setup

1. Create an app at https://discord.com/developers/applications, add a bot, and copy its token.
2. Invite it with the `bot` and `applications.commands` scopes and the **Manage Channels**, **Send Messages** and **Read Message History** permissions.
3. `cp .env.example .env`, then fill it in. Get `GUILD_ID` by right-clicking the server (Developer Mode on). `LEAGUE_ID` is the number in the Sleeper league URL.
4. `npm install`, then `npm start`.

The bot's state lives in `data/` (gitignored). Back up `data/state.json` to keep links and trade blocks.

Secrets (bot token) go in a `.env` file, which is gitignored.

## Yahoo recaps (optional)

1. Create an app at https://developer.yahoo.com/apps/create/ with **Redirect URI** `https://localhost:8080` and **API Permissions → Fantasy Sports → Read**.
2. Put its Client ID and Client Secret in `.env` as `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET`, and the league number from the Yahoo URL as `YAHOO_LEAGUE_ID`.
3. Run `npm run yahoo-auth` and follow the prompts. It saves `YAHOO_REFRESH_TOKEN` to `.env`.

Remove `YAHOO_LEAGUE_ID` to switch the recap back to Sleeper.
