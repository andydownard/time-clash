// Health candle (Team Past), health battery (Team Future), shots-left icons, and the wind
// indicator. Each team's panel sits in the ground strip under its base, so it never crosses the
// aim dial. Numbers are drawn next to the shapes, and full versus empty differ by shape (a solid
// dot against a ring), so nothing depends on color alone.
import Phaser from 'phaser';
import { HUD, windWord } from '../../data/copy';
import { DAMAGE } from '../../game/config';
import type { BattleLayout, Team } from '../../game/types';
import { hpFraction, shotIcons, windArrow, windGusts } from './geometry';
import { textStyle } from './textStyle';
import type { LabelScaler } from './textScale';
import type { ViewStatus } from './types';
import { PALETTE, PANEL, TEXT_MIN_PX, WIND_ARROW_MAX } from './visual';

const SHOT = { r: 9, step: 26 } as const;
const WIND_POS = { x: 640, y: 168 } as const;

export type StatusArt = {
  sync(status: ViewStatus): void;
  /** Lay the panels out again with the last status. Call after the label sizes change. */
  relayout(): void;
  /** Objects for one team, so the scene can dim the waiting side as one group. */
  groupFor(team: Team): Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text>;
};

type Panel = {
  frame: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Graphics;
  hp: Phaser.GameObjects.Text;
  shots: Phaser.GameObjects.Graphics;
};

