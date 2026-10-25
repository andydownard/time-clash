# Intro Voice: "How to Play"

A narrator named **Chrono** (a goofy time-traveling announcer) explains the game before the first match. It plays after the player taps "Tap to Play" (browsers block sound until a tap). It runs about 40 seconds. It has captions, a Skip button, a Replay button, and a Mute button. The same lesson is reachable later from the "?" button.

## Rules
- Start the voice only after a user tap.
- Skip works at any moment. Skip is remembered in localStorage (`timeclash.introSeen = true`). The intro plays by default on first visit and is one tap away afterward.
- Every line has a caption. Captions follow the audio timing.
- Keep the voice calm, warm, and funny. Never loud. Normalize all audio to the same volume.
- Words are short enough for a 2nd grader to follow.

## Script (5 cards)

**Card 1: Welcome (about 7 seconds)**
> Welcome to Time Clash! A Past castle fights a secret Future base. Let's learn how to win!

Caption cue text: "Welcome to Time Clash!"

**Card 2: Aim (about 8 seconds)**
> Aim your launcher with the angle and power sliders. Watch the wind. It pushes your shot sideways, the rascal!

Card title: "Aim"

**Card 3: Shoot twice (about 6 seconds)**
> You get two shots each turn. Hit the other base to lower its health. Empty the bar and you win!

Card title: "Two Shots"

**Card 4: Reload (about 11 seconds)**
> After shot two, answer a question to reload. Answer fast to earn bonus scrap. Mistake? Even Chrono trips. You still reload! Get it right for a Power Shot!

Card title: "Reload"

**Card 5: Wipeouts and passing the screen (about 10 seconds)**
> A blast can bump you. Then you do a silly wipeout! You just lose a little dignity! Pass the screen between turns. No peeking! Let's clash across time!

Card title: "Wipeouts and Turns"

**Total:** about 40 seconds (the five recorded clips add up to 42.2 s). Card 4 has 4 captions. Jokes: the wind rascal, Chrono tripping, and the lost dignity.

## Squads: the 2-goes wording (re-record needed)
Squads is on, so a turn is 2 goes, not 2 shots. The recorded clips for cards 3 and 4 still say "two shots" and "After shot two". The words below replace them when the clips are re-recorded with the same Kokoro settings. Until then the cards play the old clips with matching captions, so voice and captions never disagree.
- Card 3, "Two Goes": "You get two goes each turn. Fire your launcher, or send your helper walking. Hit the other base to lower its health. Empty the bar and you win!"
- Card 4, first sentence: "After go two, answer a question to reload." The rest of the card stays.

