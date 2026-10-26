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
[ Battle Arena ] ──────────► 2 Goes ➔ Awkward Tumbles ➔ Math/Reading Reload
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

Weapon Workshop (added 2026-10-24, owner request: "in forge weapons, you can create your own weapon to forge"):

⚬ The Forge has a "Make my own weapon" button for each team. It opens the Weapon Workshop.
⚬ Pick a style: Team Past picks Sword, Longbow or Cannon. Team Future picks Blade, Rifle or Rail Cannon. The style sets the picture, the starting points, and (later) how it fires from a base spot.
⚬ Spend 10 points with plus and minus: Power (direct hit damage, 19 to 31), Reach (how far it throws, Short to Far) and Splash (near miss damage, 6 to 14). Each stat holds 1 to 5 points.
⚬ Fair by design: a weapon's score is direct + near + 20 x (speed scale - 1). The best custom weapon scores 43. The Iron Cannon and Rail Cannon score 48. A test checks every legal design at every Forge level.
⚬ Name it: pick one silly word from each of two lists (such as Wobbly Noodle), or type a name of up to 14 letters, digits and spaces. A typed name with a blocked word, a player's name, or 3 digits in a row is not used: the screen says why, kindly, and keeps the picked words.
⚬ Cost: 6 Scrap for the gentlest weapon, up to 24 Scrap for the strongest (the WORKSHOP cost table). Too little Scrap says how much more is needed.
⚬ The new weapon is equipped at once and shows in the Forge's "My weapons" section with a star. It levels up like the others (to level 3) and plays like a catalog weapon. Each player keeps up to 6 per team, saved on the device by name.
⚬ My weapons in Build Base: in Weapons mode, the list for a pad starts with "My weapons", the player's own weapons for that side (picture with a star, name, damage). One goes on a pad for no Scrap, like a catalog weapon. The pad keeps its own copy, so a saved base never breaks. With none made, a quiet link, "Make a weapon in the Forge", opens the Workshop.

C. Base Placement (Futuristic City)

Instead of a fixed spawn point, the Future player can choose where to plant their Secret Base across the Austin cityscape:

⚬ Perched on top of a neon skyscraper.
⚬ Tucked beneath a futuristic Lady Bird Lake bridge.
⚬ Disguised inside a high-tech food truck pavilion.
⚬ Position directly alters shooting elevation, trajectory angles, and cover obstacles.

Team Past gets the same kind of choice for its castle (added 2026-10-23, owner request: "the past needs a way to have things that block too"):

⚬ Hill Fort: high on a solid rock. The best view. Low shots thud into the rock.
⚬ Village (code id `villageWall`): on the ground, behind a low stone wall out in front. It was called Village Wall until 2026-10-25, when the panel found it sounded like the Stone Wall ability.
⚬ Drawbridge: low, behind a raised wooden drawbridge that stops flat shots, so players lob.
⚬ The Village is the default (owner decision, 2026-10-24), the way Food Trucks is for Team Future. A new family, and every plan saved before castle places, starts at the Village. One castle card is always picked.

Every blocking shape is drawn as the thing it is (stone courses, moss and grass, cherry petals, temple vines, tower windows with neon trim, a steel truss, a taco truck, oak planks with iron bands), never a plain dark box. The picture and the solid shape are the same outline, so a shell hits exactly what a child sees.

D. Clear Turn Indicators (Single-Computer Hot-Seat)

Because two players share one screen, turns must be unmissable:

⚬ Massive Turn Banner: Drops down with a cartoon horn sound: "ALEX'S TURN (TEAM PAST) — TAKE AIM!"
⚬ Active Player Glow: The current player's side of the screen lights up with bright, animated framing, while the waiting player's side dims slightly.
⚬ Pass-the-Screen Alert: A prompt appears between turns: "Pass the screen!" with the next player's name and an "I'm ready!" button. (The "No peeking" line was removed on 2026-10-24.)

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

⚬ Turn Sequence: 2 goes per turn. A go is a launcher shot, or the walking helper's Walk out or Come back.
⚬ Reload Modal: Pops up immediately after go 2.
⚬ Power Shot: A right answer (fast or slow) earns exactly one extra shot that does 1.5 times the damage (`BONUS.damageMultiplier`). Walls and force fields still apply. It has no question and no bonus of its own. A wrong answer earns no Power Shot but never blocks play.
⚬ Asymmetric Tuning: Player 1 (e.g., 2nd Grade Reading) reads and picks sight words to reload; Player 2 (e.g., 8th Grade Math) solves pre-algebra equations.
⚬ Fast answers grant bonus scrap materials to spend in the Camp Hub.

4. Phased Development Roadmap

Phase 1: Local Single-Computer Core Loop (MVP)

