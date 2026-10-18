# Phase 4: iPad play with room codes (the relay)

Status: relay server built (this doc plus `server/`). The client screens are not built yet.

## 1. Goals and non-goals

Goals
- Two families on two iPads play one match. No sign-in. No accounts.
- A short picture code joins them. Nothing personal is in the code.
- The server runs the game rules. Nobody can cheat, and nobody can peek at the other player's reload question or answer.
- The game stays free and private. The relay keeps no data after a restart.

Non-goals
- No chat. No free text between players. Only a few fixed emotes.
- No accounts, no leaderboards, no stored history on the server.
- No spectators. A room holds exactly two players.
- No client code in this change. The static site and its build do not change.
- The Computer player for an empty seat is future work (section 12).

## 2. The player flow (two iPads)

1. The host taps **Make a room**. The server makes a room and sends back a code and a private seat key.
2. The screen shows the code as 6 big pictures (animals). The same 6 show as letters under the pictures, for kids and adults who prefer letters or use a screen reader.
3. The friend taps **Join a room** on the other iPad and taps the 6 pictures (or types the 6 letters).
4. Each player picks a team and a grade (and a subject). If both want the same team, the second one is told to pick the other. A player may type a first name. It is optional.
5. When both have picked, the match starts. Team Past goes first unless it is a rematch.
6. Play. Each turn is 2 shots, then a reload question, then a Power Shot after a right answer. Only the player whose turn it is sees the question.
7. At Victory, either player taps **Rematch**. When both tap, a new match starts with the other team going first and a new seed.
8. **Leave** closes the room for both. The friend sees a kind "your friend left" screen.

## 3. Who is in charge

The server is in charge (global rule `SERVER`).

- The server runs the same pure rules the single-player game uses. It imports `createMatch`, `pickQuestion`, `validateName` and friends from `src/game/` and `src/questions/`. Nothing is copied.
- The server picks the match seed and the question seed from a secure random source. It never sends either seed. (A question seed would show every future question.)
- Clients send **intents**: "fire with this angle, power and fighter", and "my answer is choice 2". The server decides what happens.
- The server sends **public state** to both players: whose turn, wind, base health, scrap, stats, the shot path and where it landed.
- The server sends the **reload question only to the player whose turn it is.** It sends the choices only, never the answer. The other iPad gets "Team X is answering" and nothing else. A test checks the raw bytes sent to the other socket.
- The server shuffles the four choices with its own seed. The client answers by position (0 to 3).
- The server times the answer itself. It starts the clock when it sends the question. The client's own timer is never trusted. A slow network can cost a "fast" bonus, which is a fair trade.
- The hint is sent only after a wrong answer, and only to the player who answered.
- Client rules are UX only. When two kids sit side by side, the client should still cover the board during a question, as today. The server cannot enforce that part.

## 4. Message protocol (version 1)

Every message is one JSON object in one WebSocket text frame. Every message has `v` (always `1`) and `t` (the type). Fields not listed for a type are **rejected**. A frame over 1,024 bytes is rejected (and the `ws` library drops the connection at the limit).

Mutating messages carry `turn` and `seq`. The server builds the **idempotency key** `{room}:{player}:{turn}:{seq}` from the connection (the room and player come from the socket, never from the message). `seq` is a whole number that goes up with every new action from that seat, for the life of the room. To retry after a lost reply, send the **same** `seq` and the same fields.

### Client to server

| Type | Fields | Notes |
|---|---|---|
| `create_room` | none | First message on a new connection. |
| `join_room` | `code` (6 symbols) | First message for the friend. |
| `rejoin` | `code`, `seat` (0 or 1), `secret` | After a dropped connection. The secret is in the body, never a URL. |
| `setup` | `turn` (0), `seq`, `team`, `grade` (0 to 12), `subject` (`reading`, `math`, `both`), `name` (optional, 1 to 12 chars) | Sets this seat's choices. Can repeat until the match starts. |
| `fire` | `turn`, `seq`, `angleDeg`, `power`, `unit` (optional fighter id) | Pick fighter, aim and fire in one message. Allowed in AIMING and BONUS_AIMING only. The server clamps the aim. |
| `answer` | `turn`, `seq`, `choice` (0 to 3) | Allowed in RELOAD only, and only from the player whose turn it is. |
| `rematch` | `turn`, `seq` | Allowed after Victory. Needs both seats. |
| `emote` | `emote` (`wave`, `cheer`, `oops`, `good_game`) | Fixed list. Limited to 1 every 2 seconds. |
| `leave` | none | Closes the room. |
| `ping` | none | Keeps the connection warm. |

