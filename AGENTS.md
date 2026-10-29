<!-- AGENT INSTRUCTIONS — read and obey before writing any code. -->
# Time Clash — a free, kid-friendly artillery game that teaches math and reading

> **Global engineering contract:** https://github.com/rallytasks/agents/blob/main/AGENTS.md
> Every rule there applies to this repo. `GLOBAL_AGENTS.md` is a local copy of it. Refresh the copy when the agents repo changes. This file adds only project specifics and any `Override <ID>:` lines.
@GLOBAL_AGENTS.md

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md` only.

**Read first:** [QUICKSTART.md](./QUICKSTART.md) → this file → [ARCHITECTURE.md](./ARCHITECTURE.md) → [docs/GAME_SPEC.md](./docs/GAME_SPEC.md) → [docs/BUILD.md](./docs/BUILD.md). For UI or audio work also read [docs/DESIGN_BRIEF.md](./docs/DESIGN_BRIEF.md) and [docs/NARRATION.md](./docs/NARRATION.md).

## What this is
Two players share one computer and take turns. One commands a Medieval castle (Team Past). The other commands a secret base in futuristic Austin (Team Future). Each turn has 2 goes. A go is a shot from the launcher, or a move by the walking helper. After go 2, the player answers a reading or math question to reload. A right answer earns one Power Shot (a bonus shot from the launcher that hits 1.5 times as hard, with no question of its own). Tone is slapstick. No gore, no blood, ever.

The game is **free**. No ads. No accounts. No purchases. No tracking. The players are children.

Owner: Andy Downard. Built for and with his family. Stack choices favor simple, free, and fast to change.

## Stack
TypeScript · Vite · Phaser 3 (game canvas) · plain DOM and CSS for menus and modals · Vitest (unit) · Playwright (browser). Served by one small Node app server (`app-server/`, `node:http` only) that serves the built site and the spoken clips (`/v1/clips/:id`) on the same origin, on Railway. Phase 4 adds a WebSocket relay (`ws`) to that same process. Scope key: none (no accounts). Phase 4 uses `room_code`.

## Commands
test: `npm test` · lint: `npm run lint` · typecheck: `npm run typecheck` · build: `npm run build` · run: `npm run dev` · browser tests: `npm run e2e` · question check: `npm run check:questions` · bundle check: `npm run check:dist` · start the built site: `npm start` · server smoke test: `npm run smoke:server`

## Vocabulary
| User sees | Code uses | NEVER say in UI |
|---|---|---|
| Team Past | `PAST` | P1, player object |
| Team Future | `FUTURE` | P2, player object |
| Chrono | `chrono` (the narrator) | bot, AI, assistant, narrator |
| Scrap | `scrap` | currency, coins, money, price |
| Reload | `reload` | quiz, test, exam |
| Camp | `camp` | lobby, menu |
| Wipeout | `tumble` | death, kill, die, dead, defeat |
| Health (per character, 4 each) | `unitHp` | lives |
| Heart (a helper's health, shown as hearts) | `hp` on the dasher | life, lives |
| Base health (replaced by per-character health when `CHARACTER_HEALTH` is on) | `baseHp` | lives |
| Rematch | `rematch` | retry, play again |
| How to Play | `intro` | tutorial |
| Build Base | `builder` | Upgrade Base (retired), Build Castle, buy, shop |
| Cannon Crew (Team Past), Laser Crew (Team Future): the launcher helpers | `PAST-launcher`, `FUTURE-launcher` (S3 plan id `rocketButton` kept) | Rocket Button (retired 2026-10-25), missile |
| Village (Team Past's middle castle place) | `villageWall` (code id kept) | Village Wall (retired 2026-10-25: it sounded like the Stone Wall ability) |
| Go (one of the 2 per turn) | `action` / a shot or a dash (`turn.shotsFired` counts both) | shot (in banners when Squads is on) |
| Helper | `helper` (`launcher` or `dasher` in `src/game/crew.ts`) | soldier, army, troops |
| Sir Bonk, Robo Bonk (the walking helper) | `dasher` | soldier, warrior |
| Walk out, Come back | `dash`, `recall` | attack, retreat |

## Top damage risks
1. **Anything gory, scary, or mean.** Wipeouts are silly and nobody is hurt. Copy lint blocks banned words (`kill`, `die`, `dead`, `blood`, `gore`, `defeat`, `buy`, `price`).
2. **Collecting data from children.** Keep all progress in the browser (`localStorage`). No analytics, no third-party scripts, no cookies, no ads, no sign-in. Children's names never leave the device.
3. **The other player seeing the answer.** The whole board is covered while a reload question is up (`INJECTION`-style leak of hidden state, `SERVER` in Phase 4).
4. **Wrong or off-level questions.** Every question has a checked answer key and a grade. `npm run check:questions` runs in CI.
5. **Sound that blasts, cannot be skipped, or autoplays.** Sound starts only after a tap. Every voice line has captions. Skip, Replay, and Mute always work. Question text is never spoken: the owner removed read-aloud and audio questions on 2026-10-23, so every player reads the question, in every grade.
6. **Hard-to-use controls.** Tap targets under 56px, text under 20px, or color-only cues fail review.
7. **Silent drift between rules and art.** Game rules live in `src/game/` with no Phaser imports and are unit tested. Phaser only draws and plays sound.

## Shipping gates (a feature must pass all three)
- **Gate 1: First five minutes.** A new family starts a match in 60 seconds. The intro voice (with captions) teaches the rules. The reload questions are read by the player. There is no read-aloud for questions (owner decision, 2026-10-23).
- **Gate 2: Always fun.** A wrong answer never blocks play. A player always gets to reload. Fast answers earn bonus scrap, slow ones lose nothing.
- **Gate 3: Learning is the game.** The reload question is the heart of the loop. Do not add features that skip, shrink, or hide it unless Andy approves.

## Project rules & overrides
- Override TENANT: not applicable. No user accounts or shared data through Phase 3.
- Override SESSION: not applicable until Phase 4. Room codes are random, expire after 2 hours idle, and carry no personal data.
- Override MONEY: not applicable. The game is free. Never add ads, payments, or paywalls.
- Override PII: do not log names. Phase 4 relay logs hold room code and event type only. No IPs kept.
- Override AI: no model calls at runtime. Any future AI feature needs Andy's approval and a panel review first.
- Override GIT: one deploy branch. PR into `main` with green CI, then Railway builds `main` and runs `npm start` (the app server, health check `/health`). No staging hop. Confirm the deployed build shows its SHA on `/version.txt` after every deploy (`VERIFY`).
- Override CI cost: Actions minutes are limited, so CI is small. A pull request runs the `check` job (lint, typecheck, unit tests, question check, build, `check:dist`, `npm audit --omit=dev`) and one Chromium job at 1280x800. A push to `main` runs `check` only, because the pull request already passed the same code. A change that touches only `*.md` or `docs/` runs nothing. The full browser matrix (Chromium and WebKit at three sizes, WebKit in two shards each) runs only when someone starts it by hand with Run workflow on the Actions tab. New pushes cancel older pull request runs. The browser job uses 4 workers (one per runner core). Retries stay at 1 in CI, and the summary line names any test that passed only on the retry ("flaky"): fix it, do not ignore it. Tests wait on conditions, not sleeps, and move the page clock (`window.__skew`) past the app's own waits (the new-family Loading screen, the Got it delay) unless the test is about that wait. Run `npm run e2e` locally before a merge that touches layout. See `.github/workflows/ci.yml`.
- Override UI: the supported screens are iPad landscape (1024x768 and up, including iPad mini 1133x744 and iPad Pro 13in 1376x1032) plus laptop. iPad portrait is not played: a touch tablet held upright (short side 600px or more, `pointer: coarse`) shows a full-screen "Turn your iPad sideways" screen (`src/ui/turnScreen.ts`) and pauses a running battle. Laptops and tall desktop windows with a mouse are unaffected. Phone is not supported through Phase 3. Screenshot at 1280x800 and 1024x768 before calling any visual change done. The latest iPad audit is [docs/IPAD_AUDIT.md](./docs/IPAD_AUDIT.md).
- Override TRACKING: use `INBOX.md` and `BACKLOG.md`. Never create new tracking files.
- Feedback FAB: not used. This is a kids' game with no accounts.
- **Panel review for user-facing changes.** Panel: a 6-year-old, a 12-year-old, a parent, a teacher, and a slapstick comedy writer. Moderated by a staff game designer. Micro (typo) = auto-GO. Small = 2 min. Medium = 10 min. Large = 30 min. A BLOCK from the parent or teacher on safety, privacy, or learning can only be overridden by Andy.
- **Voice and writing.** Plain English. Third-grade reading level for any text a child must read. Short sentences. Chrono's humor is cheeky and warm, never mean. Strunk and White for docs and commits.
- **Randomness is seeded** in all game logic so tests repeat.
- **Config in one place.** Balance numbers live in `src/game/config.ts`. No magic numbers elsewhere.
- **Audio.** All sound effects and voice are original or CC0. Keep a `public/audio/CREDITS.md` with the source and license of each file.
- **Art.** All art is original (from the Claude Design handoff or made for this project). No real brand logos or copyrighted characters.
- **Accessibility.** Keyboard play (arrow keys, Space to fire). Captions on all speech (the intro, Chrono and the wipeout lines). Questions have no read-aloud and no listen-only items: every question is answerable by reading. Reduced-motion support. Contrast 4.5:1 body, 3:1 large UI. No color-only meaning.

## Refactoring constraints
Allowed: splitting files, extracting shared styles, renaming internals, adding types, adding tests, reorganizing folders.
Not allowed without Andy:
- Removing the intro voice, captions, Skip, or Replay.
- Removing the pass-the-mouse cover or the 2-goes-then-reload turn shape (a right answer earns one Power Shot, always the launcher's).
- Adding network calls, analytics, ads, accounts, or purchases.
- Making any wipeout, hit, or message scary.
- Adding back question read-aloud (a Hear it button on the reload card) or any question that can only be answered by hearing. The owner removed both on purpose on 2026-10-23.

## Pattern detection
When you find one of these, check the files you touched for every instance:
1. Question text visible while the other player can see the screen.
2. Audio that plays before a user tap.
3. Speech without a caption. Any code that speaks question text (it must not exist).
4. Missing negative-path tests (illegal turn moves, a third go, a skipped reload).
5. Unseeded randomness in game logic.
6. Phaser imports inside `src/game/`.
7. Hex colors or fonts that drift from the design system. Tokens and rules are in [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md).
8. Unchecked `localStorage` reads (wrap in `try/catch`, it can throw or come back empty).
9. Words from the banned list in any UI string.
10. Tap targets under 56px.

## Values check (CST principles, adapted)
| Principle | Test |
|---|---|
| Human dignity | Nobody is shamed for a wrong answer. Slapstick hits the character's pride, never a person. |
| Common good | Works on a shared family computer or school iPad. No account, no install, works offline after first load. |
| Subsidiarity | Parents and teachers pick the grade and subject. The game never judges the kid. |
| Solidarity | Younger and older siblings can play fairly together. Different grade levels per side is the core feature. |
| Preferential option for the vulnerable | A slow reader or a child with one free hand can play. Captions, large targets, plain words, hints, and keyboard or touch input all work. A pre-reader plays with a helper reading the question, because the owner removed question read-aloud on 2026-10-23 (all grades must read). Picture cues on the HUD and the intro voice still help. |

## Regressions
Check this list before coding. If your change touches a listed area, read the existing code first.

| # | What broke | Rule/test that prevents it |
|---|---|---|
| 1 | A sight-word item offered homophones (see and sea), so a child who heard the word could be marked wrong. (Sight-word listening items were removed on 2026-10-23. The rule now guards reading word-choice items.) | `src/questions/homophones.ts` rule in `check:questions`. `tests/questions/checkBank.test.ts` homophone cases. |
| 2 | `.tc-row { display: flex }` beat the `hidden` attribute, so Setup showed "Yes, clear it" at all times. | Global `[hidden]` rule in `ui.css`. `tests/ui/styles.test.ts`, `e2e/setup.spec.ts` (confirm buttons hidden). |
| 3 | The ? and gear buttons covered the Team Past card. The HUD had a second ? with the same test id. The turn banner and tumble bubble covered cards and health tags. The aim panel sat on a base. | `e2e/layout.spec.ts` and `e2e/portrait.spec.ts` geometry checks. `tests/ui/hud.test.ts` (no HUD ?). `tests/ui/styles.test.ts` (room tokens). `bubbleAnchor` test in `tests/scenes/battle/geometry.test.ts`. |
| 4 | One Escape closed Settings and also paused the game. The pause panel did not trap Tab, so Fire stayed reachable. | `tests/scenes/chrome.test.ts`, `tests/scenes/battle/pauseUi.test.ts`. |
| 5 | The question card focused answer 1 (it looked picked). A wrong answer flashed away in 1.8 s and never showed the hint. Reading questions had no read-aloud (history: Hear it was added to fix this, then the owner removed read-aloud and audio questions on purpose on 2026-10-23, so do not add it back without Andy). There was no Mute on covers. | `tests/ui/covers.test.ts` (no speaker control, no speech for question text), `tests/questions/readOnly.test.ts` (no sightword or audioWord in the bank), `tests/scenes/battle/flow.test.ts`. |
| 6 | One 8 s fast limit for every question, so careful readers rarely earned the bonus. | `tests/game/reload.test.ts` (`fastWindowMs`). |
| 7 | A fast voice dropped the last captions. Sound stayed off after an iPad interruption. Speech was never primed in the tap. | `tests/audio/robustness.test.ts`, `tests/scenes/boot.test.ts`. |
| 8 | Canvas labels drew under 20 px on iPad sizes. | `tests/scenes/battle/textScale.test.ts`, label check in `e2e/layout.spec.ts` and `e2e/portrait.spec.ts`. |
| 9 | The same tumble line could show twice in a row when the bag refilled. | `tests/game/bag.test.ts`. |
| 10 | The e2e test hook shipped inside the production bundle. No security headers existed. | `npm run check:dist` in CI. `tests/hardening.test.ts`. |
| 11 | The battle HUD kept the old look: white cards, a red Past edge, old cyan for Future, counters in system type, wind shown twice, and "Base health: 100 / 100" wrapped to two lines. | `tests/ui/handoffReview.test.ts` (team card tokens, one wind readout, nowrap, reload pip). `tests/ui/contrast.test.ts` (accent tokens). `e2e/layout.spec.ts` (banner clear of cards). |
| 12 | Orbitron drew 1 as a bar and 7 as a flag, so K to 2 readers mixed up "17 - 9" and the answers. A plain hyphen stood in for minus. | `tests/ui/mathSymbols.test.ts` (every bank question draws real operators). `tests/ui/lookAndFeel.test.ts` and `tests/ui/handoffReview.test.ts` (plain numerals). |
| 13 | Setup and Victory ran past the screen at 1024x768: "Clear my data" was cut off and Victory scrolled. The Victory awards could leave one team with a lone Good Sport. | `e2e/look.spec.ts` (`fitsOnScreen` for Setup and Victory at every size). `tests/game/awards.test.ts` (shared award, Good Sport for both). |
| 14 | The ? and gear buttons used the light focus ring (about 2:1 on Ink), so keyboard users could not see them. | `tests/ui/handoffReview.test.ts` (chrome ring uses the Ember token). |
| 15 | The tumble bubble tail pointed at empty sky, away from the speaker. | `tests/ui/hud.test.ts` (tail shift) and `tests/scenes/battle/geometry.test.ts` (`bubbleTailTarget`). |
| 16 | Leaving a game from Pause left the reused Battle scene marked paused, so the next match never reached its first turn. | `e2e/navigation.spec.ts` (Leave game, then a new match starts). `BattleScene.cleanup` resets `paused`. |
| 17 | The fighter selector made the control bar wrap to three rows, so the bar reached over the ground fighters. The system voice read the intro aloud during scripted browser runs (`--mute-audio` does not mute it). | `e2e/layout.spec.ts` (bar starts below the ground line, selector, sliders and Fire share one row). `tests/scenes/services.test.ts` (no speech in a browser driven by a test tool). |
| 18 | A perfect-aim player could end a match in 1 to 2 turns (a base had 100 health). | `tests/game/pace.test.ts` (perfect aim never wins before its fifth turn, both health modes; the realistic player's median is at least 9 turns). `tests/game/balance.test.ts` bounds are shares of the fresh-game hit count. |
| 19 | Bricks could be placed floating in mid-air (and hang off the side of a wall). The Build and Weapons switch and the spots chip sat on the plot's top corner, and the picture left a thin band inside its frame where a drop missed. | `tests/game/baseBuilderSupport.test.ts` (support rule, holding, settle on load, builder bases pass the battle check). `tests/ui/baseBuilder.test.ts` (refused drop, holding, settled line, rail, edge drops). `e2e/base-builder.spec.ts` and `e2e/base-builder-touch.spec.ts` (mid-air refused, second layer, bottom brick held, all four plot corners). |
| 20 | At Hill Fort the aim guide's "45°" sat on Balloon A (panel review, 2026-10-24). | `angleLabelBox` in `src/scenes/battle/angleLabel.ts`. `tests/scenes/battle/angleLabel.test.ts` sweeps every fighter, castle place, base spot, biome and angle. `e2e/phase2.spec.ts` checks the real label size and that it covers no fighter. |
| 21 | Shots were too predictable: no birds, gusts or recoil. | `tests/game/disturbance.test.ts`, `tests/game/ballisticsDisturbance.test.ts`, `tests/game/matchDisturbance.test.ts` (fair, reachable, no stalemate, honest preview), `tests/scenes/battle/flowDisturbance.test.ts`, `e2e/disturbances.spec.ts`. |
| 22 | In a tall, narrow window (768x1024 with a mouse, where the Turn your iPad screen does not show) Build Base squeezed the plot to a strip between the two rails and the weapon list to a 124px column that scrolled sideways, so weapon buttons were cut. | `@media (max-width: 900px)` in `src/styles/baseBuilder.css` (rail row above the plot, tools row under it, bar hidden in Weapons mode). `e2e/base-builder-narrow.spec.ts` resizes the 1280x800 project to 768x1024, so pull request CI runs it (Build, My shape and Weapons, both teams, 8 saved shapes). |
| 23 | In Battle the caption bar sat at the bottom of the screen, on Pick one, Angle and Fire (a walking helper's tumble line at 1024x768). The Squads first-go hint and the coach line sat on the field over fighters and a built base. | Message lane: `src/ui/messageLane.ts` (`MESSAGE_LANE`), `.tc-lane` and the Battle caption rule in `ui.css`. `tests/ui/messageLane.test.ts` (clear of every fighter, base, helper and the wind sign on every field, and of the cards and bar at every size). `e2e/layout.spec.ts` (first-go caption, first-go hint, a long caption and the coach line with built bases, also at 1133x744) and `e2e/squads.spec.ts` (the tumble caption), both with `expectMessageClear`. |
| 24 | In Safari (iPad and WebKit) the Weapon Workshop's two name-word dropdowns were 34px tall, because Safari ignores `min-height` on a native dropdown. Only Chromium ran in pull request CI, so it was not seen. | `.tc-ws-select` has `appearance: none` and sits in `.tc-select-wrap` (like the Setup grade). `tests/ui/workshop.test.ts` (word pickers drop the native look). `e2e/forge-workshop.spec.ts` 56px target check in the WebKit projects. |
| 25 | A picked selector option drew a check mark and a heavier weight, so it grew wider than its neighbours and the whole strip (Play with, Subject, Match length) shifted on every pick. The check also repeated what the Ember fill already said. | Controls rule in `docs/DESIGN_SYSTEM.md`. `tests/ui/controls.test.ts` (no check glyph, picked state changes no size property, equal columns). `e2e/setup.spec.ts` (boxes and words stay put within 0.5px when each option is picked). `tests/ui/contrast.test.ts` (picked text on the fill). |
| 26 | The Setup VS badge covered the Team Future NAME label and the Team Past card's corner, the cards and rows were cramped, and Back made the bottom row wrap at 1024x768. | Spacing tokens (`--tc-card-pad`, `--tc-field-gap`, `--tc-row-gap`, `--tc-vs-lane`) in `tokens.css`. `e2e/setup.spec.ts` (VS clear of both cards, card padding, row gaps, words inside chips, Back up top and Setup fits). `tests/ui/handoffReview.test.ts` (tokens in use). |
| 28 | The Camp picture was drawn to fill the screen, so at 1024x768 (4:3), 1133x744 and 1280x800 it lost its edge castle and base to the window sides. | `@media (max-aspect-ratio: 16 / 9)` in `ui.css` sets the whole 16:9 picture at the bottom. `e2e/camp.spec.ts` (edge castle and base inside the window, logo and 56px buttons inside, at 1024x768, 1133x744, 1280x800 and 1376x1032). `tests/ui/campArt.test.ts` (the rule exists). |
| 27 | In Build Base Weapons mode the weapon list covered higher-numbered pads (at 1024x768, spot 4 with spot 1 picked, spots 3 and 4 with spot 2 picked). It only kept the picked pad clear. | `weaponListPlace` in `src/ui/weaponListPlace.ts`: beside the plot only where no pad is, else a bottom sheet in the bar's place. `tests/ui/weaponListPlace.test.ts`, `e2e/base-builder-list-clear.spec.ts` (every pad picked, all four pad boxes clear, four sizes, both teams). |
| 29 | A built base was drawn way too small in battle: 2 px a build step inside the bare castle box, so a typical base was 128 by 64 px beside fighters about 90 px tall (owner report, 2026-10-28). | `BASE_IN_BATTLE.fitMaxScale` (4) and `fitWiden` (80) in `src/game/config.ts`. `tests/game/builtBaseHealth.test.ts` (typical base 240 by 120 px, overhang at most 40 px a side on every rock and deck, on screen). `tests/game/pace.test.ts` (floor of 9 turns still holds). `e2e/built-base.spec.ts` (size check). |

## Current state (2026-10-24)
Phases 1 to 3 are built and live on Railway. Phase 4 (two iPads) and signed-in players with a database are planned, not built.

**Pace.** Owner rule (2026-10-24): a player with perfect aim who answers every reload right needs five turns of their own to win, so nobody loses everything in one or two turns. A base starts with 400 health (`DAMAGE.startingBaseHp`), and a fighter with 4 when character health is on. Hit damage did not change (direct 25, near 10, Power Shot 1.5 times), so weapons, ammo and upgrade levels keep their meaning. Upgrades can no longer be bought (the old Build Base shop was removed 2026-10-25), but a level saved on a device still loads and applies in battle (`src/game/upgrades.ts`, `matchEffectsFor`, `src/storage/storage.ts`): the Tower adds 48 a level and Laser Squad heals 8 a turn. `tests/game/pace.test.ts` plays 40 perfect-aim matches for each health mode and checks none ends before turn 9 (both teams' turns counted).

**The loop.** Tap to Play (new families only), How to Play (5 cards, about 40 seconds, captions, Skip, Replay, and a Sound switch that mutes), Loading (5 seconds, 8 for a new family, so the jokes and balloon riders get seen; `TIMING` in `src/game/config.ts`; browser test runs use `loadingQuickMs`), Setup, the Camp, the Battle Plan, Battle, Victory and Rematch. A returning family lands on the Camp with no Tap to Play screen. A turn is 2 goes, then the covered reload, then a Power Shot after a right answer (1.5x damage, size still Andy's call). Fire! winds up for a moment before each shot. Each side has five fighters and a "Pick one" selector. Hits, explosions, base damage marks and funny falls are in. Chrono's reload quip and Victory line carry his name.

**Sound and voice.** Sound effects and music are made in code with WebAudio (cannon boom for Team Past, laser pew for Team Future, one music loop in two flavors). The five How to Play cards are recorded Kokoro clips in `public/audio/voice/` (`.m4a`, voice `am_michael`). Reload questions and wipeout lines for grades K to 12 are recorded clips in `db/voice-*.sqlite`, served by the app server at `/v1/clips/:id` on the same origin. A clip that fails falls back to the browser voice, and every line has a caption. Each team has 30 wipeout lines (18 shared, 12 of its own), and all 42 have a recording (2026-10-25). The 24 base fall lines (12 a team) are recorded too, so the manifest holds 66 lines. How to Play cards 3 to 5 were re-recorded on 2026-10-25 with the "two goes" words. Short lines the device voice says on purpose (the pass screen's "Pass the screen!" and the helper lines, `noClip`) have no recording. `db/README.md` has the command that records only what is missing. Test runs are silent (`tests/setup/silent.ts`, `e2e/support/silent.ts`).

**Questions.** 2,685 questions in 26 files, K to 12, checked by `npm run check:questions`. Math has 100 to 110 per grade. Reading has 101 to 105 in K to 3 and 99 to 101 in grades 4 to 12 (grown on 2026-10-25 with read-only vocabulary, grammar and short-passage items). K to 3 reading grew to 80 each, then to about 100 each (101 to 105), on 2026-10-25 with read-only items (letters, rhymes by spelling, opposites, word groups, plurals, sentence fixes, prefixes and suffixes, and short stories). 260 are the multiplication topic set and 260 are the division topic set (20 per grade each, tags `topic:multiplication` and `topic:division`). They are ordinary math questions in play: the owner retired the Setup "Focus" switches on 2026-10-24, and `check:questions` uses the tags only to check that each one really multiplies or divides. Each side keeps its own grade, picked from a dropdown at Setup. For K and Grade 1, Setup adds one quiet line: "A grown-up can read the questions with you." (no read-aloud). Reload calibration nudges a player's level quietly.

**Look and feel.** Built from the Claude Design handoff. Tokens are in `src/styles/tokens.css` and the rules are in [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md). MedievalSharp and Orbitron are self-hosted in `public/fonts/`. Every control is a Button (raised, presses down, one primary per screen), a Selector (a flat connected strip with an Ember check, an on/off switch, or a dropdown for big sets) or a Link (Clear my data). The rule is in [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) ("Controls") and `tests/ui/controls.test.ts` pins it. The Camp, Loading screen, Battle HUD (one bottom bar and a coach line until the first shot) and Victory follow the latest boards. In portrait the Battle picture drops 40px (`--tc-battle-drop`) so the top cards clear every fighter. A touch tablet held upright shows the "Turn your iPad sideways" screen. Every blocking shape on the field is painted as the thing it is (`src/scenes/battle/obstacleArt.ts`), and its picture is exactly its collision outline.

**Camp and Scrap.** "Time to Clash!" opens the Battle Plan: pick a place (Aspen Forest, Cherry Blossoms or Ruined Temple), Team Past places its castle at the Hill Fort, Village or Drawbridge (the Village, code id `villageWall`, is the default, the way Food Trucks is for Team Future), Team Future hides its base on the Skyscraper, Food Trucks or Bridge, and either side unlocks special ammo with Scrap. Lock it in! starts the match. The plan is remembered (`timeclash.plan`). In battle, two gear buttons sit by Fire: Ammo (once a side owns a special kind) and the side's evasion ability (Team Past: Stone Wall, once per match; Team Future: Hoverboard Dodge, ready again 2 own turns later). Forge Weapon and Build Base are built (Scrap only). The Forge's "Make my own weapon" opens the Weapon Workshop: pick a style, spend 10 points on Power, Reach and Splash, name it, and forge it with Scrap (up to 6 per player and side, never stronger than the best catalog weapon). Build Base's Weapons mode lists them first as "My weapons" (free to mount; the pad keeps a copy), or shows a "Make a weapon in the Forge" link that opens the Workshop. Scrap and purchases are kept by player name on the device (lifetime Scrap too), and each player's Scrap shows in the battle HUD. Setup, the Forge and Build Base have Back, and Pause has Leave game.

**Base builder (on).** The base builder is the only Build Base screen (owner, 2026-10-23; the old Scrap shop for upgrades and its `?builder=0` switch were removed 2026-10-25). The Camp has one Build Base button (right side, like Forge Weapon on the left). It opens the builder, which has a Team Past and Team Future picker like the Forge, and no small picture of the bases on the Camp. The top bar holds Back, the three saved bases and Scrap; a rail left of the plot holds Team, then Build and Weapons and the spots count; the right rail holds Turn, Undo, Clear, Snap and Done. Nothing sits on the plot. Every brick must stand on the ground or on a brick that does, overlapping it by at least half a cell (owner, 2026-10-24). A brick that holds another cannot be taken off or moved away. An old base with floating bricks is set down when it opens. The bottom bar holds the bricks, then the player's saved shapes, and ends with "My shape": a 6 by 6 pad where each square gets a material (Stone, Wood, Glass, Jelly or Panel, Metal, Glass, Jelly, each with its own pattern and sturdiness) and the player names the shape. Each saved tile shows its name and has a trash can at its upper right that asks Yes or No; a base that uses a deleted shape keeps it. Touching squares of one material join into one piece (owner, 2026-10-28): no seam or per-square outline between them, the pattern runs on, and only the outer edge is outlined. This holds in the pad, saved tiles, the plot and battle (`src/ui/materialJoin.ts`, `materialTiles.ts`, `src/scenes/battle/baseJoin.ts`; docs/BUILD.md "Joined materials"). Pictures only: boxes, health and collision are unchanged.

**Built bases in battle (on).** `BASE_IN_BATTLE.enabled` is on (owner, 2026-10-25). A player whose chosen base has a brick on the foundation fights from it: the bricks are drawn with the builder's pictures where the castle was (`src/scenes/battle/baseLayer.ts`), shells hit the brick they land on, a brick at 0 crumbles with what it held up, and the HUD shows the brick total as "N / M". The total starts between 1 and 1.25 times the flat 400, and the foundation holds 90 percent of it, so perfect aim still needs five turns. The side is out when its foundation is gone. The weapons on the pads fire: "Pick one" has a Base weapons token that switches to the base's weapons, a go from a pad is one of the 2 goes, it hits no harder than a fighter (the pace rule), the Shield generator guards once per enemy turn, and a pad falls with its brick (docs/GAME_SPEC.md "Weapons on the pads"). The fighters who stood on the castle (Archer, Cannon Knight, Tank, Laser Gun Robot) stand on the top brick under them and shoot from there. When that brick falls they drop with it, flop, stand up on the brick below and say a funny line (a bubble and a caption; 24 lines, all recorded). Nobody is hurt. A player with no saved base gets the old castle and 400. See docs/GAME_SPEC.md "Built bases with base health".

**Squads (on).** `SQUADS.enabled` is on for everyone (owner, 2026-10-24). Each side has its launcher and one walking helper: Sir Bonk (Team Past) and Robo Bonk (Team Future), `dasher` in code. Walk out is one go: he walks along the ground, over the hill, mound, pillar or wall, and stops next to the first enemy thing in front. From then on he bonks it at the start of every turn, the enemy's turn too: the enemy base (`SQUADS.standBonkDamage`, shields and cuts apply) or the enemy helper next to him (1 health). He has fighter health (`CHARACTER_HEALTH.hp`, heart and pips above him). A shell near him costs 1 (2 for a Power Shot); at 0 he tumbles, walks home dizzy, and sits out one full own turn. Come back (one go) walks him home; he is ready again next turn. Rules: `src/game/crew.ts`. Art: `src/scenes/battle/dasherArt.ts` and `dasherLayer.ts`. See [docs/SQUADS_PLAN.md](./docs/SQUADS_PLAN.md).

**Computer player (on).** One child can play alone against the Computer player (`PRACTICE_BOT.enabled`, on since 2026-10-24; `?computer=0` hides it). Setup has "Play with: Another player / Computer player", with Another player picked first. The child keeps the screen (no pass-the-mouse cover) and still answers every own reload question. Once the child walks a helper out, the Computer player walks its own out too (meets him, or goes while the way is clear), with the same goes and walk a child has; it never walks out first (docs/GAME_SPEC.md "Practice opponent").

**Birds, gusts and recoil (on).** Each turn draws a strength level, low, medium or high, a third of the time each, from a seeded stream of its own (owner, 2026-10-25: the first setting was too mild). Medium is the average. A level scales the gust push, the bird turn and count (1 to 3), and the recoil (`DISTURBANCE.levels`). The gust cue grows with the level; no words were added, and the preview stays plain wind. Measured loss of perfect direct hits: about 10%, 25% and 40% (docs/GAME_SPEC.md "Disturbances").

**Behind flags (all off in production).** `CHARACTER_HEALTH.enabled`: 4 health per fighter in place of base health. Each flag has tests and a section in [docs/GAME_SPEC.md](./docs/GAME_SPEC.md). Open polish and content items are in `BACKLOG.md`.

## Pre-merge checklist
1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` pass with zero failures.
2. `npm run e2e` passes locally in Chromium and WebKit for any change to layout or screens. CI runs one Chromium job on a pull request. Start the full matrix by hand (Actions, Run workflow) before a release.
3. `npm run check:questions` passes.
4. Copy lint passes (no banned words).
5. Intro voice does not play before a tap. Skip works.
6. Screenshots at 1280x800 and 1024x768 attached for any visual change.
7. Markdown updated for any behavior change (`DOCS`).
8. No network calls or third-party scripts were added.
9. Panel review done at the right size.