⚬ Target Device: Single computer (Hot-seat pass-and-play).
⚬ Features:
  ⚬ Two-player name entry and turn-indicator banners (Player 1's Turn / Player 2's Turn).
  ⚬ Basic 2D ballistics engine (angle, power, arc, wind).
  ⚬ 2-go limit triggering the Educational Reload Modal.
  ⚬ Elementary question bank (Math & Reading) with grade-band selection.
  ⚬ Flat base health (100 HP at first, 400 since the 2026-10-24 pace rule) with the first awkward tumble animation and post-fall comic speech bubbles.
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
⚬ Active Indicator: Prominent comic banner at top center reading: "ALEX, YOUR TURN!" with "GO 1 OF 2" and two dots beside it ("SHOT 1 OF 2" with Squads off) with glowing directional arrows.
⚬ Slapstick Moment: A character who was just knocked over lies hilariously flat on their stomach with arms spread out, a cartoon speech bubble above them saying: "Just checking the lawn for four-leaf clovers!"
## Squads: the walking helper (on)

Each side has two helpers: its launcher (the fighter that shoots, picked with "Pick one") and one walking helper. Team Past has Sir Bonk, a small knight with a pink foam mallet. Team Future has Robo Bonk, a small robot with a glow noodle. A turn is still 2 goes, then the reload question. The Power Shot is always the launcher's.

- **Walk out (one go).** Pick the helper, then tap Walk out. He walks along the ground from his base. The hill, mound, pillar or wall in the middle never stops him: he is drawn walking in front of it. He stops next to the first enemy thing in front: the enemy helper, or the enemy base.
- **He keeps bonking.** At the start of every turn after that, the enemy's turn too, he bonks what is next to him, with a "Bonk!" and a puff. A bonk takes 12 base health (`SQUADS.standBonkDamage`, about an eighth of a perfect turn). The castle gate upgrade cuts it (never below 1). A force field or a Hoverboard Dodge stops it like a shot. Two helpers side by side bonk each other (1 health each) and leave the bases alone.
- **Health.** He has a heart and pips above him (`CHARACTER_HEALTH.hp`). A shell from the other side that lands on him costs 1 (2 for a Power Shot). A near miss costs nothing, but he wobbles. At 0 he does a silly tumble, says a funny line (with a caption), walks home dizzy, and sits out one full turn of his team. His own side's shells never hurt him. Nobody is hurt.
- **Come back (one go).** While he is out, Come back replaces Walk out. He walks home and is ready again on his team's next turn.
- **Sound.** A soft step sound for a walk and a foam knock for a bonk, made in code. Only after a tap, and never with sound off.
- **Birds and gusts.** They only nudge shells. The walk and the bonks are never touched by them.

Pace: a player with perfect aim still needs about five turns of their own to win. A helper left alone all match helps a lot but cannot win alone (`tests/game/squadPace.test.ts`). Matches always end, even when a side never aims (`tests/game/squadWalk.test.ts`). The Computer player leaves its helper home.
## Disturbances: birds, gusts and recoil (on)
Owner request, 2026-10-24: shots were too predictable. Three things now nudge a shot, the same way for both teams. All numbers are in `DISTURBANCE` (`src/game/config.ts`).
- **Birds.** One or two cartoon birds fly across the sky each turn on a path the player can see before firing. A shell that touches a bird gets bumped off course (a feather puff, "Squawk!" and a squawk). The bird is never hurt. A bird bumps a shell at most once and never right at the muzzle.
- **Gust.** The wind is still set at the start of a turn. On top of it, one gust per turn shoves the shell sideways for a moment in mid-flight (streaks, an arrow, "Gust!" and a whoosh sound).
- **Recoil.** After a shot, the Angle and Power dials slide a little: about 3 degrees and 5 power for the catapult and missile bunkers, almost nothing for the archer and laser gun. The sliders show it, so the player re-aims for the next shot. The first time recoil moves the dials in a match, "Kick! Your aim moved." shows in the message lane as a caption (`DISTURBANCE_COPY.kick`), clear of the controls. It comes up once the shot has landed, so it never hides the shell or the "Gust!" word. It stays while the player aims again and comes down at the next shot; when a reload comes next, it stays `DISTURBANCE.kickCueMs` (1.5 s) and comes down before the cover. Once per match: it is kept on the battle flow only, never saved, so a rematch shows it again. It shows with reduced motion too (owner, 2026-10-25).
- **The preview stays honest.** The dotted preview and the angle guide show plain wind only. The full arc left after a shot shows what really happened.
- **Fair and never stuck.** Both teams get the same chances. A direct hit can always be reached by trying again (`tests/game/matchDisturbance.test.ts`). Disturbances make matches a little longer on average, never endless.

