# Changelog

Versions follow [semantic versioning](https://semver.org). See "Versions and releases" in the README.

## 1.0.0 (2026-10-20)

First versioned release: the bot as it runs in The Boys' Discord and on the Oracle server.

**Discord**
- League category with `#welcome` (setup steps, kept up to date), `#transactions` and `#trade-block`
- A category per Sleeper team with `#team-moves` and `#player-news`, renamed when someone claims the team
- Trades, waiver claims (with bids), free-agent pickups and commissioner moves posted league-wide and to each team
- Short player updates from ESPN's fantasy news API and injury status changes, routed to the team that rosters the player
- `/link` connects a Discord account to a Sleeper team and @mentions the member in their team channel
- `/tradeblock add|remove|clear`, with players dropping off automatically when traded or dropped

**GroupMe** (off on the server until the Sleeper league goes live)
- `🚨🚨 A NEW TRADE IS PENDING 🚨🚨` alert when a trade appears
- Weekly recap: top 3 scorers, most points, BUM OF THE WEEK, biggest blowout and standings

**Tools**
- `npm run recap` previews a week's recap without posting it
- `npm run yahoo-auth` and an optional Yahoo recap source, waiting on Yahoo's API approval
