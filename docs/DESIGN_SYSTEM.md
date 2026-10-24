# Time Clash design system

This file is the source of truth for color, type, and component looks. It supersedes the palette and type sections of [DESIGN_BRIEF.md](./DESIGN_BRIEF.md). Tokens live in `src/styles/tokens.css`. Fonts load from `src/styles/fonts.css`. `tests/styles/` pins every value in this file.

The look came from the Claude Design handoff boards (1600x900 mockups). We translated the look, not the pixel sizes. Our targets are 1280x800, 1024x768, and 768x1024.

Older token names (`--tc-parchment`, `--tc-banner-red`, and so on) remain in `tokens.css` until each screen moves to the new names below. New work uses the new names.

## Colors

Two teams, two colors. Chrono Blue is the future (pods, neon, interface glow). Royal Purple is the past (pavilions, banners, wax seals). Ember and Pulse are the only lights.

| Token | Hex | Use |
|---|---|---|
| `--tc-blue-100` | #e1eaff | Text on Future surfaces |
| `--tc-blue-300` | #86a9ff | Future labels on dark |
| `--tc-blue-500` | #2f6bff | Primary. Fills and lines only, not a text background |
| `--tc-blue-700` | #1a3fb5 | Neon button top, selected chip, focus ring on light |
| `--tc-blue-900` | #0a1a4f | Future surface, progress track |
| `--tc-purple-100` | #efe6ff | Light Past tint |
| `--tc-purple-300` | #bc9cff | Past labels on dark |
| `--tc-purple-500` | #8247e8 | Secondary. Fills and lines only, not a text background |
| `--tc-purple-700` | #5a28b8 | Wood button top, primary button left, shadows |
| `--tc-purple-900` | #25104f | Past surface, wood button bottom |
| `--tc-ink-deep` | #12102b | Page ink, dark surface |
| `--tc-parchment-warm` | #f7ebcb | Light surface, text on dark |
| `--tc-oak` | #7a4a24 | Chip and input borders |
| `--tc-steel-blue` | #9aa8bd | Art and dividers only. Never text |
| `--tc-ember` | #ffb23e | Turn banner, gold border, focus ring on dark |
| `--tc-pulse` | #4fd8ff | Neon edge, progress edge |

Meaning tokens: `--tc-surface-light`, `--tc-surface-dark`, `--tc-surface-past`, `--tc-surface-future`, `--tc-on-light`, `--tc-on-dark`, `--tc-on-future`, `--tc-eyebrow-past`, `--tc-eyebrow-future`, `--tc-focus-on-light`, `--tc-focus-on-dark`.

Color never carries meaning alone. Team identity also shows as a name ("Team Past"), an icon or shape, and a different button recipe (wood versus neon).

## Type

| Voice | Family token | Use | Never |
|---|---|---|---|
| The old voice | `--tc-font-voice-old` (MedievalSharp, 400) | Titles, jokes, speech bubbles, Chrono's lines | Numbers, tight buttons |
| The new voice | `--tc-font-voice-new` (Orbitron, 700 to 900) | Buttons, banners, counters, percentages. Capitals with wide letter-spacing | Long paragraphs |

Size scale (all at least 20px, our text floor): label and body 20px, lead 24px, button 24px, large button 28px, heading 32px, title 48px, hero 64px. Mock sizes of 14, 16, and 18px are raised to 20px.

Letter-spacing for capitals: `--tc-ls-caps` 0.08em, `--tc-ls-caps-wide` 0.14em. Line height: `--tc-lh-tight` 1.1 for titles, `--tc-lh-body` 1.3 for text. Third-grade reading level for any text a child must read.

Fallbacks are system fonts (Palatino, Georgia, Arial Black), so a slow or blocked font file never blocks play. `font-display: swap` is set on every face.

## Spacing, radii, shadows

