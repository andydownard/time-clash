Time Clash: Past vs. Future

Game Design Specification & Phased Development Roadmap

1. High Concept & Platform Vision

Time Clash is an educational, turn-based artillery web application built with a cartoonish slapstick tone. Players battle across time—one commanding a Medieval Past castle, the other a Futuristic Austin secret base.

⚬ Platform Rollout:
  ⚬ Phase 1–3: Single-computer "hot-seat" pass-and-play (two players sharing one keyboard and mouse).
  ⚬ Phase 4: Multi-device wireless sync (playing head-to-head across iPads and tablets via simple room codes).
⚬ Tone: Stylized semi-realism, zero gore, maximum slapstick dignity damage, and cheeky humor.

2. Core Screens & Flow

[ Funny Loading Screen ]
         │
         ▼
[ Player Setup Screen ] ────► Enter Names, Grade Levels (K–12), & Subjects
         │
         ▼
[ The Camp Hub ] ──────────► 4 Tents, Campfire, Workbenches & Upgrade Buttons
         │
         ▼
[ Base Deployment ] ───────► Choose secret base location in futuristic Austin
         │
         ▼
[ Battle Arena ] ──────────► 2 Shots ➔ Awkward Tumbles ➔ Math/Reading Reload
         │
         ▼
[ Victory & Wipeout Screen ]


3. Dedicated Systems Breakdown

A. The Funny Loading Screen

Before loading the game or transitioning between rounds, players see an animated screen with dynamic, absurd loading bars:

⚬ Visuals: A low-gravity medieval chicken floating past a glitching hoverboard, or a trebuchet launching an alarm clock.
⚬ Randomized Loading Messages:
  ⚬ "Charging laser cannon with two AA batteries and a potato..."
  ⚬ "Teaching the catapult how to do long division..."
  ⚬ "Convincing the knights that Wi-Fi isn't black magic..."
  ⚬ "Calibrating dad jokes to maximum cringe levels..."
  ⚬ "Buffing out dignity scratches from the last fall..."
  ⚬ "Looking for Austin's secret base behind a taco truck..."

B. The Camp Hub (Base & Weapon Workshop)

The central staging area between matches where players upgrade gear and craft inventions:

⚬ Environment: A clearing under the stars with a warm, crackling campfire in the dead center.
⚬ Layout:
  ⚬ Left Side: 2 Canvas Medieval Tents (Player 1 / Past area).
  ⚬ Right Side: 2 Neon Geodesic Pod Tents (Player 2 / Future area).
  ⚬ Center: Stone-ringed campfire surrounded by heavy wooden and holographic workbenches.
⚬ Interactive Workbenches & Upgrade Buttons:
  ⚬ [Forge Weapon]: Mix past and future materials to build new launchers (e.g., Nanotech Trebuchet, Wrought-Iron Railgun).
  ⚬ [Reinforce Base]: Spend scrap materials to add armor plates, forcefield generators, or thick stone buttresses.
  ⚬ [Tweak Gear]: Adjust projectile types (confetti explosives, bouncy plasma spheres, heavy iron bowling balls).

C. Base Placement (Futuristic City)

Instead of a fixed spawn point, the Future player can choose where to plant their Secret Base across the Austin cityscape:

⚬ Perched on top of a neon skyscraper.
⚬ Tucked beneath a futuristic Lady Bird Lake bridge.
⚬ Disguised inside a high-tech food truck pavilion.
⚬ Position directly alters shooting elevation, trajectory angles, and cover obstacles.

Team Past gets the same kind of choice for its castle (added 2026-10-23, owner request: "the past needs a way to have things that block too"):

⚬ Hill Fort: high on a solid rock. The best view. Low shots thud into the rock.
⚬ Village Wall: on the ground, behind a low stone wall out in front.
⚬ Drawbridge: low, behind a raised wooden drawbridge that stops flat shots, so players lob.
⚬ Village Wall is the default (owner decision, 2026-10-24), the way Food Trucks is for Team Future. A new family, and every plan saved before castle places, starts at Village Wall. One castle card is always picked.

