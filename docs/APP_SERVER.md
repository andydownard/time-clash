# App server

One small Node process serves the whole site: the built game (`dist/`) and the spoken clips (`/v1/clips/:id`), on the SAME origin. It uses only `node:http`, `node:fs`, `node:path`, `node:zlib` and `node:sqlite`. No framework, no new dependency.

> **Status: live.** The cutover is done. Railway runs `npm start`, which runs this server, and `https://timeclash.rallytasks.com/health` reports the build SHA and the clip count (1,588 on 2026-10-23). The cutover and rollback steps below are kept for reference.

## Why one process

The owner chose clips on the game's own origin (`https://timeclash.rallytasks.com/v1/clips/<id>`), not a subdomain. Railway cannot send one path of a domain to a second service, so one process must answer both the site and the clips. Same origin means no CORS, and no change to the Content Security Policy: `media-src 'self'` and `connect-src 'self'` already cover it. The CSP names no outside origin at all, and a test keeps it that way.

## Files

| Path | What it is |
|---|---|
| `app-server/server.ts` | Start-up: reads env, opens the clip databases, listens, shuts down on SIGTERM. |
| `app-server/app.ts` | `createAppServer()`: headers, `/health`, `/v1/clips/*`, static files, and the one place a WebSocket route will go. |
| `app-server/static.ts` | Static files: types, cache headers, ETag, compression, Range, path safety, page fallback. |
| `app-server/headers.ts` | Reads `dist/_headers` (copied from `public/_headers`) so there is one source of truth for the security headers. |
| `voice-server/clips.ts`, `store.ts`, `range.ts`, `rateLimit.ts` | The clip route and its read-only SQLite store. |
| `tsconfig.server.json` | Compiles the two server folders to `dist-server/` with `tsc`. `npm run build` runs it. |

`npm start` runs the compiled `dist-server/app-server/server.js` with plain `node`. No `tsx` at run time, and no server code in the web bundle (`npm run check:dist` fails if any shows up in `dist/`).

## What it serves

- **Static files** from `dist/`. Hashed files under `/assets/` get `Cache-Control: public, max-age=31536000, immutable`. `index.html` gets `no-cache`. `/version.txt` gets `no-store`. Everything else gets `public, max-age=3600`.
- **ETag and Last-Modified** on every file, with `304` for `If-None-Match` and `If-Modified-Since`.
- **Compression**: brotli, else gzip, for text-like files over 1 KiB when `Accept-Encoding` allows it. Made on first request and kept in memory (32 MiB cap), with `Vary: Accept-Encoding` and a separate ETag per encoding. Images, fonts (woff2) and audio are sent as they are.
- **HEAD** everywhere GET works. **Range** (`206`, `416`) for plain files, because iPad Safari will not play audio without it.
- **Unknown routes**: the game is one page. A GET that asks for `text/html` (a browser navigation) to an unknown address gets `index.html` with `200`. Anything else gets `404`, and so does anything under `/assets/` or `/v1/`. Other methods get `405`. (The old Caddy host answered every unknown path with the page, even `/assets/missing.js`. Stricter is better for a missing script or clip.)
- **Path safety**: the path is decoded once, then refused with `400` if it holds `..` or `.` segments, a backslash, or a NUL byte (also `%00`, `%2e%2e`, `%5c`). The resolved path must stay inside `dist/`. Dot files, `_headers` and `_redirects` are `404`. A double-encoded `%252e` is just a file name that does not exist.
- **`GET /health`**: `{"ok":true,"build":"<sha or dev>","clips":<count>}`. `build` is the text of `dist/version.txt`, the same value `/version.txt` shows. It is `no-store` and never rate limited.
- **`GET /v1/clips/:id`**: see the contract below.
- **WebSocket upgrades** are refused with `404` for now. Phase 4 adds its relay in ONE place: pass `onUpgrade` to `createAppServer()` and branch on `req.url === '/ws'`.

## Security headers

Every response (200, 304, 400, 404, 405, 429, clips, `/health`) carries exactly the headers in the `/*` block of `public/_headers`: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. The server reads `dist/_headers` at start-up. If that file is missing, unreadable, or lacks one of those four, the server refuses to start with a clear message. A test compares the served headers with the file on many kinds of response.

Note for the cutover: the old Caddy host ignored `_headers`, so production sent only the CSP in the page's meta tag (no `frame-ancestors`, no Referrer-Policy, no Permissions-Policy). After the cutover those headers are real. Check the game in a browser once after the deploy.

