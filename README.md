# ff-discord-bot

Discord bot for my fantasy football league (Sleeper).

## What it does

- Creates a **League** category with `#transactions` and `#trade-block`, plus a category per Sleeper team with `#team-moves` and `#player-news`.
  Unclaimed teams show up as "Open Team N". When someone joins on Sleeper, the category is renamed and the bot announces the new owner.
- Posts completed trades, waiver claims (with FAAB bid) and free-agent moves to `#transactions` and to each involved team's `#team-moves`. Polls every 2 minutes.
- Posts short player updates from ESPN's free fantasy news API (the same Rotowire-written blurbs Sleeper shows, no articles) and injury status changes to the `#player-news` of the team that rosters the player. Polls every 10 minutes.
- `/link sleeper_username` connects your Discord account to your team.
- Optional: set `GROUPME_BOT_ID` (from https://dev.groupme.com/bots) to post trades and a weekly recap (scores, high/low, closest game, blowout, MVP, standings) to a GroupMe chat.
- `/tradeblock add|remove|clear` keeps one message per team in `#trade-block`. Players come off the block on their own once they're traded or dropped.

On the first run the bot records past transactions and news as seen without posting them.

## Setup

1. Create an app at https://discord.com/developers/applications, add a bot, and copy its token.
2. Invite it with the `bot` and `applications.commands` scopes and the **Manage Channels**, **Send Messages** and **Read Message History** permissions.
3. `cp .env.example .env`, then fill it in. Get `GUILD_ID` by right-clicking the server (Developer Mode on). `LEAGUE_ID` is the number in the Sleeper league URL.
4. `npm install`, then `npm start`.

The bot's state lives in `data/` (gitignored). Back up `data/state.json` to keep links and trade blocks.

Secrets (bot token) go in a `.env` file, which is gitignored.