## Pace (owner decision, 2026-10-24)

"Perfect aim should take about five turns; right now you can lose everything in one or two turns." So a player with perfect aim who answers every reload right needs five turns of their own to win. A base starts with 400 health (`DAMAGE.startingBaseHp`), and a fighter with 4 when character health is on (`CHARACTER_HEALTH.hp`). Hit damage is unchanged: direct 25, near 10, and the Power Shot 1.5 times (38). A perfect turn (two direct hits and a Power Shot) does 88, so a base lasts a little under five perfect turns. Weapons, ammo, walls and missiles keep their meaning because they change damage, not health. The two health upgrades grew four times with full health: Upgrade the Tower adds 48 a level, and Laser Squad heals 8 at the end of its own turn. A force field still blocks whole hits (1 a level). `tests/game/pace.test.ts` plays 40 seeded matches with perfect aim on both sides, in both health modes, and the shortest is 9 turns (both teams counted, so the first team wins on its fifth turn at the earliest). It also checks that a realistic player (`PRACTICE_BOT.scriptedHuman`) takes at least as long at the median. Every fighter is covered: the same perfect shooter plays each mirror pair (A~2, B~5, C~1, D~3, E~4, picked every turn) in the flat 400 game, and the old heavy hitters and the hardest hitters against the smallest built base, and a plain check holds every fighter's perfect turn to 88. So no fighter hits harder than the default (every `damageScale` is 1 or less, in `src/game/units.ts`): any scale above 1 rounds a direct hit to 26 or more. The Spearman and Saber Robot were 1.3 (116 a perfect turn, a win on their fourth turn) and the Catapult and Missile Bunkers 1.1 (98, too close to the 360 foundation). Since 2026-10-25 all four are 1.0. The fighters now differ by where they stand and how far they throw: the Catapult and Missile Bunkers reach farthest, the Spearman and Saber Robot stand closest with a slow launch that is easy to aim, and the Archer and Laser Gun Robot hit softer (0.8) with a little more reach. Measured: perfect aim 9 to 10 turns with base health and 9 to 12 with fighter health; the realistic player has a median of 12 turns with base health and 18 with fighter health.

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
- **The walking helper (Squads).** `chooseHelperGo(state, side, plan, rng)` in `bot.ts` decides once a turn, on go 1 of the computer's own turn, never on go 2 or the Power Shot. It uses the same match goes a child has (`selectHelper`, then `dash` or `recall`), so a walk-out or a call home uses up that go, and it can never do what the match refuses (a helper already out, a resting helper, no free spot). On screen the note "Computer player is thinking" shows for 0.9 s (`PRACTICE_BOT.helper.thinkMs`, shorter with reduced motion), then the same walk and caption as a child's Walk out or Come back button play. The next shot picks the launcher again.
- When it walks out: once the other side has sent its helper (he is out, or resting after a bonk-off or a call home), it answers in kind with `replyChance`: it meets him at its doorstep, or goes while the way is clear. On a field where the other helper has never left home it uses `dashChance`, which is 0 at every level today (see the measurement below).
- When it calls him home: only a hurt helper (a quarter of his full health or less, `hurtShare`) who is losing a bonk-off (the enemy helper is right next to him with more health), with `recallChance`. Even health means both tumble together, so he stays.
- The simulation (`playBotMatch`) drives the helper the same way (`helpers` option), and both places draw from the computer's own seeded stream.

Levels (tunables in `PRACTICE_BOT.levels` and `PRACTICE_BOT.helper.levels`, retuned 2026-10-25; Hard again the same day when it learned to use its helper):

| Level | Angle error | Power error | Wind read | Right answers (grade 0) | Walk out first | Answer a walk-out | Call a losing helper home |
|---|---|---|---|---|---|---|---|
| easy | 6 deg | 10.5 pts | 35% | 70% | never | 75% | never |
| medium | 5 deg | 9 pts | 60% | 80% | never | always | 10% |
| hard | 4.75 deg | 8.5 pts | 65% | 92% | never | always | 10% |

Hard was 4.25 deg and 85% right before the helper change. A wider aim with more right answers (more Power Shots) keeps Hard in its band when the child never walks out, and loses less when the child does.

Simulation (`npx tsx scripts/simulate-bot.ts 2000`: 2,000 seeded matches per pairing, sides and first turn alternate). The "decent human" is a scripted player (4.5 deg, 9 pts, reads 50% of wind, 75% right). It runs in the live setup: base health 400, birds, gusts and recoil on, Squads on, and no built base. It is measured twice: a child who never walks the helper out (the case the levels are tuned for), and a child who walks him out every time he is home and ready (the strongest simple use; in practice about once or twice a match, because a helper left alone stays out).

