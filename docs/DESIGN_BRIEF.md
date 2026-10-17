> **Note:** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) supersedes the palette and type sections below. Use its tokens (Chrono Blue, Royal Purple, MedievalSharp, Orbitron). The rest of this brief still stands.

# Time Clash: Claude Design Brief

Paste everything below the line into Claude Design. It is written to stand alone.

---

## Project

Design the complete UI and art direction for **Time Clash: Past vs. Future**, a free, turn-based artillery game for kids that runs in a web browser. Two players share one computer (pass-and-play) and later can play on two iPads. The game teaches reading and math. Each turn gives a player 2 shots. After shot 2, the player answers a reading or math question to reload.

Team Past commands a Medieval castle. Team Future commands a secret base in futuristic Austin, Texas.

## Audience and tone

- Players are kids from kindergarten to 12th grade, often a younger and an older sibling, sometimes a parent playing too.
- The game is **free**. Show no prices, no ads, no "upgrade" prompts, no sign-in, no store. Real-money language must not appear anywhere.
- Tone is slapstick and cheeky. Zero gore. No blood. No realistic destruction. Walls turn into bouncy toy blocks. Characters wipe out in funny ways and pop right back up.
- Safe for a 5-year-old, funny to a 45-year-old dad.

## Art style

Stylized semi-realism. 2.5D painterly game art. Rich textures and atmospheric lighting. Clean, cartoon-proportioned silhouettes. Warm, playful, never dark or gritty.

### Palette (starting point, refine as needed)
- Past: warm parchment `#F3E3C3`, castle stone `#8C8A84`, banner red `#B3372B`, torch gold `#F2B134`, wood `#6B4423`
- Future: deep night blue `#0E1A33`, neon cyan `#2EE6FF`, hot magenta `#FF3DAE`, hologram mint `#7CFFC4`, brushed steel `#B9C4D0`
- Shared: campfire orange `#FF7A1A`, twilight purple `#3B2A5E`, safe white `#FFFFFF`, ink `#1B1B26`
- Each team owns one accent color. Use it for the turn banner, the screen frame glow, and the buttons for that team.

### Type
- Display: a chunky, rounded comic face for banners and buttons (for example Lilita One or Bangers).
- Body: a highly legible rounded sans (for example Nunito or Atkinson Hyperlegible). Minimum 20px body on a 1024px wide screen.
- Reading questions for young kids use large text, 32px or more.

### Layout rules
- Landscape first. Design at 1280x800 (laptop) and 1024x768 (iPad landscape). Also check 768x1024 (iPad portrait).
- Tap targets at least 56px tall.
- Contrast: at least 4.5:1 for text, 3:1 for large UI.
- Every sound-driven cue also has a visual cue and text. Every spoken line has a caption.

## Screens to design

Deliver each screen with its states: default, hover or focus, pressed, disabled, empty, loading, error.

### 0. Tap-to-Start (sound gate)
A big friendly "TAP TO PLAY" button over a sunrise-to-sunset time-warp backdrop. Browsers block sound until a tap, so this screen also unlocks the intro voice. Small mute icon and a "Captions on" toggle in the corner.

### 1. Intro: How to Play (spoken)
A narrator character, a goofy time-traveling announcer named **Chrono**, speaks the how-to-play lesson for about 60 seconds. Design:
- Chrono in a corner, mouth moving, plus 5 illustrated "cards" that change as he talks: (1) aim, (2) shoot twice, (3) reload by answering, (4) wipeouts are funny, (5) win by emptying the other base's health.
- Live captions at the bottom, one sentence at a time, large type.
- Buttons: **Skip**, **Replay**, **Mute**. A progress dots row for the 5 cards.
- Also reachable later from a "?" button on every screen (name it "How to Play").
- Script lives in `docs/NARRATION.md`. Use its card titles and captions.

### 2. Funny Loading Screen
A goofy medieval knight wobbling on a hoverboard while a tiny floating repair bot looks confused. Progress bar shaped like a winding timeline. Centered rotating status text, for example "Convincing the trebuchet that math is good for it... 64%". Also used between rounds. Rotating messages:
- "Charging laser cannon with two AA batteries and a potato..."
- "Teaching the catapult how to do long division..."
- "Convincing the knights that Wi-Fi isn't black magic..."
- "Calibrating dad jokes to maximum cringe levels..."
- "Buffing out dignity scratches from the last fall..."
- "Looking for Austin's secret base behind a taco truck..."
Extra art: a low-gravity medieval chicken floating past a glitching hoverboard; a trebuchet launching an alarm clock.

### 3. Player Setup
Two side-by-side cards, Team Past (left) and Team Future (right).
Each card has: name field, a character picker (6 funny avatars per side), grade picker K through 12 (big chips), subject picker (Reading, Math, or Both). The two cards can have different grades (for example 2nd Grade Reading vs. 8th Grade Math). A friendly line under each: "Questions will match your grade." Big **Next** button.

### 4. The Camp Hub
Wide view of a cozy twilight campsite under the stars.
- Center: crackling stone-ringed campfire.
- Around the fire: wooden and brushed-steel workbenches with glowing blueprints, tools, gears, holographic screens.
- Left: exactly two canvas medieval royal pavilion tents with banners and lanterns (Team Past).
- Right: exactly two sleek geodesic dome pods with neon blue accents (Team Future).
- Buttons floating over the workbenches, wood style on the Past side and neon style on the Future side: **[UPGRADE BASE]**, **[FORGE WEAPON]**, **[READY FOR BATTLE]**. Add **[TWEAK GEAR]** for ammo type.
- Scrap counter for each team (a small pile icon plus a number).
- Phase note: in the first release these buttons can be shown as "Coming soon" with a wobbly padlock-free ribbon, not a lock. Design both the active and "coming soon" states.

