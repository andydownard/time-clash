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
⚬ Asymmetric Tuning: Player 1 (e.g., 2nd Grade Reading) identifies sight words to reload; Player 2 (e.g., 8th Grade Math) solves pre-algebra equations.
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

A rules-based opponent so one child can play alone, and later fill a seat when no second player is there. Pure logic in `src/game/bot.ts` (and `botPlay.ts` for simulated matches). No screens yet. Off by default: `PRACTICE_BOT.enabled = false` in `src/game/config.ts`.

Rules:
- It sees only what a child can see: the bases, wind, health and its own fighter. It never sees the other player's reload question.
- `chooseShot(state, side, level, rng)` returns an angle, a power and a fighter. The aim is always clamped, whole numbers, and legal. It never skips a shot.
- It finds a good aim on a copy of the physics, then adds a human-sized error. The error spread (degrees and power points) and how much wind it reads are set per level.
- `answerReload(question, level, rng)` answers only its own question. The chance of a right answer falls with the question's grade (never below a blind guess among four). It also returns a think time in ms (1.8 s to 14 s), longer for older grades and reading questions, so the screen can pace it.
- Randomness is seeded. Same seed, same game.
- The screen must say "Computer player" (never "bot", "AI" or "assistant") and show it all the time. No data model change was needed.
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
