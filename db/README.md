# db

`voice.sqlite` holds Chrono's five "How to Play" cards and 24 funny knock-down lines as audio (AAC in an MP4 container, `audio/mp4`), one row per clip in `voice_clips`. Nothing in the app reads it yet. The database is meant to be stood up with the accounts work (`docs/ACCOUNTS_PLAN.md`).

- Schema: `migrations/0001_voice_clips.sql`. Migrations are additive and numbered.
- Rebuild: `python scripts/build-voice-db.py <kokoro_model_dir> [voice]` (see the script header). The build is not deterministic byte for byte, so rebuild only when the text or voice changes.
- Captions come from the same `text` column. Every spoken line must keep its caption.
- Intro row ids match the files `src/data/introScript.ts` expects (`intro-01-welcome` and so on). The app expects `.mp3` paths today, so wiring this in means serving rows from the database or changing those paths. That is the next step, not done here.
- Voice: `am_michael`. Swap with the second argument and rebuild.
