# Changelog

Versions follow [semantic versioning](https://semver.org). See "Versions and releases" in the README.

## 1.5.1 (2026-11-03)

- Draft grades, best-value picks and busts leave out keepers. A keeper is a pick Yahoo marks as one, or a player the same manager had at the end of the season before. Keepers are labeled on the draft board.
- The history collector saves Yahoo's keeper marks.

## 1.5.0 (2026-11-03)

- Player stats on the Hall of Fame site, from every team's weekly lineup:
  - A Players tab with the best player games, the most points left on the bench, each manager's top players, and the best and worst draft picks.
  - Each season's draft now has grades, its best-value and worst early picks, and every pick's points on the board.
  - `scripts/yahoo-lineups-browser.js` collects the lineups.

## 1.4.1 (2026-11-03)

- `#welcome` links the Hall of Fame site when `SITE_URL` is set.

## 1.4.0 (2026-11-03)

- The Hall of Fame site has motion:
  - On first load the champions step in one by one and the hash marks are chalked left to right.
  - Tabs fade in and the yellow bar slides between them.
  - Changing the season, draft year or rivalry fades the new results in.
  - With "reduce motion" turned on, everything stays as plain fades.

## 1.3.1 (2026-11-03)

- The Hall of Fame site's wording is plainer: head-to-head shows "Andrew leads 3-2" or "Tied 2-2".

## 1.3.0 (2026-11-02)

- League Hall of Fame site: champions, all-time standings, season pages with awards, record book, head-to-head rivalries and draft boards. Built with `npm run site` from your league's Yahoo history; the bot serves it when `SITE_PORT` is set. See the README.
- The record book includes the highest-scoring games (both teams' points combined).
- The site's look is a chalked football field: an end-zone masthead, champions as yard markers and chalk-ruled tables. It's built for phones, with name columns pinned while tables scroll. The design system is in DESIGN.md.
- `scripts/yahoo-history-browser.js` collects a league's past seasons from Yahoo's pages, since Yahoo's API is closed to new apps.

## 1.2.0 (2026-10-21)

- `#welcome` is read-only: members can read and react, only the bot posts. Needs the **Manage Roles** permission.

## 1.1.0 (2026-10-21)

- `/link` gives the member the server's **Manager** role, and the Sleeper commissioner also gets **Commissioner**. The bot uses roles you create yourself (matched by name) and needs the **Manage Roles** permission.
- Members who linked before this release get their roles when the bot starts.
- The `#welcome` message mentions the Manager role.

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
