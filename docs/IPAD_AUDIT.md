# iPad layout audit

Date: 2026-10-17. Build: `origin/main` before the Turn your iPad screen. Browser: WebKit (Playwright), touch on.

Screenshots: `docs/screenshots/ipad-audit/<device>-<orientation>/<screen>.png`. Measurements (text size, tap targets, off-screen controls, canvas box) are in `measurements.json` beside each set. They come from the DOM, not from eye guesses. Re-run with `npx playwright test -c scripts/ipad-audit.config.ts` (set `AUDIT_DIST` to serve a bundle built from another commit).

Sizes: iPad mini 1133x744 and 744x1133, iPad Pro 11in 1194x834 and 834x1194, iPad Pro 13in 1376x1032 and 1032x1376.

Screens covered (20 per size): Tap to Start, four Intro cards, Loading failed, Setup, Settings, How to Play reopened, Camp, Forge, Upgrade Base, pass screen (twice), Battle start, Pause, Leave dialog, mid-shot, reload question, reload feedback, Victory. The first Loading frame is too short to catch, so the failed-load state stands in for it.

## Summary

| Check | Landscape (all 3 devices) | Portrait (all 3 devices) |
|---|---|---|
| Tap targets under 56px | None found | None found |
| DOM text under 20px | One: Leave dialog body (16px) | Same |
| Canvas labels under 20px | None (smallest 20.0px on the 13in) | None (smallest 20.2px) |
| Controls off screen | One: Clear my data on the mini | None |
| Sideways scroll | None | None |
| Canvas fills the screen | Yes, with thin side bars | No: board uses the top 72% only |

## Defects

| # | Screen | Device and orientation | What is wrong | Severity | Suggested fix |
|---|---|---|---|---|---|
| 1 | All screens | Every iPad, portrait | The board is drawn at 4:3 landscape, so in portrait it shrinks to the top 535px of 1133 (mini) and the bottom 40% is empty navy. The Battle HUD squeezes: "Alex, your turn! (Shot 1 of ...)" is cut with an ellipsis, team cards wrap to two rows. | P1 | Fixed by the Turn your iPad screen in this PR (landscape is now the only played orientation). |
| 2 | Setup | iPad mini landscape | "Clear my data" runs to y=745 on a 744px screen. It is flush with the bottom edge and cut by 1px, and on a real iPad the home bar sits on it. | P2 | Trim Setup spacing at heights under 800px, or move the privacy line and Clear my data into one row above a 16px bottom margin. |
| 3 | Leave dialog (Pause) | All iPads | Body text "Your match will end. You can start a new one at the Camp." measures 16px. The rule is 20px. | P2 | Set `.tc-cover-card p` in the pause panel to `var(--tc-fs-body)`. |
| 4 | Battle bottom bar | All iPads, landscape | Pick One, Angle/Power and Fire sit 8 to 16px from the bottom edge. There is no `env(safe-area-inset-bottom)` anywhere in the app, and `index.html` has no `viewport-fit=cover`. On a real iPad the home indicator and rounded corners crowd Fire. | P2 | Add `viewport-fit=cover` and pad the control band and the Camp buttons with `max(16px, env(safe-area-inset-bottom))`. Test on a device. |
| 5 | Battle | iPad mini landscape | Dense: the Power readout overlaps the balloon unit A, the wind box and the top cards crowd the sky, and the coach line sits tight over the ground bar. Nothing is clipped, but it is the tightest screen. | P3 | Move the Power readout beside the slider on small heights, or hide the coach line after the first tap. |
| 6 | Battle | iPad Pro 13in landscape | The board is 4:3, so the picture grows but the bottom band is plain green and navy panels with a hard seam. The 13in also leaves about 43px of empty body under the canvas (the canvas centers sideways only). | P3 | Center the canvas both ways (`Phaser.Scale.CENTER_BOTH`) and paint the band with one color. |
| 7 | All screens | iPad mini landscape | The 1.39 board in a 1.52 screen leaves 48px bars on each side (16px on the Pro 11in). Camp scenery stops at the edge. | P3 | Extend the sky and ground art past the board, or accept the bars. |
| 8 | Camp | iPad mini landscape | Forge Weapon and Upgrade Base sit about 20px from the screen bottom, and the scenery behind them is busy. Contrast is fine. | P3 | Same safe-area padding as #4. |

Checked and fine: Tap to Start, Intro cards, Camp, Forge, Upgrade Base, pass screen, reload question and feedback, Victory, Settings. All use buttons of 56px or more and text of 20px or more in landscape. The 13in has no wasted space beyond #6. Nothing sits under a notch (iPads have none), but see #4 for the home bar.

## What to fix first

1. Done in this PR: portrait (#1). Players now get a clear "Turn your iPad sideways" screen, and a running battle pauses.
2. Fix #3 (16px text) and #2 (Clear my data cut off). Both are small CSS changes that break a written rule.
3. Add safe-area padding (#4, #8) and check on a real iPad, since WebKit in a desktop browser reports no insets.
4. Leave #5 to #7 for the next design pass.