## Squads lines (built)
Every line is said by the device voice only after a tap (`noClip`, no network request), and shows the same words as a caption. No line holds a child's name or any question text.
- First go of a match, per side: "Press Fire! Or pick a helper and tap Walk out!" (`SQUAD_COPY.firstGo`).
- Hear it: "Cannon Crew fires a ball. Press Fire!" or "Sir Bonk walks to the other side and bonks every turn. Tap Walk out!" (`SQUAD_COPY.hearLine`, with each side's helper names).
- Captions only (not spoken): "Sir Bonk walks out. He bonks every turn!", "Sir Bonk walks home.", "Sir Bonk: Bonk! The base wobbles.", "Sir Bonk: Bonk! Bonk!", "Bop! Sir Bonk loses a heart.", "Sir Bonk wobbles.", and "Sir Bonk tumbles and walks home dizzy." followed by a funny line from the wipeout bag. That funny line is spoken like any wipeout line when the voice service is set up.

## Pass screen line (built)
Each time the pass screen (the cover between turns) opens, Chrono says its own words: "Pass the screen! No peeking at their question!" (`src/ui/passScreen.ts`, built from `PASS_SCREEN.heading` and `PASS_SCREEN.noPeeking`).
- It goes through the AudioManager, so it is silent before the first tap, while muted, and in a browser driven by a test tool. The caption shows in every case, above the cover, unless captions are off in Settings.
- "I'm ready!" is its Skip: it stops the line and clears the caption. The cover's Sound button hushes it mid-line.
- The line is fixed text. It never holds the child's name or any question text.
- It never asks the voice service for a clip (`noClip` on the line), so the cover makes no network request. The device voice reads it. No question text is ever spoken, so the question card makes no clip request either (`e2e/voice-clips.spec.ts`).
- A match against the computer has no pass screen, so it has no pass line.

## Short replays (optional, build later)
- Reload tip (5 seconds, plays the first time the Reload modal opens): "Take your time. Fast answers earn bonus scrap, but any answer reloads."

## How the audio is made
The clips are generated with the Kokoro text-to-speech model (voice `am_michael`) and stored in `db/voice.sqlite` (see `db/README.md` and `public/audio/CREDITS.md`). The site is static, so `python3 scripts/extract-voice-clips.py` copies the five intro clips into `public/audio/voice/` as `.m4a` files (AAC in an MP4 container). Chromium, WebKit and iPad Safari all play that format. A real family recording can replace any clip later: rebuild the database, run the extract script, and commit the files.

To change only the intro words without touching the 24 wipeout clips, update the five `UPDATE voice_clips` rows (text, audio, duration_ms, bytes, sha256) with the same Kokoro settings (`am_michael`, speed 0.95, `en-us`, 64 kbps AAC), then run the extract script. Keep each card header as `**Card N: Title (about X seconds)**` followed by one `> ` line, because `build-voice-db.py` reads that shape. The app server does not serve intro clips: they ship as static files, so no hash or manifest changes.

If an audio file fails to load, the game falls back to the browser `speechSynthesis` API and still shows captions.

## File layout
```
public/audio/voice/intro-01-welcome.m4a
public/audio/voice/intro-02-aim.m4a
public/audio/voice/intro-03-shoot-twice.m4a
public/audio/voice/intro-04-reload.m4a
public/audio/voice/intro-05-wipeouts-and-passing-the-screen.m4a
src/data/introScript.ts                    (card title, caption sentences, audio file, duration)
```
`durationMs` in `introScript.ts` is the real clip length, rounded to 100 ms. A test reads each file's MP4 header and fails if the two drift apart by more than 300 ms.
Caption start times come from measured pauses in the real clips. `python3 scripts/measure-intro-timings.py` decodes each clip (macOS `afconvert`, no new dependencies) and writes the clip length and its quiet gaps to `src/data/introTimings.json`. `timeCaptions` takes the longest (sentences minus one) gaps as the sentence breaks and starts each caption 100 ms before the voice resumes. If a card has too few gaps, it falls back to the sentence-length estimate. Limits: the gaps are found from silence, not from the words, so a sentence that runs into the next with no pause is not detected, and a long mid-sentence pause could be picked by mistake. Real per-word timing needs Kokoro's own timing output, which needs a re-run of Kokoro (not done). Re-run the script only if a clip changes. `--check` fails if the file is stale. Tests in `tests/data/introScript.test.ts` keep every caption inside its clip, within 300 ms of the header length, and within 1500 ms of the old length-based estimate.
Splitting by card lets the visuals change exactly when each card starts, and lets Skip jump card by card.

## Captions data shape
```ts
type IntroCard = {
  id: string;            // "aim"
  title: string;         // "Aim"
  audio: string;         // "/audio/voice/intro-02-aim.m4a"
  fallbackText: string;  // full text for speechSynthesis
  captions: { text: string; startMs: number }[];
  art: string;           // illustration id from the design
};
```

## Tests
- Intro does not call `play()` before the first tap.
- Skip stops audio and shows the next screen.
- Replay restarts at card 1.
- Missing audio file falls back to speechSynthesis and still shows captions.
- Reduced-motion setting removes card slide animations.
