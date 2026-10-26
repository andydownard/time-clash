# iPad layout audit

Date: 2026-10-17. Build: `origin/main` before the Turn your iPad screen. Browser: WebKit (Playwright), touch on.

Screenshots: `docs/screenshots/ipad-audit/<device>-<orientation>/<screen>.png`. Measurements (text size, tap targets, off-screen controls, canvas box) are in `measurements.json` beside each set. They come from the DOM, not from eye guesses. The `docs/screenshots/*-<WxH>.png` set from the e2e specs is retaken only with `UPDATE_SCREENSHOTS=1` (Chromium only), so normal runs never change tracked files. Re-run the audit with `npx playwright test -c scripts/ipad-audit.config.ts` (set `AUDIT_DIST` to serve a bundle built from another commit).

Sizes: iPad mini 1133x744 and 744x1133, iPad Pro 11in 1194x834 and 834x1194, iPad Pro 13in 1376x1032 and 1032x1376.

Screens covered (20 per size): Tap to Start, four Intro cards, Loading failed, Setup, Settings, How to Play reopened, Camp, Forge, Build Base, pass screen (twice), Battle start, Pause, Leave dialog, mid-shot, reload question, reload feedback, Victory. The first Loading frame is too short to catch, so the failed-load state stands in for it.

## Summary

| Check | Landscape (all 3 devices) | Portrait (all 3 devices) |
|---|---|---|
| Tap targets under 56px | None found | None found |
| DOM text under 20px | None (Leave dialog fixed 2026-10-18) | Same |
| Canvas labels under 20px | None (smallest 20.0px on the 13in) | None (smallest 20.2px) |
| Controls off screen | None (Clear my data fixed 2026-10-18) | None |
| Sideways scroll | None | None |
| Canvas fills the screen | Yes, with thin side bars | No: board uses the top 72% only |

## Defects

