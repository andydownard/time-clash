# Signed-in players and a database (plan)

Status: plan only. Nothing here is built. Andy said signed-in users are coming and asked for a SQLite database. Until then, Scrap and purchases are kept **by player name on the device** (`timeclash.camp`, see [ARCHITECTURE.md](../ARCHITECTURE.md)).

## Why this is a separate step

Today nothing a child types leaves the device (`AGENTS.md`, `SECURITY.md`). A database and sign-in change that:

- Names, Scrap and purchases would live on a server. That is personal data about children.
- The static host (Railway serves the built site) has no server code. A small Node service and a place to keep the SQLite file (a Railway volume) would be new.
- It needs real accounts (a parent signs in, kids are profiles under it). Plain names are not enough: anyone could type "Alex" and take that pile.

So before any code: a panel review (parent and teacher can BLOCK on privacy and safety, and only Andy can override), a privacy statement, and a decision on how a parent signs in (email link, a passkey, or a school login). Do not collect kids' emails.

## What stays the same

The game rules (`src/game/`) and the economy functions (`economy.ts`) are pure and know nothing about storage. They take a `CampState` and return a new one. A database only has to load that shape and save it. Nothing in the rules changes.

## The seam

Reads and writes go through two functions in `src/storage/storage.ts`: `loadCamp(storage)` and `storage.set('timeclash.camp', camp)`. To add a database, put a `CampStore` interface in front of them (`load(): CampState`, `save(camp)`), with the localStorage version as the default. A signed-in build swaps in an API-backed store. Offline play keeps working by saving to the device first and syncing later.

## Proposed SQLite tables

```sql
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,            -- UUID v7, never the name
  account_id TEXT NOT NULL,       -- the signed-in parent
  name TEXT NOT NULL,             -- the display name, 1 to 12 letters
  name_key TEXT NOT NULL,         -- lowercase, one space between words (walletKey)
  created_at TEXT NOT NULL,       -- UTC
  UNIQUE (account_id, name_key)
);
CREATE TABLE IF NOT EXISTS wallets (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  scrap INTEGER NOT NULL CHECK (scrap >= 0),
  earned INTEGER NOT NULL CHECK (earned >= scrap)
);
CREATE TABLE IF NOT EXISTS loadouts (
  player_id TEXT NOT NULL REFERENCES players(id),
  team TEXT NOT NULL CHECK (team IN ('PAST','FUTURE')),
  weapon TEXT NOT NULL,
  owned TEXT NOT NULL,            -- JSON: { weaponId: level }
  upgrades TEXT NOT NULL,         -- JSON: { upgradeId: level }
  PRIMARY KEY (player_id, team)
);
CREATE TABLE IF NOT EXISTS credited_matches (
  player_id TEXT NOT NULL REFERENCES players(id),
  match_seed INTEGER NOT NULL,
  scrap INTEGER NOT NULL,
  PRIMARY KEY (player_id, match_seed)   -- the same match cannot pay twice (MUTATION rule)
);
```

Rules for the server side (`SERVER`, `MUTATION`, `DB` in the global contract):

- The server checks every purchase and every credit. The browser only sends the choice, never a total.
- A purchase is one transaction: check Scrap, subtract, record the item, and write the row that stops a double buy. Same key and same input returns the same result.
- A match credit is idempotent by `(player_id, match_seed)`. The server decides how much Scrap a match was worth from what it saw, not from a number the browser sends.
- Rate limits on every write. Migrations are additive and numbered.
- Logs hold ids and event types only. No names, no emails.

## Moving what is on a device

The first time a signed-in family opens the game, offer to move the by-name piles from `timeclash.camp` into that account. The family picks which saved name is which child. Never merge piles by name alone on the server.

## Open questions for Andy

1. How does a parent sign in (email link, passkey, school login)?
2. Is this for family devices only, or for classrooms too?
3. Where does the SQLite file live (a Railway volume) and who backs it up?
4. Should scores and leaderboards exist at all? `SECURITY.md` says no accounts and no public data. Leaderboards stay out unless Andy says otherwise.