| Level | Child never walks out: before the retune | After the retune (helper unused) | Now (helper rule) | Target |
|---|---|---|---|---|
| easy | 15.8% | 30.3% | 30.3% | 25 to 35% |
| medium | 50.0% | 50.0% | 50.0% | 45 to 55% |
| hard | 89.3% | 63.4% | 64.8% | 60 to 65% |

| Level | Child walks out: computer never uses its helper | Now (helper rule) | Floor |
|---|---|---|---|
| easy | 4.3% | 14.5% | 10% |
| medium | 12.5% | 31.6% | 25% |
| hard | 18.6% | 42.9% | 40% |

A second seed set (seeds from 90,000, 2,000 matches) gives 29.9%, 50.1% and 63.0% (never walks out) and 12.2%, 30.9% and 41.0% (walks out). Easy and Medium did not change when the child never walks out, because the rule draws no random number until the other helper has left home.

Why the computer never walks out first: a helper that nobody bonks back stays out all match and bonks the base at the start of every turn, so walking out first is very strong. Even a 3% to 5% chance a turn lifts Hard to about 67% to 68% when the child never walks out, and it does not help when the child does. Calling a helper home also cost about 1 to 2 points in every test, so it stays rare.

The earlier built-base check (600 matches, a typical built base on both sides, before the helper change) gave 22.7%, 46.2% and 62.3%: Easy is a little weaker there, because built-base matches run longer (about 22 to 24 turns), which leaves less to luck.

Bot against bot (row wins, no helper walks out on either side): easy 28.6% vs medium, 18.8% vs hard; medium 71.2% vs easy, 35.5% vs hard; hard 81.5% vs easy, 62.5% vs medium. Matches against the decent human last about 13 to 14 turns (both teams counted). `tests/game/botLevels.test.ts` plays 200 seeded matches per level for each case: it pins each level inside a band around its target when the child never walks out, and above its floor when the child does.

What the levels do not do yet (measured 2026-10-25, noted for later in BACKLOG.md):
- The Computer player has no upgrades. A child with a one-level Force Field (it blocks the first damaging hit of the match) drops Hard from about 61% to 53%. Three levels drop it to about 32%.

## Character health (rules built, flag off)

### Match length (parent setting)

Setup has a Match length choice: Short, Normal, Long. Normal is the default and is exactly the balance below (base health 400, or 4 health per fighter; see Pace). Short halves full health (base 200, fighters 2). Long is one and a half times (base 600, fighters 6, rounded to whole numbers, never below 1). A direct hit still does 25 base damage (1 fighter health, 2 for a Power Shot), so Short ends in 8 direct hits and Long in 24, against 16 at Normal. It does not change the 2-goes-then-reload turn, the reload question, timing or Scrap. It is saved on the device and "Clear my data" resets it. Numbers: `MATCH_LENGTH` in `src/game/config.ts`.

Owner decision (2026-10-20): "Every character has three health. It REPLACES base health." The pace rule (2026-10-24) raised it to four. The rules are pure, in `src/game/damage.ts` and `src/game/match.ts`, with numbers in `CHARACTER_HEALTH` in `src/game/config.ts`. The flag is `CHARACTER_HEALTH.enabled = false`. It stays off until the Battle scene and the HUD draw health pips and play the awkward fall. With it off the game is exactly as before. A match reads it as the default of `MatchOptions.characterHealth`; tests pass the option and never change the constant.

What changes with the flag on:
- All ten fighters (five per team: balloon, archer, cannon, catapult, spear; tank, helicopter, bunkers, saber robot, laser robot) start with `hp: 4`. The snapshot holds `unitHp` by fighter id.
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

Win: a team loses when ALL its fighters are knocked out. The last fighter standing keeps the turn shape: 2 goes, then reload, and a right answer earns one Power Shot. `winnerOfMatch` gives the winner in both modes (fighters when the flag is on, base health when off). Matches always end: a test plays 200 seeded Computer player matches with the flag on and each one ends with a winner under the turn cap. The Computer player (`chooseShot`) only picks standing fighters and aims at a standing enemy fighter.

What stays the same: 2 goes then reload, the Power Shot, wind, scrap, the reload question, the tumble lines, seeded randomness.

## Built bases with base health (on, 2026-10-25)

Owner decision (2026-10-25): built bases take hits in battle for everyone. Bases are built from bricks and weapons on spots: bricks hold the base up, weapon spots fire. `BASE_IN_BATTLE.enabled` is `true`. Character health stays off, so this is the base health mode (400 at Normal). A team counts as built when its chosen base (`chosenBase` from the Camp) has at least one brick on the foundation. A team with no such base plays exactly as before (the drawn castle or secret base, 400 flat).