Every blocking shape is drawn as the thing it is (stone courses, moss and grass, cherry petals, temple vines, tower windows with neon trim, a steel truss, a taco truck, oak planks with iron bands), never a plain dark box. The picture and the solid shape are the same outline, so a shell hits exactly what a child sees.

D. Clear Turn Indicators (Single-Computer Hot-Seat)

Because two players share one screen, turns must be unmissable:

⚬ Massive Turn Banner: Drops down with a cartoon horn sound: "ALEX'S TURN (TEAM PAST) — TAKE AIM!"
⚬ Active Player Glow: The current player's side of the screen lights up with bright, animated framing, while the waiting player's side dims slightly.
⚬ Pass-the-Screen Alert: A prompt appears between turns: "Pass the screen! No peeking at their question!"

E. Slapstick Wipeouts & Recovery

⚬ Zero Damage Rule: Characters and bases never show blood or realistic destruction. Walls break down into bouncy, oversized toy-like blocks.
⚬ The Awkward Tumble: When caught near an explosion, characters fold like flimsy lawn chairs, spin their arms wildly like windmills, and pancake flat on the ground.
⚬ Quick Recovery & Speech Bubbles:
  ⚬ Characters scramble up instantly, look left and right to see if anyone saw them, and blurt out:
    ⚬ "Just inspecting the floor for loose pennies!"
    ⚬ "Error 404: Balance protocol failed!"
    ⚬ "I meant to do that. It’s a tactical maneuver!"
    ⚬ "Who put the gravity on maximum?!"

F. K–12 Educational Reload Loop

⚬ Turn Sequence: 2 shots per turn.
⚬ Reload Modal: Pops up immediately after shot 2.
⚬ Power Shot: A right answer (fast or slow) earns exactly one extra shot that does 1.5 times the damage (`BONUS.damageMultiplier`). Walls and force fields still apply. It has no question and no bonus of its own. A wrong answer earns no Power Shot but never blocks play.
⚬ Asymmetric Tuning: Player 1 (e.g., 2nd Grade Reading) reads and picks sight words to reload; Player 2 (e.g., 8th Grade Math) solves pre-algebra equations.
⚬ Fast answers grant bonus scrap materials to spend in the Camp Hub.

4. Phased Development Roadmap

Phase 1: Local Single-Computer Core Loop (MVP)

⚬ Target Device: Single computer (Hot-seat pass-and-play).
⚬ Features:
  ⚬ Two-player name entry and turn-indicator banners (Player 1's Turn / Player 2's Turn).
  ⚬ Basic 2D ballistics engine (angle, power, arc, wind).
  ⚬ 2-shot limit triggering the Educational Reload Modal.
  ⚬ Elementary question bank (Math & Reading) with grade-band selection.
  ⚬ Flat base health (100 HP) with the first awkward tumble animation and post-fall comic speech bubbles.
  ⚬ 1 Funny Loading Screen with rotating humor prompts.

Phase 2: The Camp Hub, Base Placement & Biomes

⚬ Features:
  ⚬ The Camp Hub Interface: Visual hub featuring the central campfire, 4 tents (2 past, 2 future), and interactive upgrade workbenches.
  ⚬ Base Placement: Grid or free-placement zone in the futuristic city for the secret base.
  ⚬ Parallax Biomes: Selectable backdrops (Aspen Forest, Cherry Blossom Forest, Ruined Temple).
  ⚬ Evasion Abilities: Rechargeable Hoverboard Dodge and Stone Barricade Wall.

Phase 3: Deep Crafting & Weapon Customization

⚬ Features:
  ⚬ Working upgrade buttons in the Camp Hub to combine materials:
    ⚬ Granite & Iron (Past) + Nanotubes & Energy Shields (Future).
  ⚬ Custom weapon creation (Hybrid Trebuchets, EMP-shielded Railguns).
  ⚬ Individual K through 12th-grade calibration for both Math and Reading.
  ⚬ Scrap material economy earned through high-speed math/reading accuracy.

