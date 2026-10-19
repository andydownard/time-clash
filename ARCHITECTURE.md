# ARCHITECTURE

## Shape
A static web app. Phaser draws the game. Plain DOM draws menus, modals, banners, and captions on top. Game rules are pure TypeScript with no Phaser imports.

```
Browser
 ├─ Phaser scenes (draw, animate, play sound)      src/scenes/
 ├─ DOM overlays (modals, banners, captions)        src/ui/
 ├─ Pure game rules (tested)                        src/game/
 ├─ Question bank + picker (tested)                 src/questions/
 ├─ Sound manager (unlock on tap, mute, volume)     src/audio/
 └─ Storage wrapper (localStorage, try/catch)       src/storage/
```

## Scene flow
New family: TapToStart → Intro → Loading → Setup → Camp → (Deploy, Phase 2) → Battle → Victory → Rematch or Camp.
Returning family (intro seen and players saved): Loading → Camp → Battle → Victory → Rematch or Camp. There is no Tap to Play screen for them. The first tap or key press anywhere unlocks sound (`boot.ts`), so nothing plays before a tap.

Back and exit: Setup has Back (to the Camp, saves nothing) once players are saved. The Forge has Back. In a battle, Pause offers Keep playing and Leave game, which asks "Leave this game?" first (Stay is focused) and then returns to the Camp.

The Camp is home. A returning family (players saved) goes Loading → Camp. A new family goes through Setup first. "Change players" on the Camp opens Setup again. The Camp reads the players Setup saved, so no data passes between the two. "Time to Clash!" starts a fresh seeded match. A Camp with no saved players goes back to Setup.

## Turn your iPad (landscape only on tablets)
`src/ui/turnScreen.ts` mounts one full-screen dialog (`data-testid="turn-screen"`, z-index 200, above the covers). It shows when the window is taller than wide, the short side is 600px or more, and the main pointer is coarse (a finger). That keeps laptops and tall mouse windows out and leaves phones alone. It listens to `resize` and `orientationchange` only, no timers. While it is up, the rest of the page is `inert`, focus moves to it, and a running battle is paused through the normal Pause button (nothing is lost). Time spent there is added to `awayMs()`, which the default overlay clock subtracts, so a reload question is not timed while the iPad is upright. Booted from `bootApp`. Tests: `tests/ui/turnScreen.test.ts`, `e2e/turn-screen.spec.ts`.

## Base deployment spots (Phase 2)
`src/game/spots.ts` turns a spot id (`skyscraper`, `bridge`, `foodTruck`, or `null`) into a `BattleLayout`. Only Team Future's base, launch origin, and cover move. `null` and unknown ids give the Phase 1 layout. The numbers live in `SPOTS` in `src/game/config.ts`. Not wired into the scenes yet.

## Turn state machine
`PASS_SCREEN → AIMING → SHOT_1 → AIMING → SHOT_2 → RELOAD → NEXT_PLAYER`. A turn has exactly two shots. Illegal moves throw. Tests pin every legal and illegal transition.

## Fighters (rules built, screens not yet)
Each team has five fighters in `src/game/units.ts` (`UNITS`, `unitsOf`, `unitById`, `DEFAULT_UNIT`). Past: A Hot Air Balloon, B Archer, C Cannon Knight, D Catapult, E Spearman. Future: 1 Tank, 2 Helicopter, 3 Missile Bunkers, 4 Saber Robot, 5 Laser Gun Robot. Only one acts at a time. In AIMING the player calls `selectUnit(id)` (free, not a shot). The Match snapshot has `selected` per team, remembered between turns, and each `lastShot` records its `unit`. A fighter sets where the shot starts (`origin`), its range (`speedScale`, times the weapon's) and its damage (`damageScale`, times the weapon's, rounded, never below 1). Mirror pairs (A~2, B~5, C~1, D~3, E~4) share both scales. The defaults C and 1 are the old launchers, so a fresh game plays exactly as before (`tests/game/squadGolden.test.ts`).

## Ammo (rules built, not yet wired into the match)
`src/game/ammo.ts` holds four kinds: standard, confetti explosives, bouncy plasma spheres and heavy iron bowling balls. Standard is free, unlimited and changes nothing (`tests/game/ammo.test.ts` pins that). The other three cost Scrap to unlock (10, 14, 18) and have 3, 3 and 2 uses per match. `simulateShot({ ..., ammo })` applies speed and wind scales and the plasma bounce (once, off the ground only; the result adds `bounced`). `classifyBlast(impact, base, radiusScale)` widens the blast for confetti. `scaleDamage(base, ammo)` scales and rounds damage. An unknown id counts as standard.

