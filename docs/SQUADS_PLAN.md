# Phase 5: Squads (plan)

Status: S1 is built and ON for everyone (`SQUADS.enabled`, owner decision 2026-10-24): the walking helper, Sir Bonk and Robo Bonk. S2 and later are plan only. Items marked **Andy's call** need his explicit OK before code starts. Squads comes **after** the Look and Feel phase, which is the next phase Andy asked for. Its art uses that new look.

> **Update 2026-10-17.** Andy's canvas comments and chat now answer some open questions below. See [DESIGN_GUIDANCE.md](./DESIGN_GUIDANCE.md). In short: five units at most per side (A to E, 1 to 5), not four. One unit acts at a time (rule 2 stands). A right answer should earn an extra turn with more powerful damage (a change to the protected turn shape, to be sized before any code). This plan has not been rewritten yet. Until it is, treat the crew tables in section 3 as out of date.

> **Built so far.** Five fighters per side with per-fighter origin, range and damage scales, `selectUnit`, a "Pick one" selector, and `selected` in the match snapshot (see the Fighters section of [ARCHITECTURE.md](../ARCHITECTURE.md)). S1 (a walking helper per side) is in and on (next section). Fly and the rest of the crew are not.

Read with: [AGENTS.md](../AGENTS.md), [GAME_SPEC.md](./GAME_SPEC.md), [BUILD.md](./BUILD.md), [CONTRACTS.md](./CONTRACTS.md).

## S1 as built (on)

S1 is on for everyone (`SQUADS.enabled = true`, owner decision 2026-10-24). Rules: `src/game/crew.ts`, wired into `src/game/match.ts`. Screen: `src/ui/squadBar.ts`, one hook each in `src/ui/hudView.ts` and `src/scenes/battle/flow.ts`, and the battlefield art in `src/scenes/battle/dasherArt.ts` (pure shapes and timelines) and `src/scenes/battle/dasherLayer.ts` (Phaser). Tests: `tests/game/crew.test.ts`, `tests/game/crewMatch.test.ts`, `tests/game/squadWalk.test.ts`, `tests/game/squadPace.test.ts`, `tests/game/squadGolden.test.ts`, `tests/ui/squadBar.test.ts`, `tests/scenes/battle/flowSquads.test.ts`, `tests/scenes/battle/flowDasher.test.ts`, `tests/scenes/battle/dasherArt.test.ts`, `e2e/squads.spec.ts`.

**The rules in plain words.** Each side has a launcher (the fighter that shoots) and one walking helper, the dasher: Sir Bonk for Team Past (pink foam mallet) and Robo Bonk for Team Future (glow noodle). A turn is 2 goes, then the reload question.
- **Walk out (one go).** He walks along the ground from his base, over the hill, mound, pillar, tower or wall. The walk is a ground line that ignores obstacle shapes; he is only drawn in front of them. He stops next to the first enemy thing in front: the enemy dasher, or the enemy base. He bonks nothing on arrival.
- **He stays and keeps bonking.** At the start of every turn, both teams' turns, every dasher out on the field walks on if nothing is next to him, then bonks. A dasher at his attack spot bonks the enemy base for `standBonkDamage` (12). The gate cut (`nearCut`, never below 1), a Hoverboard Dodge and a force field all stop it like a shot. Two dashers side by side bonk each other at once for `duelBonkHp` (1 health each) and leave the bases alone. A bonk can win the match.
- **Health.** A dasher has fighter health (`CHARACTER_HEALTH.hp`), drawn as a heart and pips above him. Only enemy shells hurt him: a direct hit near him costs `directHit` (1), a Power Shot `powerHit` (2), a near miss nothing (he wobbles). The hit box is the fighter box (`CHARACTER_HEALTH.box`) at his spot. At 0 he tumbles (silly fall, puff, a line from the wipeout bag, a caption), walks home dizzy, and sits out one full own turn of his team. Nobody is hurt.
- **Come back (one go).** While he is out, Come back replaces Walk out. He walks home and is ready again on his team's next turn.
- **Character health and built bases.** Squads stays off with either flag, as before.