Phase 4: iPad & Multi-Device Networking

⚬ Target Devices: iPads, tablets, and cross-play web browsers.
⚬ Features:
  ⚬ Lightweight room code system (e.g., enter 4-letter room code on iPad to join host computer).
  ⚬ Real-time WebSocket synchronization for remote aiming, firing, and secret answering.
  ⚬ Persistent player profiles and win/loss leaderboards.
  ⚬ Full audio suite: Whimsical slide-whistles, boing springs, hums, and custom comedic voiceover lines.

Visual & UI Design Prompt (For Designers & Asset Generation)

Use the prompt below when generating UI mockups, concept art, or specifying front-end layouts for development:

Project Design Brief: "Time Clash" UI & Environment Suite

Art Style: Stylized semi-realism, 2.5D painterly game art. Rich textures, atmospheric lighting, and clean, cartoon-proportioned silhouettes. Playful, safe, and humorous tone—no dark grit, blood, or militaristic grime.

Screen 1: The Central Camp Hub

⚬ Composition: Wide-angle view of a cozy twilight campsite.
⚬ Centerpiece: A crackling, warm campfire with stone perimeter. Around the fire are wooden and brushed-steel workbenches cluttered with glowing blueprints, tools, gears, and holographic screens.
⚬ Sides: Exactly four tents. On the left: two canvas, medieval royal pavilion tents adorned with banners and lanterns. On the right: two sleek, glowing futuristic geodesic dome pods with neon blue accents.
⚬ UI Overlay: Stylized wooden and neon buttons hovering over workbenches labeled [UPGRADE BASE], [FORGE WEAPON], and [READY FOR BATTLE].

Screen 2: Funny Loading Screen

⚬ Visual: A goofy medieval knight attempting to ride a hoverboard that is wobbling wildly, while a tiny floating repair bot looks on in confusion.
⚬ UI Elements: A glowing progress bar shaped like a winding timeline. Centered humorous status text: "Convincing the trebuchet that math is good for it... 64%".

Screen 3: Battle Screen & Turn Transition

⚬ Environment: Left side shows an ornate medieval castle; right side shows a futuristic Austin cyber-base tucked under a glowing solar skyway.
⚬ Active Indicator: Prominent comic banner at top center reading: "PLAYER 1: ALEX — YOUR TURN! (SHOT 1 OF 2)" with glowing directional arrows.
⚬ Slapstick Moment: A character who was just knocked over lies hilariously flat on their stomach with arms spread out, a cartoon speech bubble above them saying: "Just checking the lawn for four-leaf clovers!"
## Practice opponent

A rules-based opponent so one child can play alone, and later fill a seat when no second player is there. Pure logic in `src/game/bot.ts` (and `botPlay.ts` for simulated matches, `practice.ts` for turn ownership and pacing). On for everyone since 2026-10-24 (owner decision): `PRACTICE_BOT.enabled = true` in `src/game/config.ts`. `?computer=0` on the address hides the choice and `?computer=1` shows it, whatever the flag says. With it off the game is exactly as before. "Another player" is still picked first, so two children who share a screen see no change.

