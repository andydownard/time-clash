# ARCHITECTURE

## Shape
A static web app. Phaser draws the game. Plain DOM draws menus, modals, banners, and captions on top. Game rules are pure TypeScript with no Phaser imports.

```
Browser
 ├─ Phaser scenes (draw, animate, play sound)      src/scenes/
 ├─ DOM overlays (modals, banners, captions)        src/ui/
 ├─ Pure game rules (tested)                        src/game/
 ├─ Question bank + picker (tested), topic tags     src/questions/
 ├─ Sound manager (unlock on tap, mute, volume)     src/audio/
 └─ Storage wrapper (localStorage, try/catch)       src/storage/

App server (one Node process on Railway)            app-server/, voice-server/
 ├─ Static files from dist/ + security headers      app-server/static.ts, headers.ts
 └─ GET /v1/clips/:id from db/voice-*.sqlite        voice-server/clips.ts (read-only)
```

## Voice clips (content)
Read-aloud audio for questions and wipeout lines is pre-made offline and stored in SQLite files under `db/` (`voice-k4.sqlite` for grades K to 4). Each clip id is `t:` plus a 64-bit FNV-1a hash of the exact text (`src/audio/clipId.ts`), so the player can look a clip up from the text it would speak. The voice says a reworded form (`src/audio/toSpoken.ts`); captions and ids use the original text. The app server serves them (next section) and the databases are not in the web bundle. Details: `db/README.md`.

## App server and voice clips
`app-server/` is a small Node server (`node:http` only) that serves the built site and the recorded lines on one origin: `GET /v1/clips/:id`, `GET /health`, static files with cache headers, compression and Range support. The exact security headers come from `public/_headers`. The game asks for clips only in a build made with `VITE_VOICE=on` (production and e2e builds). `speak(line)` picks the line's own `audioSrc` file, then a clip (`src/audio/clipPlayer.ts`, id from `src/audio/clipId.ts`), then the browser voice. A clip that fails or takes over 1.5 s falls back at once and is not asked for again that session. The funny knock-down line is also spoken through `speak()` when clips are on. The Phase 4 relay will mount at `/ws` in the same process. Full contract, env, and Railway cutover and rollback: [docs/APP_SERVER.md](./docs/APP_SERVER.md).

## Scene flow
New family: TapToStart → Intro → Loading → Setup → Camp → Battle Plan → Battle → Victory → Rematch or Camp. The Battle Plan is a DOM screen run by the Camp step (`showPlan`, `src/ui/planScreen.ts`). Back returns to the Camp. Lock it in! saves the plan and starts the match.
Returning family (intro seen and players saved): Loading → Camp → Battle → Victory → Rematch or Camp. There is no Tap to Play screen for them. The first tap or key press anywhere unlocks sound (`boot.ts`), so nothing plays before a tap.

Back and exit: Setup has Back (to the Camp, saves nothing) once players are saved. The Forge has Back. In a battle, Pause offers Keep playing and Leave game, which asks "Leave this game?" first (Stay is focused) and then returns to the Camp.

The Camp is home. A returning family (players saved) goes Loading → Camp. A new family goes through Setup first. "Change players" on the Camp opens Setup again. The Camp reads the players Setup saved, so no data passes between the two. "Time to Clash!" starts a fresh seeded match. A Camp with no saved players goes back to Setup.

The Camp hawk is a small 3D solid (`src/ui/hawkModel.ts`: body, head, beak, eyes, two thick wings, tail). Each frame it is turned about its upright axis, painted back to front in flat colors with an outline, so it keeps its volume at every angle. `hawkPose` in `src/ui/flightPhysics.ts` is the pure pose math (position, size, depth, over/behind flag, yaw, wing lift, dim, shadow; tunables in `HAWK_3D` and `HAWK_ORBIT`). The hawk circles in 3D around the title: on the near half it is painted in a second SVG layer placed over the title (`hawkFrontLayer`, larger, with a soft shadow), on the far half in the scene layer under it (smaller, dimmed). It switches layers exactly at the two turns. With reduced motion the scene draws a still three-quarter pose.

## Turn your iPad (landscape only on tablets)
`src/ui/turnScreen.ts` mounts one full-screen dialog (`data-testid="turn-screen"`, z-index 200, above the covers). It shows when the window is taller than wide, the short side is 600px or more, and the main pointer is coarse (a finger). That keeps laptops and tall mouse windows out and leaves phones alone. It listens to `resize` and `orientationchange` only, no timers. While it is up, the rest of the page is `inert`, focus moves to it, and a running battle is paused through the normal Pause button (nothing is lost). Time spent there is added to `awayMs()`, which the default overlay clock subtracts, so a reload question is not timed while the iPad is upright. Booted from `bootApp`. Tests: `tests/ui/turnScreen.test.ts`, `e2e/turn-screen.spec.ts`.

