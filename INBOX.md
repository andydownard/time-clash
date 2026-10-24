# Inbox

Raw ideas land here. Triage promotes them to BACKLOG.md. Items expire after 30 days.

- (2026-10-15) Follow-up from the review fixes. Andy to sign off: if the question card breaks, the turn still reloads with no scrap and Chrono says so (`flow.ts reload()`).
- (2026-10-17) Two-iPad play, kid accounts, matching and a labeled bot: parked. Andy (2026-10-21): this stays a web app. An iPad app can come later. Plan stays in `docs/plans/2026-10-17-two-player-ipad-plan.md`.
- (2026-10-19) Owner design comments from the canvas (https://claude.ai/artifact/KVA45RChVvDHQsJezUur1v), not yet in the game. Triage into BACKLOG.md and docs/GAME_SPEC.md:
  - Every character has 3 health. At 0 they fall down awkwardly and say something funny (the hit effects and funny falls are in; the 3-health rule is built behind `CHARACTER_HEALTH.enabled`, off).
  - Team Past horseman: comes more often, can stab, and pushes a person along with him. The pushed person says "Ah, yeah, this is funny."
  - Helicopter crew lose 2 health when they fall, then must shoot the enemy. Once they are hit down, the helicopter and the tank reappear.
  - In the base builder, players choose where their cannon, catapult or person stands (weapon spots are in; unit placement is not).
  - Base builder "make your own shapes": built (the "My own shape" pad, behind the base builder switch).
  - Forge: after buying every item, unlock balloons, chariots and catapults (and a Future set, names still to decide), with several versions of each like the sword, bow and cannon. The Past arrow-maker should be making a bow, not swinging an arrow.
  - Castle and bunkers explode, then are rebuilt, then explode again (a battle idle loop on the design canvas; the real game ends a match on base health).
  - Owner answers (2026-10-21): Future Forge units are Hover Balloon, Rocket Sled and Zap Catapult. The Camp button stays "Build Base". Lasers are Future only. Each team keeps one evasion ability (Past Stone Wall, Future Hoverboard Dodge).