| # | Screen | Device and orientation | What is wrong | Severity | Suggested fix |
|---|---|---|---|---|---|
| 1 | All screens | Every iPad, portrait | The board is drawn at 4:3 landscape, so in portrait it shrinks to the top 535px of 1133 (mini) and the bottom 40% is empty navy. The Battle HUD squeezes: "Alex, your turn! (Shot 1 of ...)" is cut with an ellipsis, team cards wrap to two rows. | P1 | Fixed by the Turn your iPad screen (landscape is now the only played orientation). |
| 2 | Setup | iPad mini landscape | "Clear my data" runs to y=745 on a 744px screen. It is flush with the bottom edge and cut by 1px, and on a real iPad the home bar sits on it. | P2 | Trim Setup spacing at heights under 800px, or move the privacy line and Clear my data into one row above a 16px bottom margin. | **FIXED 2026-10-18: at heights under 761px Setup drops the repeated summary line (kept for screen readers) and tightens gaps. Clear my data now ends about 56px above the bottom edge on the mini (was 745 of 744), with no scroll.**
| 3 | Leave dialog (Pause) | All iPads | Body text "Your match will end. You can start a new one at the Camp." measures 16px. The rule is 20px. | P2 | Set `.tc-cover-card p` in the pause panel to `var(--tc-fs-body)`. | **FIXED 2026-10-18: `.tc-cover-card p` uses `--tc-fs-body` (20px). The audit finds no DOM text under 20px on any landscape iPad.**
| 4 | Battle bottom bar | All iPads, landscape | Pick One, Angle/Power and Fire sit 8 to 16px from the bottom edge. There is no `env(safe-area-inset-bottom)` anywhere in the app, and `index.html` has no `viewport-fit=cover`. On a real iPad the home indicator and rounded corners crowd Fire. | P2 | Add `viewport-fit=cover` and pad the control band and the Camp buttons with `max(16px, env(safe-area-inset-bottom))`. Test on a device. | **FIXED 2026-10-18 in CSS: `viewport-fit=cover`, tokens `--tc-safe-top/right/bottom/left`, and screens and the Battle control band pad with `max(normal, safe inset)`. Insets are 0 in desktop WebKit, so it still needs a check on a real iPad.**
| 5 | Battle | iPad mini landscape | Dense: the Power readout overlaps the balloon unit A, the wind box and the top cards crowd the sky, and the coach line sits tight over the ground bar. Nothing is clipped, but it is the tightest screen. | P3 | Move the Power readout beside the slider on small heights, or hide the coach line after the first tap. | **FIXED 2026-10-18: the Power meter and label slide away from the enemy (`meterLeft`), so they clear balloon A on the mini (about 15px gap in the new screenshot). The coach line and wind box are unchanged.**
| 6 | Battle | iPad Pro 13in landscape | The board is 4:3, so the picture grows but the bottom band is plain green and navy panels with a hard seam. The 13in also leaves about 43px of empty body under the canvas (the canvas centers sideways only). | P3 | Center the canvas both ways (`Phaser.Scale.CENTER_BOTH`) and paint the band with one color. | **NOT FIXED: the green/navy split in the band is part of the art and the 43px strip is the body color, so a blend needs art changes, not a small CSS fix. Left for the design pass.**
| 7 | All screens | iPad mini landscape | The 1.39 board in a 1.52 screen leaves 48px bars on each side (16px on the Pro 11in). Camp scenery stops at the edge. | P3 | Extend the sky and ground art past the board, or accept the bars. |
| 8 | Camp | iPad mini landscape | Forge Weapon and Build Base sit about 20px from the screen bottom, and the scenery behind them is busy. Contrast is fine. | P3 | Same safe-area padding as #4. | **FIXED 2026-10-18 with #4: Camp is a screen, so its bottom padding now respects the safe inset.**
| 9 | Battle | All iPads, landscape | The caption bar sat on the control bar (a walking helper's tumble line covered Pick one and Angle at 1024x768), and the Squads first-go hint sat on the field over fighters and a built base. | P1 | Give captions and hints one reserved place clear of the bar, the cards, the fighters and the bases. | **FIXED 2026-10-25: the message lane (`src/ui/messageLane.ts`, see docs/DESIGN_SYSTEM.md). Checked at 1024x768, 1133x744 and 1280x800 by `e2e/layout.spec.ts` and `e2e/squads.spec.ts`.** |

Checked and fine: Tap to Start, Intro cards, Camp, Forge, Build Base, pass screen, reload question and feedback, Victory, Settings. All use buttons of 56px or more and text of 20px or more in landscape. The 13in has no wasted space beyond #6. Nothing sits under a notch (iPads have none), but see #4 for the home bar.

## What to fix first

1. Done in this PR: portrait (#1). Players now get a clear "Turn your iPad sideways" screen, and a running battle pauses.
2. Done 2026-10-18: #2, #3, #4, #5, #8. Check the safe-area padding on a real iPad, since WebKit in a desktop browser reports no insets.
   Pinned 2026-10-21: `e2e/look.spec.ts` checks Setup and Victory fit at 1024x768, 1133x744, 1280x800 and 1376x1032 (Clear my data stays inside the window). `tests/ui/styles.test.ts` pins the 20px Leave text, `viewport-fit=cover`, the 0px safe-area fallbacks and the `max(normal, safe inset)` bottom padding.
3. Leave #6 (band seam) and #7 (side bars) for the next design pass.
4. Done 2026-10-25: Build Base in a tall, narrow window. A touch tablet held upright shows the Turn your iPad screen, but a desktop window at 768x1024 with a mouse does not. Under 900px wide the builder now puts the Team and Mode rail in one row above the plot, the tools in one row under it, and gives the plot the full width. The bar keeps three rows with 8 saved shapes, and it steps aside in Weapons mode so the weapon list has room. Landscape sizes are unchanged. `e2e/base-builder-narrow.spec.ts` checks it in the normal 1280x800 project.
