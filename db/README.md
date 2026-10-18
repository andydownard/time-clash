# db

`voice.sqlite` holds Chrono's five "How to Play" cards and 24 funny knock-down lines as audio (AAC in an MP4 container, `audio/mp4`), one row per clip in `voice_clips`. The site is static, so the app does not read the database at run time. The five intro clips are extracted to static files (see below). The database is meant to be stood up with the accounts work (`docs/ACCOUNTS_PLAN.md`).

- Schema: `migrations/0001_voice_clips.sql`. Migrations are additive and numbered.
- Rebuild: `python scripts/build-voice-db.py <kokoro_model_dir> [voice]` (see the script header). The build is not deterministic byte for byte, so rebuild only when the text or voice changes.
- Captions come from the same `text` column. Every spoken line must keep its caption.
- Extract: `python3 scripts/extract-voice-clips.py` writes the intro clips (`id` starting with `intro-`) to `public/audio/voice/<id>.m4a`. It uses only the Python standard library and is safe to run again (files that already match are left alone). Run it after every rebuild of the database and commit the changed `.m4a` files.
- `src/data/introScript.ts` points at those files. Each card's `durationMs` is the clip's `duration_ms` rounded to the nearest 100 ms. `tests/data/introScript.test.ts` checks the files exist and the durations agree.
- Voice: `am_michael`. Swap with the second argument and rebuild.

## Question and wipeout clips by text hash (`voice-k4.sqlite`, later volumes)

`voice-k4.sqlite` holds a spoken clip for every reload question in grades K to 4 (math and reading) and every wipeout line. It uses only the table `voice_clip_index` (`migrations/0002_voice_clip_text_ids.sql`). The older `voice.sqlite` and its five intro files are untouched. Like `voice.sqlite`, the site does not read it yet. A server and a game-side player will.

**The contract.**
- `id` is `t:` plus 16 lowercase hex digits: FNV-1a 64-bit of the UTF-8 bytes of the text after collapsing whitespace (`text.split(/\s+/).filter(Boolean).join(' ')`). Offset basis `0xcbf29ce484222325`, prime `0x100000001b3`, modulo 2^64. TypeScript: `src/audio/clipId.ts`. Python: `clip_id()` in `scripts/build-voice-index.py`. Both check the same four test vectors (`"" -> t:cbf29ce484222325`).
- `text` is exactly what the game passes to `speak()` (from `spokenText()` in `src/questions/spoken.ts`, or a line from `tumblePool()`). The id hashes that original text, and it is also the caption.
- The voice does not read that text raw. `toSpoken()` (`src/audio/toSpoken.ts`) rewrites symbols for the ear: `x` becomes "times", `+` "plus", `-` between numbers "minus", `=` "equals", `%` "percent", `^` "to the power of", `___` "blank", and so on. `text_sha256` is the sha256 of that spoken form, so changing `toSpoken` rebuilds the affected clips.
- Audio: mono AAC in MP4, 48 kbps, mime `audio/mp4`. Voice: Kokoro `am_michael`, speed 0.95, `en-us`. `kind` is `bark`, `question`, `passage` or `intro` (reading passages are spoken inside the question, so there are no `passage` rows today).

**Manifest.** `npx tsx scripts/voice-manifest.ts --grades 0-4` prints `[{id, kind, text, spoken}]`. It fails if two different texts share an id. Wipeout lines are the shared tumble lines plus both teams' own lines.

**Rebuild** (Python venv with `kokoro-onnx` and `soundfile`, Kokoro v1.0 model files, macOS `afconvert`):

    python scripts/build-voice-index.py <model_dir> --grades 0-4 --out db/voice-k4.sqlite
    python scripts/check-voice-index.py db/voice-k4.sqlite --grades 0-4

The build is resumable: it keeps rows whose spoken text is unchanged and rebuilds the rest (3 worker processes by default). The check confirms every manifest id has audio, 0.5 s to 40 s long, and prints totals. The build stops if the file passes 80 MB (GitHub rejects 100 MB); delete it and rerun with `--bitrate 32000`.

**Phases.** Phase 1 is grades K to 4 (`db/voice-k4.sqlite`, wipeout lines included). Phase 2 is `--grades 5-12 --out db/voice-5-12.sqlite`. `--grades` also takes one grade (`7`) or `all`.