## The hit moment
A hit gets a burst (`playHitBurst`: a flash, an expanding ring, 14 flying bits and a puff, fire for Team Past and cyan and white for Team Future, gone in under 0.9 s) on top of the explosion, a floating "-N" pip over the base that was hit, and a pop on that base's health number. A near miss also knocks the defender down: a hop, a spin, a bounce, then lying still with 3 circling stars until the next turn, when the fighter stands back up. The fall style (face-plant or backward flop) comes from the match seed (`fallVariantFor`). The wipeout line comes from `tumblePool(team)` in `src/data/copy.ts`: shared lines plus that team's own. All numbers are in `HIT_FX` in `src/game/config.ts`. The plans are pure and tested (`src/scenes/battle/hitFx.ts`, `tumble.ts`). One flash limiter (`flashAllowed`) keeps every screen flash under 3 a second. With reduced motion on: a short fade, the final fallen pose, the bubble and the pip, with no flying or spinning.

## Computer player (one child plays alone)
Off by default (`PRACTICE_BOT.enabled` in `src/game/config.ts`). `?computer=1` on the address turns the choice on for testing before the panel review (`practiceEnabled` in `src/game/practice.ts`, read once in `createServices` into `AppServices.computerPlayer`). With it off, Setup, the Camp and the battle are unchanged, and a saved choice is ignored.
- **Rules (pure, `src/game/`):** `bot.ts` picks the shot and the reload answer. `practice.ts` decides who the computer is (`withComputer`, `computerTeamOf`, `practiceRun`), whose turn is the computer's (`isComputerTurn`), who sees the pass screen (`needsPassScreen`: nobody when one child plays alone) and the pacing (`aimDurationMs`, `aimSteps`, `reloadWaitMs`). Pace numbers are in `PRACTICE_BOT.pace`.
- **Setup:** `showSetup(..., { computer: true })` adds the Play with row and the Computer player card (`src/ui/computerPlayer.ts`, styles in `src/styles/computer.css`). The child is always Team Past and the Computer player is Team Future. It copies the child's grade and subject. The choice is saved in `timeclash.practice`.
- **Hand-off:** `buildBattleData` gives `BattleSceneData.practice = { team, level, effects? }` only when the flag is on, the saved choice is `computer` and one saved player is named "Computer player". Names are 12 letters at most, so no child can match it.
- **Battle (`src/scenes/battle/flow.ts`):** on the computer's turn there is no pass screen, the dial and meter move by themselves (`computerAims`) while `overlay.showThinking` shows "Computer player is aiming", Fire stays off, and the shot flies through the same `launch` path as a child's. The reload (`computerReload`) shows "Computer player is thinking" and never a question card, choice or answer. It uses its own random stream (`RNG_SALT.computer`) and leaves the child's question history and level nudges alone. A wrong answer still reloads (Gate 2). Thinking time stays under `turnBudgetMs` (8 s) per computer turn.
- **Label:** the HUD cards, turn strip (`computerTurnBanner`), setup card and Victory all show `PRACTICE_BOT.displayName`.

## Key data shapes
```ts
type Team = 'PAST' | 'FUTURE';
type Player = { name: string; team: Team; grade: number /* 0 = K */; subject: 'reading' | 'math' | 'both' };
type AimInput = { angleDeg: number; power: number }; // angle 0 to 90, power 0 to 100
type Shot = AimInput & { team: Team; wind: number; turnNumber: number }; // one fired shot, replayable
type Match = { players: [Player, Player]; baseHp: Record<Team, number>; scrap: Record<Team, number>; turn: number; wind: number };
```
The full contract (every type, function signature, and rule) is in [src/game/types.ts](./src/game/types.ts). See [docs/CONTRACTS.md](./docs/CONTRACTS.md) for the reasons behind each choice.

Question and intro shapes are in [docs/BUILD.md](./docs/BUILD.md) and [docs/NARRATION.md](./docs/NARRATION.md).

## Determinism
Wind, question order, and speech bubble choice use a seeded RNG (`src/game/rng.ts`). Physics uses a fixed 1/60 s step. The same seed and inputs give the same match.

## Storage keys (localStorage)
`timeclash.players`, `timeclash.introSeen`, `timeclash.settings` (mute, volume, captions, music, reduced motion), `timeclash.history` (questions used, plus a short list of missed questions to ask again), `timeclash.camp` (one wallet per player name: Scrap in hand, lifetime Scrap earned, and the weapons and upgrades they own for each side, plus the seed of the last match whose Scrap was added). Names match without caring about capitals or extra spaces. A plan for signed-in players and a SQLite database is in [docs/ACCOUNTS_PLAN.md](./docs/ACCOUNTS_PLAN.md)., `timeclash.levels` (a quiet level nudge per player name and subject: an offset from -2 to +2 and the last few answers, at most 50 names; after each 5 answers, 4 or more right moves up one step, 2 or fewer moves down one; never shown to a child), `timeclash.practice` (Play with: `{ opponent: 'person' | 'computer', level: 'easy' | 'medium' | 'hard' }`; only read while the Computer player choice is on). No personal data beyond first names the family types in. Nothing is sent anywhere.

## Phase 4 (iPad play)
A small Node relay (`ws`) pairs two clients by a 4-letter room code. The server owns turn order and checks every move. Clients send inputs only. See Phase 4 in [docs/BUILD.md](./docs/BUILD.md).

## Hosting
Static files on Cloudflare Pages or GitHub Pages. Build output in `dist/`. `/version.txt` holds the build SHA.
