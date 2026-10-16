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

## Short replays (optional, build later)
- Reload tip (5 seconds, plays the first time the Reload modal opens): "Take your time. Fast answers earn bonus scrap, but any answer reloads."
- Turn tip (4 seconds, first pass screen): "Pass the screen. No peeking!"

## How to make the audio (free options, pick one)
1. **Best and simplest:** record it with a real voice. A family member reading it in a silly announcer voice is the best fit for a family game. Use the Voice Memos app, export as `.m4a`, then convert to `.mp3` and `.ogg`.
2. **Free offline text to speech:** run Piper (open source) on the Mac to render each card to `.wav`, then convert to `.mp3` and `.ogg`. Commit the files. No runtime cost.
3. **Fallback in code:** if an audio file fails to load, use the browser `speechSynthesis` API to read the caption text. This costs nothing and needs no files.

## File layout
```
public/audio/voice/intro-01-welcome.mp3   (+ .ogg)
public/audio/voice/intro-02-aim.mp3
public/audio/voice/intro-03-two-shots.mp3
public/audio/voice/intro-04-reload.mp3
public/audio/voice/intro-05-wipeouts.mp3
src/data/introScript.ts                    (card title, caption sentences, audio file, duration)
```
Splitting by card lets the visuals change exactly when each card starts, and lets Skip jump card by card.

## Captions data shape
```ts
type IntroCard = {
  id: string;            // "aim"
  title: string;         // "Aim"
  audio: string;         // "/audio/voice/intro-02-aim.mp3"
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
