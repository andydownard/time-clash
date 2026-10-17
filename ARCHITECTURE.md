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
`timeclash.players`, `timeclash.introSeen`, `timeclash.settings` (mute, volume, captions, music, reduced motion), `timeclash.history` (questions used, plus a short list of missed questions to ask again), `timeclash.camp` (one wallet per player name: Scrap in hand, lifetime Scrap earned, and the weapons and upgrades they own for each side, plus the seed of the last match whose Scrap was added). Names match without caring about capitals or extra spaces. A plan for signed-in players and a SQLite database is in [docs/ACCOUNTS_PLAN.md](./docs/ACCOUNTS_PLAN.md). No personal data beyond first names the family types in. Nothing is sent anywhere.

## Phase 4 (iPad play)
A small Node relay (`ws`) pairs two clients by a 4-letter room code. The server owns turn order and checks every move. Clients send inputs only. See Phase 4 in [docs/BUILD.md](./docs/BUILD.md).

## Hosting
Static files on Cloudflare Pages or GitHub Pages. Build output in `dist/`. `/version.txt` holds the build SHA.