Plan (each step starts with its RED test):
1. Fit the base into the old base footprint (`fitFrame` in `builtBase.ts`). RED: `tests/game/builtBaseHealth.test.ts` "fits inside the footprint, bottom on its bottom edge, mirrored for Team Future, never more than 2 px a step".
2. Brick health in base health mode (`brickHealth`). RED: same file, "starting total in the fair band for the smallest, a typical and the biggest base; the foundation holds at least 90 percent".
3. Shots and bonks hit bricks in `match.ts` (`landOnBricks`). RED: same file, "a shell hurts the brick under it", "a fallen brick takes what it held up", "the HUD number is the sum left", "win at 0 or when the foundation is gone", "cuts, force field, dodge, repair and bonks still work".
4. The Computer player aims at the standing bricks. RED: "seeded bot matches with built bases all end with a winner".
5. Pace. RED: `tests/game/pace.test.ts` "perfect aim needs at least 9 turns with the smallest, a typical and the biggest built base", plus a worst-case floor test.
6. The Camp passes each player's chosen base into the match (`battleBasesFor`). RED: `tests/game/builtBaseHealth.test.ts` "only bases with bricks go into battle".
7. The scene draws the bricks with the builder's own art (`src/scenes/battle/baseLayer.ts`). RED: `tests/scenes/battle/baseLayer.test.ts` (sprite plan inside the footprint, crumble stays on screen and ends on the ground, reduced motion is a fade).
8. The flow plays the crumble after the blast and after a bonk. RED: `tests/scenes/battle/flowBuilt.test.ts`.
9. Browser: `e2e/built-base.spec.ts` at 1280x800 and 1024x768 (seed a base, start a match, hit it, see bricks crumble, nothing covers the cards, fighters or HUD).

### How a built base plays

- **Where it stands.** The base is fitted inside the old castle's (or secret base's) box on its side of the field (`fitFrame`): the box around its bricks and weapon pads, centered, standing on the box's bottom edge, the same shape, and never bigger than 2 px a build step (`BASE_IN_BATTLE.fitMaxScale`, so a cell is at most 16 px). Team Future's base is mirrored so it faces Team Past. It moves with the castle place and the Austin spot (Hill Fort, Skyscraper and so on). The aim, the fighters, the middle shape, the HUD and every tap target stay exactly where they were. The bricks are drawn behind the fighters.
- **How it looks.** Each brick is the builder's own picture (`brickSvg` in `src/ui/baseBuilderArt.ts`, turned into a texture), so materials and patterns match Build Base. A hurt brick gets darker in two steps and shows one or two cracks (the change never rests on color alone). Weapon pads with a weapon are drawn on their spots.
- **Health.** The HUD keeps "N / M" on one line. M, the starting total, is the saved brick hit points times 1.5 (`health.perHp`), held between 1 and 1.25 times the flat full health (`health.band`): 400 to 500 at Normal, 200 to 250 at Short, 600 to 750 at Long, raised by a tower upgrade like the flat base. So the smallest base (one plank) starts at 400, the typical test base (seven bricks) at 400, and the biggest (60 gates) at 500. The bricks on the foundation share 90 percent of it by their saved strength (`health.foundationShare`); the bricks above share the other 10 percent (all of it goes to the foundation when nothing is above). Shares are whole numbers, at least 1 each, split by largest remainder, so they add up exactly and repeat every time. N is the sum of the standing bricks.
- **Shots.** A shell that touches a standing enemy brick bursts there: a direct hit on that brick. A shell that lands anywhere else is scored against the closest standing brick, with the usual radii (direct within 48 px, near within 120 px, ammo scales them). Damage is today's base damage: direct 25, near 10, the Power Shot 1.5 times, the weapon and ammo scale it, the gate cut lowers it, and a force field or a Hoverboard Dodge stops it. The brick loses that much (never below 0). The shot result's `damage` is how much N really dropped. Flier shots arc over bricks on the way up, as before.
- **Falling.** A brick at 0 falls, and every brick it held up falls too (the support rule below). Their health leaves N. The scene puffs dust where each one gave way, then each brick hops, spins a little, lands on the ground and fades away, a few at a time in the rules' order. With reduced motion it only fades. A weapon on a fallen brick tumbles with it. Nobody is hurt. The crumble has no word of its own (owner, 2026-10-25).
- **The saved base is safe.** A match never changes a saved base. When at least one brick of a side's built base fell in the match, Victory adds a second row to Chrono's bubble that names that side: "Sam, your saved base is safe. Build it again any time!" (both sides: "Alex and Sam, your saved bases are safe. Build them again any time!", `VICTORY.savedBaseSafe`). The bubble is a status region, so a screen reader says it too. To keep Victory on one screen with six medals a card, the "Awards" heading is then for screen readers only. Rules: `crumbledTeams` in `src/game/crumbled.ts`, carried on `BattleResult.crumbled` and `VictoryOptions.crumbled`. Tests: `tests/game/crumbled.test.ts`, `tests/scenes/battle/flowBuilt.test.ts`, `tests/scenes/flow.test.ts`, `tests/ui/screens.test.ts`, `e2e/look.spec.ts` (fits at every iPad size).
- **Win.** A side loses when N reaches 0 or when no brick on its foundation stands (they mean the same for any base from the builder).
- **Helpers.** Squads stays on. A walking helper's bonk (12, through the gate cut, force field and dodge) chips the brick on the foundation nearest the enemy. A Laser Squad repair patches the most hurt standing brick, never past its full health.
- **Pace.** Four perfect turns do at most 352, and the foundation always holds at least 360, so perfect aim needs five turns of its own (9 total) with any base. `tests/game/pace.test.ts` plays 40 seeded perfect-aim matches with the smallest, a typical and the biggest base on both sides and checks it, plus that worst case. Measured (perfect aim, both sides, 3 seeds): smallest 9 to 11 total turns, typical 11 to 13, biggest 19 to 30. The scripted human: about 22 with the smallest and typical bases, about 55 with the biggest. Every match ends.
- **Computer player.** It aims at the box around the other side's standing bricks (plain to see), with its usual error. It never sees a question.
- **Weapons on the pads.** They fire, guard and fall with their brick. See "Weapons on the pads" below. With character health on, the older rules below still apply.
- **Panel review (medium, 10 min, 2026-10-25).** 6-year-old: "My castle is in the game! The top fell off!" GO. 12-year-old: wants the weapons on the pads to fire (follow-up in BACKLOG.md); likes that a big base is not unbeatable. GO. Parent: no new data, no network, saved bases stay on the device and a match never changes them. GO. Teacher: the reload question is untouched, and the HUD number still reads as a plain "N / M". GO. Comedy writer: bricks hop, spin and puff, nobody is hurt; asks for a "boing" later. GO. Moderator: GO, with the mounted weapons and the floating riders over a small base as follow-ups.
- **Which base.** The Camp takes each player's chosen base for their side (`battleBasesFor`), only when it has a brick on the foundation. A player with no saved base gets today's castle or secret base and 400 flat. A rematch keeps the bases.

