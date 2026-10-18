# SECURITY and Child Safety

Players are children. Assume the strictest rules for kids' privacy (COPPA in the US, similar elsewhere).

## Data
- No accounts, no sign-in, no email, no phone numbers.
- Names are first names a family types in. They stay in the browser (`localStorage`). They are never sent to a server, logged, or put in a URL.
- No analytics, no ad networks, no third-party scripts, no cookies, no fonts or images loaded from other sites (self-host everything).
- A "Clear my data" button in Settings wipes all `timeclash.*` keys.

## Content
- No gore, blood, or realistic harm. No scary imagery.
- No user-generated text shown to other players beyond the typed first name. Names pass a simple blocked-word check.
- No chat. Phase 4 has no free-text messages between players.

## Secrets
- Phases 1 to 3 need no secrets. Phase 4 relay secrets (if any) live in env vars, never in git. `.env` is git-ignored and `.env.example` lists keys.

## Web hardening
- Set a strict Content Security Policy that allows only same-origin scripts, styles, images, audio, and (Phase 4) the relay's WebSocket host.
- Send `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` that turns off camera, microphone and location, and `frame-ancestors 'none'` in the Content Security Policy. They live in `public/_headers` (Cloudflare Pages reads it; GitHub Pages ignores it, so use Cloudflare Pages for deploys). A test keeps its CSP in step with the page meta tag.
- The `?e2e=1` test hook is left out of production builds. `npm run check:dist` fails CI if the built bundle still holds it.
- Text-to-speech uses the browser's own voices. The game asks for a voice that stays on the device when one exists, but a browser may use a network voice. Only the game's fixed lines and question text are spoken, never a child's name or answers.
- Pin dependency versions. Commit the lockfile. Run `npm audit --omit=dev` in CI.

## Phase 4 relay
- Room codes: 6 symbols from 32 (animal picture plus letter or digit), 30 bits, from `crypto.randomInt`. Rude combinations are skipped. Expire after 2 hours idle. A room locks to two seats.
- Guessing is limited: 10 failed joins per address per 10 minutes and a server-wide cap. Addresses are held only in memory as a salted hash and dropped after 10 minutes. They are never logged. (Open decision for Andy: see docs/PHASE4_RELAY.md section 14.)
- Verify the `Origin` header on every WebSocket upgrade (`ALLOWED_ORIGINS`, required in production). Rate limit messages per connection and per room.
- The server validates every message with a strict schema (unknown fields and frames over 1 KB are rejected), validates every move, and owns turn order. The reload question and answer exist only on the server. The question goes to the player whose turn it is, without its answer. The other player never receives it.
- Every match-changing message has an idempotency key `{room}:{player}:{turn}:{seq}`. A repeat is a replay, never a second shot.
- Seat secrets are 256-bit random, kept as a SHA-256 hash in memory, compared in constant time, sent in a message body (never a URL), and never logged. A dropped seat is held for 60 seconds.
- No free text between players. Names are optional, 12 characters at most, and run through the same banned-word check as the single-player game.
- Logs: room code and event type only. A test checks it.
