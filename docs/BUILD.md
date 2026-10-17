# Time Clash: Build Plan for Claude Code

This file tells Claude Code how to build the game. Read `AGENTS.md` first. All rules in `GLOBAL_AGENTS.md` apply, including `PLAN` (post a plan, wait for GO), `TDD`, and `VERIFY`.

## Start prompt (paste this into Claude Code from the project folder)
```
Read AGENTS.md, docs/GAME_SPEC.md, docs/BUILD.md, docs/NARRATION.md and docs/DESIGN_BRIEF.md.
Build Phase 1 from docs/BUILD.md. Post a numbered plan first and wait for my GO.
Use TDD. Keep game rules in src/game/ with no Phaser imports.
When done, run the tests, build, and screenshot the Battle screen at 1280x800 and 1024x768.
```

## Product facts
- Free game. No ads, accounts, payments, or tracking. Players are children.
- Pass-and-play on one computer in Phases 1 to 3. Two iPads with room codes in Phase 4.
- Everything saves in the browser (localStorage). Nothing leaves the device until Phase 4, and then only game moves.
- Intro voice explains how to play (see `docs/NARRATION.md`).

## Setup (one time)
```bash
npm create vite@latest . -- --template vanilla-ts
npm i phaser
npm i -D vitest @vitest/coverage-v8 playwright @playwright/test eslint prettier typescript
```
Add scripts: `dev`, `build`, `preview`, `test` (vitest run), `lint`, `typecheck` (tsc --noEmit), `e2e` (playwright test).
Pin versions. Commit the lockfile. Add `.gitignore` (node_modules, dist, .env). Add `.env.example` (empty for now).

## Folder layout
```
src/
  main.ts                 boot, scene registry
  scenes/                 Phaser scenes: Boot, TapToStart, Intro, Loading, Setup, Camp, Deploy, Battle, Victory
  ui/                     DOM overlays: modals, banners, caption bar, pass-the-mouse screen
  game/                   PURE TypeScript rules (no Phaser). Unit tested.
    ballistics.ts         trajectory math
    wind.ts               seeded wind
    turn.ts               turn state machine
    damage.ts             base health, hit detection
    reload.ts             reload flow and bonus scrap
    economy.ts            scrap earn and spend (Phase 3)
    rng.ts                seeded random
  questions/
    types.ts
    bank/reading-k.json ... reading-12.json
    bank/math-k.json ... math-12.json
    pick.ts               choose a question by grade, subject, and recent history
  data/introScript.ts     from NARRATION.md
  audio/                  sound manager (mute, volume, unlock on tap)
  storage/                localStorage wrapper with try/catch
public/
  assets/                 art exported from Claude Design
  audio/voice/            intro voice files
  audio/sfx/              slide whistle, boing, horn, clunk (all original or CC0)
tests/                    unit tests mirror src/game and src/questions
e2e/                      Playwright tests
```

## Phase 1: Local core loop (MVP). Built.
Status: built. Decisions made during the build are in `docs/CONTRACTS.md`. Open items are in `BACKLOG.md`.


### Screens and flow
TapToStart → Intro (spoken how-to-play) → Loading → Setup → Battle → Victory → (Rematch → Loading → Battle).
Camp, Deploy, and biomes arrive in Phase 2. In Phase 1 the Future base uses a fixed spot.

