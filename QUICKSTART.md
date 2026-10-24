# QUICKSTART

Goal: a fresh Claude Code session goes from an empty folder to the game running on `localhost:5173` in under ten minutes. Phases 1 to 3 are built, so the game already runs.

## 1. Prerequisites
- Node 22.13 or newer (`node -v`). `package.json` sets this as the minimum.
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
npm run e2e          # browser tests (Chromium and WebKit, several sizes)
UPDATE_SCREENSHOTS=1 npm run e2e   # same, and also retakes docs/screenshots (normal runs leave them alone)
npm run check:questions
npm run build && npm start   # the built site and spoken clips at http://localhost:8080
npm run smoke:server         # checks the compiled app server
```

## 4. Start a Claude Code session
Open Claude Code in this folder. Read [AGENTS.md](./AGENTS.md) first. Phases 1 to 3 are built. Phase 4 (two iPads) is not. See the phase status in [docs/BUILD.md](./docs/BUILD.md).

## 5. Gotchas
- **No sound?** Browsers block sound until a tap. Tap "TAP TO PLAY" first.
- **Intro keeps replaying?** Clear `timeclash.introSeen` in localStorage, or use the "?" button.
- **Which voice?** The five How to Play cards use recorded files in `public/audio/voice/`. Question and wipeout clips come from the app server (`npm start`), not from `npm run dev`. Anything without a clip uses the browser's own speech voice. Captions show every line.
- **localStorage errors in private windows.** The storage wrapper catches errors and falls back to memory. The game still runs.
- **Tests that play sound.** Test files stub speech and audio. A test that starts real sound fails on purpose.
