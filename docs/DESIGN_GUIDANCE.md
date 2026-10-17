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
- **A right answer earns an extra turn with more powerful damage.** Not built. It changes the protected turn shape (2 shots, then reload), and Andy asked for it directly. The size of the bonus (how many shots, how much extra damage) is still to decide.
- **Every screen a family has progressed to needs a Back, and a game needs a way to leave.** Built: Back on Setup and Forge, Leave game in the pause panel.
- **Returning families should not face a Tap to Play first screen.** Built: they go straight to the Camp. New families still see it once, because sound and the spoken How to Play start only after a tap.

## What is built from the boards

| Board | Status |
|---|---|
| 1 Camp Hub | Built, no hawk or fires yet. Home screen for returning families. Both side buttons open their screens. |
| 2 Loading | Not rebuilt from the latest board (daytime scene, three balloon riders, 10 seconds). |
| 3 Battle | HUD simplified to one bottom bar. The units, scenery and explosions are not built (Phase 5 Squads). |
| 4 Setup | Built from the earlier board. |
| 5 Math, 6 Reading | Built from earlier boards. |
| 7 and 7b Forge | Built (Scrap only). |
| 8 and 8b Upgrade | Built (Scrap only, "Upgrade Base"). |
| 9 Base Destroyed | Built as the Wipeout screen. |

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