### Features and acceptance criteria
1. **Tap to Start screen.** Unlocks audio. Mute and captions toggles. Done when: no sound plays before the first tap (test).
2. **Intro voice.** Implement per `docs/NARRATION.md`. Done when: 5 cards play in order with captions, Skip, Replay, Mute work, and a missing file falls back to speech synthesis.
3. **Loading screen.** Rotating messages (list in DESIGN_BRIEF.md), timeline-shaped progress bar. It is real: it waits for assets to load, with a minimum of 1.5 seconds so jokes can be read. Done when: a failed asset shows a friendly error with Retry.
4. **Setup screen.** Names, grade (K to 12), and subject (Reading, Math, Both) for each side. Validate: names 1 to 12 characters, trimmed, no profanity list match. Done when: values persist in localStorage and the two sides may differ.
5. **Battle: ballistics.** 2D projectile with angle (0 to 90 degrees), power (0 to 100), gravity, and wind. Terrain and obstacles as simple polygons. Fixed time step (1/60 s). Done when: the same inputs and seed always give the same landing point (golden test).
6. **Turn state machine.** States: `PASS_SCREEN → AIMING → SHOT_1 → AIMING → SHOT_2 → RELOAD → NEXT_PLAYER`. A turn always has exactly 2 shots. Done when: tests prove illegal transitions throw and a turn cannot be skipped.
7. **Turn indicators.** Massive banner with horn ("ALEX, YOUR TURN! (SHOT 1 OF 2)"), active-side glow, waiting side dims, and the Pass-the-Mouse cover between turns. Done when: the cover fully hides the board and any question text.
8. **Reload modal.** Appears right after shot 2. Reading and math question from the bank by grade band. Wrong answers show the right answer and still reload. Fast answers earn +2 scrap, others +1. The fast limit depends on the question kind (for example 8 seconds for a math fact, 20 seconds for a main idea passage, and 4 seconds more in grades K and 1), see `RELOAD.fastMsByKind` in `src/game/config.ts`. A wrong answer waits for Got it, with a 20 second cap. Done when: the other player's view never shows the question (the whole board is covered while the modal is up).
9. **Base health and tumble.** Each base has 100 HP. A direct hit deals 25. A near miss within the blast radius deals 10 and triggers the Awkward Tumble animation plus a random speech bubble. First base at 0 HP loses. No gore. Walls turn into bouncy blocks. Done when: the damage table is unit tested, and the tumble plays with each of the 12 bubble lines.
10. **Victory screen.** Winner, stats, Rematch, Main Menu. No "dead" or "defeat" words (test with a copy lint over `src/`).
11. **Sound.** Slide whistle on launch, boing on tumble, horn on turn banner, clunk on reload. All original or CC0. Global mute and volume saved.
12. **Accessibility.** Keyboard play (arrow keys for angle and power, Space to fire). Tap targets 56px or more. Captions on all speech. Reduced-motion support. Contrast 4.5:1.

### Phase 1 balance numbers (tune later in one config file `src/game/config.ts`)
- Gravity 600 px/s². Max launch speed 900 px/s at power 100. Wind range -80 to +80 px/s², changes every turn.
- Blast radius: direct 48 px, near 120 px. Hit damage: direct 25, near 10.
- Reload timer for the fast-answer bonus: 8 seconds. No penalty for slow answers.
- Starting scrap 0. No scrap spending until Phase 3.

### Question bank format
```json
{
  "id": "math-8-0042",
  "subject": "math",
  "grade": 8,
  "kind": "numeric",
  "prompt": "Solve for x: 3x + 5 = 20",
  "choices": ["3", "5", "7", "15"],
  "answer": "5",
  "hint": "Subtract 5 from both sides first.",
  "tags": ["pre-algebra", "linear-equations"]
}
```
- Reading K to 3: sight words and simple sentences (use the public Dolch and Fry lists). `kind: "sightword"` with `audioWord` text for the speak button.
- Reading 4 to 12: vocabulary in context, main idea, and grammar. Write original questions only.
- Math K to 12: counting, add and subtract, times tables, fractions, ratios, pre-algebra, algebra, geometry, trig basics.
- At least 40 questions per grade per subject before launch. Phase 1 may ship with 15 per grade for grades K, 2, 5, and 8, with a generic fallback to the nearest grade.
- Question picker never repeats a question until the pool is used up, then reshuffles with a seeded RNG.
- Every math question has its answer checked by a script (`npm run check:questions`) that recomputes the answer from the prompt where possible. Done when: this script runs in CI.

### Tests for Phase 1 (write first)
- `ballistics.test.ts`: golden trajectories, wind effect, angle limits.
- `turn.test.ts`: legal and illegal transitions, exactly 2 shots.
- `damage.test.ts`: direct hit, near miss, miss, win condition.
- `reload.test.ts`: bonus scrap rule, wrong answer path.
- `pick.test.ts`: grade selection, no repeats, fallback grade.
- `questions.test.ts`: every question has a unique id, valid answer in choices, grade 0 to 12.
- `copy-lint.test.ts`: banned words (kill, die, dead, blood, gore, defeat, buy, price, upgrade to pro).
- `intro.test.ts`: from NARRATION.md.
- E2E (Playwright): full game from Setup to Victory with scripted inputs, in Chromium and WebKit, at 1280x800 and 1024x768.

## Look and feel phase: built
Status: built. The screens use the Claude Design handoff look. The rules and tokens are in `docs/DESIGN_SYSTEM.md`, and the tests in `tests/styles/` and `tests/ui/` pin them. Done so far: Team Past and Team Future labels, the Wipeout title in place of the mock's "Base Destroyed" title (the victory screen shows "Wipeout!" and a bouncy toy block line), self-hosted MedievalSharp and Orbitron fonts in `public/fonts/`, 56px grade chips, and contrast at 4.5:1 for body text and 3:1 for large text. No game rules changed.

