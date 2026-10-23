# Backlog

P0 = blocks release. P3 = nice to have.

Phase 1 is built (see docs/BUILD.md and docs/CONTRACTS.md). The look and feel phase is built from the design handoff (see docs/DESIGN_SYSTEM.md). Items below are open.

## P0
- None open.

## P1
- Caption times now start at measured pauses in the real clips (`scripts/measure-intro-timings.py`). Exact word timing needs Kokoro timing output. Re-run the script after every voice re-render.

## P2
- Victory awards: the winner can still hold five awards. Consider a cap if it stings.
- Wood plank and neon pod card skins, bigger castle and rocket pictures on Setup cards, brighter Tap to Play silhouettes with a visual gag, and bouncing victory blocks are new art (Victory confetti and the fast-answer scrap burst are built; the blocks stay hidden under 820px tall).
- Decided 2026-10-21, now built: one evasion ability per team. Food Trucks is the default spot (it adds a low wall that Phase 1 did not have). Ammo unlock lives on the Battle Plan, not the Forge.
- P2: Biome art is simple: cherry trees recolor the aspens and the temple uses plain columns. The spot shapes (tower, bridge deck, food truck wall) are plain steel blocks. Real art from a design board would help.
- P3: Ammo and the dodge only change damage in the base-health game. With character health (flag off) ammo still changes the flight, but not damage.
- Camp has no Scrap counter, because the Main board has none. Scrap is saved between matches by player name, and it shows in the battle HUD, the Forge and Build Base.
- Every grade now has 70 or more items per subject (reading 70 to 90, math 100 to 110, checked 2026-10-23). Families who play many rematches will still see repeats. A later pass could grow reading toward 100 per grade and add more variety in the upper grades.
- There is no setting for match length. A player can leave a match from Pause (Leave game), which asks first and returns to the Camp.
- P2: Battle simplification, next steps. Health shows in both the top chips and the base pills, so one of them can go. The richer scenery on the Battle board belongs to Phase 5 (Squads). The five-fighter picker is built.

## P3
- Phase 3 crafting that is still open: hybrid weapons and recipes (the Forge and Build Base are built). Phase 4 iPad play with room codes.

## Phase 5: Squads
Plan: docs/SQUADS_PLAN.md. S1 (a dasher helper per side) is built behind `SQUADS.enabled`, which is off. S2 onward is not built. Each milestone ships behind the same flag.
- P1: S1 follow-ups. Hear it, Back, the first-go hint and an e2e switch are built behind the flag. Still to do: dasher art and ground spot markers on the battlefield, the no-stalemate walk test, and a once-per-family first-match hint (needs a storage key, Andy's call).
- P2: S3 Full crew of 4. Slingshot Squire, Laser Zapper, and Rocket Button, with fairness and no-stalemate tests.
- P2: Unit tags. Team Past units wear letters A to D on a shield. Team Future units wear numbers 1 to 4. Pick a unit by tapping it or pressing its key.
- P3: Easy crew option per side at Camp, set by a parent (just the launcher).
- P3: S4 Crew roster, pick screen, and scrap unlocks.