Rules:
- It sees only what a child can see: the bases, wind, health and its own fighter. It never sees the other player's reload question.
- `chooseShot(state, side, level, rng)` returns an angle, a power and a fighter. The aim is always clamped, whole numbers, and legal. It never skips a shot.
- It finds a good aim on a copy of the physics, then adds a human-sized error. The error spread (degrees and power points) and how much wind it reads are set per level.
- `answerReload(question, level, rng)` answers only its own question. The chance of a right answer falls with the question's grade (never below a blind guess among four). It also returns a think time in ms (1.8 s to 14 s), longer for older grades and reading questions, so the screen can pace it.
- Randomness is seeded. Same seed, same game.
- The screen must say "Computer player" (never "bot", "AI" or "assistant") and show it all the time. One storage key, `timeclash.practice`, remembers Play with and the level.
- What a child sees: Setup has a "Play with" choice with two big buttons, "Another player" and "Computer player". Computer player adds "How hard?" (Easy, Medium, Hard; Medium to start) on the Computer player's card, which has a friendly robot face (Team Future) or helmet (Team Past). The child is Team Past and types one name and picks one grade (a dropdown, K to 12) and subject. The Computer player copies that grade and subject for its own reload question. The last choice is remembered on the device.
- On the computer's turn there is no pass screen. The child keeps the screen. A note says "Computer player is aiming" while the dial and power meter move by themselves for about 1.2 to 2 seconds (shorter on Hard), then it fires. The turn strip says "Computer player's turn", and its Fire, sliders and keys are locked. With reduced motion the dial jumps and the note still shows for a moment.
- The Computer player's reload shows "Computer player is thinking" for up to 2.5 seconds. The child never sees its question, choices or answer. A wrong answer still reloads (Gate 2). All thinking in one computer turn, including the reload and a Power Shot aim, is under 8 seconds. The child's own reload questions, history and level nudges are unchanged.
- With one child alone, the pass-the-mouse cover is not shown at all (nobody to hide the board from). Two players still get it.
- The rules have no turn cap. Matches end because shots hit. A test plays 1,000 seeded matches and all end with a winner.

Levels (tunables in `PRACTICE_BOT.levels`):

| Level | Angle error | Power error | Wind read | Right answers (grade 0) |
|---|---|---|---|---|
| easy | 7.5 deg | 12 pts | 30% | 65% |
| medium | 5 deg | 9 pts | 60% | 80% |
| hard | 2 deg | 4 pts | 90% | 92% |

Simulation (`npx tsx scripts/simulate-bot.ts 2000`: 2,000 seeded matches per pairing, sides and first turn alternate). The "decent human" is a scripted player (4.5 deg, 9 pts, reads 50% of wind, 75% right).

| Level | Bot wins vs decent human | Target |
|---|---|---|
| easy | 31.8% (human wins 68.2%) | human wins 65 to 75% |
| medium | 49.6% | 45 to 55% |
| hard | 62.8% | 60 to 65% |

Bot against bot (row wins): easy 30.9% vs medium, 20.6% vs hard; medium 67.5% vs easy, 37.0% vs hard; hard 79.3% vs easy, 63.1% vs medium. Matches last about 3 to 4 turns each.

## Character health (rules built, flag off)

### Match length (parent setting)

Setup has a Match length choice: Short, Normal, Long. Normal is the default and is exactly the balance below (base health 100, or 3 health per fighter). Short halves full health (base 50, fighters 2). Long is one and a half times (base 150, fighters 5, rounded to whole numbers, never below 1). A direct hit still does 25 base damage (1 fighter health, 2 for a Power Shot), so Short ends in 2 direct hits and Long in 6, against 4 at Normal. It does not change the 2-shots-then-reload turn, the reload question, timing or Scrap. It is saved on the device and "Clear my data" resets it. Numbers: `MATCH_LENGTH` in `src/game/config.ts`.

Owner decision (2026-10-20): "Every character has three health. It REPLACES base health." The rules are pure, in `src/game/damage.ts` and `src/game/match.ts`, with numbers in `CHARACTER_HEALTH` in `src/game/config.ts`. The flag is `CHARACTER_HEALTH.enabled = false`. It stays off until the Battle scene and the HUD draw health pips and play the awkward fall. With it off the game is exactly as before. A match reads it as the default of `MatchOptions.characterHealth`; tests pass the option and never change the constant.

What changes with the flag on:
- All ten fighters (five per team: balloon, archer, cannon, catapult, spear; tank, helicopter, bunkers, saber robot, laser robot) start with `hp: 3`. The snapshot holds `unitHp` by fighter id.
- Each fighter has a hit box (`unitBox` in `units.ts`, `CHARACTER_HEALTH.box`, centered on its firing spot). A shell flies along its path and bursts on the first standing enemy fighter whose box it touches (with 24 px of slack, `classifyBlast` with `directScale`). That is one direct hit. Air fighters can be hit in flight. If the shell touches none, it bursts where it lands. Any other standing enemy within 90 px of the burst (`nearScale`) has a near miss.
- Base health is not used. A shot at the base does nothing to the base. `baseHp` stays in the snapshot at full, only for saves and old tests.

