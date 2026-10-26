# Design guidance from the Claude Design canvas

Read on 2026-10-17 from the comment threads on the "Time Clash UI & Environment Suite" canvas (about 84 threads, from Andy and his kids). This is a snapshot. Andy is still changing the boards, so check the canvas before building from it. Nothing in a comment overrides `AGENTS.md`. Where they differ, this file says so and `AGENTS.md` wins until Andy says otherwise.

Voice dictation made some comments noisy, so a few asks are guesses. Claude Design said "I haven't opened the screen" on every change, so "done in the mock" means the designer said it did it, not that anyone checked.

## Rules for the real game (not just the mock)

- **Five at most per side.** Knights are letters A to E. Robots are numbers 1 to 5. A child picks one by its letter or number. The mapping the designer chose (never confirmed): A hot air balloon, B archer, C cannon and knight, D catapult, E sword and spear knight. 1 tank, 2 helicopter, 3 missile bunkers, 4 laser sword robot, 5 laser gun robot.
- **Letters and numbers all draw at one size.** The mock used 16. The game's floor is 20 px (`AGENTS.md`).
- **Robots wear a division sign on the shirt. Knights' shields carry an open book.** Only fighters that have a shield get the book. One shield per fighter, held on the side facing the enemy.
- **Shooting is angle plus power.** Angle sets how high, power sets how far. A Fire! button sends the shot after both are set. The controls stay visible during a fight (one bar at the bottom: selected fighter, Angle, Power, wind, Fire!).
- **Melee is planned before it happens.** The mock offers jump, swipe, stab, sword, special.
- **Wind and birds push shots.** In the mock they only wobble a shot. In the real game they should change where it lands.
- **Shields.** A laser that hits a shield just disappears. A shield cracks on the first hit and breaks on the second.
- **Explosions.** Cannonballs, missiles and tank shells explode where they land. When the fuel tank explodes, only the bunker nearest to it explodes. Only part of the castle explodes, and it keeps some life. Repeated tank hits bring it down.
- **Nobody is hurt.** A hit fighter tumbles awkwardly, says one line after it lands (never while falling), then vanishes in a puff. If it lands on its feet it must then fall over. The speech bubble needs more padding and sits farther away. A pilot or driver of an exploded helicopter or tank falls out, says "Ah!", lands, and vanishes.
- **A base that blows up** does not let anyone walk out. No new fighters can be made, but fighters already out keep fighting. The board counter reads "NEW FIGHTERS: 0".
- **A match is about 10 minutes.**
- **Names.** The game is "Time Clash". The big button is "TIME TO CLASH!" (with the exclamation mark). Math says SUBMIT and has no hints. Only draw what is shown (a hoverboard, not a trebuchet).
- **Saving.** Andy asked to keep points and resources by username across sessions. The game saves on the device only (`timeclash.camp`). Accounts stay out of scope.
- **Rare stone.** Rebuilding the castle needs stone, and stone is rare in the woods.

## Changes Andy asked for in chat (2026-10-17)

- **One unit acts at a time.** This matches rule 2 of [SQUADS_PLAN.md](./SQUADS_PLAN.md).
- **A right answer earns an extra turn with more powerful damage.** Built as the Power Shot: one extra shot at 1.5 times the damage after a right reload answer (`BONUS.damageMultiplier`). The size of the bonus is still Andy's call.
- **Every screen a family has progressed to needs a Back, and a game needs a way to leave.** Built: Back on Setup and Forge, Leave game in the pause panel.
- **Returning families should not face a Tap to Play first screen.** Built: they go straight to the Camp. New families still see it once, because sound and the spoken How to Play start only after a tap.

## What is built from the boards

| Board | Status |
|---|---|
| 1 Camp Hub | Built, with the circling hawk. Home screen for returning families. Both side buttons open their screens. |
| 2 Loading | Rebuilt from the latest board. |
| 3 Battle | HUD simplified to one bottom bar. Five fighters per side, explosions and funny falls are built. Richer scenery is not (Phase 5 Squads). |
| 4 Setup | Built from the earlier board. |
| 5 Math, 6 Reading | Built from earlier boards. |
| 7 and 7b Forge | Built (Scrap only). |
| 8 and 8b Upgrade | Built (Scrap only, "Build Base"). |
| 9 Base Destroyed | Built as the Wipeout screen. |

## Gap check (2026-10-16)

Compared Setup, Math, Reading and Base Destroyed on the design canvas with the game. Placeholder grades (K and 1 to 8) on the boards are not a gap, because the game keeps K to 12.

**Setup**
- Title "Who is fighting?" and the line "Type your name. Pick your grade and subject." Fixed. The line is hidden on screens under 791 px tall (screen readers still read it), because Setup must fit 1024x768 without scrolling.
- Player 1 and Player 2 tags. Left: the vocabulary table bans P1 and P2. Team Past and Team Future say the same thing.
- Names in capitals, a 14 letter limit, and no Subject picker on the board. Left: the game keeps 12 letters and the Subject picker (parents and teachers choose it).
- Button "START BATTLE". Left: the game says "Let's clash!" and the Camp has "Time to Clash!".

**Math reload card**
- Turn-order tags (turn and waiting). The waiting tag was cut on 2026-10-25 (Andy): the turn tag already says whose turn it is. The card shows the one turn tag.
- Header "Math Challenge", "Player 1: Jack, your turn! (shot 1 of 2)" and "Solve it to load your shot!". Left: the game says "Reload time!" for every subject. A reload comes after both shots, so "shot 1 of 2" would be wrong.
- Answer text in Orbitron. Left: regression 12. Math numbers keep the plain numeral face.
- Letters A to D on the answers. Left: the 1 to 4 keys already match the numbers shown.
- SUBMIT step. Left: it adds a tap to the loop, and the game answers on one tap.

**Reading reload card**
- Story, question and answers in Orbitron. Fixed for grade 3 and up (no reading question holds a digit, pinned by a test). Grades K to 2 keep the open letter face, because Orbitron's I and l look alike.
- "Read the story" label above the story. Fixed.
- Story title ("The Wobbly Ride"). Left: stories in the bank have no title field.
- "Read it again" link and CHECK ANSWER. Left: Hear it already reads aloud, and Check Answer is a Submit step.

**Base Destroyed (mid-battle) and Victory**
- The Destroyed board shows a base that collapses while the fight goes on, with "NEW FIGHTERS: 0". Left: it needs fighters on the field (Phase 5 Squads). The game says Wipeout, not "Base destroyed".
- Victory wording already says Wipeout and toy blocks. No change.

**Pass screen**: no board. Wording checked against the banned list. No change.

## Questions Claude Design asked that Andy has not answered

1. "Maybe two minutes": a turn timer, a game length, or how often the wind changes?
2. Should the cannon itself explode when it hits the castle?
3. Which "little star" should be removed (Camp Hub or Forge)?
4. "The laser gun guy fighting each other": two gun robots shooting each other, or a gun robot against the knights?
5. Is the five-unit lineup (A to E, 1 to 5) right, and is the book only on the two shields?
6. Should the title, team selector and Back layout used on Forge and Upgrade also apply to Setup, Math, Reading, Battle and Camp?
7. What grade level and topics for the Math and Reading sample content?
8. Add a hawk to the Battle screen? Give the balloon rider and catapult more fighting motion?
9. Should the silo hologram also appear on the Forge screen?
10. Should the Camp Hub and Battle match the Loading daytime light?
