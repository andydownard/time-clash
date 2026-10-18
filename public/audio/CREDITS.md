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

The "How to Play" voice and the Hear it button use the browser's built-in speech synthesis until recordings exist. No voice files are shipped, and the game sends nothing anywhere. The game asks for an English voice that stays on the device when one exists. A browser may still pick a network voice, which is the browser's choice, not the game's. Captions show every line, with or without sound.

When recordings are added (see `docs/NARRATION.md`), list each file below with its speaker, source, and license.

| File | Speaker | Source | License |
|---|---|---|---|
| _none yet_ | | | |

## Voice clips (not shipped yet)

Spoken lines for Chrono's intro and the funny knock-down lines are stored in `db/voice.sqlite` (table `voice_clips`). They are not served by the site yet.

| Part | Source | License |
|---|---|---|
| All voice clips | Kokoro-82M text-to-speech model, voice `am_michael`, run by `scripts/build-voice-db.py` | Apache-2.0 (model); the generated audio is original to this project |

Why Kokoro: the first voice tried (Piper "ryan") was trained on RyanSpeech, licensed CC BY-NC-SA 4.0, which breaks the original-or-CC0 audio rule. It was dropped and none of its audio is in this repo.
