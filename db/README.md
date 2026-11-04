# db

`voice.sqlite` holds Chrono's five "How to Play" cards and 24 funny knock-down lines as audio (AAC in an MP4 container, `audio/mp4`), one row per clip in `voice_clips`. The app server does not read this database (it ignores the name `voice.sqlite`). The five intro clips are extracted to static files (see below).

- Schema: `migrations/0001_voice_clips.sql`. Migrations are additive and numbered.
- Rebuild: `python scripts/build-voice-db.py <kokoro_model_dir> [voice]` (see the script header). It is resumable: it records only rows whose text or voice changed (or are new) and keeps the rest, so unchanged clips stay byte for byte the same. It deletes nothing. Intro clips are 64 kbps AAC.
- Captions come from the same `text` column. Every spoken line must keep its caption.
- Extract: `python3 scripts/extract-voice-clips.py` writes the intro clips (`id` starting with `intro-`) to `public/audio/voice/<id>.m4a`. It uses only the Python standard library and is safe to run again (files that already match are left alone). Run it after every rebuild of the database and commit the changed `.m4a` files.
- `src/data/introScript.ts` points at those files. Each card's `durationMs` is the clip's `duration_ms` rounded to the nearest 100 ms. `tests/data/introScript.test.ts` checks the files exist and the durations agree.
- Voice: `am_michael`. Swap with the second argument and rebuild.

## Wipeout clips by text hash (`voice-k4.sqlite`, later volumes)

`voice-k4.sqlite` holds a spoken clip for every wipeout line. The game no longer speaks question text (owner, 2026-10-23), so the question clips were deleted on 2026-10-29 (rows only; the table and its schema are unchanged) and the manifest (`scripts/voice-manifest.ts`) lists wipeout lines only. It uses only the table `voice_clip_index` (`migrations/0002_voice_clip_text_ids.sql`). The older `voice.sqlite` and its five intro files are untouched. Like `voice.sqlite`, the site does not read it yet. A server and a game-side player will.

**The contract.**
- `id` is `t:` plus 16 lowercase hex digits: FNV-1a 64-bit of the UTF-8 bytes of the text after collapsing whitespace (`text.split(/\s+/).filter(Boolean).join(' ')`). Offset basis `0xcbf29ce484222325`, prime `0x100000001b3`, modulo 2^64. TypeScript: `src/audio/clipId.ts`. Python: `clip_id()` in `scripts/build-voice-index.py`. Both check the same four test vectors (`"" -> t:cbf29ce484222325`).
- `text` is exactly what the game passes to `speak()` (a line from `tumblePool()`; `spokenText()` and `src/questions/spoken.ts` were removed). The id hashes that original text, and it is also the caption.
- The voice does not read that text raw. `toSpoken()` (`src/audio/toSpoken.ts`) rewrites symbols for the ear: `x` becomes "times", `+` "plus", `-` between numbers "minus", `=` "equals", `%` "percent", `^` "to the power of", `___` "blank", and so on. `text_sha256` is the sha256 of that spoken form, so changing `toSpoken` rebuilds the affected clips.
- Audio: mono AAC in MP4, 48 kbps, mime `audio/mp4`. Voice: Kokoro `am_michael`, speed 0.95, `en-us`. `kind` is `bark` for every row today (the schema also allows `intro`, `question` and `passage`, which stay unused).

**Manifest.** `npx tsx scripts/voice-manifest.ts --grades 0-4` prints `[{id, kind, text, spoken}]`. It fails if two different texts share an id. Wipeout lines are the shared tumble lines plus both teams' own lines: 42 today, all recorded in all three volumes (the 15 newest on 2026-10-25), plus the 24 base fall lines (`baseFallPool`, 12 a team) recorded on 2026-10-25, so the manifest holds 66 lines (the check prints `66/66`). `tests/audio/baseFallVoice.test.ts` fails while any base fall line has no clip in any volume. Each volume also keeps 3 older wipeout rows no longer used (near twins that were dropped). The three volumes now hold the same 69 wipeout rows (the `question` kind stays allowed by the schema but no row uses it, and `tests/audio/noQuestionClips.test.ts` fails if one comes back). A line with no clip gets a 404 from the app server, and the game falls back to the browser voice with the caption. `tests/audio/tumbleVoice.test.ts` fails while any wipeout line has no clip in `voice-k4.sqlite`.

