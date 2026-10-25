# SECURITY and Child Safety

Players are children. Assume the strictest rules for kids' privacy (COPPA in the US, similar elsewhere).

## Data
- No accounts, no sign-in, no email, no phone numbers.
- Names are first names a family types in. They stay in the browser (`localStorage`). They are never sent to a server, logged, or put in a URL.
- No analytics, no ad networks, no third-party scripts, no cookies, no fonts or images loaded from other sites (self-host everything).
- A "Clear my data" link in Settings (and on Setup) wipes all `timeclash.*` keys after a "Yes, clear it" confirm.

## Content
- No gore, blood, or realistic harm. No scary imagery.
- No user-generated text shown to other players beyond the typed first name. Names pass a simple blocked-word check.
- No chat. Phase 4 has no free-text messages between players.

## Secrets
- Phases 1 to 3 need no secrets. Phase 4 relay secrets (if any) live in env vars, never in git. `.env` is git-ignored and `.env.example` lists keys.

## Web hardening
- Set a strict Content Security Policy that allows only same-origin scripts, styles, images, audio, and (Phase 4) the relay's WebSocket host.
- Send `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` that turns off camera, microphone and location, and `frame-ancestors 'none'` in the Content Security Policy. They live in `public/_headers`. The app server (`app-server/`) reads that file at start-up and sends exactly those headers on every response, and refuses to boot without them. Tests compare the served headers with the file and keep the CSP in step with the page meta tag. The CSP names no outside origin.
- The `?e2e=1` test hook is left out of production builds. `npm run check:dist` fails CI if the built bundle still holds it.
- Text-to-speech uses the browser's own voices. The game asks for a voice that stays on the device when one exists, but a browser may use a network voice. Only the game's fixed lines and question text are spoken, never a child's name or answers.
- Spoken clips (see docs/APP_SERVER.md): in a build made with `VITE_VOICE=on` the game asks its own origin for audio. The one request is a GET for `/v1/clips/<hash of the line's text>`. The hash covers fixed game lines and question text, never a child's name, and the request carries no cookies, no query string and no identifier. The route is read-only, opens its databases read-only with parameterized SQL, rate limits per IP (in memory), needs no CORS because it is same origin, and the server logs only method, status class and duration (no IP, id, path or text). A failed or slow clip falls back to the browser voice. Static file paths are decoded once and must stay inside `dist/` (`..`, backslash and NUL are refused; dot files and `_headers` are never served).
- Pin dependency versions. Commit the lockfile. Run `npm audit --omit=dev` in CI.

## Phase 4 relay
- Room codes: 4 uppercase letters, no vowels. Random. Expire after 2 hours idle.
- Verify the `Origin` header. Rate limit connections and messages per client.
- The server validates every move and owns turn order. The server checks reload answers, so one player cannot see the other's answer.
- Logs: room code and event type only.