### 5. Base Deployment (Future player picks the secret base spot)
Side-view Austin skyline at dusk with three glowing drop zones: on top of a neon skyscraper, tucked under a futuristic Lady Bird Lake bridge, disguised inside a food-truck pavilion. A small card for each spot shows "Height: high / medium / low" and one funny fact. A ghost preview of the base follows the pointer. **Lock it in!** button.

### 6. Battle Arena (the main screen)
Left: ornate medieval castle. Right: futuristic Austin cyber-base under a glowing solar skyway. Parallax layers in between.
Include these elements:
- **Turn banner**, top center, drops in with a cartoon horn: "ALEX, YOUR TURN! (SHOT 1 OF 2)" with glowing arrows toward the active side. Use the active team's accent color.
- **Active player glow**: bright animated frame around the active side. The waiting side dims about 25%.
- **Aim controls**: angle dial and power meter, each with big touch-friendly drag handles and number readouts. Also arrow-key and mouse support hints. Trajectory dotted arc preview (short, fades out).
- **Wind**: a windsock or leaf that shows direction and strength, plus a small number.
- **Health bars** for each base: 100 HP, shaped like a candle on the Past side and a battery on the Future side.
- **Shots left**: two cannonball (Past) or plasma orb (Future) icons.
- **Scrap pickup popups** after fast answers.
- Corner buttons: How to Play (?), Mute, Pause.
- Hit effects: confetti burst, bouncy plasma ring, toy-block walls tumbling. No fire that looks dangerous, no blood, no smoke that looks like real war.

### 7. Awkward Tumble (slapstick moment, animation frames)
Storyboard of 6 frames: character near the blast folds like a lawn chair, spins arms like windmills, pancakes flat on the ground, springs up, looks left and right, blurts a speech bubble. Speech bubble lines (rotate):
- "Just inspecting the floor for loose pennies!"
- "Error 404: Balance protocol failed!"
- "I meant to do that. It's a tactical maneuver!"
- "Who put the gravity on maximum?!"
- "Just checking the lawn for four-leaf clovers!"
Show one lying flat on their stomach, arms spread, with a bubble.

### 8. Pass-the-Mouse Screen (between turns)
Full-screen cover that hides the board. Big text: "Pass the screen! No peeking at their question!" Shows the next player's name and avatar and a **I'm ready!** button. A small hand-off animation (a cartoon hand passing a mouse).

### 9. Reload Modal (the learning moment)
Appears right after shot 2. Hides the rest of the screen so the other player cannot see.
Three question layouts:
- **Reading (K to 3)**: a sight word shown large, with a speaker button that says the word. Four big picture-or-word choices.
- **Reading (4 to 12)**: a short sentence or vocabulary item with 4 choices.
- **Math**: an equation, for example `3x + 5 = 20`, with a number pad or 4 choice buttons. Include a visible fraction and exponent style.
Elements: a fast-answer timer ring (friendly, not stressful; no buzzer), a hint button, a progress "reload bar" that fills when correct. Right answer: cheerful clunk and "RELOADED!" with scrap sparkle (fast answers earn bonus scrap). Wrong answer: a funny boing, show the right answer kindly, reload still happens after a short beat (kids never get stuck).

### 10. Victory and Wipeout Screen
Winner on a hovering podium with confetti. Loser flat on the ground, then popping up with a good-sport line: "Rematch? My dignity needs a rematch!" Show a simple scoreboard: shots fired, questions answered, fastest answer, scrap earned. Buttons: **Rematch**, **Back to Camp**, **Main Menu**. No "defeat" or "you died" words anywhere.

### 11. Phase 4 screens (design now, build later)
- **Join a game**: enter a 4-letter room code on an iPad, big letter tiles.
- **Host a game**: shows the room code in huge letters and "Waiting for a friend..." with a bouncing chicken.
- **Lobby** and **Connection lost** states, kind and funny wording.

## Components to include in the design system
Buttons (wood, neon, neutral), chips, name field, avatar picker, grade picker, subject toggle, progress bar (timeline), health bar (candle and battery), scrap counter, turn banner, speech bubble, toast, modal, caption bar, mute toggle, dial, power meter, wind indicator, number pad, answer tiles, podium, tooltips.

## Motion
Springy and exaggerated. Banner drop 400ms with overshoot. Modal pop 250ms. Tumble 1.2 to 1.6s total. Respect reduced-motion: swap big motion for fades.

## Deliverables
1. A design system: colors, type, spacing, components, light-on-dark rules for neon.
2. High-fidelity frames for screens 0 through 10 at 1280x800 and 1024x768. Frames for screen 11 at 1024x768.
3. A sprite sheet plan: list every character pose, prop, and effect needed, with sizes.
4. An exportable asset list with file names (PNG/SVG/WebP) the engineers can drop into `public/assets/`.

## Do not
- Do not use real brand logos, real characters, or copyrighted mascots.
- Do not show blood, weapons aimed at people, or realistic damage.
- Do not add any money, ads, login, or social features.