**Rebuild** (Python venv with `kokoro-onnx` and `soundfile`, Kokoro v1.0 model files, macOS `afconvert`):

    python scripts/build-voice-index.py <model_dir> --grades 0-4 --out db/voice-k4.sqlite
    python scripts/check-voice-index.py db/voice-k4.sqlite --grades 0-4

The build is resumable: it keeps rows whose spoken text is unchanged and rebuilds the rest (3 worker processes by default). The check confirms every manifest id has audio, 0.5 s to 40 s long, and prints totals. Defaults are 0.5 s to 40 s, which fits the wipeout lines. The build stops if the file passes 80 MB (GitHub rejects 100 MB); delete it and rerun with `--bitrate 32000`.

**Phases.** Phase 1 is grades K to 4 (`db/voice-k4.sqlite`, wipeout lines included). Phase 2 added two more volumes: `--grades 5-8 --out db/voice-5-8.sqlite` and `--grades 9-12 --out db/voice-9-12.sqlite`. Since the question clips went, each volume repeats the same wipeout lines (same text, same id) and the app server uses the first copy it finds. `--grades` also takes one grade (`7`) or `all`.

## Record only what is missing (run again after anyone adds a line)

Tools used on 2026-10-25 (build time only, kept outside the repo, nothing ships): Python 3.14, `kokoro-onnx==0.4.7` (MIT), `onnxruntime==1.31.0`, `soundfile==0.14.0`, macOS `afconvert`, and the Kokoro v1.0 model files from the kokoro-onnx GitHub release `model-files-v1.0` (Kokoro-82M, Apache-2.0):

    python3 -m venv ~/kokoro-venv
    ~/kokoro-venv/bin/pip install kokoro-onnx==0.4.7 soundfile==0.14.0
    mkdir -p ~/kokoro-model
    curl -fL -o ~/kokoro-model/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -fL -o ~/kokoro-model/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

espeak-ng (inside `espeakng_loader`) fails with "Error processing file .../phontab" when its data folder sits on a long path. Copy that folder to a short path and point `ESPEAK_DATA_PATH` at it (both build scripts read it):

    cp -R ~/kokoro-venv/lib/python3.*/site-packages/espeakng_loader/espeak-ng-data ~/esd
    export ESPEAK_DATA_PATH=~/esd

Then, from the repo root:

    ~/kokoro-venv/bin/python scripts/build-voice-index.py ~/kokoro-model --grades 0-4 --out db/voice-k4.sqlite
    ~/kokoro-venv/bin/python scripts/build-voice-index.py ~/kokoro-model --grades 5-8 --out db/voice-5-8.sqlite
    ~/kokoro-venv/bin/python scripts/build-voice-index.py ~/kokoro-model --grades 9-12 --out db/voice-9-12.sqlite
    python3 scripts/check-voice-index.py db/voice-k4.sqlite --grades 0-4

Each build prints how many clips it kept and how many it recorded; only lines with no clip (or new spoken words) are recorded. For an intro card, edit `docs/NARRATION.md` and `src/data/introScript.ts`, then:

    ~/kokoro-venv/bin/python scripts/build-voice-db.py ~/kokoro-model
    python3 scripts/extract-voice-clips.py
    python3 scripts/measure-intro-timings.py

and set each changed card's `durationMs` (and `DB_DURATIONS_MS` in `tests/data/introScript.test.ts`) from the printed lengths. Sizes after the question clips were deleted (2026-10-29): `voice.sqlite` 0.9 MB, `voice-k4.sqlite` 1.3 MB, `voice-5-8.sqlite` 1.3 MB, `voice-9-12.sqlite` 1.3 MB (before: 43.7, 65.3 and 26.1 MB; GitHub rejects files over 100 MB).