## Maximum parallelization
When work splits into independent pieces, dispatch them in parallel in isolated git worktrees. Name the model in each dispatch. Split by file ownership. Suggested split: rules (`src/game/`), questions (`src/questions/`), UI and intro (`src/ui/`, `src/data/`), art wiring (`src/scenes/`).

## Work tracking
New ideas go in [INBOX.md](./INBOX.md) (raw, 30-day expiry). Triage moves them to [BACKLOG.md](./BACKLOG.md) (P0 to P3). Delete or move to Shipped when done. Never create new ad-hoc tracking files.

## Doc index
| Topic | File |
|---|---|
| Get running in 10 minutes | [QUICKSTART.md](./QUICKSTART.md) |
| Architecture and data shapes | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Privacy and child safety | [SECURITY.md](./SECURITY.md) |
| App server: site + spoken clips, headers, Railway cutover and rollback | [docs/APP_SERVER.md](./docs/APP_SERVER.md) |
| iPad layout audit (all sizes, both orientations) | [docs/IPAD_AUDIT.md](./docs/IPAD_AUDIT.md) |
| Original game spec | [docs/GAME_SPEC.md](./docs/GAME_SPEC.md) |
| Design guidance from the canvas comments | [docs/DESIGN_GUIDANCE.md](./docs/DESIGN_GUIDANCE.md) |
| Plan for signed-in players and a database | [docs/ACCOUNTS_PLAN.md](./docs/ACCOUNTS_PLAN.md) |
| Phased build plan and start prompt | [docs/BUILD.md](./docs/BUILD.md) |
| Text to paste into Claude Design | [docs/DESIGN_BRIEF.md](./docs/DESIGN_BRIEF.md) |
| Intro voice script and audio plan | [docs/NARRATION.md](./docs/NARRATION.md) |
| Design tokens and rules | [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) |
| Shared types, functions and decisions | [docs/CONTRACTS.md](./docs/CONTRACTS.md) |
| How to write and check questions | [docs/QUESTION_BANK.md](./docs/QUESTION_BANK.md) |
| Squads plan (Phase 5, S1 on: the walking helper) | [docs/SQUADS_PLAN.md](./docs/SQUADS_PLAN.md) |
| Two-iPad, accounts and matching proposal | [docs/plans/2026-10-17-two-player-ipad-plan.md](./docs/plans/2026-10-17-two-player-ipad-plan.md) |
| Voice clip databases | [db/README.md](./db/README.md) |
| Panel review of the 2026-10-23 and 2026-10-24 batch, and the second batch (2026-10-25) | [docs/panel/2026-10-24-batch.md](./docs/panel/2026-10-24-batch.md) |
| Global rules (copy) | [GLOBAL_AGENTS.md](./GLOBAL_AGENTS.md) |
| Backlog and inbox | [BACKLOG.md](./BACKLOG.md), [INBOX.md](./INBOX.md) |
