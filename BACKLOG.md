# Backlog

P0 = blocks release. P3 = nice to have.

Phase 1 is built (see docs/BUILD.md and docs/CONTRACTS.md). The look and feel phase is built from the design handoff (see docs/DESIGN_SYSTEM.md). Items below are open.

## P0
- None open.

## P1
- Re-render the five intro clips from the shortened docs/NARRATION.md (`scripts/build-voice-db.py`, then `scripts/extract-voice-clips.py`). Captions and timing are already short. The recorded voice stays the old, longer script until then.
- Caption times are still estimated from sentence length across the real clip length. Measure real sentence times (for example from the TTS output) if a caption looks early or late.

## P2
- Reload card: an optional "hide the bonus ring" setting for slow readers.
- Victory awards: the winner can still hold five awards. Consider a cap if it stings.
- iPad landscape fixes from docs/IPAD_AUDIT.md: Clear my data is cut off on Setup at 1133x744, the Leave dialog body text is 16px, and the bottom controls have no safe-area margin.
- Chrome host (? and gear) has no data-motion attribute. Add it if animation is ever added there.
- Scrap counts and the brain stats line on Victory are still numbers in words. A pre-reader may want dots or stars to count.
- Wood plank and neon pod card skins, bigger castle and rocket pictures on Setup cards, brighter Tap to Play silhouettes with a visual gag, and bouncing victory blocks are new art (Victory confetti and the fast-answer scrap burst are built; the blocks stay hidden under 820px tall).
- Phase 2 Battle Plan, biomes, base spots, ammo and evasion are wired in. Open calls for Andy: one ability per team (Past wall, Future dodge) or both for each side; wall size and once per match versus dodge every 3rd turn (balance); Food Trucks as the default spot (it adds a low wall that Phase 1 did not have); ammo unlock lives on the Battle Plan, not the Forge.
- P2: Biome art is simple: cherry trees recolor the aspens and the temple uses plain columns. The spot shapes (tower, bridge deck, food truck wall) are plain steel blocks. Real art from a design board would help.
- P3: Ammo and the dodge only change damage in the base-health game. With character health (flag off) ammo still changes the flight, but not damage.
- Camp scrap counter and saved scrap between matches. The Main board has no scrap counter, so it waits for Phase 3 and the Forge.
- There are about 40 items per grade and subject (grades K to 2 now have 62 to 70, with story and word-meaning questions added). Families who play many rematches will see repeats. Grades 3 to 12 still need more.
- There is no way to end a match early and no setting for match length.
- Parents must re-pick grades every time (Clear my data now fits on screen with a privacy line).
- P2: Battle simplification, next steps. Health shows in both the top chips and the base pills, so one of them can go. The richer scenery and the unit picker on the Battle board belong to Phase 5 (Squads).

## P3
- Phase 3 crafting. Phase 4 iPad play with room codes.

## Phase 5: Squads
Plan only: docs/SQUADS_PLAN.md. Squads starts after the look and feel phase, which is built. Each milestone ships behind `SQUADS.enabled`.
- P1: Topic focus for Team Future. Team Past multiplication is built (see AGENTS.md). The Future topic is still Andy's call. Add it to `TOPIC_FOCUS.offer`, tag a set per grade, and the checker and Setup control pick it up.
- P1: S1 Pick a helper. Each side gets a launcher and one dasher. Two taps per go, a "GO 1 OF 2" banner with dots, and reload after go 2.
- P2: S2 Flyers. Hot Air Balloon and Space Plane drop payloads from sky spots.
- P2: S3 Full crew of 4. Slingshot Squire, Laser Zapper, and Rocket Button, with fairness and no-stalemate tests.
- P2: Unit tags. Team Past units wear letters A to D on a shield. Team Future units wear numbers 1 to 4. Pick a unit by tapping it or pressing its key.
- P3: Easy crew option per side at Camp, set by a parent (just the launcher).
- P3: S4 Crew roster, pick screen, and scrap unlocks.
