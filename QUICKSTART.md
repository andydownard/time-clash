# QUICKSTART

Goal: a fresh Claude Code session goes from an empty folder to the game running on `localhost:5173` in under ten minutes. Phase 1 is built, so the game already runs.

## 1. Prerequisites
- Node 22.12 or newer (`node -v`). `package.json` sets this as the minimum.
- Git
- A modern browser (Chrome, Safari, or Edge)

## 2. First-time setup
Run `npm ci` in the project folder to install the locked dependencies. The setup steps for building from scratch are in [docs/BUILD.md](./docs/BUILD.md).

## 3. Everyday commands
```bash
npm run dev          # start the game at http://localhost:5173
npm test             # unit tests (silent: no sound or speech starts)
npm run lint
npm run typecheck
npm run build        # builds to dist/
npm run check:dist   # fails if the build still holds the e2e test hook
npm run e2e          # browser tests (Chromium and WebKit)
npm run check:questions
```

## 4. Start a Claude Code session
Open Claude Code in this folder. Read [AGENTS.md](./AGENTS.md) first. For the next phase, use the "Start prompt" in [docs/BUILD.md](./docs/BUILD.md).

## 5. Gotchas
- **No sound?** Browsers block sound until a tap. Tap "TAP TO PLAY" first.
- **Intro keeps replaying?** Clear `timeclash.introSeen` in localStorage, or use the "?" button.
- **Which voice?** Recorded voice files are not in the game yet. The browser's own speech voice is used, and captions show every line.
- **localStorage errors in private windows.** The storage wrapper catches errors and falls back to memory. The game still runs.
- **Tests that play sound.** Test files stub speech and audio. A test that starts real sound fails on purpose.