`src/scenes/battle/aimArt.ts` draws one small angle guide (a short arc, a ~108px line, a tiny handle with a 48px invisible grab circle, and the degree number) at the muzzle of the fighter about to fire. The muzzle comes from `firingOrigin(team, unitId, layout)` in `src/game/units.ts`, the same function `match.fire()`, the bot and the dotted preview use, so the guide, the preview and the shot always start at one point. `flow.ts` sends it to the view as `ViewStatus.firingOrigin`, and picking another fighter moves the guide. Dragging the tip sets the angle only (`angleFromDrag` in `geometry.ts`). Power is shown and set only by the bottom-bar slider; there is no power meter on the board. The e2e hook reads the guide through `window.__timeclash.aim()`. The dotted preview comes from `match.previewShot()`, which flies the same shot as `fire()` (fighter range, ammo, walls) and changes nothing. After a shot, `showTrace` leaves the full arc up as faint dots (`traceDots` in `trajectory.ts`). The flow clears it before the pass screen and before the reload question, so no cover ever has it behind it. Wind already shows once in the HUD with arrows and a number, so the arc adds none. Tests: `tests/game/units.test.ts`, `tests/game/previewShot.test.ts`, `tests/scenes/battle/geometry.test.ts`, `tests/scenes/battle/trajectory.test.ts`, `e2e/aim.spec.ts`.

## Base deployment spots (Phase 2)
`src/game/spots.ts` turns a spot id (`skyscraper`, `bridge`, `foodTruck`, or `null`) into a `BattleLayout`. Only Team Future's base, launch origin, and cover move. `null` and unknown ids give the Phase 1 layout. The numbers live in `SPOTS` in `src/game/config.ts`. The Battle Plan picks one (see below).

