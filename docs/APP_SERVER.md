# Voice service

A tiny read-only web service that hands out short spoken clips (Chrono's lines) by id. The game asks it for the exact text it wants to say. If the service is off, slow or missing the clip, the game uses the browser voice, as it always did.

## The contract

- A clip id is `t:` plus 16 lowercase hex characters. It is the FNV-1a 64-bit hash of the text after squeezing whitespace. The game and the content builder share `src/audio/clipId.ts`. Test vectors: `"I meant to do that!"` is `t:8b53121ff423c149`, `""` is `t:cbf29ce484222325`.
- Data: SQLite files `db/voice-*.sqlite`, each with the table `voice_clip_index` (`id`, `kind`, `text`, `text_sha256`, `mime`, `duration_ms`, `bytes`, `audio`, `voice`, `engine`, `created_at`). Audio is mono AAC in MP4 (`audio/mp4`).
- `GET /v1/clips/:id` returns the bytes. `Content-Type: audio/mp4`, `Accept-Ranges: bytes`, `Content-Length`, and `Cache-Control: public, max-age=31536000, immutable` (ids are content hashes). Full Range support: `206` with `Content-Range`, `416` for a range past the end. iPad Safari will not play media without `206`.
- `404` for an unknown id. `400` for an id that does not match `^t:[0-9a-f]{16}$`, or any query string. `405` for methods other than GET and HEAD. `HEAD` works.
- `GET /health` returns `{"ok":true,"clips":<count>,"build":"<sha or dev>"}`.
- Every other path is `404`. There is no listing and nothing writes.

## What it keeps and logs

Nothing about players. There are no cookies, no accounts and no query strings. It logs only the method, the status class (`2xx`) and the time taken. It never logs an IP, an id or any text. The per-IP rate limit (120 requests a minute, then `429`) lives in memory only. Behind Railway's proxy it uses the last `X-Forwarded-For` entry, which the proxy adds itself.

Clip ids are hashes of the game's own fixed lines (questions and funny lines). Children's names are never part of any spoken text, so they never reach this service.

## Run it here

```
npm run voice:start        # reads db/voice-*.sqlite, listens on $PORT (default 8080)
curl localhost:8080/health
```

Tests build a small fixture database in a temp folder. No real clip files are needed. To try the game against it: build or run the game with `VITE_VOICE_URL=http://localhost:8080`.

## Environment

| Name | Where | Meaning |
|---|---|---|
| `PORT` | voice service | Port to listen on. Railway sets it. |
| `VOICE_DB_DIR` | voice service | Folder with the `voice-*.sqlite` files. Default `db`. Opened read-only. |
| `ALLOWED_ORIGIN` | voice service | The one site allowed to use the audio (CORS). Default `https://timeclash.rallytasks.com`. |
| `VITE_VOICE_URL` | game build | Address of the service. Empty or unset turns the whole feature OFF. |

None of these are secrets.

## Deploy as a second Railway service

Same repo, same Railway project as the game. Nothing here is deployed by this change.

1. In the project, add a service from this GitHub repo.
2. Start command: `npm run voice:start`. Health check path: `/health`.
3. Set `ALLOWED_ORIGIN` to the game's origin. Railway provides `PORT`.
4. Add the custom domain. The planned name is `https://voice.timeclash.rallytasks.com`.
5. In the game's build settings set `VITE_VOICE_URL` to that same address, then rebuild the game.
6. Check `GET /health` shows the new build and a clip count above zero.

The service reads the database files that are committed in the repo (`db/voice-*.sqlite`), so it needs no volume and no database server. Adding clips means committing a new file and redeploying.

The start command uses `tsx` (a dev dependency). The Railway build must keep dev dependencies installed, or `tsx` must move to `dependencies`. Node must be 22.13 or newer (`node:sqlite` runs without a flag from there).

### Keep the origin in sync

`public/_headers` and the CSP meta tag in `index.html` allow media and connections to `https://voice.timeclash.rallytasks.com`, the planned domain. If the real address is different, change those two places and `VITE_VOICE_URL` together. `tests/hardening.test.ts` pins the pair.

## How the game uses it

`src/audio/clipPlayer.ts` builds `${VITE_VOICE_URL}/v1/clips/${clipId(text)}`. `speak(line)` picks, in order: the line's own `audioSrc` file (the five intro cards), then the clip, then the browser voice. The clip plays through the normal audio manager, so Mute, volume, Skip, one voice at a time and captions all still work. A clip that errors, returns 404 or has not started after 1.5 seconds hands over to the browser voice at once, and that line is not asked for again in the session. Once the browser reports the clip length, captions follow it. Funny knock-down lines are also spoken when the service is on.

## Cost

One small Node process with a few megabytes of memory and no database server. Audio is cached for a year by the browser, so each device fetches a clip once. Expect a few dollars a month or less on Railway.