| Event | Health lost | What the fighter does |
|---|---|---|
| Direct hit | 1 (`directHit`) | Flashes. Keeps playing. |
| Power Shot direct hit | 2 (`powerHit`) | Same. |
| Near miss | 0 (`nearHit`) | Tumbles (the existing wipeout fall and line). |
| Reaches 0 | n/a | `knockedOut`: the awkward fall and a funny line. Nobody is hurt. |

The Power Shot is "1.5 times as hard". Health is whole numbers, so 1 x 1.5 rounds up to 2. A test pins `powerHit` to `round(directHit x 1.5)`. Weapon upgrades, walls and force fields do not change fighter damage in this mode.

A fighter at 0 is knocked out. It takes no more hits or tumbles, it cannot be picked (`selectUnit` throws), and it cannot fire. If the team's pick is knocked out, the pick moves to a standing fighter (the default if it stands). The `knockedOut` list on the shot result names each fighter once, on the shot that took it to 0, so the scene plays the fall one time.

Win: a team loses when ALL its fighters are knocked out. The last fighter standing keeps the turn shape: 2 shots, then reload, and a right answer earns one Power Shot. `winnerOfMatch` gives the winner in both modes (fighters when the flag is on, base health when off). Matches always end: a test plays 200 seeded Computer player matches with the flag on and each one ends with a winner under the turn cap. The Computer player (`chooseShot`) only picks standing fighters and aims at a standing enemy fighter.

What stays the same: 2 shots then reload, the Power Shot, wind, scrap, the reload question, the tumble lines, seeded randomness.

## Built bases in battle (rules built, flag off)

Owner decision (2026-10-20): "the bricks take hits", the weapons on the four spots are real firing positions, a brick that is hit enough falls away, and a weapon sits on its brick so it falls when the brick falls. Nobody is hurt: bricks puff and tumble, and a fighter behind a falling wall is never damaged by it. The rules are pure, in `src/game/builtBase.ts` and `src/game/match.ts`, with numbers in `BASE_IN_BATTLE` in `src/game/config.ts`. The flag is `BASE_IN_BATTLE.enabled = false`. A match reads it as the default of `MatchOptions.baseInBattle`; tests pass the option and never change the constant. It only works together with `CHARACTER_HEALTH` (`characterHealth`): without it the option is ignored. With it off the game is exactly as before.

**Choosing the bases.** `MatchOptions.bases` is `{ PAST?: ChosenBase, FUTURE?: ChosenBase }`, where `ChosenBase = { pieces, spots }` is `chosenBase` plus `chosenSpots` from the base builder (`chosenBaseFor(bases, name, team)` makes one). A missing base is the default fixed base, as today. A team that brings a base (bricks or weapons) no longer has the default base box stopping shells: its bricks are its base.

**Layout.** The build plot (24 by 12 cells, 192 by 88 steps) maps to the battlefield at `BASE_IN_BATTLE.scale` (2 px per step, so 384 by 176 px). Team Past builds from the left (`margin` 40 px from the edge). Team Future is mirrored and sits on the right, so both face each other. The plot's bottom edge is the ground line. The snapshot holds each brick's box (`bricks`) and the four spots (`spots`), all in battlefield px. Custom-shape pieces do not exist in the base builder yet, so every brick is one rectangle.

**Brick hit points.** Each brick starts with the `hp` saved in the base. A shell that reaches a brick box bursts there (a direct hit) and does damage in brick hit points. A near miss (a shell that lands next to a wall) does 0. One hit per shell.

| Shot | Damage to a brick or weapon |
|---|---|
| Fighter shot | 20 times the fighter's `damageScale` (`brickDamage.fighterShot`) |
| Mounted `direct` weapon | its catalog `damage` times 1 |
| Mounted `lob` weapon (splash) | its catalog `damage` times 1.5 |
| Mounted `volley` weapon | its catalog `damage` times 1, for each small shell |
| `guard` | does not fire |
| Power Shot | the damage above times 1.5, rounded (`BONUS.damageMultiplier`) |