## Battle Plan, biomes, ammo and evasion (Phase 2, wired in)
- **Battlefield.** `src/game/battlefield.ts` `buildLayout({ biome, spot })` builds the `BattleLayout`: obstacle 0 is the biome's middle shape (`BIOMES` in config; aspen is the Phase 1 hill), then the spot's shapes. The layout carries `biome`, `spot` and `baseShift`. A fighter standing on its base (`ridesBase` in `units.ts`) moves with it, and `firingOrigin` applies the shift, so the shot, the bot and the guide agree. The scene draws the biome backdrop (`src/scenes/battle/biomeArt.ts`) and shifts those fighters.
- **Ammo.** Special kinds are unlocked per player and side on the Battle Plan (`unlockAmmo`, saved as `loadout[team].ammo`). `MatchOptions.ammo` lists the kinds each side owns. The match keeps the loaded kind and the shots left (`selectAmmo`, snapshot `ammo` and `ammoLeft`). Firing a special kind uses one. At 0 it goes back to Standard. Standard changes nothing.
- **Evasion.** `src/game/evasion.ts` is a small cycle per team: ready → armed (this turn) → active (the other team's next turn) → recharging or used. `armEvasion` and `disarmEvasion` work only while aiming and are free. Team Past's Stone Wall adds a wall obstacle (`EVASION.barricade.wall`) for the whole enemy turn, once per match (`currentLayout()`). Team Future's Hoverboard Dodge makes the first damaging hit of the enemy turn miss (`dodged: true`), before the force field, and is ready again 2 own turns after it was armed. Misuse throws (`IllegalTransitionError` out of phase, `EvasionError` when not ready).
- **Screens.** The HUD gear (`src/ui/hudGear.ts`) floats by Fire: an Ammo button (hidden until a kind is owned) and the ability button (`aria-pressed` when armed). With no room it shows icons only. Chrono says a line with a caption when an ability is armed.

## Base builder (Phase 2, behind a switch)
Before a battle a player builds a castle (Team Past) or a base (Team Future) from bricks. The feature is off: `BASE_BUILDER.enabled` in `src/game/config.ts` is `false`. Add `?builder=1` to the address to try it. With it off, the Camp is exactly as before.
- **Rules, no Phaser or DOM:** `src/game/baseBuilder.ts`. A catalog of pieces per team (id, size in cells, hit points, free or locked), a plot of 24 by 12 cells (the bottom row is the foundation), and pure operations that return a new `BuildState`: `placePiece`, `movePiece`, `turnPiece`, `removePiece`, `clearBuild`, `undoBuild`. The only rules: inside the plot, no two bricks share area. Bricks may stand on each other or on nothing. With Snap off a brick sits on a finer grid (`ox`, `oy` in eighths of a cell). Turn is a quarter turn about the middle and slides to the nearest free spot. A drop onto another brick lands on the nearest free spot (`findSpot`).
- **Saving:** three slots per player name and side in `timeclash.bases`, keyed like the wallets (`walletKey`). A base is stored as small tuples `[piece, x, y, ox, oy, rot, hp]`. `repairBase` and `parseBases` clean everything read from storage: a bad brick is dropped, the rest stay.
- **Scrap:** a locked piece is unlocked with `unlockPiece` in `src/game/economy.ts` (same rules as the Forge: no negative Scrap, one purchase per piece). Unlocked ids are kept in the wallet at `loadout[team].pieces`. All numbers live in `BASE_BUILDER`.
- **Weapon spots:** a base has four pads (`B.spots.count`). `BuildState.spots` holds `{ weapon?, x?, y? }` per pad, and `assignWeapon`, `clearSpot` and `moveSpot` return a new state like the brick operations, so Undo covers bricks and weapons together. `resolveSpots(pieces, spots)` works out each pad's place: spread across the built base and resting on the highest brick under it, or a row on the foundation when there are no bricks. The weapon catalog (`SPOT_WEAPONS`, built from `BASE_BUILDER.spotWeapons`) carries a role, damage and hp for the later battle task. A locked weapon is unlocked with `unlockSpotWeapon` (wallet field `mounts`). Saves add an optional `s` array to each slot, so old saves load unchanged.
- **Your own shapes:** `src/game/customShapes.ts` holds the pure shape rules (4 by 4 pad, touching squares, trim, canonical key such as `10/10/11`, quarter turns). A shape is a piece whose id is `own:P:<key>` or `own:F:<key>`, so a saved base carries the whole shape and old saves need no new field. `pieceById` reads these ids, `occupiedRects` gives one box per filled square for collision, and the saved list per player and side is `shapes` (keys) inside `timeclash.bases`, managed by `saveShape`, `deleteShape` and `shapesOf`. Pad words are in `src/data/shapeCopy.ts`.
- **Screen:** `src/ui/baseBuilderScreen.ts` (plain DOM, pointer events, keyboard), pictures (bricks, pads and weapon icons) in `src/ui/baseBuilderArt.ts`, styles in `src/styles/baseBuilder.css`. The Camp shows a Build button and a small picture of the chosen base per side (`campScreen.ts`), and `runCampStep` in `src/scenes/steps.ts` opens the builder and returns to the Camp on Done.
- **Not built yet:** the battle scene does not read the base. See `docs/BUILD.md` for how it will.

## Turn state machine
`PASS_SCREEN → AIMING → SHOT_1 → AIMING → SHOT_2 → RELOAD → NEXT_PLAYER`. A turn has exactly two shots. Illegal moves throw. Tests pin every legal and illegal transition.

## Fighters (rules built, screens not yet)
Each team has five fighters in `src/game/units.ts` (`UNITS`, `unitsOf`, `unitById`, `DEFAULT_UNIT`). Past: A Hot Air Balloon, B Archer, C Cannon Knight, D Catapult, E Spearman. Future: 1 Tank, 2 Helicopter, 3 Missile Bunkers, 4 Saber Robot, 5 Laser Gun Robot. Only one acts at a time. In AIMING the player calls `selectUnit(id)` (free, not a shot). The Match snapshot has `selected` per team, remembered between turns, and each `lastShot` records its `unit`. A fighter sets where the shot starts (`origin`), its range (`speedScale`, times the weapon's) and its damage (`damageScale`, times the weapon's, rounded, never below 1). Mirror pairs (A~2, B~5, C~1, D~3, E~4) share both scales. The defaults C and 1 are the old launchers, so a fresh game plays exactly as before (`tests/game/squadGolden.test.ts`).

Character health (flag `CHARACTER_HEALTH.enabled`, off): every fighter has 3 health in `Match.unitHp`, a team loses when all its fighters are knocked out, and base health is unused for the win. See `docs/GAME_SPEC.md` "Character health".

Built bases in battle (flag `BASE_IN_BATTLE.enabled`, off, needs character health): a team's built bricks and weapon spots take hits, fall, and fire in the match (`src/game/builtBase.ts`). See `docs/GAME_SPEC.md` "Built bases in battle".

Squads S1 (flag `SQUADS.enabled`, off; `MatchOptions.squads` overrides it; ignored with character health or built bases): each side also has a launcher helper (today's fighter and aim, fired with `fire()`) and one dasher helper, in `src/game/crew.ts`. In AIMING a player calls `selectHelper(id)` (free), then either `fire()` or `dash(spot)`. A dash is one whole go: `dash` runs FIRE and SHOT_LANDED itself, so the turn machine is unchanged and the third go, a skipped reload and the Power Shot all behave as before. The Power Shot is always the launcher's. With the flag off the snapshot has no `squads` and the new calls throw `IllegalCommandError('flag_off')`. See `docs/SQUADS_PLAN.md` "S1 as built".

## Ammo (rules; wired in through the Battle Plan, see above)
`src/game/ammo.ts` holds four kinds: standard, confetti explosives, bouncy plasma spheres and heavy iron bowling balls. Standard is free, unlimited and changes nothing (`tests/game/ammo.test.ts` pins that). The other three cost Scrap to unlock (10, 14, 18) and have 3, 3 and 2 uses per match. `simulateShot({ ..., ammo })` applies speed and wind scales and the plasma bounce (once, off the ground only; the result adds `bounced`). `classifyBlast(impact, base, radiusScale)` widens the blast for confetti. `scaleDamage(base, ammo)` scales and rounds damage. An unknown id counts as standard.

## The hit moment
A hit gets a burst (`playHitBurst`: a flash, an expanding ring, 14 flying bits and a puff, fire for Team Past and cyan and white for Team Future, gone in under 0.9 s) on top of the explosion, a floating "-N" pip over the base that was hit, and a pop on that base's health number. A near miss also knocks the defender down: a hop, a spin, a bounce, then lying still with 3 circling stars until the next turn, when the fighter stands back up. The fall style (face-plant or backward flop) comes from the match seed (`fallVariantFor`). The wipeout line comes from `tumblePool(team)` in `src/data/copy.ts`: shared lines plus that team's own. All numbers are in `HIT_FX` in `src/game/config.ts`. The plans are pure and tested (`src/scenes/battle/hitFx.ts`, `tumble.ts`). One flash limiter (`flashAllowed`) keeps every screen flash under 3 a second. With reduced motion on: a short fade, the final fallen pose, the bubble and the pip, with no flying or spinning.

## Computer player (one child plays alone)
Off by default (`PRACTICE_BOT.enabled` in `src/game/config.ts`). `?computer=1` on the address turns the choice on for testing before the panel review (`practiceEnabled` in `src/game/practice.ts`, read once in `createServices` into `AppServices.computerPlayer`). With it off, Setup, the Camp and the battle are unchanged, and a saved choice is ignored.
- **Rules (pure, `src/game/`):** `bot.ts` picks the shot and the reload answer. `practice.ts` decides who the computer is (`withComputer`, `computerTeamOf`, `practiceRun`), whose turn is the computer's (`isComputerTurn`), who sees the pass screen (`needsPassScreen`: nobody when one child plays alone) and the pacing (`aimDurationMs`, `aimSteps`, `reloadWaitMs`). Pace numbers are in `PRACTICE_BOT.pace`.
- **Walls and obstacles:** the search flies its test shots on the field it is given (so the biome's middle shape is always counted) plus the Stone Wall while `state.evasion` shows Team Past's barricade as active (`wallsInView`). Only public state is read. The aim error and wind skill still apply on top, so easy and medium miss often. `botPlay.ts` can raise the wall (`raiseWall`) and take a `layout` for the 240-match simulation in `tests/game/botWall.test.ts`.
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
`timeclash.players`, `timeclash.introSeen`, `timeclash.settings` (mute, volume, captions, music, reduced motion), `timeclash.history` (questions used, plus a short list of missed questions to ask again), `timeclash.camp` (one wallet per player name: Scrap in hand, lifetime Scrap earned, and the weapons and upgrades they own for each side, plus the seed of the last match whose Scrap was added). Names match without caring about capitals or extra spaces. A plan for signed-in players and a SQLite database is in [docs/ACCOUNTS_PLAN.md](./docs/ACCOUNTS_PLAN.md)., `timeclash.bases` (up to three saved bases per player name and side, each a short list of bricks, plus which slot is chosen; at most 50 names; cleaned on every read), `timeclash.plan` (the last Battle Plan: biome and base spot; bad data falls back to Aspen Forest and Food Trucks), `timeclash.levels` (a quiet level nudge per player name and subject: an offset from -2 to +2 and the last few answers, at most 50 names; after each 5 answers, 4 or more right moves up one step, 2 or fewer moves down one; never shown to a child)., `timeclash.practice` (Play with: `{ opponent: 'person' | 'computer', level: 'easy' | 'medium' | 'hard' }`; only read while the Computer player choice is on). No personal data beyond first names the family types in. Nothing is sent anywhere.

## Phase 4 (iPad play)
A small Node relay (`ws`) pairs two clients by a 4-letter room code. The server owns turn order and checks every move. Clients send inputs only. See Phase 4 in [docs/BUILD.md](./docs/BUILD.md).

## Hosting
One Node app server on Railway (`npm start`, health check `/health`) serves `dist/` and the clips. `railway.json` pins the start command. Build output in `dist/`, compiled server in `dist-server/`. `/version.txt` holds the build SHA.
