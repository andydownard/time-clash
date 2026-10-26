# Audio credits

Every sound in Time Clash is original or CC0. Nothing here needs a license from anyone else.

## Sound effects

All nine effects are made in code with the browser's WebAudio. There are no sound files to download or license. The code is in `src/audio/sfx.ts`.

| Effect | What it sounds like | Source | License |
|---|---|---|---|
| launch | slide whistle going up (kept for other uses) | synthesized in code | original |
| cannonBoom | Team Past fires: a tiny wooden creak, a low pitched-down thump and a fast-fading rumble | synthesized in code | original |
| laserPew | Team Future fires: three quick falling zaps | synthesized in code | original |
| boing | springy wobble | synthesized in code | original |
| horn | two-note cartoon horn | synthesized in code | original |
| clunk | low, short reload thunk | synthesized in code | original |
| thud | soft toy-like landing | synthesized in code | original |
| click | tiny button tick | synthesized in code | original |
| cheer | four happy rising notes | synthesized in code | original |
| bonk | a dasher's hollow foam knock | synthesized in code | original |
| step | a dasher's soft pitter-patter steps | synthesized in code | original |
| squawk | a shell bumps a bird: two quick chirps that fall in pitch | synthesized in code | original |
| whoosh | the turn's gust: a soft rush of air that sweeps up, over a low hum | synthesized in code | original |

## Music

One original looping track, about 130 BPM, in two flavors. Nothing is sampled. No melody, rhythm or chord pattern was copied from any existing song. The energy of a bouncy oom-pah party tune is the only nod. It is not a death theme.

The notes and tempo are plain data in `src/audio/musicData.ts`. `src/audio/music.ts` plays them with WebAudio and a small scheduler.

| Part | What it sounds like | Source | License |
|---|---|---|---|
| Team Past flavor | tuba-like oom-pah bass, short chord stabs, marching snare, soft kick | synthesized in code | original |
| Team Future flavor | synth arpeggio, wobbly bass, steady kick | synthesized in code | original |
| Shared | squeaky lead tune, off-beat claps | synthesized in code | original |

The music starts only after the first tap, is quiet by default, ducks under spoken lines, follows Mute and the saved volume, and has its own Music on/off button in Settings.

## Voice

The "How to Play" voice plays the five recorded files below. If a file fails to load, the intro falls back to the browser's built-in speech synthesis. The game sends nothing anywhere. The game asks for an English voice that stays on the device when one exists. A browser may still pick a network voice, which is the browser's choice, not the game's. Captions show every line, with or without sound.

| File | Speaker | Source | License |
|---|---|---|---|
| `voice/intro-01-welcome.m4a` | Chrono (synthetic) | Kokoro-82M, voice `am_michael` | Original to this project |
| `voice/intro-02-aim.m4a` | Chrono (synthetic) | Kokoro-82M, voice `am_michael` | Original to this project |
| `voice/intro-03-shoot-twice.m4a` | Chrono (synthetic) | Kokoro-82M, voice `am_michael` | Original to this project |
| `voice/intro-04-reload.m4a` | Chrono (synthetic) | Kokoro-82M, voice `am_michael` | Original to this project |
| `voice/intro-05-wipeouts-and-passing-the-screen.m4a` | Chrono (synthetic) | Kokoro-82M, voice `am_michael` | Original to this project |

## Voice clips (database)

Spoken lines for Chrono's intro and the funny knock-down lines are stored in `db/voice.sqlite` (table `voice_clips`). The five intro clips ship as static files, extracted by `scripts/extract-voice-clips.py`. The app server does not read this database. The knock-down lines are also in the `voice-*.sqlite` files below, which the app server does serve.

| Part | Source | License |
|---|---|---|
| All voice clips | Kokoro-82M text-to-speech model, voice `am_michael`, run by `scripts/build-voice-db.py` | Apache-2.0 (model); the generated audio is original to this project |
| Wipeout clips, and question clips that are no longer used (`db/voice-k4.sqlite`, `db/voice-5-8.sqlite` and `db/voice-9-12.sqlite`, table `voice_clip_index`) | Same Kokoro-82M model and voice, run by `scripts/build-voice-index.py` | Apache-2.0 (model); the generated audio is original to this project |

Recording runs: the first clips were made on 2026-10-18 and 2026-10-21. On 2026-10-25 intro cards 3, 4 and 5 were re-recorded (new words) and the 15 newer wipeout lines were added to all three `voice-*.sqlite` files. That run used `kokoro-onnx` 0.4.7 (MIT) with `onnxruntime` 1.31.0 (MIT) and `soundfile` 0.14.0 (BSD-3-Clause), and the Kokoro v1.0 model files `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx GitHub release `model-files-v1.0` (Kokoro-82M weights and voices, Apache-2.0). These are build-time tools only. None of them ships in the game.

Why Kokoro: the first voice tried (Piper "ryan") was trained on RyanSpeech, licensed CC BY-NC-SA 4.0, which breaks the original-or-CC0 audio rule. It was dropped and none of its audio is in this repo.
