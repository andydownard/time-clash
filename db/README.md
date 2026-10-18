# db

`voice.sqlite` holds Chrono's five "How to Play" cards and 24 funny knock-down lines as audio (AAC in an MP4 container, `audio/mp4`), one row per clip in `voice_clips`. The site is static, so the app does not read the database at run time. The five intro clips are extracted to static files (see below). The database is meant to be stood up with the accounts work (`docs/ACCOUNTS_PLAN.md`).

- Schema: `migrations/0001_voice_clips.sql`. Migrations are additive and numbered.
- Rebuild: `python scripts/build-voice-db.py <kokoro_model_dir> [voice]` (see the script header). The build is not deterministic byte for byte, so rebuild only when the text or voice changes.
- Captions come from the same `text` column. Every spoken line must keep its caption.
- Extract: `python3 scripts/extract-voice-clips.py` writes the intro clips (`id` starting with `intro-`) to `public/audio/voice/<id>.m4a`. It uses only the Python standard library and is safe to run again (files that already match are left alone). Run it after every rebuild of the database and commit the changed `.m4a` files.
- `src/data/introScript.ts` points at those files. Each card's `durationMs` is the clip's `duration_ms` rounded to the nearest 100 ms. `tests/data/introScript.test.ts` checks the files exist and the durations agree.
- Voice: `am_michael`. Swap with the second argument and rebuild.
