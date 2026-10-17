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

## Turn state machine
`PASS_SCREEN → AIMING → SHOT_1 → AIMING → SHOT_2 → RELOAD → NEXT_PLAYER`. A turn has exactly two shots. Illegal moves throw. Tests pin every legal and illegal transition.

## Fighters (rules built, screens not yet)
Each team has five fighters in `src/game/units.ts` (`UNITS`, `unitsOf`, `unitById`, `DEFAULT_UNIT`). Past: A Hot Air Balloon, B Archer, C Cannon Knight, D Catapult, E Spearman. Future: 1 Tank, 2 Helicopter, 3 Missile Bunkers, 4 Saber Robot, 5 Laser Gun Robot. Only one acts at a time. In AIMING the player calls `selectUnit(id)` (free, not a shot). The Match snapshot has `selected` per team, remembered between turns, and each `lastShot` records its `unit`. A fighter sets where the shot starts (`origin`), its range (`speedScale`, times the weapon's) and its damage (`damageScale`, times the weapon's, rounded, never below 1). Mirror pairs (A~2, B~5, C~1, D~3, E~4) share both scales. The defaults C and 1 are the old launchers, so a fresh game plays exactly as before (`tests/game/squadGolden.test.ts`).

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
`timeclash.players`, `timeclash.introSeen`, `timeclash.settings` (mute, volume, captions, music, reduced motion), `timeclash.history` (questions used, plus a short list of missed questions to ask again), `timeclash.camp` (one wallet per player name: Scrap in hand, lifetime Scrap earned, and the weapons and upgrades they own for each side, plus the seed of the last match whose Scrap was added). Names match without caring about capitals or extra spaces. A plan for signed-in players and a SQLite database is in [docs/ACCOUNTS_PLAN.md](./docs/ACCOUNTS_PLAN.md)., `timeclash.levels` (a quiet level nudge per player name and subject: an offset from -2 to +2 and the last few answers, at most 50 names; after each 5 answers, 4 or more right moves up one step, 2 or fewer moves down one; never shown to a child). No personal data beyond first names the family types in. Nothing is sent anywhere.

## Phase 4 (iPad play)
A small Node relay (`ws`) pairs two clients by a 4-letter room code. The server owns turn order and checks every move. Clients send inputs only. See Phase 4 in [docs/BUILD.md](./docs/BUILD.md).

## Hosting
Static files on Cloudflare Pages or GitHub Pages. Build output in `dist/`. `/version.txt` holds the build SHA.