### Server to client

| Type | To | Fields | Notes |
|---|---|---|---|
| `room_created` | host | `code`, `seat` (0), `secret` | The secret appears once. |
| `room_joined` | guest | `code`, `seat` (1), `secret` | Same. |
| `lobby` | both | `seats` (for each: `present`, `team`, `grade`, `subject`, `name`, `ready`) | Sent on every change before the match. |
| `state` | both | `rev`, `phase`, `activeSeat`, `status`, `winner`, `turnNumber`, `shotsFired`, `bonus`, `wind`, `baseHp`, `maxBaseHp`, `scrap`, `stats`, `names`, `you` (seat and team) | Public only. No seed. No question. |
| `shot` | both | `rev`, `team`, `angleDeg`, `power`, `unit`, `path`, `landing`, `hit`, `result`, `damage`, `blocked`, `tumble`, `bubbleIndex` | Everything a client needs to draw the shot. |
| `question` | active seat only | `turn`, `kind`, `prompt`, `choices`, `passage`, `audioWord`, `grade` | No answer. No question id. |
| `reload` | both | `rev`, `team`, `correct`, `scrap`, `fast`, `bonus`; `hint` to the answerer only, after a wrong answer | Never contains the question or the answer. |
| `rematch_vote` | both | `seat` | One player asked for a rematch. When both have, a new `state` follows. |
| `pong` | sender | none | Reply to `ping`. |
| `peer` | the other seat | `event` (`left`, `back`) and `graceMs` | Tells the other iPad to show "waiting for your friend". |
| `emote` | the other seat | `emote` | |
| `room_closed` | both | `reason` (`left`, `gone`, `idle`) | Then the server closes the socket. |
| `error` | sender | `code`, `seq` (if known) | Codes: `bad_message`, `too_big`, `unknown_type`, `not_in_room`, `no_such_room`, `room_full`, `busy`, `rejoin_failed`, `not_your_turn`, `wrong_phase`, `stale_turn`, `stale_seq`, `key_reused`, `bad_name`, `team_taken`, `already_in_room`, `slow_down`. No free text. |

A repeated `seq` with the same fields is a **replay**. The server sends back the same replies the first call produced to the sender, does nothing else, and tells nobody else. The same `seq` with different fields is `key_reused`. A `seq` lower than the newest one that is not in the replay cache is `stale_seq`. Only accepted actions use up a `seq`; a rejected one does not.

## 5. Reconnect rules

- If a socket drops, the seat is kept for **60 seconds**. The other player gets `peer: left`.
- The player rejoins with `rejoin` (room code, seat, secret). On success they get the full `state` again, and the pending `question` if it is their reload. The other player gets `peer: back`.
- The seat secret is 32 random bytes (256 bits), base64url. The server keeps only its SHA-256 hash, in memory. It is compared in constant time. It is never logged and never in a URL. The client keeps it in memory or `sessionStorage` (not `localStorage`, so it dies with the tab).
- After 60 seconds, or with a wrong secret, `rejoin` fails with one generic `rejoin_failed`. The room is closed when the grace ends (the other player gets `room_closed: gone`).
- A second socket for a live seat is refused unless the secret matches. A matching secret replaces the old socket (an iPad that woke up with a new connection).

## 6. Rate limits

