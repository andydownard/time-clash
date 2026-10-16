// Health candle (Team Past), health battery (Team Future), shots-left icons, and the wind arrow.
// Numbers are drawn next to the shapes so nothing depends on color alone.
import Phaser from 'phaser';
import { HUD, windWord } from '../../data/copy';
import type { BattleLayout, Team } from '../../game/types';
import { hpFraction, shotIcons, windArrow } from './geometry';
import type { LabelScaler } from './textScale';
import type { ViewStatus } from './types';
import { FONT, PALETTE, TEXT_MIN_PX, WIND_ARROW_MAX } from './visual';

const GAUGE = { w: 30, h: 90, above: 130 } as const;
const WIND_POS = { x: 640, y: 168 } as const;

const textStyle = (color = '#1b1b26'): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${TEXT_MIN_PX + 2}px`,
  fontStyle: 'bold',
  color,
  backgroundColor: '#ffffffcc',
  padding: { x: 6, y: 2 },
});

export type StatusArt = {
  sync(status: ViewStatus): void;
  /** Objects for one team, so the scene can dim the waiting side as one group. */
  groupFor(team: Team): Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text>;
};

export function createStatusArt(
  scene: Phaser.Scene,
  layout: BattleLayout,
  labels?: LabelScaler,
): StatusArt {
  type Gauge = {
    gfx: Phaser.GameObjects.Graphics;
    hp: Phaser.GameObjects.Text;
    shots: Phaser.GameObjects.Graphics;
    x: number;
    y: number;
  };
  const gauges = {} as Record<Team, Gauge>;
  for (const team of ['PAST', 'FUTURE'] as const) {
    const base = layout.bases[team];
    const x = team === 'PAST' ? base.x + 30 : base.x + base.w - 30 - GAUGE.w;
    const y = base.y - GAUGE.above;
    gauges[team] = {
      gfx: scene.add.graphics().setDepth(12),
      hp: scene.add
        .text(x + GAUGE.w / 2, y + GAUGE.h + 8, '', textStyle())
        .setOrigin(0.5, 0)
        .setDepth(12),
      shots: scene.add.graphics().setDepth(12),
      x,
      y,
    };
  }

  for (const team of ['PAST', 'FUTURE'] as const)
    labels?.register(gauges[team].hp, TEXT_MIN_PX + 2);

  const windGfx = scene.add.graphics().setDepth(12);
  const windText = scene.add
    .text(WIND_POS.x, WIND_POS.y + 26, '', textStyle())
    .setOrigin(0.5, 0)
    .setDepth(12);
  labels?.register(windText, TEXT_MIN_PX + 2);

  const drawCandle = (g: Phaser.GameObjects.Graphics, x: number, y: number, f: number): void => {
    const waxH = Math.max(0, GAUGE.h * f);
    g.fillStyle(PALETTE.shared.white, 0.5);
    g.fillRoundedRect(x, y, GAUGE.w, GAUGE.h, 6);
    g.fillStyle(PALETTE.past.parchment, 1);
    g.fillRoundedRect(x, y + GAUGE.h - waxH, GAUGE.w, waxH, 6);
    g.lineStyle(3, PALETTE.shared.ink, 1);
    g.strokeRoundedRect(x, y, GAUGE.w, GAUGE.h, 6);
    const topY = y + GAUGE.h - waxH;
    g.lineBetween(x + GAUGE.w / 2, topY, x + GAUGE.w / 2, topY - 8);
    if (f > 0) {
      g.fillStyle(PALETTE.past.gold, 1);
      g.fillEllipse(x + GAUGE.w / 2, topY - 16, 14, 22);
      g.fillStyle(PALETTE.shared.campfire, 1);
      g.fillEllipse(x + GAUGE.w / 2, topY - 12, 8, 12);
    }
  };

  const drawBattery = (g: Phaser.GameObjects.Graphics, x: number, y: number, f: number): void => {
    g.fillStyle(PALETTE.future.night, 1);
    g.fillRoundedRect(x, y, GAUGE.w, GAUGE.h, 6);
    g.fillRoundedRect(x + 8, y - 8, GAUGE.w - 16, 8, 2);
    const fillH = Math.max(0, (GAUGE.h - 8) * f);
    g.fillStyle(PALETTE.future.cyan, 1);
    g.fillRoundedRect(x + 4, y + GAUGE.h - 4 - fillH, GAUGE.w - 8, fillH, 4);
    g.lineStyle(3, PALETTE.future.steel, 1);
    g.strokeRoundedRect(x, y, GAUGE.w, GAUGE.h, 6);
    // Segment lines: a pattern cue, so the shape works without color.
    g.lineStyle(2, PALETTE.future.night, 1);
    for (let i = 1; i < 4; i++)
      g.lineBetween(x + 4, y + (GAUGE.h * i) / 4, x + GAUGE.w - 4, y + (GAUGE.h * i) / 4);
  };

  const drawShots = (
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    left: number,
    team: Team,
  ): void => {
    const color = team === 'PAST' ? PALETTE.past.gold : PALETTE.future.cyan;
    shotIcons(left).forEach((full, i) => {
      const cx = x + 8 + i * 22;
      if (full) {
        g.fillStyle(color, 1);
        g.fillCircle(cx, y, 8);
      }
      g.lineStyle(3, PALETTE.shared.ink, 1);
      g.strokeCircle(cx, y, 8);
    });
  };

  const drawWind = (wind: number): void => {
    windGfx.clear();
    const a = windArrow(wind);
    windGfx.lineStyle(4, PALETTE.shared.ink, 1);
    windGfx.fillStyle(PALETTE.shared.white, 0.9);
    windGfx.fillRoundedRect(
      WIND_POS.x - WIND_ARROW_MAX / 2 - 12,
      WIND_POS.y - 18,
      WIND_ARROW_MAX + 24,
      36,
      18,
    );
    windGfx.strokeRoundedRect(
      WIND_POS.x - WIND_ARROW_MAX / 2 - 12,
      WIND_POS.y - 18,
      WIND_ARROW_MAX + 24,
      36,
      18,
    );
    if (a.dir !== 0) {
      const tail = WIND_POS.x - (a.dir * a.length) / 2;
      const tip = WIND_POS.x + (a.dir * a.length) / 2;
      windGfx.lineStyle(6, PALETTE.future.night, 1);
      windGfx.lineBetween(tail, WIND_POS.y, tip, WIND_POS.y);
      windGfx.fillStyle(PALETTE.future.night, 1);
      windGfx.fillTriangle(
        tip,
        WIND_POS.y,
        tip - a.dir * 14,
        WIND_POS.y - 10,
        tip - a.dir * 14,
        WIND_POS.y + 10,
      );
    }
    windText.setText(
      a.dir === 0 ? windWord(wind) : `${windWord(wind)} ${Math.abs(Math.round(wind))}`,
    );
  };

  return {
    sync(status) {
      for (const team of ['PAST', 'FUTURE'] as const) {
        const gg = gauges[team];
        const hp = status.baseHp[team];
        const f = hpFraction(hp);
        gg.gfx.clear();
        (team === 'PAST' ? drawCandle : drawBattery)(gg.gfx, gg.x, gg.y, f);
        gg.hp.setText(HUD.hpValue(hp));
        gg.shots.clear();
        drawShots(
          gg.shots,
          gg.x,
          gg.y + GAUGE.h + 52,
          status.activeTeam === team ? status.shotsLeft : 0,
          team,
        );
      }
      drawWind(status.wind);
    },
    groupFor: (team) => [gauges[team].gfx, gauges[team].hp, gauges[team].shots],
  };
}
