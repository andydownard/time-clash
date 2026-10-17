// Victory art: the winner on a hovering podium under falling confetti, and the other team's
// character lying flat, then popping back up with a good-sport line. Nobody is hurt: the loser
// boings up smiling. Reduced motion shows the final picture with nothing moving.
import Phaser from 'phaser';
import { VICTORY } from '../../data/copy';
import type { Team } from '../../game/types';
import { createCharacter } from './sprites';
import { worldFontPx } from './textScale';
import { TEXT_ROLES, textStyle } from './textStyle';
import {
  HOVER_PERIOD_MS,
  LOSER_FLAT_MS,
  LOSER_POP_MS,
  confettiFor,
  hoverOffset,
  loserSquash,
  victoryLayout,
} from './victoryLayout';
import { PALETTE } from './visual';

const CHARACTER_SCALE = 1.9;
const BUBBLE_W = 380;

export type VictoryArt = { destroy(): void };

export function paintVictory(
  scene: Phaser.Scene,
  winner: Team,
  size: { width: number; height: number },
  reduced: boolean,
): VictoryArt {
  const loserTeam: Team = winner === 'PAST' ? 'FUTURE' : 'PAST';
  const layout = victoryLayout(winner, size);
  const { podium } = layout;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => (objects.push(o), o);

  // Shadow on the ground, under the podium.
  const shadow = track(
    scene.add
      .ellipse(
        podium.x + podium.w / 2,
        layout.groundY + 6,
        podium.w * 1.1,
        22,
        PALETTE.shared.shadow,
        0.4,
      )
      .setDepth(5),
  );

  // Podium: a purple block with an ember top slab and a star, so the winner reads without color.
  const stage = track(scene.add.container(0, 0).setDepth(6));
  const block = scene.add.graphics();
  block.fillStyle(PALETTE.past.bannerDark, 1);
  block.fillRoundedRect(podium.x, podium.y, podium.w, podium.h, 10);
  block.lineStyle(5, PALETTE.past.deep, 1);
  block.strokeRoundedRect(podium.x, podium.y, podium.w, podium.h, 10);
  block.fillStyle(PALETTE.future.neon, 1);
  block.fillRoundedRect(
    podium.x + podium.w * 0.5,
    podium.y + 8,
    podium.w * 0.5 - 8,
    podium.h - 16,
    8,
  );
  block.fillStyle(PALETTE.past.gold, 1);
  block.fillRoundedRect(podium.x - 10, podium.y - 14, podium.w + 20, 22, 8);
  block.lineStyle(4, PALETTE.shared.ink, 1);
  block.strokeRoundedRect(podium.x - 10, podium.y - 14, podium.w + 20, 22, 8);
  const star = scene.add
    .star(podium.x + podium.w * 0.25, podium.y + podium.h / 2, 5, 12, 28, PALETTE.past.gold)
    .setStrokeStyle(4, PALETTE.shared.ink);
  stage.add([block, star]);

  // The winner, standing on the slab.
  const hero = createCharacter(scene, winner, layout.winnerFeet.x, layout.winnerFeet.y - 8);
  hero.container.setScale(CHARACTER_SCALE).setDepth(7);
  track(hero.container);

  // The other team: flat on the ground, then up with a boing.
  const other = createCharacter(scene, loserTeam, layout.loserFeet.x, layout.loserFeet.y);
  other.container.setDepth(7);
  track(other.container);
  const squash = (ms: number): void => {
    other.container.setScale(CHARACTER_SCALE, CHARACTER_SCALE * loserSquash(ms));
  };

  // The good-sport line, in a speech bubble, once the loser is up.
  const bubble = track(scene.add.container(0, 0).setDepth(8).setVisible(false));
  const px = worldFontPx(TEXT_ROLES.bubble.basePx, scene.scale.displaySize.width, size.width);
  const line = scene.add
    .text(0, 0, VICTORY.goodSport, {
      ...textStyle('bubble'),
      fontSize: `${px}px`,
      wordWrap: { width: BUBBLE_W },
      align: 'center',
    })
    .setOrigin(0.5, 1);
  const by = layout.loserFeet.y - 150 * CHARACTER_SCALE;
  const tail = scene.add.graphics();
  tail.fillStyle(PALETTE.past.parchment, 1);
  tail.fillTriangle(-14, 0, 14, 0, 0, 22);
  tail.lineStyle(4, PALETTE.shared.ink, 1);
  tail.lineBetween(-14, 0, 0, 22);
  tail.lineBetween(14, 0, 0, 22);
  bubble.add([line, tail]);
  bubble.setPosition(
    Math.min(size.width - BUBBLE_W / 2 - 8, Math.max(BUBBLE_W / 2 + 8, layout.loserFeet.x)),
    by,
  );
  tail.setPosition(0, 0);

  // Confetti.
  const pieces = confettiFor(winner, size).map((c) => {
    const r = track(scene.add.rectangle(c.x, c.startY, 12, 8, c.color).setDepth(9));
    return { r, c };
  });

  const hover = (ms: number): void => {
    const dy = hoverOffset(ms);
    stage.setY(dy);
    hero.container.setY(layout.winnerFeet.y - 8 + dy);
    shadow.setScale(1 - dy / 120, 1);
  };

  if (reduced) {
    squash(Number.MAX_SAFE_INTEGER);
    bubble.setVisible(true);
    for (const { r, c } of pieces) r.setPosition(c.x, c.endY);
  } else {
    squash(0);
    scene.tweens.addCounter({
      from: 0,
      to: LOSER_FLAT_MS + LOSER_POP_MS,
      duration: LOSER_FLAT_MS + LOSER_POP_MS,
      onUpdate: (t) => squash(t.getValue() ?? 0),
      onComplete: () => {
        squash(Number.MAX_SAFE_INTEGER);
        bubble.setVisible(true);
      },
    });
    scene.tweens.addCounter({
      from: 0,
      to: HOVER_PERIOD_MS,
      duration: HOVER_PERIOD_MS,
      repeat: -1,
      onUpdate: (t) => hover(t.getValue() ?? 0),
    });
    for (const { r, c } of pieces) {
      scene.tweens.add({
        targets: r,
        y: c.endY,
        angle: c.spin,
        delay: c.delayMs,
        duration: c.durationMs,
        ease: 'Quad.easeIn',
      });
    }
  }

  return {
    destroy() {
      for (const o of objects) o.destroy();
      objects.length = 0;
    },
  };
}