## The clip contract

- A clip id is `t:` plus 16 lowercase hex characters. It is the FNV-1a 64-bit hash of the text after squeezing whitespace. The game and the content builder share `src/audio/clipId.ts`. Test vectors: `"I meant to do that!"` is `t:8b53121ff423c149`, `""` is `t:cbf29ce484222325`.
- Data: SQLite files `db/voice-*.sqlite`, each with the table `voice_clip_index` (`id`, `kind`, `text`, `text_sha256`, `mime`, `duration_ms`, `bytes`, `audio`, `voice`, `engine`, `created_at`). Audio is mono AAC in MP4 (`audio/mp4`). Opened read-only. If the folder cannot be read the server still starts, with zero clips, and the game uses the browser voice.
- `GET /v1/clips/:id` returns the bytes: `Content-Type: audio/mp4`, `Accept-Ranges: bytes`, `Content-Length`, `Cache-Control: public, max-age=31536000, immutable` (ids are content hashes). `206` with `Content-Range` for a Range request, `416` past the end.
- `404` unknown id. `400` for a bad id or any query string. `405` for methods other than GET and HEAD. `429` after 120 clip requests a minute from one IP (in memory; behind Railway's proxy the last `X-Forwarded-For` entry). The limit covers clips only, not the site.

The repo ships `db/voice-k4.sqlite`, `db/voice-5-8.sqlite` and `db/voice-9-12.sqlite`. They hold the wipeout lines only (the question clips were deleted on 2026-10-29, after the owner removed question read-aloud on 2026-10-23). `db/voice.sqlite` (the original five intro cards and knock-down lines) uses a different table and a name the store ignores, so it is not served.

## What it keeps and logs

Nothing about players. No cookies, no accounts. It logs one line per request: the method, the status class (`2xx`) and the time taken. Never an IP, an id, a path or a query string. Clip ids are hashes of the game's own fixed lines. Children's names never become spoken text, so they never reach the server.

## The game side

`VITE_VOICE=on` at build time turns clips on. It is set in `.env.production` (so `npm run build` has it) and `.env.e2e`. With it unset, as in `npm run dev` and any static host, the game never asks for a clip and behaves as it always did. `src/audio/clipPlayer.ts` builds the path `/v1/clips/<clipId(text)>`, with no host. `speak(line)` picks, in order: the line's own `audioSrc` file (the five intro cards), then the clip, then the browser voice. A clip that errors, returns 404 or has not started after 1.5 seconds hands over to the browser voice at once, and that line is not asked for again in the session.

## Run it here

```
npm run build              # makes dist/ and dist-server/
npm start                  # http://localhost:8080
npm run smoke:server       # starts the compiled server on a free port and checks it with fetch
```

For work on the game itself keep using `npm run dev` (no clips). To hear clips, use the built site through `npm start`.

## Environment

None of these are secrets.

| Name | Meaning |
|---|---|
| `PORT` | Port to listen on. Railway provides it. Default 8080. |
| `DIST_DIR` | The built site. Default `dist`. |
| `VOICE_DB_DIR` | Folder with the `voice-*.sqlite` files. Default `db`. |
| `VITE_VOICE` | Build time. `on` turns clips on in the game. |

Other behavior: request timeout 30 s, header timeout 10 s, keep-alive 65 s (longer than the proxy's idle time), SIGTERM closes the server and exits (forced after 10 s).

## Deploy on Railway (done)

The existing `time-clash` service, builder Railpack. `railway.json` pins the start command, the health check and the restart policy, so the cutover needs no dashboard edits. Railpack runs `npm run build` (this now also compiles the server), then `npm start`.

Cutover steps (already done once; use them again after a Railway change):

1. Merge the PR into `main`. Railway deploys after CI passes.
2. In the deploy logs look for `time-clash: N clips, port 8080`. The health check `GET /health` must pass before Railway switches traffic.
3. `curl https://timeclash.rallytasks.com/health` shows `"ok":true` and the new build SHA, and `/version.txt` shows the same SHA.
4. Open the game once, press Tap to Play, play through the How to Play cards. Check the browser console for blocked-by-CSP messages.

Rollback: revert the PR on `main`. Railway redeploys the static build (no `railway.json`, no `start` script). Faster: in Railway, redeploy the previous successful deployment.

Cost: one small Node process, a few MB of memory, no database server. Clips are cached by browsers for a year.