### Weapons on the pads (base health, 2026-10-25)

Owner intent: a base is bricks plus weapons on four numbered spots, and the weapons on the spots fire in battle. Character health stays off, and the pace rule holds (perfect aim needs at least 9 total turns).

**Picking.** The "Pick one" selector of a team whose base has a weapon that can fire gets one more round token, Base weapons, after the five fighters. It shows the picture of a weapon. Tapping it switches the selector to that team's weapons and picks the first one: one token per filled pad that can fire, in spot order (the spot number and the weapon's picture), then a token with the picked fighter's letter that switches back to the fighters. So the tokens on show always hold what Fire will shoot. With the sixth token the selector lays out six fixed token places, the name of what is picked ("Cannon") runs under all of them, and the words "Pick one" stay for screen readers only (the group is still labelled "Pick one"). That makes it narrower than the five-fighter selector, so the selector, the sliders and Fire keep one row at 1024x768, and it never changes width between the two views. A weapon token's screen reader name is "Spot 1: Cannon". The swap token has a dashed ring, so it reads as a switch. On the field the picked pad wears a ring in the team color, and the angle guide starts at the pad. A weapon is `mount:0` to `mount:3` (`selectUnit('mount:2')`). Only a filled pad on a standing brick (or on the foundation) can be picked: an empty pad, a pad whose brick fell, and the Shield generator (it does not fire) are refused. A fighter's letter key still picks that fighter.

**A go with a weapon.** It is a go like any other: it counts toward the 2 goes, then the reload. It fires from the middle of its pad with the same Angle and Power sliders, wind, birds and gust. It has no recoil and fires its own shells (the Ammo button does not change it). A `direct` weapon fires flat (0 to 45 degrees), a `lob` in an arc (45 to 90, over walls), and a `volley` 3 smaller shells fanned 4 degrees apart (`volleyAngles`). The dotted preview starts at the pad.

**Damage (base health).** A weapon hits like a fighter, scaled: `mountScale = min(1, damage x roleMultiplier x shells / 20)` (`BASE_IN_BATTLE.baseHealthMount`: `refDamage` 20, `maxScale` 1). So a direct hit does `round(25 x mountScale)` and a near miss `round(10 x mountScale)`, then the Power Shot (1.5 times), the gate cut, the force field and the Hoverboard Dodge apply as for a fighter. A volley's shells share it: each is scored on its own with `mountScale / 3`. A volley counts as one hit for the dodge and the force field. Every catalog weapon comes out at 1 (Cannon 20, Catapult 25 x 1.5, Archer post 10 x 3, Ballista 35 are all capped), so no weapon on a pad hits harder than a fighter's standard shot. That cap is what the pace rule needs: a perfect turn can do at most 88 (25 + 25 + 38), and the foundation always holds at least 360. A weak weapon of your own hits less (a Workshop weapon with Power 1 is 0.55 as a direct, 0.9 as a volley, 0.83 as a lob).