Choices made where the owner's words left room (the simplest option each time). Andy can overrule any of them.
1. **Launcher is today's shot.** The launcher helper is the existing fighter and aim. Past calls it Cannon Crew, Future calls it Rocket Button, for now only as a name. The five-fighter selector is unchanged.
2. **A dash and a recall are one call each.** `dash(spot)` and `recall()` do the work of `fire()` and `shotLanded()`, so the turn machine and its tests do not change. `ready()` returns the start-of-turn bonks.
3. **Five ground spots g0 to g4.** g0 is Team Past's doorstep and g4 is Team Future's. Only a side's own dasher may stand on its doorstep (to guard it). The attack spot is the one just before the enemy doorstep (g3 for Past, g1 for Future). The doorstep and attack spot sit `spotInset` px from each base's inner edge, on the ground line, whatever the place or base spot.
4. **Where he stops.** The last free spot before the first enemy dasher, or the attack spot when the way is clear. So a dasher who walks out against an attacker guards his own doorstep, and the two bonk each other. If the very first spot holds an enemy (play never makes this board), the walk is refused (`no_free_spot`). There is always exactly one target, so the spot list shows one Walk out! button.
5. **Who bonks first.** The team whose turn starts is listed first. Base bonks are applied in that order, so both bases can never reach 0 at once.
6. **Bonk damage.** `standBonkDamage` is 12: about 12 percent of a perfect-aim turn at the new base health of 400 (owner pace decision). At today's 100 it is still one bonk in eight of a base. The gate upgrade (`nearCut`) cuts it because the bonk lands at the gate.
7. **Rest.** A dasher who tumbles at the start of his own turn (a bonk from the dasher beside him) sits that whole turn out and is ready on his team's next turn. One who tumbles during the enemy's turn sits out his team's next turn and is ready on the one after. Either way he misses one full own turn. A recalled dasher is ready on his team's next turn.
8. **No Power Shot dash.** The Power Shot is the launcher's. A right answer resets the pick to the launcher. Walk out and Come back only work in AIMING.
9. **Stats and awards.** A dash, a recall and a bonk add nothing to `shotsFired`, `directHits` or `nearHits`.
10. **Keyboard.** Tab to a helper or a button, Enter or Space to press it. Space does not fire while the dasher is picked. No letter keys, since A to E already pick fighters.
11. **Where the controls sit.** The helper row (the two helpers and a speaker button for Hear it) floats in the band under the ground line, between the two base health tags, where the coach line sat (the first-go hint replaces the coach line). "GO 1 OF 2" and two dots sit in the turn strip in place of its shot circles. While the dasher is picked, the dasher panel (Walk out!, Come back or "Resting. Back soon.", and Back) takes the aim panel's place. So the control bar keeps its two rows and never reaches over the fighters. In portrait the helper row takes its own line.
12. **Back and Hear it.** Both 56px. Hear it is always there; Chrono says the picked helper's name and what it does, with a caption. It only speaks on a tap, asks for no network clip, and costs no go. Back shows while the dasher is picked and returns to the launcher. Escape and H are not wired (Escape pauses the game, see Regressions row 4).
13. **First-go hint.** A drawn finger and the words "Press Fire! Or pick a helper and tap Walk out!" show on each side's first go of a match, never for the Computer player. Chrono says the line once, with the same words as a caption. Per match, not per family.
14. **Art and sound.** Sir Bonk and Robo Bonk are drawn in code (original). Walking has a step cycle and a small bounce; a bonk winds up, swings, lunges a little, and shows "Bonk!" and a puff; a tumble flops over with a puff, then a dizzy, swaying walk home with stars. Reduced motion: he fades out and appears at the new spot, nothing spins or lunges. Spot markers are flat rings on the ground; the spot he would walk to gets a thick ring and an arrow (not color alone). Two sounds are made in code with WebAudio: `step` and `bonk`, only after a tap and never when muted.
15. **The Computer player** leaves its dasher home and plays as before. A bot match still ends (`tests/game/squadWalk.test.ts`).
16. **Pace.** Perfect-aim bots that keep their dashers out every turn still need at least 9 turns in all at base health 400, and a dasher saves at most one own turn (`tests/game/squadPace.test.ts`).
17. **E2E switch.** With `?e2e=1` (never in a production build) `window.__timeclash.setSquads(false)` turns Squads off for matches started after it; `null` goes back to the config default (on). `window.__timeclash.dashers()` says where each dasher is drawn and what he is doing.
18. **Still open:** a per-family first-match hint, Escape and H keys, re-recording intro cards 3 and 4 with "2 goes" (docs/NARRATION.md), and the copy lint words from section 7 (the Camp's "Forge Weapon" still uses "weapon").

## 1. Goal and the "super simple" rules

Each side gets a small, fixed crew of silly helpers instead of one cannon. The castle has a chariot full of archers and an old-time hot air balloon. The future base has a rocket button, a laser zapper, a tank button, and a flying space plane. A six-year-old should understand it from one look at the screen.

The rules:

1. **Tap a helper, then tap where or press go.** Two taps is one action. No menus.
2. **One helper acts at a time.** Nothing happens in parallel.
3. **A fixed crew of 4 per side.** No roster, no pick screen, no unlocks. Everyone gets the same crew every match.
4. **Nothing moves on its own.** No AI, no timers, no drifting. A helper moves only when its player says so, or when a bonk sends it home.
5. **One command per helper, three command shapes in all.** Fire, Dash, Fly. Kids learn three icons, not four verbs.
6. **Helpers have no health.** They tumble, dust off, and walk home. Only base health (`baseHp`) decides the match.

### Why 4, and why fixed

Andy said 3, then 4, then 5 in one breath. Four per side covers what he named and keeps the screen calm. That is 8 helpers and 2 bases, and each stays a big tap target on an iPad. Five or more brings back the clutter he wants gone. A roster, pick screen, and unlocks are a whole new Camp surface, so they move to the backlog (P3).

**Andy's call:** confirm a fixed crew of 4 per side (Open question 1).

## 2. How it fits the turn shape

Today a turn is 2 shots, then a reload question. AGENTS.md protects that shape. The plan keeps it and only widens what a "shot" is.

**Recommended: "2 goes, then reload."**

- A turn is still exactly 2 goes, then the reload question.
- One go = tap a helper, then give it its one command.
- The same helper may go twice in a turn. So today's game (one cannon, two shots) is just a crew of one. Nothing about Phase 1 breaks.
- After go 2, the reload question comes up exactly as now. The board is covered. Question count, timing, and difficulty do not change. Scrap rules do not change.
- **No "empty" badge.** Since a helper may go twice, a used badge would teach nothing. Helpers have no used state at all.
- **A wrong answer still ends the turn normally and the next turn starts with the full crew (Gate 2).** No helper, crew choice, or command ever changes question count, timing, or difficulty, and no path skips the question. Pinned by tests in S1.
- A fast answer still earns bonus scrap. A slow correct answer loses nothing.

The turn state machine in `src/game/turn.ts` does not change. Its phases keep their names. `FIRE` means "a go starts." `SHOT_LANDED` means "the go is done." The banner changes from "SHOT 1 OF 2" to "GO 1 OF 2," always paired with two big dots (one filled) so a pre-reader can count.

Options considered and not recommended:

- **Each helper goes once per reload.** Makes the badge real, but forces kids to use helpers they do not want and breaks the crew-of-one match.
- **Moving is free, only attacks count.** A second kind of action and a rule to explain. Kids would shuffle helpers forever.

**Andy's call:** approve "2 goes, then reload" (Open question 2). This changes a protected rule, so it needs his explicit yes. **No protected-rule text changes until he says yes.**

### Doc lines to update in the S1 PR (only after Andy's yes)

| File | Line today | Change |
|---|---|---|
| `AGENTS.md` "What this is" | "Each turn has 2 shots. After shot 2, ..." | "Each turn has 2 goes. After go 2, ..." |
| `AGENTS.md` Refactoring constraints | "the 2-shots-then-reload turn shape" | "the 2-goes-then-reload turn shape" |
| `AGENTS.md` Pattern detection 4 | "a third shot" | "a third go" |
| `AGENTS.md` Vocabulary | none | Add rows: Crew / `squad` / army, troops. Helper / `unit` / soldier. Rocket / `rocketButton` / missile. Go / `action` / shot (in banners). |
| `AGENTS.md` Current state | | Note Squads behind `SQUADS.enabled`. |
| `docs/GAME_SPEC.md` lines 28, 93, 94, 106, 160 | "2 Shots", "2 shots per turn", "after shot 2", "2-shot limit", "(SHOT 1 OF 2)" | "2 goes" wording and "GO 1 OF 2". |
| `ARCHITECTURE.md` line 20 | "A turn has exactly two shots." | "A turn has exactly two goes. A go is one helper's command." Add the squad types. |
| `docs/CONTRACTS.md` state machine and decisions 2, 12 | shot wording | Add `selectUnit`, `act`, `actionDone`, and the squad types. |
| `docs/NARRATION.md` lines 20, 25, 27, 30, 54 | "shoot far or near", "two shots", card "Two Shots" | Reword ("send it far or near", "two goes"). Needed anyway once `shoot` joins the banned list. Re-record those clips. |

## 3. The crews

Three command shapes. The rules for a shape are the same on both sides. Only art, sound, and words differ. That keeps Past and Future fair.

| Shape (icon) | What the player does | What happens |
|---|---|---|
| **Fire** (target icon) | Press the one big Fire button. Aimed helpers show today's angle and power first. Straight helpers have a fixed aim from config, so it is one press. | Aimed: today's arc with wind, biggest damage. Straight: flies flat along the ground lane, no wind. |
| **Dash** (arrow icon) | Tap a glowing ground spot. | The helper rolls there and bonks the thing next to it: an enemy helper or the enemy base. |
| **Fly** (wing icon) | Tap a glowing sky spot. | The helper flies there and drops one goofy payload straight down. It stays up until it moves again or gets bonked. |

"Straight Fire" is the old Zap folded into Fire. In rules it is `fire` with a preset aim, so there is one code path, not two.

A bonked enemy helper does an Awkward Tumble, says a bubble line, and walks home. That is the only thing that ever happens to a helper.

### Team Past

| Code `UnitKind` | Name kids see | Looks like | Shape | What it does | Kid-safe |
|---|---|---|---|---|---|
| `cannonCrew` | Cannon Crew | Two knights and a stubby cannon (today's launcher). | Fire, aimed | Arcs a foam ball at the base. | Foam ball. Walls pop into toy blocks. |
| `chariot` | Chariot Archers | A wobbly chariot pulled by a pony, two archers with suction-cup arrows. | Dash | Rolls up to 2 spots, then sticks a volley of suction cups on what is next to it. | "Thwop." Target wobbles and tumbles. |
| `balloon` | Hot Air Balloon | A patched, striped old-time balloon with a nervous lookout. | Fly | Floats up to 2 sky spots, then drops a sack of feathers. | Feathers puff everywhere. |
| `slingshotSquire` | Slingshot Squire *(Andy's call)* | A small squire with a giant slingshot. | Fire, straight | Flings a rubber chicken flat along the ground. | Squeaky chicken. |

Andy named three Past helpers. The fourth is the one invented helper, needed so Past has a match for the Laser Zapper. If Andy says no, both sides drop the straight shot and play a crew of 3 (Open question 3).

### Team Future

| Code `UnitKind` | Name kids see | Looks like | Shape | What it does | Kid-safe |
|---|---|---|---|---|---|
| `rocketButton` | Rocket Button | An operator slaps a giant red button. A foam rocket leaves a pad. | Fire, aimed | Arcs a foam rocket at the base (same rules as the cannon). | Rocket bursts into confetti. UI never says "missile." |
| `laserZapper` | Laser Zapper | A helper with a chunky glowing toy blaster. | Fire, straight | A sparkly bolt flies flat along the ground. | Pops toy blocks, makes helpers sneeze. Aims at walls and gadgets. |
| `tankButton` | Tank Button | An operator presses a button. A bumper-car tank rolls out with a glow-sword rider on top. | Dash | Rolls up to 2 spots. The rider bonks what is next to it with a glow-noodle sword. The operator stays put. | "Fwoosh-bonk" and a clown horn. |
| `spacePlane` | Space Plane | A chubby prop plane with rocket fins and a fishbowl-helmet pilot. | Fly | Zooms up to 2 sky spots, then drops a wobbly goo bubble. | Goo pops into glitter. |

To fit all six things Andy named into 4, two are merged: the laser sword rides on the tank (mirror of archers on the chariot), and the spaceship and airplane are one Space Plane (mirror of the balloon). **Andy's call** (Open question 4).

## 4. Tapping and selecting

**Three states you can see, never color alone:**
- **Picked:** grows a little, thick outline, a pointing arrow above it.
- **Ready:** a soft bounce. Under reduced motion, a static small arrow badge instead.
- **Enemy:** normal art, not tappable. The waiting side dims as today.

There is no rule that a helper is always picked. At the start of a turn the helper you used last is pre-picked, so a kid who just wants to fire can press Fire (one tap, like today).

**Taps.**
- Tap one of your helpers. It is picked. Its targets show at once: glowing spots for Dash and Fly, or the big Fire button (plus aim controls for aimed Fire).
- Tap a glowing spot or press Fire. The go happens. **At most 2 taps per go** (aiming drags not counted). Pinned in a test.
- Tap a different helper of yours. The pick switches in one tap. It costs no go.
- Tap the picked helper again, press Back, or press Escape. Nothing is picked.
- Only glowing spots, your helpers, and the buttons respond. A tap anywhere else does nothing except a small wobble of the picked helper. No snapping, no surprise moves, no error messages.

**Corner buttons, not a ring.** Two icon buttons sit in one fixed corner, outside the board: **Hear it** (speaker) and **Back** (arrow). Back shows whenever a helper is picked. Hear it has Chrono say the picked helper's name and what it does, with captions. Long-press on a helper does the same.

**First go hint.** On a family's first squad match, a drawn pointing finger taps a helper, then a spot. No words needed.

**Keyboard.**
- Left and Right arrows (or Tab) move between your helpers. Enter or Space picks.
- With a Dash or Fly helper picked, arrows move between glowing spots. Space confirms.
- With a Fire helper picked, today's keys work: arrows for angle and power, Space to fire.
- Escape is Back. H is Hear it.

**Less clutter.**
- At most 8 helpers, 2 bases, and 1 thing in flight.
- **5 ground spots and 4 sky spots**, fixed. One helper per spot.
- Sizes are stated in **rendered pixels at 768 px wide** (iPad portrait, the smallest view): spot circles and helper hit areas at least 64 px, corner buttons at least 64 px, never under 56 px. Config stores world positions; a test checks the rendered sizes.
- No health bars on helpers, no labels on every helper. Names show on Hear it, long-press, hover, or focus.
- Reduced motion: no bounce, no shake. Moves become a short slide or fade.

**Covers stay.** The pass-the-mouse cover and the reload cover still hide the whole board and the question (risk 3).

## 5. Fairness rules (no walls, no stalemate)

- **No doorstep camping.** The ground spot next to each base is a doorstep. A side's own helpers may never stand on their own doorstep. So no one can wall off a base.
- **Straight Fire passes through.** It bonks every enemy helper in its path and still reaches the base.
- **Dash on the enemy doorstep always bonks the base.**
- **Fly drops hit whatever is below.** A drop over the enemy base hits the base. A drop over your own side hurts nothing (no self damage, same as today).
- **No stalemate guarantee:** from every legal board, the side to play has at least one go that can damage the enemy base. Pinned by a test that walks every reachable board.

## 6. Rules and data shapes

All in `src/game/` with no Phaser imports. Randomness only from the seeded `createRng`. Sketches only; the real contract lands in `src/game/types.ts` and `docs/CONTRACTS.md` in the S1 PR.

```ts
export type CommandType = 'fire' | 'dash' | 'fly';
export type Lane = 'ground' | 'sky';

export type UnitKind =
  | 'cannonCrew' | 'chariot' | 'balloon' | 'slingshotSquire'
  | 'rocketButton' | 'laserZapper' | 'tankButton' | 'spacePlane';

/** Fixed spots 'g0'..'g4' and 's0'..'s3'. From config. g0 and g4 are doorsteps. */
export type SpotId = string;
export type Spot = { id: SpotId; lane: Lane; x: number; y: number; doorstepOf?: Team };

/** Static facts about a kind. In config, one entry per kind. */
export type UnitDef = {
  kind: UnitKind;
  team: Team;
  command: CommandType;
  lane: Lane;
  /** Spots per go for dash and fly. 0 for fire. */
  range: number;
  /** Fire only. Preset aim for straight fire; absent means the player aims. */
  fixedAim?: AimInput;
};

export type Unit = {
  readonly id: string; // 'PAST-chariot'
  readonly kind: UnitKind;
  readonly team: Team;
  readonly home: SpotId;
  readonly spot: SpotId;
};

export type Squad = {
  readonly team: Team;
  /** Length 1..SQUADS.crewSize. Fixed crew from config. */
  readonly units: readonly Unit[];
};

export type Command =
  | { type: 'fire'; aim?: AimInput } // aim ignored when the unit has fixedAim
  | { type: 'dash'; to: SpotId }
  | { type: 'fly'; to: SpotId };

export type ActionOutcome = {
  unitId: string;
  command: Command;
  /** Points for the scene to animate. Aimed fire uses simulateShot's path. */
  path: Vec2[];
  /** Base damage from this go. Reuses BlastOutcome. */
  blast: BlastOutcome;
  /** Helpers that tumble and go home. */
  bonked: { unitId: string; from: SpotId; to: SpotId }[];
};

export type IllegalCommandReason =
  | 'no_unit_selected' | 'not_your_unit' | 'wrong_command'
  | 'out_of_range' | 'spot_taken' | 'own_doorstep';
```

`MatchController` gains:

```ts
/** Only in AIMING. Picks one of the active team's units. Switching is free. Throws IllegalCommandError otherwise. */
selectUnit(unitId: string | null): void;
selectedUnitId(): string | null;
/** Spots the picked unit may target now. Empty for fire. The UI shows only these. */
legalTargets(): SpotId[];
/** AIMING -> SHOT_n (via FIRE). Validates, then computes the whole go now. */
act(command: Command): ActionOutcome;
/** SHOT_n -> AIMING or RELOAD (via SHOT_LANDED). Applies damage and moves. Same win rules as today. */
actionDone(): ActionOutcome;
```

- `Match` snapshot adds `squads: Record<Team, Squad>` and `selectedUnitId`.
- `MatchOptions` adds an optional `squads`. Without it, each side is a crew of one aimed Fire helper at today's launch spot, so `fire()` and `shotLanded()` keep working and every Phase 1 test stays green.
- Dash, Fly, and straight Fire have no randomness. Aimed Fire keeps seeded wind. Bubble lines stay a seeded shuffle bag.
- The Battle scene only draws `path`, plays tumbles, and moves sprites. It never decides what a command does.
- New `src/game/squads.ts` holds `legalTargets`, `resolveFire`, `resolveDash`, `resolveFly`, and `startingCrew`. `match.ts` calls it.
- Numbers go in `src/game/config.ts` under `SQUADS`:

```ts
export const SQUADS = {
  enabled: false,
  crewSize: 4,
  groundSpots: 5,
  skySpots: 4,
  dashRange: 2,
  flyRange: 2,
  damage: { straightFire: 8, dashBonk: 12, flyDirect: 15, flyNear: 6 },
  minTapPx: 64, // rendered at 768 px wide; hard floor 56
} as const;
```

One aimed direct hit (25) stays the biggest hit in the game, so aiming is still worth learning.

## 7. Milestones

Each ships behind `SQUADS.enabled`, starts after the Look and Feel phase, and passes the full pre-merge checklist in AGENTS.md.

### S1: Pick a helper, one dasher per side
- Each side has 2 helpers: its launcher (aimed Fire) and its dasher (Chariot Archers, Tank Button).
- Two-tap flow, one-tap switch, Back and Hear it corner buttons, keyboard path, three visible states, 5 ground spots, doorsteps.
- "GO 1 OF 2" banner with dots. Reload after go 2.
- Doc updates from section 2 land in this PR (after Andy's yes). Copy lint banned list gains: missile, soldier, army, troops, war, shoot, weapon. NARRATION lines that say "shoot" are reworded in the same PR.
- **RED tests first:**
  - `squads.test.ts`: dash targets within range; spot taken; own doorstep refused; dash on enemy doorstep bonks the base.
  - `match.test.ts`: select in PASS_SCREEN throws; select an enemy throws; act with nothing picked throws; a third go throws; reload still follows go 2; same helper may go twice; switching picks costs no go; a wrong answer still passes the turn and the next turn has the full crew; no squad option changes question count, timing, or difficulty; no-squad options reproduce the Phase 1 golden match exactly.
  - `copy.test.ts`: helper names, "GO 1 OF 2", and new words pass the extended banned list.
  - e2e: pick, dash, bonk, reload by mouse, by touch, and by keyboard only; each go takes at most 2 taps; tap targets measured at 768x1024 and 1024x768 are all at least 56 px (target 64); a tap on empty grass moves nothing.
- **Done when:** a family plays a full match with both helpers, and the Phase 1 golden tests are unchanged and green.

### S2: Flyers
- Add Fly: Hot Air Balloon and Space Plane. 4 sky spots. Drops hit what is below.
- **RED tests first:** fly targets are sky only and in range; drop damage from `SQUADS.damage`; a drop over your own side hurts nothing; a bonked flyer returns home; reduced-motion path in e2e.
- **Done when:** both flyers work by mouse, touch, and keyboard, and screenshots at 1280x800 and 1024x768 show no overlap with 3 helpers per side.

### S3: Full crew of 4
- Add straight Fire: Slingshot Squire and Laser Zapper (if Andy approves question 3). Reskin the Future launcher as Rocket Button.
- Crew of 4 enforced in rules.
- **RED tests first:** straight Fire bonks every enemy in its path and still reaches the base; a 5th unit in `squads` throws at `createMatch`; mirrored Past and Future crews give identical outcomes for mirrored commands; "base never fully shielded" and "no stalemate" walk every reachable board; a seeded 4v4 replay is bit-for-bit repeatable.
- **Done when:** the panel (all five lenses) GOes a 4v4 playtest; a 6-year-old playtester finishes a turn without help; no path in the playtest skips or shortens the reload question; no screen at 1024x768 has a tap target under 56 px.

## 8. Art and audio needs

Art (original, in the new Look and Feel style):
- 8 helpers, each with idle, picked, acting, and tumble poses. No "empty" pose.
- Payloads: foam ball, foam rocket, suction-cup volley, rubber chicken, sparkly bolt, feather sack, goo bubble.
- Tank with glow-sword rider and garage door. Rocket pad and big red button.
- Spot markers (ground, sky, doorstep). Icons for Fire, Dash, Fly, Hear it, Back. The pointing-finger hint. Two-dot go counter.

Audio (original or synthesized with WebAudio, listed in `public/audio/CREDITS.md`):
- One pick "pop," one Back "boop," one empty-tap "wobble."
- Per shape: fire boom or "pew-sparkle," dash wheels and "bonk," fly whoosh and "plop."
- Clown horn for the tank. Squeak for the rubber chicken.
- Chrono lines, all captioned, script in `docs/NARRATION.md`: **one line per command shape (3 lines)** plus a short name clip per helper (8 clips of one to three words) for Hear it and first sight.

All numbers (ranges, damage, spot positions, sizes) go in `src/game/config.ts`.

## 9. Risks, kid safety, and learning

**Risks.**
- *Clutter creeps back.* The crew size and the three shapes are rules in `src/game/`, pinned by tests. They never grow without Andy.
- *Longer turns.* Two taps per go, last helper pre-picked, 2 goes per turn fixed.
- *Older sibling wins on fiddling.* A pre-picked launcher means a younger kid can play exactly like today. An "Easy crew" option is Open question 5.
- *Imbalance or a walled base.* Mirrored rules, doorsteps, pass-through shots, and the no-stalemate test.
- *Phase 4 relay.* Commands are small inputs (`unitId` + `Command`), so the relay sends inputs only and the server re-runs the same pure rules (`SERVER`).

**Kid safety.**
- No helper is ever hurt, removed, or "out." They tumble and walk home.
- Gear is toys: foam, suction cups, glow noodles, rubber chickens, feathers, goo, confetti. Shots aim at walls and gadgets. A helper in the way gets bonked silly (pride, not pain).
- Copy lint gains missile, soldier, army, troops, war, shoot, weapon.
- **Panel review (parent and teacher lenses) of the final helper names and every bubble and Chrono line before S2 starts.** Includes "Laser Zapper," "glow sword," and "Fire."
- No new data, network, or tracking.

**Learning (Gate 3).** The reload question stays the heart of the loop. Squads changes what you do with your 2 goes, not whether you answer. The question still comes after every second go, still covers the board, and is never skipped, shortened, or hidden by any helper or command.

## Panel notes

**Changed (folded in):**
- Fixed crew of 4 per side. Cut the roster of 6, pick screen, and scrap unlocks; S4 moves to BACKLOG as P3.
- Cut two of the three invented Past helpers. Kept one (Slingshot Squire, renamed in code from `crossbowSquire` to `slingshotSquire`) only as Andy's call, with a crew-of-3 fallback.
- Removed the button ring. Tap a helper, then tap a spot or press Fire. At most 2 taps per go, switching is one tap and free, all pinned in tests.
- Hear it and Back moved to icon buttons in one fixed corner. Long-press also says Hear it. Escape is Back.
- Merged Zap into Fire as a fixed-aim shot. Three shapes (Fire, Dash, Fly), each with an icon; words are captions only.
- Dropped the "empty" badge and the `used` field. It had no rule effect. This also removes the blinking-battery reduced-motion problem.
- Stated that a wrong answer still passes the turn and the crew is full next turn, and that nothing changes question count, timing, or difficulty. Added S1 tests and an S3 playtest check.
- Three visible states (picked, ready, enemy) without color-only cues. Removed "one helper always highlighted."
- Only glowing spots respond. Removed "tap anywhere snaps."
- Sizes stated in rendered pixels at 768 px wide. Spots cut to 5 ground and 4 sky. S1 e2e measures tap targets at 768x1024 and 1024x768.
- Fairness: doorsteps nobody can camp, straight Fire passes through, plus "never fully shielded" and "no stalemate" tests.
- Listed the exact AGENTS.md, GAME_SPEC.md, ARCHITECTURE.md, CONTRACTS.md, and NARRATION.md lines to update in S1, gated on Andy's yes.
- Extended the copy lint banned list and required a parent and teacher panel pass on names and lines before S2.
- Narration capped at one line per shape plus short name clips.
- Added a pointing-finger first-go hint, two-dot go counter, and a 6-year-old "finishes a turn without help" done-when.
- Squads now follows the Look and Feel phase.

**Declined or deferred, and why:**
- *"Easy crew" Camp option per side.* Adds a setting. Moved to Open question 5. The pre-picked launcher already gives a younger kid today's simple game.
- *"Each helper acts once per reload."* Forces unwanted helpers and breaks the crew-of-one match. Dropping the badge solves the same confusion more simply.
- *Panel finding on unlock scrap for slow readers.* No longer applies: there are no unlocks.
- *Pick-screen "Play with this crew" button.* No longer applies: there is no pick screen.
- *Name said on every first sight per helper as full lines.* Kept to short name clips to stay within the narration cap.
- *Edits to BUILD.md, BACKLOG.md, and AGENTS.md.* Out of this file's scope. They are listed above and in the roadmap lines for the S1 PR or the triage step.

## Open questions for Andy

| # | Question | Recommended answer |
|---|---|---|
| 1 | Fixed crew of 4 per side, no roster, no unlocks? | Yes. Calm screen, nothing new at Camp. |
| 2 | Is "2 goes, then reload" OK as the new "2 shots, then reload"? (Protected rule.) | Yes. Same shape, same question, and today's game still works as a crew of one. |
| 3 | Add one invented Past helper (Slingshot Squire) to match the Laser Zapper? | Yes, or name your own. If no, both sides play a crew of 3 with no straight shot. |
| 4 | OK to merge the laser sword onto the tank and the spaceship and airplane into one Space Plane? | Yes. All six things you named stay in, in 4 helpers. |
| 5 | Add a per-side "Easy crew" at Camp (just the launcher, today's game) picked by a parent? | Yes, later. Costs almost nothing since a crew of one already works. Not in S1 to S3. |
| 6 | Can one helper go twice in a turn? | Yes. Simplest rule, keeps the cannon-only game. |
| 7 | Do helpers have their own health? | No. They tumble and go home. Only base health matters. |
| 8 | Should the banner say "GO 1 OF 2"? | Yes, with two dots. Short and readable by a first grader. |
| 9 | Order: Look and Feel phase next, then Squads? | Yes, as you asked. |

## Owner decisions (2026-10-15)
Andy answered yes to Open Questions 1 to 4:
1. Fixed crew of 4 per side.
2. A turn is 2 goes, then the reload question. This approves the change to the protected turn rule. The S1 PR updates AGENTS.md, GAME_SPEC, ARCHITECTURE, CONTRACTS and NARRATION to match.
3. Keep the Slingshot Squire (Past crew stays at 4).
4. Merges stand: glow-sword rider on the Tank Button, and one Space Plane for the spaceship and airplane.

## Owner decisions (2026-10-24)
Andy: "Make the guys actually move and attack and then come back." And: "people can, when they attack, go over any obstacles ... the soldier walks forward and starts attacking the enemy base or fights whatever's in the front. And then it keeps attacking even when the enemy has a turn."
1. S1 is finished and on for everyone. A turn is 2 goes, then the reload question (approved 2026-10-15).
2. The dasher walks out along the ground over any obstacle, stops next to the enemy thing he fights, and attacks with a silly swing, a puff and a "Bonk!".
3. He stays and bonks at the start of every turn, the enemy's too, until he is knocked down or called home. Come back is a go; he is ready again next turn.
4. He has fighter health, shown as a heart and pips. At 0 he tumbles, walks home dizzy, and is back after one full own turn.
5. The start-of-turn bonk replaces the old "bonk on landing, then return" rule.
This replaces rule 4 and rule 6 of section 1 for the dasher ("Nothing moves on its own" and "Helpers have no health").

Added after the plan was written (not yet folded into the sections above):
- Each unit wears a label to pick it by. Past: letters A to D on a shield. Future: numbers 1 to 4. Tap the unit or press its key.
- Past math focuses on multiplication (X emblem). Reading uses a book emblem. Future uses a division emblem. Whether emblems follow the player's subject choice is still open.
- Learning aim: a short fading trajectory stub before firing, then a full arc trace after, with wind arrows and numbers.
