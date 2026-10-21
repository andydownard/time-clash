# Intro Voice: "How to Play"

A narrator named **Chrono** (a goofy time-traveling announcer) explains the game before the first match. It plays after the player taps "Tap to Play" (browsers block sound until a tap). It runs about 60 seconds. It has captions, a Skip button, a Replay button, and a Mute button. The same lesson is reachable later from the "?" button.

## Rules
- Start the voice only after a user tap.
- Skip works at any moment. Skip is remembered in localStorage (`timeclash.introSeen = true`). The intro plays by default on first visit and is one tap away afterward.
- Every line has a caption. Captions follow the audio timing.
- Keep the voice calm, warm, and funny. Never loud. Normalize all audio to the same volume.
- Words are short enough for a 2nd grader to follow.

## Script (5 cards)

**Card 1: Welcome (about 10 seconds)**
> Welcome to Time Clash! One of you commands a castle from the Past. The other commands a secret base from the Future. Let's learn how to win!

Caption cue text: "Welcome to Time Clash!"

**Card 2: Aim (about 12 seconds)**
> On your turn, aim your launcher. Turn the angle dial to point up or down. Slide the power meter to shoot far or near. Watch the wind. It pushes your shot sideways!

Card title: "Aim"

**Card 3: Shoot twice (about 10 seconds)**
> You get two shots each turn. Hit the other base to lower its health. Each base starts with one hundred health. Empty the bar to win!

Card title: "Two Shots"

**Card 4: Reload (about 15 seconds)**
> After shot two, you reload your launcher. Answer a question to reload it. Reading players find the right word. Math players solve the problem. Answer fast to earn bonus scrap. Don't worry about mistakes. You always get to reload.

Card title: "Reload"

**Card 5: Wipeouts and passing the screen (about 13 seconds)**
> A blast can bump you. Then you do a silly wipeout! Nobody gets hurt. You just lose a little dignity! Between turns, pass the screen. No peeking at their question. Ready? Let's clash across time!

Card title: "Wipeouts and Turns"

**Total:** about 60 seconds.

## Pass screen line (built)
Each time the pass screen (the cover between turns) opens, Chrono says its own words: "Pass the screen! No peeking at their question!" (`src/ui/passScreen.ts`, built from `PASS_SCREEN.heading` and `PASS_SCREEN.noPeeking`).
- It goes through the AudioManager, so it is silent before the first tap, while muted, and in a browser driven by a test tool. The caption shows in every case, above the cover, unless captions are off in Settings.
- "I'm ready!" is its Skip: it stops the line and clears the caption. The cover's Sound button hushes it mid-line.
- The line is fixed text. It never holds the child's name (names never leave the device, even as a clip request) or any question text.
- A match against the computer has no pass screen, so it has no pass line.

## Short replays (optional, build later)
- Reload tip (5 seconds, plays the first time the Reload modal opens): "Take your time. Fast answers earn bonus scrap, but any answer reloads."

## How the audio is made
The clips are generated with the Kokoro text-to-speech model (voice `am_michael`) and stored in `db/voice.sqlite` (see `db/README.md` and `public/audio/CREDITS.md`). The site is static, so `python3 scripts/extract-voice-clips.py` copies the five intro clips into `public/audio/voice/` as `.m4a` files (AAC in an MP4 container). Chromium, WebKit and iPad Safari all play that format. A real family recording can replace any clip later: rebuild the database, run the extract script, and commit the files.

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