**The Power Shot** fires from whatever is picked when Fire is pressed, a fighter or a weapon. It is 1.5 times as hard either way.

**Shield generator (Team Future, `guard`).** It never fires. Once per enemy turn it blocks the first go that would hurt its base and whose shell lands within 90 px of its pad (`BASE_IN_BATTLE.guardRadius`): nothing is damaged, and the shot result's `built.guardBlocked` names it. It goes before the Hoverboard Dodge and the force field, so those are not used up. It is ready again on the next enemy turn. It falls with its brick like any pad.

**Hits on a pad.** A pad stops an enemy shell like a brick. Its box is the pad as drawn: 10 build steps across at the base's scale, never under 8 px (20 px on a typical base). The shell bursts there as a direct hit on the brick the pad stands on, or on the closest standing brick when the pad stands on the foundation. A pad has no health of its own in this mode. When its brick falls, the weapon tumbles with it and is gone for the match. If it was picked, the pick goes back to the fighter.

**Computer player.** It may pick a weapon that can fire (half the time when it has one, `BASE_IN_BATTLE.botMountChance`) and aims from the pad with its usual error, inside the role's angles. Seeded. Matches still end.

**Workshop weapons.** A weapon of your own on a pad fires too. Battle reads the pad's copy (`ResolvedSpot.custom`, from `spotDef`), with the role, damage and picture of its style. Its token wears the Forge star.

**On the field.** The pad flashes in the team color as its weapon fires (a blink in place with reduced motion), and the shells fly from it. A volley's 3 shells fly together.

**Pace, measured** (40 seeds each, the strongest four weapons on both bases: Ballista, Catapult, Ballista, Archer post against Missile pod, Laser, Turret, Missile pod; the Computer player fires from a pad about half the time). Perfect aim: smallest base 9 to 14 total turns (11 at the median), typical 11 to 15 (13). Without weapons: 9 to 13 (10) and 11 to 15 (13). The scripted human: about 25 turns at the median with weapons, 23 to 24 without. `tests/game/pace.test.ts` checks the 9-turn floor with weapons, and that no catalog weapon or weapon of your own can do more than 88 in a perfect turn.

**Panel review (medium, 10 min, 2026-10-25).** 6-year-old: "My cannon shoots! It glows!" Taps the picture token, then the cannon. GO. 12-year-old: likes that a lob arcs high and the volley spreads; asks why the Ballista is not stronger than a fighter (the pace rule caps it; noted). GO. Parent: no new data, no network, nothing saved by a match. GO. Teacher: the reload question and the 2-goes turn are untouched; the weapon's name shows under the tokens. GO. Comedy writer: wants a "pew-boing" for the pad flash later. GO. Moderator: GO. Follow-ups in BACKLOG.md: Team Future's fighter token in the weapons view shows a number, like the spot numbers on the weapon tokens (the dashed ring and the screen reader name tell them apart; a small person picture would be clearer), and a Hear it line for what each weapon does.

