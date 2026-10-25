# Backlog

P0 = blocks release. P3 = nice to have.

Phase 1 is built (see docs/BUILD.md and docs/CONTRACTS.md). The look and feel phase is built from the design handoff (see docs/DESIGN_SYSTEM.md). Items below are open.

## P0
- None open.

## P1
- Built bases (on since 2026-10-25): mounted weapons on the four spots are drawn but do nothing in the base-health game. Next: list them in "Pick one" next to the fighters (a mount is `mount:0` to `mount:3`, rules already in `builtBase.ts`: `firingMounts`, `mountAim`, `volleyAngles`, `guardFor`), let them take hits, let the shield generator guard, draw their shots, and let the Computer player use them. Needs a panel review (one more choice on the bar). See docs/GAME_SPEC.md "How a built base plays".
- Built bases: a fighter that stood on the old castle (the archer, Team Future's riders) can now stand in the air above a small built base. Owner to decide: keep, lower them onto the top brick, or draw a small stand.
- Caption times now start at measured pauses in the real clips (`scripts/measure-intro-timings.py`). Exact word timing needs Kokoro timing output. Re-run the script after every voice re-render.

## P2
- P2: The Computer player never walks its dasher out or calls him home, so a child who walks the dasher out once a match wins far more often (Hard drops from about 61% to 17% in a 600-match test). When both sides walk out, the levels land near their targets again. Teach it to walk out and call home, then re-run `scripts/simulate-bot.ts` and the bands in `tests/game/botLevels.test.ts`. Numbers: docs/GAME_SPEC.md "Practice opponent". (The level retune itself was done on 2026-10-25.)
- P2: The Computer player has no upgrades. A child's one-level Force Field blocks the first damaging hit of the match and drops Hard from about 61% to 53%; three levels drop it to about 32%. Owner to decide: give the Computer player matching upgrades, or leave it as a reward for building up.
- Victory awards: the winner can still hold five awards. Consider a cap if it stings.
- Wood plank and neon pod card skins, bigger castle and rocket pictures on Setup cards, brighter Tap to Play silhouettes with a visual gag, and bouncing victory blocks are new art (Victory confetti and the fast-answer scrap burst are built; the blocks stay hidden under 820px tall).
- Decided 2026-10-21, now built: one evasion ability per team. Food Trucks is the default spot (it adds a low wall that Phase 1 did not have). Ammo unlock lives on the Battle Plan, not the Forge.
- P3: Ammo and the dodge only change damage in the base-health game. With character health (flag off) ammo still changes the flight, but not damage.
- Camp has no Scrap counter, because the Main board has none. Scrap is saved between matches by player name, and it shows in the battle HUD, the Forge and Build Base.
- Reading has 79 to 90 items per grade (K to 3 have 80 or 81 each) and math 100 to 110. Families who play many rematches will still see repeats. A later pass could grow reading toward 100 per grade and add more variety in the upper grades.
- P2: Question-clip voice databases and files are unused; delete in a separate cleanup (`db/voice-k4.sqlite` question rows, later volumes, question clips in `public/audio` if any, and the Python voice scripts' question handling).
- P2: Battle simplification, next steps. Health shows in both the top chips and the base pills, so one of them can go. The richer scenery on the Battle board belongs to Phase 5 (Squads). The five-fighter picker is built.

## P3
- Phase 3 crafting that is still open: hybrid weapons and recipes (the Forge and Build Base are built). Phase 4 iPad play with room codes.

## Phase 5: Squads
Plan: docs/SQUADS_PLAN.md. S1 (the walking helper, Sir Bonk and Robo Bonk) is on for everyone (owner, 2026-10-24). S2 onward is not built.
- P1: S1 follow-ups. A once-per-family first-match hint (needs a storage key, Andy's call), Escape and H keys for Back and Hear it, re-recorded intro cards 3 and 4 (see INBOX), and a panel pass on Sir Bonk, Robo Bonk and every new line.
- P2: S3 Full crew of 4. Slingshot Squire, Laser Zapper, and Rocket Button, with fairness and no-stalemate tests.
- P2: Unit tags. Team Past units wear letters A to D on a shield. Team Future units wear numbers 1 to 4. Pick a unit by tapping it or pressing its key.
- P3: Easy crew option per side at Camp, set by a parent (just the launcher).
- P3: S4 Crew roster, pick screen, and scrap unlocks.
