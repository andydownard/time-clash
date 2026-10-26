# Inbox

Raw ideas land here. Triage promotes them to BACKLOG.md. Items expire after 30 days.

- (2026-10-24) Re-record How to Play cards 3 and 4 with the "2 goes" words in docs/NARRATION.md (Squads is on; the clips still say "two shots"). Then add the copy lint words from the Squads plan (missile, soldier, army, troops, war, shoot) once no screen uses them. "weapon" cannot join the list while the Camp has Forge Weapon.
- (2026-10-15) Follow-up from the review fixes. Andy to sign off: if the question card breaks, the turn still reloads with no scrap and Chrono says so (`flow.ts reload()`).
- (2026-10-17) Two-iPad play, kid accounts, matching and a labeled bot: parked. Andy (2026-10-21): this stays a web app. An iPad app can come later. Plan stays in `docs/plans/2026-10-17-two-player-ipad-plan.md`.
- (2026-10-19) Owner design comments from the canvas (https://claude.ai/artifact/KVA45RChVvDHQsJezUur1v), not yet in the game. Triage into BACKLOG.md and docs/GAME_SPEC.md:
  - Every character has 3 health. At 0 they fall down awkwardly and say something funny (the hit effects and funny falls are in; the health rule is built behind `CHARACTER_HEALTH.enabled`, off, with 4 health since the 2026-10-24 pace rule).
  - Team Past horseman: comes more often, can stab, and pushes a person along with him. The pushed person says "Ah, yeah, this is funny."
  - Helicopter crew lose 2 health when they fall, then must shoot the enemy. Once they are hit down, the helicopter and the tank reappear.
  - In the base builder, players choose where their cannon, catapult or person stands (weapon spots are in; unit placement is not).
  - Base builder "make your own shapes": built (the "My shape" tile at the end of the bar: a 6 by 6 pad with materials and a name, 2026-10-25).
  - Forge: after buying every item, unlock balloons, chariots and catapults (and a Future set, names still to decide), with several versions of each like the sword, bow and cannon. The Past arrow-maker should be making a bow, not swinging an arrow.
  - Castle and bunkers explode, then are rebuilt, then explode again (a battle idle loop on the design canvas; the real game ends a match on base health).
  - Owner answers (2026-10-21): Future Forge units are Hover Balloon, Rocket Sled and Zap Catapult. The Camp button stays "Build Base". Lasers are Future only. Each team keeps one evasion ability (Past Stone Wall, Future Hoverboard Dodge).
- (2026-10-24) Adversarial UI review: 14 questions for Andy (risk 2 and 3 items, each with a recommendation) are in `docs/panel/2026-10-24-batch.md`, "Adversarial review: what to cut". The risk 1 items were cut.
- (2026-10-25) Record the 15 new wipeout lines (added by the second panel batch) into `db/voice-k4.sqlite`, `db/voice-5-8.sqlite` and `db/voice-9-12.sqlite` with `scripts/build-voice-index.py`. Until then they use the browser voice with captions. When done, `tests/audio/tumbleVoice.test.ts` expects 0 unrecorded lines.
- (2026-10-25) Second panel batch: 8 questions for Andy (risk 2 and 3) are in `docs/panel/2026-10-24-batch.md`, "Panel: second batch". Also logged there (item 16): the helper tumble caption covers the Pick one and Angle panel for a moment at 1024x768.
- (2026-10-25) Record the 24 base fall lines (`BASE_FALL_LINES`, `BASE_FALL_LINES_PAST`, `BASE_FALL_LINES_FUTURE` in `src/data/copy.ts`) into the voice databases with `scripts/build-voice-index.py`. Until then they use the browser voice with captions. When done, update `tests/audio/baseFallVoice.test.ts` (it expects no recorded clip yet).
