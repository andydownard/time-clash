# Backlog

P0 = blocks release. P3 = nice to have.

Phase 1 is built (see docs/BUILD.md and docs/CONTRACTS.md). The look and feel phase is built from the design handoff (see docs/DESIGN_SYSTEM.md). Items below are open.

## P0
- None open.

## P1
- The intro runs about 60 seconds. Card 4 (Reload) has 7 captions over 15 seconds and only one joke.
- The tumble is a small bubble beside an idle sprite, with no setup or payoff.
- The shot has no build-up, and Fire! is a plain red box.
- Caption times are still estimated from sentence length across the real clip length. Measure real sentence times (for example from the TTS output) if a caption looks early or late.
- Base health, Shots left, Wind, Scrap, and award names are text a pre-reader cannot use.
- Miss, near-miss, and wrong-answer lines are plain. Chrono has no label or quip on the reload card. "My dignity needs a rematch" shows even when it does not fit.

## P2
- Tumble bubble: a squash, spin or block-bounce animation for the speaker (the tail now points at them).
- Reload card: an optional "hide the bonus ring" setting for slow readers.
- Victory awards: the winner can still hold five awards. Consider a cap if it stings.
- Portrait Setup: the Both chip wraps to its own row at 768 wide.
- Chrome host (? and gear) has no data-motion attribute. Add it if animation is ever added there.
- The pass screen needs a picture for pre-readers, beyond the team icon in the medium item.
- The win moment has no celebration.
- The reward for a fast answer is easy to miss.
- Wood plank and neon pod card skins, bigger castle and rocket pictures on Setup cards, brighter Tap to Play silhouettes with a visual gag, and bouncing victory blocks are new art.
- Phase 2 base placement, biomes, and evasion abilities (docs/BUILD.md). The Camp Hub is built.
- Camp scrap counter and saved scrap between matches. The Main board has no scrap counter, so it waits for Phase 3 and the Forge.
- There are about 40 items per grade and subject (grades K to 2 now have 62 to 70, with story and word-meaning questions added). Families who play many rematches will see repeats. Grades 3 to 12 still need more.
- There is no way to end a match early and no setting for match length.
- Parents must re-pick grades every time (Clear my data now fits on screen with a privacy line).
- P2: Battle simplification, next steps. Health shows in both the top chips and the base pills, so one of them can go. The richer scenery and the unit picker on the Battle board belong to Phase 5 (Squads).

## P3
- Phase 3 crafting. Phase 4 iPad play with room codes.

## Phase 5: Squads
Plan only: docs/SQUADS_PLAN.md. Squads starts after the look and feel phase, which is built. Each milestone ships behind `SQUADS.enabled`.
- P1: Learning aim. Show a short fading trajectory stub before a shot, then the full arc after it, with wind as arrows and a number. The reload question stays the heart of the loop.
- P1: Topic focus. Team Past math is multiplication (topic tag, grade-scaled multiplication sets, checker patterns). Team Future topic is still to be decided.
- P1: S1 Pick a helper. Each side gets a launcher and one dasher. Two taps per go, a "GO 1 OF 2" banner with dots, and reload after go 2.
- P2: S2 Flyers. Hot Air Balloon and Space Plane drop payloads from sky spots.
- P2: S3 Full crew of 4. Slingshot Squire, Laser Zapper, and Rocket Button, with fairness and no-stalemate tests.
- P2: Unit tags. Team Past units wear letters A to D on a shield. Team Future units wear numbers 1 to 4. Pick a unit by tapping it or pressing its key.
- P3: Easy crew option per side at Camp, set by a parent (just the launcher).
- P3: S4 Crew roster, pick screen, and scrap unlocks.