The design boards are 1600x900 mockups. We translate their look to 1280x800, 1024x768, and 768x1024. Board names: Main (Camp hub), Loading, Battle, DesignSystem, Setup, Math, Reading, Forge, ForgeFuture, Upgrade, UpgradePast, Destroyed. Phase 2 and 3 boards are not built yet. Phase 2 uses Main. Phase 3 uses Forge, ForgeFuture, Upgrade, and UpgradePast.

## Phase 2: Camp Hub, base placement, biomes
- Camp Hub scene per the Main (Camp hub) board in the design handoff. **Built.** The board shows the campfire, both camps, workbenches, and three buttons: [FORGE WEAPON], [UPGRADE BASE] and the big [TIME TO CLASH!]. Only the big one works. The other two show "Coming soon". Tweak Gear is not on the board, so it is not built.
- Base Deployment: three Austin spots (skyscraper top, bridge underside, food truck pavilion). The spot changes launch height and cover. Test: each spot has a distinct elevation and a reachable shot path.
- Parallax biomes: Aspen Forest, Cherry Blossom Forest, Ruined Temple. Selected before battle.
- Evasion abilities: Hoverboard Dodge (recharges after 2 turns) and Stone Barricade Wall (once per match).

## Phase 3: Deep crafting and customization
- Working Camp buttons. Build the Forge screens from the Forge and ForgeFuture boards, and the Upgrade screens from the Upgrade and UpgradePast boards. Recipes combine Past materials (granite, iron) with Future materials (nanotubes, energy shields).
- **Forge Weapon screen built** from the Forge and ForgeFuture boards (`src/ui/forgeScreen.ts`, `forgeArt.ts`): pick a team, unlock or equip a weapon, forge the one in use. Scrap only. The Upgrade Base screen is not built yet.
- **Rules built**: `src/game/weapons.ts`, `upgrades.ts`, `loadout.ts` and `economy.ts`, saved in `timeclash.camp`. Scrap is the only currency. A fresh game plays exactly like Phase 1. The balance test (`tests/game/balance.test.ts`) checks that no single purchase wins the game alone.
- Hybrid weapons: Nanotech Trebuchet, Wrought-Iron Railgun, EMP-shielded Railgun. Each has stats in `src/game/weapons.ts` (damage, blast radius, speed, reload difficulty).
- Ammo types: confetti explosives, bouncy plasma spheres, heavy iron bowling balls.
- Scrap economy: earned from fast, correct reloads. Spent only at the Camp. Balance test: no single purchase wins the game alone.
- Individual K to 12 calibration: if a player gets 4 of 5 right, nudge the next question up a level (never more than 2 above grade). If 2 of 5 or fewer, nudge down. Show nothing scary about this.

## Phase 4: iPad and multi-device
- Room codes: 4 uppercase letters, no vowels (avoids bad words), expire after 2 hours idle.
- Small Node relay with `ws`. Server owns the turn order and checks that moves come from the right player (`SERVER` rule). Clients send inputs only. Rate limit messages. The question and its answer are checked on the server, so a player cannot peek at the other player's answer.
- Reconnect within 60 seconds restores the match.
- Privacy: relay logs hold room code and event type only. No names, no IPs kept.
- Profiles and leaderboards: local only, or optional and anonymous. Do not add accounts. Revisit before building.
- Full audio suite and optional extra voice lines.

## Hosting (free)
- Phases 1 to 3: build to `dist/` and host on Cloudflare Pages or GitHub Pages. Custom domain optional.
- Phase 4 relay: a free tier (Cloudflare Workers with Durable Objects, or Fly.io free allowance). Confirm current free limits before choosing.

## Order of work for Claude Code (parallel where safe)
1. Setup + config + empty scenes + CI. (one agent)
2. In parallel, in separate git worktrees:
   - A: `src/game/*` rules with tests (ballistics, turn, damage, reload).
   - B: `src/questions/*` bank, picker, and checker script.
   - C: `src/ui/*` and `src/data/introScript.ts` intro with captions and audio manager.
3. Wire scenes (Battle, Reload, Victory). One agent.
4. Replace placeholder shapes with exported Claude Design art. One agent.
5. E2E tests, copy lint, accessibility pass, screenshots at both sizes. One agent.
6. Deploy to the free host. Check the health page shows the build SHA (`VERIFY`).

## Done means
Fresh `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run e2e` all pass, with the output shown. Screenshots at 1280x800 and 1024x768 are attached. The intro voice plays only after a tap and Skip works.