export function createStatusArt(
  scene: Phaser.Scene,
  layout: BattleLayout,
  labels?: LabelScaler,
): StatusArt {
  const panels = {} as Record<Team, Panel>;
  for (const team of ['PAST', 'FUTURE'] as const) {
    panels[team] = {
      frame: scene.add.graphics().setDepth(11),
      icon: scene.add.graphics().setDepth(12),
      hp: scene.add.text(0, 0, '', textStyle('hud')).setOrigin(0, 0.5).setDepth(12),
      shots: scene.add.graphics().setDepth(12),
    };
    labels?.register(panels[team].hp, TEXT_MIN_PX);
  }

  const windFrame = scene.add.graphics().setDepth(11);
  const windGfx = scene.add.graphics().setDepth(12);
  const windText = scene.add
    .text(WIND_POS.x, WIND_POS.y + 22, '', textStyle('hud'))
    .setOrigin(0.5, 0)
    .setDepth(12);
  labels?.register(windText, TEXT_MIN_PX);

  /** Candle: wax melts down as health falls. A flame sits on top while any health is left. */
  const drawCandle = (g: Phaser.GameObjects.Graphics, x: number, y: number, f: number): void => {
    const w = PANEL.iconW;
    const h = 22;
    const top = y + 24;
    const waxH = Math.max(0, h * f);
    g.fillStyle(PALETTE.shared.ink, 1);
    g.fillRoundedRect(x, top, w, h, 6);
    g.fillStyle(PALETTE.past.parchment, 1);
    g.fillRoundedRect(x, top + h - waxH, w, waxH, 6);
    g.lineStyle(3, PALETTE.past.parchment, 1);
    g.strokeRoundedRect(x, top, w, h, 6);
    if (f > 0) {
      const wickY = top + h - waxH;
      g.lineStyle(3, PALETTE.shared.ink, 1);
      g.lineBetween(x + w / 2, wickY, x + w / 2, wickY - 4);
      g.fillStyle(PALETTE.past.gold, 1);
      g.fillEllipse(x + w / 2, wickY - 12, 12, 18);
      g.fillStyle(PALETTE.shared.campfire, 1);
      g.fillEllipse(x + w / 2, wickY - 9, 7, 10);
    }
  };

  /** Battery: the charge bar shrinks as health falls. Segment lines make a pattern cue. */
  const drawBattery = (g: Phaser.GameObjects.Graphics, x: number, y: number, f: number): void => {
    const w = PANEL.iconW;
    const h = 34;
    const top = y + 14;
    g.fillStyle(PALETTE.shared.ink, 1);
    g.fillRoundedRect(x, top, w, h, 6);
    g.fillStyle(PALETTE.future.steel, 1);
    g.fillRoundedRect(x + 10, top - 7, w - 20, 8, 2);
    const fillH = Math.max(0, (h - 8) * f);
    g.fillStyle(PALETTE.future.glow, 1);
    g.fillRoundedRect(x + 4, top + h - 4 - fillH, w - 8, fillH, 4);
    g.lineStyle(2, PALETTE.shared.ink, 1);
    for (let i = 1; i < 4; i++)
      g.lineBetween(x + 4, top + (h * i) / 4, x + w - 4, top + (h * i) / 4);
    g.lineStyle(3, PALETTE.future.steel, 1);
    g.strokeRoundedRect(x, top, w, h, 6);
  };

  const drawFrame = (g: Phaser.GameObjects.Graphics, team: Team, x: number, w: number): void => {
    g.clear();
    if (team === 'PAST') {
      // Wood style: deep purple board, a light purple rim, a darker inner line.
      g.fillStyle(PALETTE.past.deep, 1);
      g.fillRoundedRect(x, PANEL.y, w, PANEL.h, 16);
      g.lineStyle(9, PALETTE.shared.ink, 1);
      g.strokeRoundedRect(x, PANEL.y, w, PANEL.h, 16);
      g.lineStyle(5, PALETTE.past.light, 1);
      g.strokeRoundedRect(x, PANEL.y, w, PANEL.h, 16);
      g.lineStyle(2, PALETTE.past.bannerDark, 1);
      g.strokeRoundedRect(x + 6, PANEL.y + 6, w - 12, PANEL.h - 12, 12);
    } else {
      // Neon style: blue board with a pulse edge and a soft halo.
      g.fillStyle(PALETTE.future.night, 1);
      g.fillRoundedRect(x, PANEL.y, w, PANEL.h, 16);
      g.lineStyle(10, PALETTE.future.glow, 0.25);
      g.strokeRoundedRect(x, PANEL.y, w, PANEL.h, 16);
      g.lineStyle(3, PALETTE.future.glow, 1);
      g.strokeRoundedRect(x, PANEL.y, w, PANEL.h, 16);
    }
  };

  const drawShots = (
    g: Phaser.GameObjects.Graphics,
    x: number,
    cy: number,
    left: number,
    team: Team,
  ): void => {
    const color = team === 'PAST' ? PALETTE.past.gold : PALETTE.future.glow;
    shotIcons(left).forEach((full, i) => {
      const cx = x + SHOT.r + i * SHOT.step;
      if (full) {
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy, SHOT.r);
      }
      g.lineStyle(3, full ? PALETTE.shared.ink : PALETTE.past.parchment, 1);
      g.strokeCircle(cx, cy, SHOT.r);
    });
  };

  const drawWind = (wind: number): void => {
    const a = windArrow(wind);
    windText.setText(
      a.dir === 0 ? windWord(wind) : `${windWord(wind)} ${Math.abs(Math.round(wind))}`,
    );
    windFrame.clear();
    windGfx.clear();
    const w = Math.max(WIND_ARROW_MAX + 48, windText.width + 28);
    const top = WIND_POS.y - 26;
    const h = 26 + 22 + windText.height + 8;
    windFrame.fillStyle(PALETTE.shared.ink, 1);
    windFrame.fillRoundedRect(WIND_POS.x - w / 2, top, w, h, 18);
    windFrame.lineStyle(4, PALETTE.past.parchment, 1);
    windFrame.strokeRoundedRect(WIND_POS.x - w / 2, top, w, h, 18);
    if (a.dir !== 0) {
      const tail = WIND_POS.x - (a.dir * a.length) / 2;
      const tip = WIND_POS.x + (a.dir * a.length) / 2;
      windGfx.lineStyle(7, PALETTE.past.gold, 1);
      windGfx.lineBetween(tail, WIND_POS.y, tip, WIND_POS.y);
      windGfx.fillStyle(PALETTE.past.gold, 1);
      windGfx.fillTriangle(
        tip + a.dir * 6,
        WIND_POS.y,
        tip - a.dir * 14,
        WIND_POS.y - 13,
        tip - a.dir * 14,
        WIND_POS.y + 13,
      );
      // Gust streaks behind the tail, so a pre-reader sees wind, not just an arrow.
      windGfx.lineStyle(4, PALETTE.past.parchment, 1);
      for (const s of windGusts(wind, WIND_POS.x, WIND_POS.y)) {
        windGfx.lineBetween(s.x1, s.y, s.x2, s.y);
      }
    } else {
      // Calm: a small dot, not an empty box.
      windGfx.fillStyle(PALETTE.past.parchment, 1);
      windGfx.fillCircle(WIND_POS.x, WIND_POS.y, 6);
    }
  };

  let last: ViewStatus | null = null;
  const art: StatusArt = {
    relayout() {
      if (last) art.sync(last);
    },
    sync(status) {
      last = status;
      const worldW = layout.width;
      for (const team of ['PAST', 'FUTURE'] as const) {
        const p = panels[team];
        const hp = status.baseHp[team];
        const max = status.maxBaseHp?.[team] ?? DAMAGE.startingBaseHp;
        p.hp.setText(HUD.hpValue(hp, max));
        const shotsW = SHOT.step * (shotIcons(0).length - 1) + SHOT.r * 2;
        const w = PANEL.pad + PANEL.iconW + PANEL.gap + p.hp.width + PANEL.gap + shotsW + PANEL.pad;
        const x = team === 'PAST' ? PANEL.edge : worldW - PANEL.edge - w;
        drawFrame(p.frame, team, x, w);
        p.icon.clear();
        (team === 'PAST' ? drawCandle : drawBattery)(
          p.icon,
          x + PANEL.pad,
          PANEL.y,
          hpFraction(hp, max),
        );
        p.hp.setPosition(x + PANEL.pad + PANEL.iconW + PANEL.gap, PANEL.y + PANEL.h / 2);
        p.shots.clear();
        drawShots(
          p.shots,
          x + w - PANEL.pad - shotsW,
          PANEL.y + PANEL.h / 2,
          status.activeTeam === team ? status.shotsLeft : 0,
          team,
        );
      }
      drawWind(status.wind);
    },
    groupFor: (team) => [
      panels[team].frame,
      panels[team].icon,
      panels[team].hp,
      panels[team].shots,
    ],
  };
  return art;
}