Plan (each step starts with its RED test):
1. Weapons of your own resolve in battle. RED: `tests/game/builtBaseMounts.test.ts` "a Workshop weapon on a pad is a mount with its role and damage".
2. Mounts exist in base health mode and can be picked. RED: same file, "a filled pad on a standing brick can be picked; an empty pad, a fallen pad, the Shield generator and the other side's pad cannot".
3. A mount go fires from its pad and counts as a go. RED: same file, "the shot starts at the pad", "a mount go counts toward the 2 goes; a third go throws", "the Power Shot fires from a picked weapon".
4. Damage. RED: same file, "a weapon's direct hit is round(25 x mountScale)", "a volley's shells share the damage", "every catalog weapon is capped at 1", "a dodge or force field takes a whole volley".
5. Pads as walls and falling. RED: same file, "a shell on a pad hurts the brick under it", "a pad falls with its brick, cannot be picked, and the pick goes back to the fighter".
6. Shield generator. RED: same file, "blocks the first damaging go within 90 px once per enemy turn".
7. Pace. RED: `tests/game/pace.test.ts` "perfect aim needs at least 9 turns with four strong weapons on both bases" and the worst-case floor with weapons.
8. The Computer player uses weapons and still finishes. RED: `tests/game/builtBaseMounts.test.ts` "seeded Computer player matches with weapons end, and it fires from a pad sometimes".
9. HUD selector. RED: `tests/ui/hudMounts.test.ts` (the Base weapons token shows only with a weapon that can fire, the mode switch, 56px tokens, names at 20px, keyboard).
10. Flow and scene. RED: `tests/scenes/battle/flowMounts.test.ts` (the pick reaches the rules, the guide and the charge start at the pad, the pad flashes, a volley flies 3 shells, the Computer player's mount pick is used).
11. Browser: `e2e/built-base-mounts.spec.ts` at 1280x800 and 1024x768 (seed a base with weapons, pick a weapon, fire, the shot leaves the pad, nothing covers cards, fighters, the HUD or the bar).

## Built bases in battle with character health (rules built, character health off)

These are the rules when `CHARACTER_HEALTH` is on (it is off). In the live game see "Built bases with base health" above.

Owner decision (2026-10-20): "the bricks take hits", the weapons on the four spots are real firing positions, a brick that is hit enough falls away, and a weapon sits on its brick so it falls when the brick falls. Nobody is hurt: bricks puff and tumble, and a fighter behind a falling wall is never damaged by it. The rules are pure, in `src/game/builtBase.ts` and `src/game/match.ts`, with numbers in `BASE_IN_BATTLE` in `src/game/config.ts`. The flag is `BASE_IN_BATTLE.enabled = true` (since 2026-10-25). A match reads it as the default of `MatchOptions.baseInBattle`; tests pass the option and never change the constant. With `characterHealth` on, these rules apply. With it off (the live game), "Built bases with base health" applies.

**Choosing the bases.** `MatchOptions.bases` is `{ PAST?: ChosenBase, FUTURE?: ChosenBase }`, where `ChosenBase = { pieces, spots }` is `chosenBase` plus `chosenSpots` from the base builder (`chosenBaseFor(bases, name, team)` makes one). A missing base is the default fixed base, as today. A team that brings a base (bricks or weapons) no longer has the default base box stopping shells: its bricks are its base.

**Layout.** The build plot (24 by 12 cells, 192 by 88 steps) maps to the battlefield at `BASE_IN_BATTLE.scale` (2 px per step, so 384 by 176 px). Team Past builds from the left (`margin` 40 px from the edge). Team Future is mirrored and sits on the right, so both face each other. The plot's bottom edge is the ground line. The snapshot holds each brick's box (`bricks`) and the four spots (`spots`), all in battlefield px. A shape of your own is drawn as its box, but it rests on (and holds up) other bricks by its filled squares.

**Brick hit points.** Each brick starts with the `hp` saved in the base. A shape of your own has the sum of its squares, and each square counts by its material (`BASE_BUILDER.materialHp`: glass 3, wood 5, jelly 6, stone and panel 8, metal 12). It takes hits as one brick, and it rests by its filled squares whatever they are made of. A shell that reaches a brick box bursts there (a direct hit) and does damage in brick hit points. A near miss (a shell that lands next to a wall) does 0. One hit per shell.

| Shot | Damage to a brick or weapon |
|---|---|
| Fighter shot | 20 times the fighter's `damageScale` (`brickDamage.fighterShot`) |
| Mounted `direct` weapon | its catalog `damage` times 1 |
| Mounted `lob` weapon (splash) | its catalog `damage` times 1.5 |
| Mounted `volley` weapon | its catalog `damage` times 1, for each small shell |
| `guard` | does not fire |
| Power Shot | the damage above times 1.5, rounded (`BONUS.damageMultiplier`) |

A brick at 0 hit points falls away: the shot result lists it in `built.brickFell`. Nobody is hurt, the scene puffs it.

**Support rule.** A brick is held up if it rests on the foundation (its bottom is the bottom of the plot) or on a standing brick directly under it (the bottom edge of one of its filled squares lies on the top edge of a filled square of that brick, and they overlap sideways; `restOverlap` in `baseBuilder.ts`). The builder uses the same rule, stricter: a brick may only be placed where it overlaps what holds it up by at least half a cell (`BASE_BUILDER.minSupportSteps`), and an old floating base is settled when it loads (see ARCHITECTURE.md "Base builder"). So every base from the builder starts a match with every brick held up (`tests/game/baseBuilderSupport.test.ts`). When a brick falls, every brick that is no longer held up falls too, in a fixed order: lowest bottom edge first, then leftmost, then by index. One pass is enough, because what holds a brick up is always lower. All of them are listed, in that order, in `built.bricksFell` (the brick the shell took out comes first). A brick that was already floating when the match began (nothing under it) is anchored and never falls by support. This only guards against a base made outside the builder: the builder never makes one. A fallen brick never comes back and never blocks a shell again.

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