Spacing is a 4px scale: `--tc-s-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 24, `-6` 32, `-7` 48, `-8` 64. Radii: chip 14, button 16, large button 20, card 18, bubble 26, pill 999. Shadows and glows: `--tc-shadow-wood`, `--tc-shadow-card`, `--tc-shadow-banner`, `--tc-glow-neon`, `--tc-glow-ready`. Under `prefers-reduced-motion`, keep glows static (no pulsing) and drop the banner tilt animation.

## Component recipes

All interactive parts are at least 56px tall and wide (`--tc-tap`).

**Wood button (Team Past).** MedievalSharp, `--tc-fs-button-lg`. Background `--tc-btn-wood-bg`, text `--tc-btn-wood-text`, border `--tc-btn-wood-border`, shadow `--tc-shadow-wood`, text shadow `--tc-btn-wood-text-shadow`, radius `--tc-r-button`. Min height 68px in the mock, 56px is the floor. Keep labels to two or three words, since MedievalSharp stays off tight buttons.

**Neon button (Team Future).** Orbitron 800, capitals, `--tc-ls-caps`. Background `--tc-btn-neon-bg`, text `--tc-btn-neon-text`, border `--tc-btn-neon-border`, shadow `--tc-glow-neon`, text shadow `--tc-btn-neon-text-shadow`.

**Primary button (READY style).** Orbitron 900, capitals. Background `--tc-btn-primary-bg` (purple to blue split), text `--tc-btn-primary-text`, gold border `--tc-btn-primary-border`, shadow `--tc-glow-ready`, radius `--tc-r-button-lg`. One per screen.

**Fire! (Battle).** The primary recipe at `--tc-fs-button-lg`, at least 64px tall and 160px wide. Team Past keeps the Ember edge. On Team Future's turn the edge is `--tc-pulse` with `--tc-glow-neon` (the word Fire! is still the cue, so color is never the only one). After a tap or Space it winds up: `data-charging` flares the glow (`--tc-glow-charge`) and a fill (`--tc-fire-charge-fill`) sweeps across behind the word in `--tc-fire-charge` (380 ms, the same as `CHARGE_MS`). The button is off during the wind-up and the flight, but it is not dimmed. Reduced motion keeps the glow and drops the sweep. On the canvas, a team-colored ring pulls in to the launcher over the same time, then the shot goes (none when motion is reduced).

**Turn banner.** Orbitron 900 capitals. Background `--tc-banner-turn-bg` (Ember), text `--tc-banner-turn-text`, border `--tc-banner-turn-border`, shadow `--tc-shadow-banner`, tilt `--tc-banner-turn-tilt`. Example text: "YOUR TURN! (SHOT 1 OF 2)". The words carry the meaning, not the color.

**Speech bubble.** MedievalSharp `--tc-fs-lead`. Background `--tc-bubble-bg`, text `--tc-bubble-text`, border `--tc-bubble-border`, radius `--tc-r-bubble`, tail 22px tall below the bubble. Chrono speaks here. Every spoken line also shows as a caption.

**Pre-reader pictures.** Every readout a child must use has a picture beside its words, so a young child can follow them (questions themselves are read by the player; there is no read-aloud). Base health has a heart beside the meter, Shots left has a flying ball before the pips, and Scrap has a gear (in the HUD, the Forge and Upgrade Base). The shapes live in `src/ui/hudIcons.ts` (class `tc-hud-icon`, 26px or more). The wind sign on the canvas trails two gust streaks behind its arrow (`windGusts` in `src/scenes/battle/geometry.ts`). Each award on Victory has its own picture (`src/ui/awardIcons.ts`). Victory counts have a picture row too (`src/ui/countPictures.ts`): one star per question answered (filled for right, dashed outline for the rest) beside Brain stats, and one dot per Scrap beside Scrap earned. A row holds at most 10 icons and then a "+". The row is one `role="img"` with an `aria-label`, and the words beside it are `aria-hidden`, so a screen reader hears each count once. Both teams see the same rows, and zero is a plain "0 Scrap". Pictures are decorative (`aria-hidden`) and use palette colors only. The shape carries the meaning, and the words stay.

**Celebrations.** Victory drops one burst of confetti (`confetti` in `src/ui/simpleScreens.ts`, `CELEBRATE` in config, palette tokens only, `aria-hidden`, out of the layout, hidden under reduced motion). A fast right answer pops a "+2 scrap" burst on the reload card with the caption "Ka-ching!" and the `bonus` sound (made in code, plays only through the audio manager, so Mute and the tap rule hold). Slow and wrong answers get no burst, and nothing is taken away.

**Bonus ring.** The reload card shows a ring and the line "Bonus scrap if you answer fast. No rush!" (`.tc-timer`). Settings has a "Bonus ring: shown / hidden" button (56px or more, text in words) for slow readers. When hidden, the ring and its line are not drawn at all, so a screen reader hears no timer either. Nothing else changes: the same question, the same fast-answer clock (`fastWindowMs`), the same bonus Scrap, and a slow answer still loses nothing. The choice is `hideBonusRing` in `timeclash.settings`, and Clear my data resets it.

**Chrono's lines.** On the reload card, Chrono's quip shows his face and "Chrono:" before the line. On Victory, Chrono's line fits the match: close, one side landed nothing, or a plain good match (`src/ui/victoryMood.ts`, `VICTORY_CHRONO`). "My dignity needs a rematch" belongs to the losing fighter's bubble on the canvas, never to Chrono.

**Progress bar.** Track `--tc-bar-track`, 3px edge in `--tc-bar-edge`, fill `--tc-bar-fill`, height `--tc-bar-h` (26px). The label above it shows the percent as a number ("64%"), so the fill is never the only signal. Label text is `--tc-on-future` at `--tc-fs-lead`.

**Chips (grade picker, K to 12).** Orbitron 800, `--tc-fs-label`. Unselected: `--tc-chip-bg`, `--tc-chip-text`, `--tc-chip-border`. Selected: `--tc-chip-on-bg`, `--tc-chip-on-text`, `--tc-chip-on-border`, plus a check mark so selection is not color-only. Size at least `--tc-chip-min` (56px) square. The mock used 52px, which is too small.

**Inputs.** Background `--tc-input-bg`, text `--tc-input-text`, border `--tc-input-border`, radius `--tc-r-button`, min height `--tc-input-min-h` (56px), text at least `--tc-fs-body`. Always a visible label.

**Focus ring.** `outline: var(--tc-focus-width) solid var(--tc-focus-on-light)` on light surfaces and `var(--tc-focus-on-dark)` on dark ones, with `outline-offset: var(--tc-focus-offset)`. Never remove it. One ring color cannot reach 3:1 on both parchment and ink, so there are two.

### Match length (Setup)

A radio group of three chips (Short, Normal, Long) with the label "Match length", on the same row as Let's clash! so Setup keeps fitting 1024x768 and 1133x744 with no scroll. Chips are 56px tall, 20px type, a cream outline. The chosen chip is Ember with an Ink border and a check mark (not color alone). One Tab stop; arrow keys move. Styles: `.tc-length` in `src/styles/ui.css`.

## Battle layout

The Phaser canvas is the 1280x720 battlefield plus a control band below it (`BATTLE_BAND`, 200 world px), so it is 1280x920 and scaled to fit, top-aligned and centered across. Physics and layout still use the 1280x720 world. The HUD control bar sits at the bottom of the screen, full width, inside that band: the turn strip on row 1, then the fighter selector, the Angle and Power sliders and Fire on row 2 (portrait wraps to more rows). The backdrop paints the band as ground (grass left, soil right). Sound sits top left under the ? and gear. Pause sits top right under the team card. The speech bubble maps world to screen with one scale (canvas width / world width) on both axes.

## Contrast

Computed from the token values by `tests/styles/designPairs.ts` (WCAG 2.1 relative luminance). Ratios are rounded down. Body text needs 4.5:1. Large UI (buttons, borders, focus rings, fills) needs 3:1. The test fails if this table drifts from the tokens.

<!-- contrast-table:start -->
| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---|---|---|
| Body text on parchment | `--tc-on-light` #12102b | `--tc-surface-light` #f7ebcb | 15.59:1 | 4.5:1 | pass |
| Body text on ink | `--tc-on-dark` #f7ebcb | `--tc-surface-dark` #12102b | 15.59:1 | 4.5:1 | pass |
| Body text on Past surface (Purple 900) | `--tc-on-dark` #f7ebcb | `--tc-surface-past` #25104f | 13.98:1 | 4.5:1 | pass |
| Body text on Future surface (Blue 900) | `--tc-on-future` #e1eaff | `--tc-surface-future` #0a1a4f | 13.67:1 | 4.5:1 | pass |
| Past label on Past surface | `--tc-eyebrow-past` #bc9cff | `--tc-surface-past` #25104f | 7.37:1 | 4.5:1 | pass |
| Past label on ink | `--tc-eyebrow-past` #bc9cff | `--tc-surface-dark` #12102b | 8.22:1 | 4.5:1 | pass |
| Future label on Future surface | `--tc-eyebrow-future` #86a9ff | `--tc-surface-future` #0a1a4f | 7.17:1 | 4.5:1 | pass |
| Future label on ink | `--tc-eyebrow-future` #86a9ff | `--tc-surface-dark` #12102b | 8.04:1 | 4.5:1 | pass |
| Wood button text, top of gradient (Purple 700) | `--tc-btn-wood-text` #f7ebcb | `--tc-purple-700` #5a28b8 | 7.28:1 | 4.5:1 | pass |
| Wood button text, bottom of gradient (Purple 900) | `--tc-btn-wood-text` #f7ebcb | `--tc-purple-900` #25104f | 13.98:1 | 4.5:1 | pass |
| Neon button text, top of gradient (Blue 700) | `--tc-btn-neon-text` #e1eaff | `--tc-blue-700` #1a3fb5 | 7.18:1 | 4.5:1 | pass |
| Neon button text, bottom of gradient (Blue 900) | `--tc-btn-neon-text` #e1eaff | `--tc-blue-900` #0a1a4f | 13.67:1 | 4.5:1 | pass |
| Primary button text on Purple 700 | `--tc-btn-primary-text` #f7ebcb | `--tc-purple-700` #5a28b8 | 7.28:1 | 4.5:1 | pass |
| Primary button text on Blue 700 | `--tc-btn-primary-text` #f7ebcb | `--tc-blue-700` #1a3fb5 | 7.30:1 | 4.5:1 | pass |
| Primary button text on Blue 900 | `--tc-btn-primary-text` #f7ebcb | `--tc-blue-900` #0a1a4f | 13.89:1 | 4.5:1 | pass |
| Turn banner text on Ember | `--tc-banner-turn-text` #12102b | `--tc-banner-turn-bg` #ffb23e | 10.30:1 | 4.5:1 | pass |
| Speech bubble text | `--tc-bubble-text` #12102b | `--tc-bubble-bg` #f7ebcb | 15.59:1 | 4.5:1 | pass |
| Chip text | `--tc-chip-text` #12102b | `--tc-chip-bg` #f7ebcb | 15.59:1 | 4.5:1 | pass |
| Selected chip text | `--tc-chip-on-text` #ffffff | `--tc-chip-on-bg` #1a3fb5 | 8.66:1 | 4.5:1 | pass |
| Picked chip text on Ember | `--tc-chip-picked-text` #12102b | `--tc-chip-picked-bg` #ffb23e | 10.30:1 | 4.5:1 | pass |
| Chip text on Past card | `--tc-on-dark` #f7ebcb | `--tc-card-past-bg` #25104f | 13.98:1 | 4.5:1 | pass |
| Chip text on Future card | `--tc-on-future` #e1eaff | `--tc-card-future-bg` #0a1a4f | 13.67:1 | 4.5:1 | pass |
| Chip edge on Past card | `--tc-chip-past-edge` #bc9cff | `--tc-card-past-bg` #25104f | 7.37:1 | 3:1 | pass |
| Chip edge on Future card | `--tc-chip-future-edge` #86a9ff | `--tc-card-future-bg` #0a1a4f | 7.17:1 | 3:1 | pass |
| Picked chip edge on Ember | `--tc-chip-picked-edge` #12102b | `--tc-chip-picked-bg` #ffb23e | 10.30:1 | 3:1 | pass |
| Pulse glow edge on Future card | `--tc-pulse` #4fd8ff | `--tc-card-future-bg` #0a1a4f | 9.89:1 | 3:1 | pass |
| Past card edge on ink | `--tc-card-past-edge` #bc9cff | `--tc-surface-dark` #12102b | 8.22:1 | 3:1 | pass |
| Input text | `--tc-input-text` #12102b | `--tc-input-bg` #ffffff | 18.50:1 | 4.5:1 | pass |
| Progress label on Future surface | `--tc-on-future` #e1eaff | `--tc-bar-track` #0a1a4f | 13.67:1 | 4.5:1 | pass |
| Focus ring on parchment | `--tc-focus-on-light` #1a3fb5 | `--tc-surface-light` #f7ebcb | 7.30:1 | 3:1 | pass |
| Focus ring on ink | `--tc-focus-on-dark` #ffb23e | `--tc-surface-dark` #12102b | 10.30:1 | 3:1 | pass |
| Focus ring on Past surface | `--tc-focus-on-dark` #ffb23e | `--tc-surface-past` #25104f | 9.23:1 | 3:1 | pass |
| Focus ring on Future surface | `--tc-focus-on-dark` #ffb23e | `--tc-surface-future` #0a1a4f | 9.17:1 | 3:1 | pass |
| Chip border on parchment | `--tc-oak` #7a4a24 | `--tc-chip-bg` #f7ebcb | 6.24:1 | 3:1 | pass |
| Selected chip fill on parchment | `--tc-chip-on-bg` #1a3fb5 | `--tc-surface-light` #f7ebcb | 7.30:1 | 3:1 | pass |
| Input border on white | `--tc-oak` #7a4a24 | `--tc-input-bg` #ffffff | 7.41:1 | 3:1 | pass |
| Progress edge on ink | `--tc-bar-edge` #4fd8ff | `--tc-surface-dark` #12102b | 11.10:1 | 3:1 | pass |
| Progress fill (Blue 500) on track | `--tc-blue-500` #2f6bff | `--tc-bar-track` #0a1a4f | 3.66:1 | 3:1 | pass |
| Progress fill (Purple 500) on track | `--tc-purple-500` #8247e8 | `--tc-bar-track` #0a1a4f | 3.15:1 | 3:1 | pass |
| Blue 500 line on parchment | `--tc-blue-500` #2f6bff | `--tc-surface-light` #f7ebcb | 3.79:1 | 3:1 | pass |
| Blue 500 line on ink | `--tc-blue-500` #2f6bff | `--tc-surface-dark` #12102b | 4.11:1 | 3:1 | pass |
| Purple 500 line on parchment | `--tc-purple-500` #8247e8 | `--tc-surface-light` #f7ebcb | 4.40:1 | 3:1 | pass |

<!-- contrast-table:end -->

## Changes from the design handoff

| Design value | Our value | Why |
|---|---|---|
| Wood button gradient Purple 500 to 700 with cream text | Purple 700 to 900 | Cream on Purple 500 is 4.41:1. It needs 4.5:1. |
| Grade chips 52px | 56px minimum | Tap target floor. |
| Labels and eyebrows at 14, 16, 18px | 20px | Text floor. |
| Chip on a team card: see-through, team edge (Purple 300 or Blue 300), cream text. Picked chip: Ember fill, Ink text and border, parchment ring | Same as the board, with a check mark added | The board is already accessible (Ink on Ember is 10.30:1). The check mark means the pick is never shown by color alone. Chips off a team card use Blue 700 with white text (8.66:1). |
| Chip digits in Orbitron | Grade chips, question numbers and answer numbers use the plain rounded system stack | Orbitron draws 1 as a bar and 7 as a flag, which young readers mix up. Titles and counters keep Orbitron. |
| A separate shots panel in the middle of the HUD | One control bar at the bottom. Its header names whose turn it is and shows the shot pips (two shots, then Reload) | The Battle board has one bar: badge, Angle, Power, Fire. The banner and the bar already say "shot 1 of 2". |
| Wind drawn twice (card and sign) | One wind sign, on the canvas. The HUD copy is for screen readers | Two readouts in two type voices confused the top row. |
| Team card edge in red or old cyan | Past: Purple. Future: Blue with a Pulse glow when active | Red and old cyan are not in the palette. |
| Focus ring (none shown) | Blue 700 on light, Ember on dark | A ring needs 3:1 against the surface under it. |
| Blue 500 or Purple 500 as a text background | Not allowed. Fills and lines only | Margins are too thin for body text. |
| Steel as a text color | Not allowed. Art and dividers only | Steel on parchment is low contrast. |
| Google Fonts link | Self-hosted woff2 in `public/fonts` | No third-party requests. Children's game. |
| Pixel sizes of the 1600x900 boards | Tokens above | Our screens are 1280x800, 1024x768, 768x1024. |

The Camp board (Main) is built: `src/ui/campArt.ts` holds its picture, with ids prefixed `tcCamp` and classes `tc-camp-*`. The big button reads "Time to Clash!" (the slogan, never the name). The Forge board (Past and Future) is built in `src/ui/forgeArt.ts`: the board's Gold, Credits, Wood and Stone become Scrap. The loose bottom button is gone. The weapon in use shows a "Level up · N Scrap" button inside its own row (56px tall, named for the weapon, "Top level" at the top). Each owned card says "Owned by <name>", the player on that side. The Upgrade boards are built in `src/ui/upgradeArt.ts` (the Past castle tower and the Future silo hologram with its ground line and depth marks). The cards read "Upgrade the Tower", "Reinforce the Wall" and "New Castle Gate", the title reads "Build Base". They share the Forge's layout and classes (`tc-forge-*`). On narrow screens the Camp picture keeps its 16:9 shape along the bottom, because cropping it hides both camps. The "Base Destroyed" board becomes the Wipeout screen: walls turn into bouncy toy blocks, and no copy uses "destroyed", "defeat", "dead", "die", or "kill".

## Icon
The icon comes from the design (a sword crossed with a glowing laser sword on purple, for Past and Future). Andy supplied it as a 128x128 PNG. Files: `public/favicon-128.png` (the original), `public/favicon-32.png` and `public/apple-touch-icon.png` (180x180, for the iPad home screen) are resized from it. `tests/favicon.test.ts` checks the links and sizes.

## Fonts

Both fonts are served from our own origin. The browser makes no request to any other site. The Content-Security-Policy keeps `font-src 'self'`.

| Font | Files | Source | License |
|---|---|---|---|
| MedievalSharp 400 | `public/fonts/medievalsharp-latin-400-normal.woff2` | npm `@fontsource/medievalsharp` 5.3.0 (dev dependency, files copied out) | SIL Open Font License 1.1. Copyright (c) 2011 Wojciech Kalinowski. Text in `public/fonts/LICENSE-MedievalSharp.txt` |
| Orbitron 700, 800, 900 | `public/fonts/orbitron-latin-{700,800,900}-normal.woff2` | npm `@fontsource/orbitron` 5.3.0 (dev dependency, files copied out) | SIL Open Font License 1.1. Copyright 2018 The Orbitron Project Authors. Text in `public/fonts/LICENSE-Orbitron.txt` |

Only the Latin subset ships. Other characters fall back to the system font. To refresh: bump the pinned package, copy the matching woff2 files, and run `npx vitest run tests/styles`.