| Limit | Value |
|---|---|
| Messages per connection | burst 10, refill 5 per second. Over: `slow_down`. 5 strikes in a row close the socket. |
| Messages per room | burst 40, refill 10 per second |
| Rule violations per connection (wrong turn, bad phase, bad name...) | 12, then the socket closes |
| Failed joins per network address | 10 per 10 minutes |
| Failed joins, whole server | burst 200, refill 5 per second |
| New rooms per network address | 10 per 10 minutes |
| New sockets per network address | 30 per minute; 20 open at once (a classroom shares one address) |
| Open rooms, whole server | 2,000. Over: `busy`. |
| Emotes | 1 per 2 seconds per seat |

Network addresses are held **only in memory**, as a salted hash with a random salt made at boot, and are forgotten when the limit window ends. They are never logged and never written to disk. This is the one use of an address, and it is what stops brute-force guessing (section 7). See open decision 2.

## 7. Room codes and guessing

- A code is 6 symbols from an alphabet of 32. That is 32^6 = 1,073,741,824 codes (**30 bits**). The 32 symbols are 32 animal pictures. Each picture also has one letter or digit: `23456789` plus `BCDFGHJKLMNPQRSTVWXYZ` plus `A`, `E`, `U`.
- The code comes from `crypto.randomInt`. A new code is thrown away if it is already in use, or if its letters (after turning digits like 3 and 5 into letters) hold a blocked or rude word.
- Why 6 and not 4: with 2,000 open rooms at most, one guess hits a room with chance about 1 in 540,000. Four symbols (20 bits) would give about 1 in 520 per guess, which is too easy to farm. Six pictures still fit on an iPad in two rows of three, and kids match pictures well. The code is for one game only.
- Guess limits: 10 failed joins per address per 10 minutes, and 200 burst for the whole server. One address, at 1,440 guesses a day, needs about a year to expect one hit on a full server. A large botnet still hits the server-wide limit first.
- A room locks to **two seats**. A third `join_room` gets `room_full`. A room with no guest yet is open to exactly one joiner.
- Rooms expire after **2 hours without a valid message** (`room_closed: idle`).
- The harm of a wrong join is small: no text, no names unless typed, fixed emotes only. It is still treated as a safety issue, which is why the limits exist.

## 8. Abuse and safety

- No free text between players. The only strings that reach the other player are a typed first name and fixed emote ids.
- A name is optional, trimmed, 1 to 12 characters, and checked by the same `validateName` the single-player game uses (banned words, leetspeak). A bad name gets `bad_name` and is never relayed.
- Names are never logged. The opponent sees a name only if the family typed one. Otherwise they see the default (Knight or Rocket).
- Unknown message fields, wrong types, `NaN`, and huge numbers are rejected before any game code runs. `__proto__` style keys are rejected as unknown fields.
- A client that sends a shot out of turn, in the wrong phase, or with an old `turn` gets an error and nothing changes.

## 9. What the relay logs

One line per event: the room code and the event type. For example `{"room":"7KX3PE","event":"fire"}`. Nothing else: no names, no addresses, no secrets, no seeds, no questions, no answers. A test reads every log line a full match writes and checks this. Railway's own edge may keep request logs; the relay cannot control that (open decision 2).

## 10. Failure modes

| What happens | What the server does |
|---|---|
| Host leaves on purpose | Sends the guest `room_closed: left`. Deletes the room. |
| A player's connection drops | 60 second grace, then `room_closed: gone` for the other player. |
| Both leave or drop | The room is deleted after the grace. A room with nobody connected is also swept by the idle timer. |
| The server restarts | All rooms are lost. Clients see the socket close and the rejoin fails. The client shows "That room is gone. Make a new one." This is accepted. |
| Duplicate message | Replay (section 4). One shot only. |
| Out-of-order message | `stale_seq`, or `stale_turn` if it is for an old turn. |
| Clock skew | The server uses only its own clock. The client clock is never read. |
| Shot out of turn | `not_your_turn`. A violation is counted. |
| Answer when no question is open | `wrong_phase`. |
| A client floods | `slow_down`, then the socket is closed. |
| Both want the same team | The second `setup` gets `team_taken`. |
| An iPad sleeps in the middle of a question | Grace applies. After `rejoin`, the same question is sent again and the server's clock keeps running. A slow answer never loses scrap (Gate 2). |

