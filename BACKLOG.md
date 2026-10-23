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
- Phase 2 Battle Plan, biomes, base spots, ammo and evasion are wired in. Decided 2026-10-21: one ability per team, as built. Food Trucks as the default spot (it adds a low wall that Phase 1 did not have); ammo unlock lives on the Battle Plan, not the Forge.
- P2: Biome art is simple: cherry trees recolor the aspens and the temple uses plain columns. The spot shapes (tower, bridge deck, food truck wall) are plain steel blocks. Real art from a design board would help.
- P3: Ammo and the dodge only change damage in the base-health game. With character health (flag off) ammo still changes the flight, but not damage.
- Camp scrap counter and saved scrap between matches. The Main board has no scrap counter, so it waits for Phase 3 and the Forge.
- Reading in grades 4 to 12 has 79 to 90 items and math 100 to 110. Reading in K to 3 is lower now (see the next items). Families who play many rematches will still see repeats. Families who play many rematches will still see repeats. A later pass could grow reading toward 100 per grade and add more variety in the upper grades.
- P2: Question-clip voice databases and files are unused; delete in a separate cleanup (`db/voice-k4.sqlite` question rows, later volumes, question clips in `public/audio` if any, and the Python voice scripts' question handling).
- P2: K to 2 reading count dropped after removing sight-word listening items (K 50, grade 1 51, grade 2 54, grade 3 64); add read-only questions. Owner decides the new questions.
- There is no way to end a match early and no setting for match length.
- P2: Battle simplification, next steps. Health shows in both the top chips and the base pills, so one of them can go. The richer scenery and the unit picker on the Battle board belong to Phase 5 (Squads).

## P3
- Phase 3 crafting. Phase 4 iPad play with room codes.

## Phase 5: Squads
Plan only: docs/SQUADS_PLAN.md. Squads starts after the look and feel phase, which is built. Each milestone ships behind `SQUADS.enabled`.
- P1: S1 follow-ups. Hear it, Back, the first-go hint and an e2e switch are built behind the flag. Still to do: dasher art and ground spot markers on the battlefield, the no-stalemate walk test, and a once-per-family first-match hint (needs a storage key, Andy's call).
- P2: S3 Full crew of 4. Slingshot Squire, Laser Zapper, and Rocket Button, with fairness and no-stalemate tests.
- P2: Unit tags. Team Past units wear letters A to D on a shield. Team Future units wear numbers 1 to 4. Pick a unit by tapping it or pressing its key.
- P3: Easy crew option per side at Camp, set by a parent (just the launcher).
- P3: S4 Crew roster, pick screen, and scrap unlocks.
