# Contracts (Phase 1)

The shared shapes three agents build against. Types live in `src/**/types.ts`, numbers in `src/game/config.ts`, words in `src/data/copy.ts`. Change a contract here and in the types file in the same PR. Each implementer writes `export const name: TypeName = ...` so the compiler holds them to the signature.

## Who owns what
| Track | Owns |
|---|---|
| Architect | `src/**/types.ts`, `src/game/config.ts`, `src/data/copy.ts`, this file, `tests/contracts/` |
| A: rules | `src/game/*.ts` (not types or config), `tests/game/` |
| B: questions | `src/questions/*` (not types), `scripts/check-questions.ts`, `tests/questions/` |
| C: UI, audio, storage, intro | `src/ui/*`, `src/audio/*`, `src/storage/*`, `src/data/introScript.ts`, their tests |
| Scenes (later) | `src/scenes/*`, `src/main.ts` |

## Function table
| File | Export | Type | Notes |
|---|---|---|---|
| `game/rng.ts` | `createRng` | `CreateRng` | mulberry32. `int` inclusive. `pick` throws on empty. `shuffle` copies. |
| `game/ballistics.ts` | `simulateShot`, `clampAim` | `SimulateShot`, `ClampAim` | Semi-implicit Euler at 1/60 s. Wind adds to x velocity, gravity to y. |
| `game/wind.ts` | `windForTurn` | `WindForTurn` | Integer in -80..80 from `createRng(seed ^ RNG_SALT.wind ^ turn)`-style mixing. |
| `game/turn.ts` | `createTurn`, `transition` | `CreateTurn`, `Transition` | Throws `IllegalTransitionError` (in `game/types.ts`). |
| `game/damage.ts` | `classifyBlast`, `blastDamage`, `applyBlast`, `isWipeout`, `winnerOf` | same names, PascalCase | Distance to nearest point of the base rect. |
| `game/damage.ts` (character health) | `freshUnitHp`, `aliveUnitIds`, `teamKnockedOut`, `winnerOfUnits`, `winnerOfMatch`, `unitDamage`, `resolveUnitBlast`, `pathGap` | `UnitHp`, `UnitBlast` | Only used when `MatchOptions.characterHealth` is true (flag `CHARACTER_HEALTH.enabled`, off). See GAME_SPEC "Character health". |
| `game/reload.ts` | `scoreReload` | `ScoreReload` | 2 / 1 / 0 scrap. Never throws. |
| `game/names.ts` | `validateName` | `ValidateName` | Trim, 1..12 chars, small local blocklist. |
| `game/builtBase.ts` (built bases in battle) | `createBuilt`, `chosenBaseFor`, `battleBasesFor`, `fitFrame`, `plotFrame`, `boxToWorld`, `pointToWorld`, `healthPlan`, `splitHealth`, `builtHealth`, `nearestBrick`, `frontBrick`, `repairBricks`, `cutAtWalls`, `hitWall`, `settle`, `wallDamage`, `mountAim`, `volleyAngles`, `guardFor`, `flightLayout` | `Built`, `BuiltTeam`, `Wall`, `PlotFrame`, `BaseHealthBuild` | Used when `MatchOptions.baseInBattle` is true (flag `BASE_IN_BATTLE.enabled`, on). With `characterHealth` off the bricks are the base health. Additive fields: `BrickView.rot`, `BrickView.grounded`, `SpotView.brick`, a bonk's `built`. See GAME_SPEC "Built bases with base health". |
| `game/match.ts` | `createMatch` | `CreateMatch` | Returns a `MatchController`. No Phaser. The snapshot also has `characterHealth: boolean`, `unitHp: Record<UnitId, number>`, `maxUnitHp: number`, `aliveCount: Record<Team, number>`. `baseHp` stays, unused for the win when `characterHealth` is true. `shotLanded()` adds optional `units: UnitOutcome[]` and `knockedOut: UnitId[]` in that mode. With `baseInBattle` the snapshot also has optional `baseInBattle: boolean`, `selectedMount: Record<Team, MountId | null>`, `bricks: Record<BrickId, BrickView>` (`{team, piece, hp, maxHp, box, alive}`), `mounts: Record<Team, MountView[]>`, `spots: Record<Team, SpotView[]>`, `builtBase: Record<Team, boolean>`; `fire()` results add optional `stoppedBy: {kind: 'brick'|'mount', id}` and `volley: ShotResult[]`; `shotLanded()` adds optional `built: BuiltEvents` (`brickHits`, `brickFell`, `bricksFell`, `mountHits`, `mountDown`, `guardBlocked`). `selectUnit` takes a `ShooterId` (`UnitId | 'mount:0'..'mount:3'`); `Shot.mount` and `BotShot.mount` name a mounted weapon. `MountView` has `name` and `art` (the catalog picture; a Workshop weapon's style), and `SpotView` has optional `art`. In base health mode mounts exist too (docs/GAME_SPEC.md "Weapons on the pads"). `HudState` adds optional `mounts: HudMount[]` (`{id, spot, name, art, mine}`) and `selectedMount`; `HudHandlers.onSelect` takes a `ShooterId`; `BattleView` adds optional `setSelectedMount(team, id | null)` and `flashPad(team, spot)`. |
| `questions/pick.ts` | `pickQuestion`, `isCorrect` | `PickQuestion`, `IsCorrect` | Rules in the `PickQuestion` doc comment. |
| `questions/validate.ts` | `validateQuestion`, `recomputeMathAnswer` | same | Used by `npm run check:questions`. |
| `questions/bank/index.ts` | `BANK` | `QuestionBank` | Static JSON imports. |
| `storage/storage.ts` | `createStorage`, `loadSettings` | `CreateStorage`, `LoadSettings` | Never throws. Memory fallback. |
| `audio/audioManager.ts` | `createAudioManager` | `CreateAudioManager` | SFX synthesized with WebAudio. |
| `ui/overlay.ts` | `createOverlay` | `CreateOverlay` | DOM only. |
| `data/introScript.ts` | `INTRO_SCRIPT` | `IntroScript` | 5 cards from NARRATION.md. |

## Turn flow
```
PASS_SCREEN --READY--> AIMING(0) --FIRE--> SHOT_1 --SHOT_LANDED--> AIMING(1)
  --FIRE--> SHOT_2 --SHOT_LANDED--> RELOAD --RELOAD_DONE--> NEXT_PLAYER
  --PASS--> PASS_SCREEN (other team, turnNumber + 1)
```
Any other pair throws. Battle scene loop: `pass screen → ready() → (start-of-turn bonks) → banner → setAim → Fire tap → wind-up (playCharge) → fire() → animate path → shotLanded() → (tumble, bubble) → ... → pickQuestion → showReloadModal → reloadDone() → pass()`. The shot is not taken until the wind-up ends, so leaving the game during it fires nothing.

With Squads on (the default) a turn is 2 goes. `FIRE` means "a go starts" and `SHOT_LANDED` means "the go is done". A go is `fire()` then `shotLanded()`, or one `dash(spot)` or `recall()` call, which runs both steps itself. `selectHelper(id)` picks the launcher or the dasher for free in AIMING. `helperTargets()` lists the one spot the picked dasher walks out to. `ready()` returns `StandBonk[]`: what each out dasher did at the start of the turn (walk on, then bonk the enemy base or the enemy dasher next to him).

## Decisions
1. **`shotsFired` (0, 1, 2) tells the two AIMING states apart.** Keeps the six state names from BUILD.md exactly, with no extra states.
2. **SHOT_1 and SHOT_2 mean "ball in the air."** `fire()` computes the whole flight up front; `shotLanded()` applies damage after the animation. Rules stay pure and the scene owns timing.
3. **y grows down, origin top-left, angle 0 is flat toward the opponent, 90 is straight up.** Same as Phaser, so there is no axis flip to get wrong.
4. **World is 1280x720 logical.** 16:9 fits laptop and iPad landscape with letterbox. `src/main.ts` uses `WORLD` (plus `BATTLE_BAND` for the bottom control band).
5. **Wind is an integer, fixed for both shots of a turn, from `(seed, turnNumber)`.** Easy to show as a number and to replay.
6. **`Shot` stores `wind` and `turnNumber` instead of a `seed`.** That is all a replay needs; ARCHITECTURE.md's `seed` field is replaced.
7. **No self damage. Blasts score only against the opponent's base.** A weak shot at your own feet should not cost a six-year-old health.
8. **Tumble on 'near' only. 'direct' shows the toy-block wall effect.** Matches BUILD.md item 9.
9. **Bubble line picked by a seeded shuffle bag.** Every one of the 12 lines shows before any repeats, and the same line never shows twice in a row, even when the bag refills (`src/game/bag.ts`).
10. **Wrong answer: 0 scrap, still reloads. Right and under the fast limit: 2. Right and slow: 1.** Scrap rewards learning; the reload is never withheld (Gate 2). The fast limit is 8 s for a math fact, 10 s for a choice question, 12 s for vocab and grammar, 20 s for a main idea passage, plus 4 s in grades K and 1 (`RELOAD.fastMsByKind`, `fastWindowMs` in `src/game/reload.ts`). Scrap never depends on grade beyond that limit.
11. **Bad `elapsedMs` counts as slow, never throws.** A clock glitch must never stop play.
12. **A match won on shot 1 ends right there.** No reload after the final hit; status goes to OVER.
13. **Team Past starts match 1; each rematch flips the starter and uses seed + 1.** Fair for siblings, still repeatable.
14. **Match does not pick questions.** The Battle scene calls `pickQuestion` with `createRng(seed ^ RNG_SALT.questions)`. Keeps `src/game` and `src/questions` independent.
15. **'both' alternates reading then math per team.** Predictable for parents; no extra state beyond `lastSubject`.
16. **Nearest-grade fallback breaks ties toward the easier grade.** Kinder for a child between levels.
17. **Exactly 4 choices per question, shown as 4 buttons in Phase 1.** One layout to build and test; a number pad can come later.
18. **Pass screen and reload modal are opaque full-viewport DOM covers.** The canvas also goes `visibility: hidden` and `inert`, and question DOM exists only while the modal is open. Two layers of hiding for risk 3.
19. **All buttons and text are DOM, Phaser draws only the world.** Real buttons give keyboard, focus, screen reader, and 56px targets for free.
20. **SFX are synthesized with WebAudio.** Original by construction; nothing to license or download.
21. **Audio before unlock is silent but captions still run.** One code path, and captions never depend on sound.
22. **Storage `get` returns null on any problem; `set` keeps a memory copy.** The game works in private mode.
24. **After an answer the reload card waits for Got it.** A wrong answer shows the right answer, Chrono's line, and the hint as a clue, and stays up until the player taps Got it (or 20 s pass, `RELOAD.wrongAnswerMaxMs`, so play is never blocked). A right answer closes after 1.2 s, or sooner with Got it. Got it ignores taps for 0.4 s so a stray key cannot skip the clue. The missed question comes back once, after 3 more picks (`noteMissed` in `src/questions/pick.ts`), with no penalty.
25. **Question cards are read by the player. There is no Hear it and no listen-only item** (owner decision, 2026-10-23: "all grades must read"; this replaces the earlier read-aloud decision). The pass screen and the question card each have a Sound on/off button.
26. **The corner ? and gear buttons are one fixed row, and the HUD leaves room for it.** The HUD has no ? button of its own. The turn banner sits below the HUD cards. The aim controls sit between the two bases.
23. **Victory has "Back to Start", not "Main Menu".** "Menu" is on the never-say list.
27. **Ammo and evasion are free actions while aiming, like picking a fighter.** `selectAmmo`, `armEvasion` and `disarmEvasion` work only in AIMING or BONUS_AIMING and never count as a go, so a turn is still exactly 2 goes, then the reload. Out of phase they throw `IllegalTransitionError`. A kind the team does not own throws `RangeError`. An ability that is not ready throws `EvasionError` with a reason.
28. **An ability guards the other team's next turn, not the turn it was armed.** The match flips armed to active in `pass()`, and ends the guard when the owner's next turn starts. `currentLayout()` is the field with any standing wall. The preview and the shot both use it.
29. **Pace: health is big, damage is unchanged.** A base starts with 400 health and a fighter with 4 (owner, 2026-10-24), so perfect aim needs five turns of its own to win. Hit damage stays 25, 10 and 1.5 times, so weapons, ammo and damage upgrades keep their meaning. `tests/game/pace.test.ts` pins it.
30. **A dasher walks out as one go and bonks at the start of every turn, both teams' turns.** He stops next to the first enemy thing in front (the enemy dasher, or the enemy base from his attack spot). His bonk on a base is `SQUADS.standBonkDamage`, less the gate cut (`nearCut`, never below 1), and a Hoverboard Dodge or a force field stops it like a shot. Two dashers side by side bonk each other at once (`SQUADS.duelBonkHp`). Only enemy shells hurt him (`CHARACTER_HEALTH.directHit`, `powerHit` for the Power Shot, 0 for a near miss). At 0 he rests one full own turn. `recall()` rests him until his team's next turn. Errors are `IllegalCommandError` with `not_your_helper`, `wrong_command`, `out_of_range`, `no_free_spot`, `already_out`, `resting`, `not_out` or `flag_off`.

## Copy rules
All UI text comes from `src/data/copy.ts`. `tests/contracts/copy.test.ts` checks the banned list and the never-say column of the vocabulary table, by whole word and (for the worst words) inside other words.