## 11. Deployment on Railway

- A **second service** in the same Railway project as the static site. It uses the same repo.
- Build command: `npm ci --include=dev` (the relay runs TypeScript through `tsx`, a dev dependency). Start command: `npm run relay`. Nixpacks detects Node and the `engines` field.
- The service listens on `PORT` (Railway sets it) on `0.0.0.0`.
- Health check path: `/health`. It returns `{"ok":true,"build":"<git sha>"}`. The build id comes from `RAILWAY_GIT_COMMIT_SHA`, or `dev` when it is not set.
- `wss://`: Railway ends TLS at its proxy and forwards the upgrade to the service, so the relay itself speaks plain `ws` on its port. The browser connects to `wss://<relay-domain>/ws`.
- Environment variables (see `.env.example`):
  - `ALLOWED_ORIGINS` (required in production): `https://timeclash.rallytasks.com`. The relay checks the `Origin` header on every upgrade and boot fails without it when `NODE_ENV=production`.
  - `TRUST_PROXY=1` (set on Railway): read the client address from the proxy header, for rate limits only.
  - `PORT`, `RAILWAY_GIT_COMMIT_SHA`: set by Railway.
- The static site needs one thing: `VITE_RELAY_URL=wss://<relay-domain>/ws`, set at build time. Its CSP `connect-src` must also add that host (and `_headers` and the page meta tag change together, as the existing test requires). **Not done in this change**, because it needs the real domain.
- A restart loses open rooms. That is fine for a game that lasts about 15 minutes.
- One instance only. Rooms live in memory, so do not scale to two replicas.

## 12. A Computer player in an empty seat (later)

`src/game/bot.ts` already picks shots and answers from public state with a seeded rng. A bot seat would be a server-side object with the same `fire` and `answer` entry points as a human seat. The driver would call it on the bot's turn after a short delay. No protocol change is needed: the other player just sees a seat that never disconnects. It needs the `team`, `grade` and a bot level in `setup`, which is an additive change.

## 13. Test plan

Unit tests (`npm run relay:test`):
- Protocol: valid messages; malformed JSON; non-objects; wrong `v`; oversize; unknown type; unknown field; wrong types; out-of-range numbers; `NaN`.
- Room codes: format, alphabet size and bits, uniqueness over many draws, rude combos rejected.
- Rate limiter: burst allowed, flood rejected, refill with a fake clock; keyed limiter forgets old keys.
- Expiry: idle rooms close after 2 hours with a fake clock; activity resets it.
- Idempotency: a replayed `fire` fires nothing new; same `seq` with other fields is `key_reused`; lower `seq` is `stale_seq`.
- Turn authority: a shot out of turn, in the wrong phase, or for an old turn is rejected and changes nothing.
- Privacy: for a full reload, the raw frames sent to the other seat never contain the prompt, any choice, or the answer. The question frames sent to the active seat never contain the answer string at a field of its own.
- Reconnect: rejoin inside 60 seconds restores state and the pending question. Rejoin after 60 seconds fails. A wrong secret fails the same way.
- Logs: every line holds only `room` and `event`.

Integration test: a real HTTP server on an ephemeral port, two real `ws` clients, a seeded match played to Victory with a scripted shooter and a fixed reload answer rule, plus the `/health` check and an Origin check.

Not covered yet (needs the client): iPad Safari behavior of a sleeping socket, and the real Railway proxy. Check both in the first staging run.

## 14. Open decisions for the owner

1. **Code length.** Six pictures (30 bits) is what this doc builds. The BUILD.md note says 4 letters. Four is easier for small kids but is easy to guess. See section 7.
2. **Network address use.** Brute-force limits need a per-address counter, held in memory as a salted hash and dropped after 10 minutes. AGENTS.md says "no IPs kept". This is the narrowest reading that still protects kids from guessers. Approve it, or accept weaker limits.
3. **Where the relay lives.** Railway second service (as built here), versus the free tiers in BUILD.md. Also whether `tsx` should become a runtime dependency instead of the build command flag.