A brick at 0 hit points falls away: the shot result lists it in `built.brickFell`. Nobody is hurt, the scene puffs it.

**Support rule.** A brick is held up if it rests on the foundation (its bottom is the bottom of the plot) or on a standing brick directly under it (that brick's top touches its bottom and they overlap sideways). When a brick falls, every brick that is no longer held up falls too, in a fixed order: lowest bottom edge first, then leftmost, then by index. One pass is enough, because what holds a brick up is always lower. All of them are listed, in that order, in `built.bricksFell` (the brick the shell took out comes first). A brick that was already floating when the match began (nothing under it) is anchored and never falls by support. A fallen brick never comes back and never blocks a shell again.

**Shells and walls.** A shell stops at the first standing enemy brick or mounted weapon its path touches, and bursts there. The result's `path` and `landing` end at the contact point and `stoppedBy` names the brick or weapon (`hit` then means the original flight and should be ignored). A fighter the shell touches first is hit first and the wall is not. Two kinds of shell arc over walls: a `lob` weapon, and any shot from a flier (balloon, helicopter; `flierRoles`). They pass over walls on the way up and across, and only meet one coming down. A team's own bricks never stop its own shells. Fighter hits, near misses and the Power Shot work exactly as in Character health.

**Mounted weapons.** With the flag on, a weapon on spot `i` is a shooter with its own id, `mount:i` (`mount:0` to `mount:3`). The selector id space is `ShooterId = UnitId | MountId`. `selectUnit('mount:2')` picks it; the fighter pick stays as it was (`snapshot().selected`) and `selectedMount[team]` names the weapon (`null` for a fighter). A shot from a mount starts at its pad and `lastShot.mount` records it. The weapon sits on the highest brick under its pad (or on the foundation, which never falls): `MountView.brick`. If that brick falls, the weapon falls too and is out (`built.mountDown`, reason `brickFell`). A weapon also has the `hp` from the catalog, takes hits like a brick, and is out at 0 (reason `hit`). A weapon that is down cannot be picked.

| Role | How it fires |
|---|---|
| `direct` | Flat: the angle is held between 0 and 45 degrees. |
| `lob` | Arc: the angle is held between 45 and 90 degrees. Arcs over walls. |
| `volley` | A burst of 3 small shells, fanned 4 degrees apart, each with the weapon's small damage. A fighter loses at most 1 health to one volley (2 for a Power Shot). |
| `guard` (Shield generator) | No shot. It blocks the first hit per enemy turn that lands within 90 px of its pad: nothing is damaged and `built.guardBlocked` names it. It is ready again after the turn passes. |

**Win.** Unchanged: a team loses when all its FIGHTERS are out (Character health). Bricks and weapons do not count. A team whose fighters all stand behind a pile of rubble is still alive. A team with no weapons and no bricks still has its fighters as before. Matches always end: a seeded test plays 240 Computer player matches with all three flags on and random built bases, and each ends with a winner under the turn cap.

**Computer player.** `chooseShot` may pick a mounted weapon that can fire (`mount` on the result; half the time when it has one) and uses the same aim search from the weapon's pad, held to the role's angle limits. It has no wall logic in v1: it aims by the plain physics at a standing fighter and ignores bricks, so a shell that meets a wall simply hits the wall. It always chooses a legal shot.

**What the snapshot and the shot result add** (all optional, only with `baseInBattle`): `Match.baseInBattle`, `selectedMount`, `bricks` (by `BrickId`, such as `"FUTURE:3"`), `mounts`, `spots`, `builtBase`; `ShotResult.stoppedBy` and `volley`; `BlastOutcome.built` with `brickHits`, `brickFell`, `bricksFell`, `mountHits`, `mountDown`, `guardBlocked`. See docs/CONTRACTS.md.
