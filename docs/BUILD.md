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
This setup is done. It stays here as the record of how the project started.
Pin versions. Commit the lockfile. Add `.gitignore` (node_modules, dist, .env). Add `.env.example` (empty for now).

## Folder layout
```
src/
  main.ts                 boot, scene registry
  scenes/                 Phaser scenes (Boot, Intro, Loading, Setup, Camp, Battle, and the Flow scene that steps between them)
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
    bank/reading-0.json ... reading-12.json   (grade 0 is kindergarten)
    bank/math-0.json ... math-12.json
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
Camp, the Battle Plan, and biomes arrived in Phase 2. In Phase 1 the Future base used a fixed spot.

### Features and acceptance criteria
1. **Tap to Start screen.** Unlocks audio. Mute and captions toggles. Done when: no sound plays before the first tap (test).
2. **Intro voice.** Implement per `docs/NARRATION.md`. Done when: 5 cards play in order with captions, Skip, Replay, Mute work, and a missing file falls back to speech synthesis.
3. **Loading screen.** Rotating messages (list in DESIGN_BRIEF.md), timeline-shaped progress bar. It is real: it waits for assets to load, with a minimum of 1.5 seconds so jokes can be read. Done when: a failed asset shows a friendly error with Retry.
4. **Setup screen.** Names, grade (K to 12), and subject (Reading, Math, Both) for each side. Validate: names 1 to 12 characters, trimmed, no profanity list match. Done when: values persist in localStorage and the two sides may differ.
5. **Battle: ballistics.** 2D projectile with angle (0 to 90 degrees), power (0 to 100), gravity, and wind. Terrain and obstacles as simple polygons. Fixed time step (1/60 s). Done when: the same inputs and seed always give the same landing point (golden test).
6. **Turn state machine.** States: `PASS_SCREEN → AIMING → SHOT_1 → AIMING → SHOT_2 → RELOAD → NEXT_PLAYER`. A turn always has exactly 2 shots. A right answer adds `RELOAD → BONUS_AIMING → BONUS_SHOT → NEXT_PLAYER`: one Power Shot (`turn.bonus`, not shot 3, `BONUS.damageMultiplier` in `src/game/config.ts`). Done when: tests prove illegal transitions throw and a turn cannot be skipped.
7. **Turn indicators.** Massive banner with horn ("ALEX, YOUR TURN! (SHOT 1 OF 2)"), active-side glow, waiting side dims, and the Pass-the-Mouse cover between turns. Done when: the cover fully hides the board and any question text.
8. **Reload modal.** Appears right after shot 2. Reading and math question from the bank by grade band. Wrong answers show the right answer and still reload. Fast answers earn +2 scrap, others +1. The fast limit depends on the question kind (for example 8 seconds for a math fact, 20 seconds for a main idea passage, and 4 seconds more in grades K and 1), see `RELOAD.fastMsByKind` in `src/game/config.ts`. A wrong answer waits for Got it, with a 20 second cap. Done when: the other player's view never shows the question (the whole board is covered while the modal is up).
9. **Base health and tumble.** Each base has 400 HP (100 in Phase 1; raised for the 2026-10-24 pace rule, see docs/GAME_SPEC.md "Pace"). A direct hit deals 25. A near miss within the blast radius deals 10 and triggers the Awkward Tumble animation plus a random speech bubble. First base at 0 HP loses. No gore. Walls turn into bouncy blocks. Done when: the damage table is unit tested, and the tumble plays with each of the 12 bubble lines.
10. **Victory screen.** Winner, stats, Rematch, Main Menu. No "dead" or "defeat" words (test with a copy lint over `src/`).
11. **Sound.** Slide whistle on launch, boing on tumble, horn on turn banner, clunk on reload. All original or CC0. Global mute and volume saved.
12. **Accessibility.** Keyboard play (arrow keys for angle and power, Space to fire). Tap targets 56px or more. Captions on all speech. Reduced-motion support. Contrast 4.5:1.

### Phase 1 balance numbers (tune later in one config file `src/game/config.ts`)
- Gravity 600 px/s². Max launch speed 900 px/s at power 100. Wind range -80 to +80 px/s², changes every turn.
- Blast radius: direct 48 px, near 120 px. Hit damage: direct 25, near 10.
- Base health 400 (`DAMAGE.startingBaseHp`). It was 100 until the pace rule (owner, 2026-10-24): perfect aim needs five turns of its own to win, so a match never ends in one or two turns.
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
- Reading K to 3: printed words and simple sentences (use the public Dolch and Fry lists), always answerable by reading. (The `sightword` kind and its speak button were removed on 2026-10-23.)
- Reading 4 to 12: vocabulary in context, main idea, and grammar. Write original questions only.
- Math K to 12: counting, add and subtract, times tables, fractions, ratios, pre-algebra, algebra, geometry, trig basics.
- At least 40 questions per grade per subject before launch. The bank is past that: 2,460 questions, with 100 to 110 math and 79 to 90 reading per grade (`npm run check:questions` prints the count per file). The picker still falls back to the nearest grade if a grade is ever empty.
- Topic tag: a question that belongs to a math topic carries the tag `topic:<name>` (today `topic:multiplication` for Team Past and `topic:division` for Team Future, 20 or more of each per grade, K to 12). `check:questions` requires the topic prompt to be checkable by the recompute (no `manual`), the kind to be `numeric`, the prompt to really multiply (or divide), and no wrong choice worth the same as the answer. Equal-groups word problems ("3 baskets have 4 apples each. How many apples in all?") are checkable too. So are sharing and grouping problems ("12 cookies are shared equally by 3 kids. How many cookies does each kid get?", "20 apples are put in groups of 5. How many groups are there?") and remainders ("What is the remainder when 17 is divided by 5?"). The tags live in `QUESTION_TOPICS` in `src/game/config.ts`. They only feed these checks: in play, topic questions are ordinary math questions. (A Setup "Focus" switch that narrowed one side to a topic was retired on 2026-10-24.)
- Question picker never repeats a question until the pool is used up, then reshuffles with a seeded RNG.
- Every math question has its answer checked by a script (`npm run check:questions`) that recomputes the answer from the prompt where possible. Done when: this script runs in CI.

### Tests for Phase 1 (write first)
- `ballistics.test.ts`: golden trajectories, wind effect, angle limits.
- `turn.test.ts`: legal and illegal transitions, exactly 2 shots. `bonus.test.ts`: the Power Shot rules.
- `damage.test.ts`: direct hit, near miss, miss, win condition.
- `reload.test.ts`: bonus scrap rule, wrong answer path.
- `pick.test.ts`: grade selection, no repeats, fallback grade.
- `tests/questions/validate.test.ts` and `checkBank.test.ts`: every question has a unique id, valid answer in choices, grade 0 to 12.
- `tests/copy-lint.test.ts`: banned words (kill, die, dead, blood, gore, defeat, buy, price, upgrade to pro).
- `tests/data/introScript.test.ts`: from NARRATION.md.
- E2E (Playwright): full game from Setup to Victory with scripted inputs, in Chromium and WebKit, at 1280x800 and 1024x768.

## Look and feel phase: built
Status: built. The screens use the Claude Design handoff look. The rules and tokens are in `docs/DESIGN_SYSTEM.md`, and the tests in `tests/styles/` and `tests/ui/` pin them. Done so far: Team Past and Team Future labels, the Wipeout title in place of the mock's "Base Destroyed" title (the victory screen shows "Wipeout!" and a bouncy toy block line), self-hosted MedievalSharp and Orbitron fonts in `public/fonts/`, a 56px grade dropdown, and contrast at 4.5:1 for body text and 3:1 for large text. No game rules changed.

The design boards are 1600x900 mockups. We translate their look to 1280x800, 1024x768, and 768x1024. Board names: Main (Camp hub), Loading, Battle, DesignSystem, Setup, Math, Reading, Forge, ForgeFuture, Upgrade, UpgradePast, Destroyed. Phase 2 and 3 boards are not built yet. Phase 2 uses Main. Phase 3 uses Forge, ForgeFuture, Upgrade, and UpgradePast.

## Phase 2: Camp Hub, base placement, biomes
Status: built, except that the base builder is on for everyone (`BASE_BUILDER.enabled = true`, `?builder=0` shows the old shop) and built bases take hits in battle (`BASE_IN_BATTLE.enabled = true`, owner 2026-10-25), and the weapons on their pads fire (2026-10-25, docs/GAME_SPEC.md "Weapons on the pads").
- Camp Hub scene per the Main (Camp hub) board in the design handoff. **Built.** The board shows the campfire, both camps, workbenches, and three buttons: [FORGE WEAPON], [BUILD BASE] and the big [TIME TO CLASH!]. The big one starts the match. Forge Weapon and Build Base open their own screens. Tweak Gear is not on the board, so it is not built.
- Base Deployment: three Austin spots (skyscraper top, bridge underside, food truck pavilion). The spot changes launch height and cover. Test: each spot has a distinct elevation and a reachable shot path.
  - **Rules built, picked on the Battle Plan**: `src/game/spots.ts` and the `SPOTS` block in `src/game/config.ts`. `layoutForSpot(null)` is exactly the Phase 1 layout. Launch height (y): skyscraper 310, food truck 470, bridge 530. The bridge deck blocks flat shots, so players lob. `shiftForSpot` moves the Future fighters with their base. Tests: `tests/game/spots.test.ts`.
- Castle places for Team Past (the mirror of the Austin spots): Hill Fort (high, on a solid rock), Village (middle, a low stone wall in front; code id `villageWall`, labeled "Village Wall" until 2026-10-25) and Drawbridge (low, a raised oak drawbridge that stops flat shots). **Built, picked on the Battle Plan.** Rules: `src/game/forts.ts` and the `FORTS` block in `src/game/config.ts` (same shape as `SPOTS`: `shift`, `base`, `launchOrigin`, `obstacles`). `layoutForFort(null)` is exactly the Phase 1 layout in the rules code, but the live game always passes a castle place. Launch height (y): Hill Fort 310, Village 450, Drawbridge 500. The Village is the default (`DEFAULT_PLAN.fort`, owner decision 2026-10-24), the mirror of Food Trucks for Team Future. A plan saved before castle places existed, or with an unknown value, loads at the Village, and a new family starts with it picked. The Village keeps the Phase 1 castle spot and adds a low stone wall in front. The Archer (B) rides the castle like Team Future's riders. Tests: `tests/game/forts.test.ts` (distinct heights, reachable shots for both teams with every spot and biome, the default field in every biome and spot, cover, old plans), `tests/ui/plan.test.ts`, `tests/storage/plan.test.ts`, `e2e/phase2.spec.ts`.
- Obstacle art. Every solid shape is painted by `src/scenes/battle/obstacleArt.ts` (pure, no Phaser): the collision polygon is the silhouette, the details sit inside it, and its outline is drawn last. `tests/scenes/battle/obstacleArt.test.ts` checks every biome, spot and castle place. The Stone Wall ability uses the same recipe. One exception, approved by Andy on 2026-10-24: a floating shape gets supports so it does not hang in the sky. The Drawbridge hangs by two chains from a gate post and rests on a wooden leg; the Future bridge stands on two steel pylons with cables from a tower. Supports are decoration only (`obstacleDecor`, `solid: false`): they never change a collision polygon, shells pass through them, they paint behind every solid shape and its outline, and they stay inside the world and above the ground line. The tests check all of that.
- Angle number. The "45°" by the aim guide never covers a fighter, its letter tag or the guide (`src/scenes/battle/angleLabel.ts`). `tests/scenes/battle/angleLabel.test.ts` sweeps every fighter, castle place, base spot, biome and angle.
- Base placement (castle and secret base from bricks): **screen and rules built, on for everyone (2026-10-23).** Before a battle a player drags bricks from a tray onto a build plot (or taps a brick, then taps or slides on the plot), turns them, and stacks them. Each player keeps three saved bases per side and picks one. **Support rule (owner, 2026-10-24):** a brick may only go on the ground or on top of a brick that is held up all the way down to the ground, overlapping it sideways by at least half a cell (`minSupportSteps`). A corner touch or a brick stuck to the side of a wall does not count. A brick let go in mid-air is refused with a pink dashed outline and "Build on something that touches the ground." A brick that another brick sits on cannot be taken off, dragged away or turned ("Something is sitting on that brick. Take the top one off first."). Clear and Undo always work. An old base saved with floating bricks is set down when it opens (each floating brick drops straight down, lowest first, then leftmost), saved, and Chrono says so once. **Layout:** the top bar holds Back, the three saved bases and Scrap. A rail left of the plot holds Team Past and Team Future, then Build and Weapons and the spots count. The right rail holds Turn, Undo, Clear, Snap and Done. Nothing sits on the plot: the whole picture is a place to build, and a brick let go just past its edge is pushed back inside. A locked piece costs Scrap. Rules: `src/game/baseBuilder.ts`. Screen: `src/ui/baseBuilderScreen.ts`, `baseBuilderArt.ts`, `src/styles/baseBuilder.css`. Numbers: `BASE_BUILDER` in `src/game/config.ts`. With the builder on, the Camp has one **Build Base** button per side that opens it (it replaces the old Upgrade Base shop screen, which still shows under the name Build Base while the builder is off). Players spend Scrap there on locked pieces and weapons. It stays off (`BASE_BUILDER.enabled = false`) until the panel has reviewed it. Try it with `?builder=1`. Tests: `tests/game/baseBuilder.test.ts`, `tests/game/baseBuilderSupport.test.ts`, `tests/game/weaponSpots.test.ts`, `unlockPiece.test.ts`, `tests/storage/bases.test.ts`, `tests/ui/baseBuilder.test.ts`, `e2e/base-builder.spec.ts`, `e2e/base-builder-touch.spec.ts`.
  - **How battle reads the chosen base (built, on).** `chosenBase(bases, name, team)` returns the bricks of the slot the player picked, already cleaned, and `chosenBaseFor` in `src/game/builtBase.ts` bundles it with `chosenSpots` as a `ChosenBase`. The Camp passes `battleBasesFor(bases, names)` (only bases with a brick on the foundation) in `MatchOptions.bases`. In the live game (character health off) the match fits each base into its old castle footprint, gives the bricks base health in a fair band around 400 (the foundation holds 90 percent), and never changes the saved base. A brick at 0 falls away, takes the bricks it was holding up with it, and the scene puffs and tumbles them. A side is out when its foundation is gone. Full rules: docs/GAME_SPEC.md "Built bases with base health". The scene draws it with `src/scenes/battle/baseLayer.ts`.
  - **How battle will read the chosen base (a later task).** `chosenBase(bases, name, team)` in `src/game/baseBuilder.ts` returns the bricks of the slot the player picked, already cleaned (unknown or overlapping bricks are dropped) and settled (no brick floats). Each brick has a piece id, a place on the 24 by 12 grid (`x`, `y` in cells, `ox`, `oy` in eighths of a cell), a turn (`rot`) and `hp`, the hit points it starts with (the piece's full strength, from `BASE_BUILDER.hp`). `rectOf(brick)` gives its box. Battle should read it once when the match is built, draw each brick at its box, and keep a separate hit-point count per brick for the match. Saved bases must never be changed by a match. A brick at 0 hit points falls away with a puff, and the base health bar can follow the total of the bricks. The scene and the damage rules are not changed by this task.
  - **Your own shapes.** The main bar holds the side's bricks, then the player's saved shapes (in saved order), and its last tile is "My shape", which opens a 6 by 6 drawing pad over the plot, the status line and the bar. There is no separate shapes row. Pick a material with the Material selector (`radioGroup`: Stone, Wood, Glass, Jelly for Team Past; Panel, Metal, Glass, Jelly for Team Future; the first is the side default), then tap or drag across squares. A tap on an empty square or a square of another material fills it with the picked material; a tap on a square of the same material empties it. Each material has its own picture (stone crack, wood grain and nails, panel inset, metal rivets, slanted glass shine, round jelly with bubbles) as well as its own color, and its own sturdiness (`BASE_BUILDER.materialHp`, hit points per square: glass 3, wood 5, jelly 6, stone 8, panel 8, metal 12). The pad shows the count and the shape's total Strength. The player names the shape in a Name field (at most `shapeNameMax`, 14, letters, numbers and spaces). The field starts with the next free "Shape N", so Save always works: an empty name, or one the Workshop name rules refuse (a blocked word, odd letters, a player's own name), says so kindly and saves with "Shape N". Limits (all in `BASE_BUILDER`): squares must touch side to side (a corner touch is two pieces and is refused, "Squares must touch side to side."), 1 to 12 squares (`maxShapeCells`), 8 saved shapes per player and side (`maxShapes`), any outline (an L, a U, a plus), and the same squares in the same materials drawn anywhere on the pad count as a duplicate (the same squares in another material are a new shape). Drawing and saving are free (no Scrap). A saved shape's tile shows its picture and its name (the name is its label; a long name ends in "..." on the tile) and drags, snaps, turns and undoes like a brick. Each placed shape is one piece against `maxPieces` (60). A trash can sits in each saved tile's upper right corner (a 56px button). It asks "Delete?" inside the tile with real Yes and No buttons (No is the safe primary and gets the keyboard; Escape is No). Yes takes the shape and its name off the list; a base that already uses it keeps its own copy (squares and materials live in the placed piece's id). The bar wraps into a second row of even columns when it is full, so nothing scrolls. **How battle reads a shape piece:** `chosenBase` returns it like any brick, with `piece` = `own:<P|F>:<key>`. The key is one letter a square, rows joined by "/": `0` empty, `1` the side default material, or a material letter (`w` wood, `m` metal, `g` glass, `j` jelly), so `w0/10/1g` is an L with a wood top and a glass foot. `pieceById(piece).cells` lists its filled squares (column, row, material) before turning, and `occupiedRects(brick)` gives one box (in steps) per filled square after turning and placing. `hp` is the total for the whole piece. Tests: `tests/game/customShapes.test.ts`, `customPieces.test.ts`, `builtBase.test.ts`, `tests/ui/baseBuilderShapes.test.ts`, `e2e/base-builder-shapes.spec.ts` (0, 3 and 8 saved shapes, the pad and the delete question fit at 1280x800, 1024x768 and 1133x744), `e2e/base-builder-shapes-touch.spec.ts`.
  - **Weapon spots.** Each base also has four numbered round pads where a weapon is mounted (Weapons mode in the builder). Past picks from Cannon, Catapult, Archer post and Ballista (locked, 35 Scrap). Future picks from Laser, Missile pod, Turret and Shield generator (locked, 35 Scrap). The weapon list, the cost and each weapon's `role` (`direct`, `lob`, `volley`, `guard`), `damage` and `hp` live in `BASE_BUILDER.spotWeapons` in `src/game/config.ts`; the spot numbers are in `BASE_BUILDER.spots`. Unlock with `unlockSpotWeapon` in `src/game/economy.ts` (kept at `loadout[team].mounts`, same rules as pieces: once, never below zero). The same weapon may sit on more than one spot. A slot is saved as `{ v: 1, p: [...], s: [{ w, x, y }] }`. `s` is optional, so every older save still loads with four empty spots, and bad data is repaired (unknown weapon, the other side's weapon, a pad outside the plot).
  - **How battle fires the spots (built, on).** In the live game (base health) see docs/GAME_SPEC.md "Weapons on the pads": a filled pad on a standing brick is picked from "Pick one" (a Base weapons token), a go from it counts toward the 2 goes, it hits like a fighter scaled by `mountScale` (capped at 1 by the pace rule, `BASE_IN_BATTLE.baseHealthMount`), a shell on a pad hits the brick under it, and the pad falls with its brick. With character health on, the older rules below apply. `chosenSpots(bases, name, team)` returns four `{ index, x, y, weapon }` rows (`x` and `y` are the middle of the pad in free steps, so a brick's `rectOf` box and a pad share one coordinate system; `weapon` is a spot-weapon id or `null`). With the flag on, a mounted weapon on spot `i` is a shooter with id `mount:i`, picked with `selectUnit('mount:i')`, and it fires from its pad: `direct` flat (angle 0 to 45), `lob` in an arc (45 to 90, flies over walls), `volley` a burst of 3 small shells, and `guard` (the Shield generator) fires nothing and instead blocks the first hit per turn that lands within 90 px of its pad. Each weapon starts at its catalog `hp`, takes hits like a brick, and sits on the highest brick under its pad, so if that brick falls the weapon falls too and is out. Saved bases are never changed by a match.
  - **My weapons in Build Base** (owner request: "when you put the weapons on build your own base you can get new weapons like you can create your own new weapon and make a section for that"). In Weapons mode the list for a pad starts with a "My weapons" group: the weapons this player made in the Forge Workshop for the side being built (from their Camp wallet), two to a row, each with the picture of its style and a star (the Forge's "yours" badge), its name and "Damage N". A thin line then starts the base weapons (a "Base weapons" heading for screen readers), two to a row as well. Picking one mounts it on the chosen pad exactly like a catalog weapon, for no Scrap (it was paid for when it was forged); the chosen tile gets a check badge on its picture as well as the Ember fill, and the pad picture gets the star. While My weapons shows, the list is as wide as the room on the far side of the chosen pad allows (never over the pad, at most 440px), the spot title steps aside (the status line says it), and the list may run past the plot picture into the empty band under it. With three weapons it fits with no scrolling at 1280x800 and 1133x744 and for Team Past at 1024x768; Team Future at 1024x768 (Orbitron and the locked Shield generator) and six weapons on iPad sizes scroll a little inside the list, which has always been `overflow-y: auto`, and every button stays reachable (checked in e2e). With none made, the group is one quiet Link, "Make a weapon in the Forge", which opens the Forge Workshop over the builder for that side; a weapon forged there comes straight back in My weapons with the keyboard on it (Back returns to the link). **Saving:** a pad keeps its own copy of the weapon, so renaming or losing it in the Forge never breaks a saved base. The spot is `{ w: 'custom:P:1', m: { b, n, p, r, s } }` (style, name, Power, Reach, Splash). `m` is new and optional, so every older save loads unchanged. A copy is checked like a saved Workshop weapon on every read (budget, name rules, style of the right side, id of the right side); a bad one empties the pad. `assignWeapon(state, i, id, owned, mine)` refuses an id that is not in the player's list or is the other side's. **How battle reads it:** `chosenSpots` gives `weapon: 'custom:P:1'` and `custom` (the `SpotWeaponDef` from the copy: role, damage, hp, `art`); `spotDef(spot)` reads any spot. `builtBase.ts` reads `custom` first (then the catalog), so a weapon of your own fires in battle with the role, damage and picture of its style. Numbers: `WORKSHOP.mount` (role, damage, hp, `art` by style). Tests: `tests/game/mySpotWeapons.test.ts`, `tests/ui/baseBuilderMyWeapons.test.ts`, `e2e/base-builder-my-weapons.spec.ts` (0 and 3 made, both teams).
- Parallax biomes: Aspen Forest, Cherry Blossom Forest, Ruined Temple. Selected before battle.
- Evasion abilities: Hoverboard Dodge (recharges after 2 turns) and Stone Barricade Wall (once per match).
- **Wired in (Battle Plan).** "Time to Clash!" opens the Battle Plan (`src/ui/planScreen.ts`): pick a place, Team Future picks its base spot, and either side may unlock special ammo. Lock it in! starts the match with `buildLayout(plan)` and each side's owned ammo. The plan is saved in `timeclash.plan`. Choices made where this file was silent (simplest option, flagged for Andy):
  - The spot picker shows the three Austin spots only. The default is Food Trucks (the Phase 1 base place, plus its low wall).
  - The castle picker ("<name>, place your castle") sits above the spot picker and shows Hill Fort, Village and Drawbridge. The Village is picked by default, and exactly one card is always checked. Each card says its height in one word (High, Middle, Low) and what it does, so all nine place cards stay one or two lines and the Battle Plan fits a 1133x744 iPad mini without scrolling.
  - Each biome changes the backdrop and the middle obstacle: Aspen keeps the Phase 1 hill, Cherry Blossoms is a low wide mound, Ruined Temple is a tall pillar. A test proves both teams can still score in every biome and spot, in no wind and strong wind.
  - One ability per team: Team Past has the Stone Wall (a wall in front of the castle for the other team's whole next turn, once per match). Team Future has the Hoverboard Dodge (the first damaging hit of the other team's next turn misses; ready again 2 of your own turns after you arm it). "Recharges after 2 turns" counts your own turns.
  - Arming is free (not a shot) and works while aiming, including the Power Shot. A second tap the same turn takes it back.
  - Ammo is unlocked on the Battle Plan (not the Forge) and loaded with the Ammo button by Fire. A mounted base weapon (built bases, flag off) always fires its own shells.
  - Tests: `tests/game/battlefield.test.ts`, `evasion.test.ts`, `matchPhase2.test.ts`, `ammoUnlock.test.ts`, `tests/storage/plan.test.ts`, `tests/ui/plan.test.ts`, `hudGear.test.ts`, `tests/scenes/battle/flowPhase2.test.ts`, `e2e/phase2.spec.ts`.

## Phase 3: Deep crafting and customization
Status: Forge, Build Base shop, ammo, the Scrap economy and calibration are built. Hybrid weapons and recipes are not built.
- Working Camp buttons. Build the Forge screens from the Forge and ForgeFuture boards, and the Upgrade screens from the Upgrade and UpgradePast boards. Recipes combine Past materials (granite, iron) with Future materials (nanotubes, energy shields).
- **Forge Weapon screen built** from the Forge and ForgeFuture boards (`src/ui/forgeScreen.ts`, `forgeArt.ts`): pick a team, unlock or equip a weapon, forge the one in use. Scrap only. **Build Base screen (old shop, shown while the builder is off) built** from the Upgrade and UpgradePast boards (`src/ui/upgradeScreen.ts`, `upgradeArt.ts`): pick a team, raise any of three upgrades through three levels with Scrap. The battle HUD and base pills show the raised maximum health.
- **Weapon Workshop built** (owner request, 2026-10-24: "you can create your own weapon to forge"). The Forge has a "Make my own weapon" button under the list for each team. The Workshop (`src/ui/workshopScreen.ts`, rules in `src/game/customWeapons.ts`, numbers in `WORKSHOP`) picks a style (the team's three weapons), spends 10 points on Power, Reach and Splash (1 to 5 each), and names the weapon from two word lists or a typed name (14 characters, letters, digits and spaces, no blocked word, no player name, no run of 3 digits; a bad typed name is never used and the picked words stay). It costs 6 to 24 Scrap by strength and is equipped at once. A custom weapon is a normal owned weapon after that: the Forge's "My weapons" section lists it, it can be equipped and levelled to 3, and the match reads it like a catalog weapon. At most 6 per player and side. No custom weapon beats the best catalog weapon (a test sweeps every design). `customMountWeapons` gives the same weapons as base spot weapons for the "My weapons" group in Build Base's Weapons mode. Defaults chosen without the owner's answers, flagged for Andy: the budget, the cost table, the word lists, and that My weapons swaps in for the list (two cards a row) so six fit with no scrolling.
- **Rules built**: `src/game/weapons.ts`, `upgrades.ts`, `loadout.ts` and `economy.ts`, saved in `timeclash.camp`. Scrap is the only currency. A fresh game plays exactly like Phase 1. The balance test (`tests/game/balance.test.ts`) checks that no single purchase wins the game alone.
- Hybrid weapons: Nanotech Trebuchet, Wrought-Iron Railgun, EMP-shielded Railgun. Not built. `src/game/weapons.ts` holds six weapons today, three per team (Royal Sword, Elder Longbow, Iron Cannon; Plasma Blade, Laser Rifle, Rail Cannon), each with damage, blast radius, speed and reload difficulty.
- Ammo types: confetti explosives (bigger blast, a little less damage), bouncy plasma spheres (one real bounce off the ground), heavy iron bowling balls (slower, hardly pushed by wind, more damage). Rules are in `src/game/ammo.ts`. Each costs Scrap to unlock (10, 14, 18) and has 3, 3 and 2 uses per match. Wired in: unlock on the Battle Plan, load with the Ammo button in battle (see Phase 2).
- Scrap economy: earned from fast, correct reloads. Spent only at the Camp. Kept by player name on the device, with a lifetime total. A database for signed-in players is planned (docs/ACCOUNTS_PLAN.md). Balance test: no single purchase wins the game alone.
- Individual K to 12 calibration: if a player gets 4 of 5 right, nudge the next question up a level (never more than 2 above grade). If 2 of 5 or fewer, nudge down. Show nothing scary about this.

## Phase 4: iPad and multi-device
Status: not built. The app server has one place for the relay to mount (`/ws`, see docs/APP_SERVER.md).
- Room codes: 4 uppercase letters, no vowels (avoids bad words), expire after 2 hours idle.
- Small Node relay with `ws`. Server owns the turn order and checks that moves come from the right player (`SERVER` rule). Clients send inputs only. Rate limit messages. The question and its answer are checked on the server, so a player cannot peek at the other player's answer.
- Reconnect within 60 seconds restores the match.
- Privacy: relay logs hold room code and event type only. No names, no IPs kept.
- Profiles and leaderboards: local only, or optional and anonymous. Do not add accounts. Revisit before building.
- Full audio suite and optional extra voice lines.

## Hosting (free)
- Phases 1 to 3 run today on Railway as one Node app server (`npm start`) that serves `dist/` and the spoken clips. See docs/APP_SERVER.md.
- Phase 4 relay: planned to mount at `/ws` in the same process (`ws`). Confirm Railway limits and cost before building.

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
