// The angle dial, the draggable handle, the power meter, and the dotted preview.
// The same numbers show on the DOM sliders, and the arrow keys change them there.
import Phaser from 'phaser';
import { HUD } from '../../data/copy';
import { AIM, TEAM_FACING } from '../../game/config';
import type { AimInput, BattleLayout, Team, Vec2 } from '../../game/types';
import { aimFromDrag, dialHandle } from './geometry';
import type { PreviewDot } from './types';
import type { LabelScaler } from './textScale';
import { DIAL, FONT, PALETTE, TEAM_COLOR, TEXT_MIN_PX } from './visual';

const METER = { w: 170, h: 20, rise: 60 } as const;
const GRAB = DIAL.handleRadius * 2.2;

export type AimArt = {
  /** Draw the dial and meter for a team, or hide them with null. */
  show(team: Team | null, aim: AimInput): void;
  showPreview(team: Team, dots: readonly PreviewDot[] | null): void;
  /** Pointer events. Return true if the pointer grabbed the handle. */
  pointerDown(p: Vec2): boolean;
  pointerMove(p: Vec2): AimInput | null;
  pointerUp(): void;
  destroy(): void;
};

export function createAimArt(
  scene: Phaser.Scene,
  layout: BattleLayout,
  labels?: LabelScaler,
): AimArt {
  const dial = scene.add.graphics().setDepth(20);
  const preview = scene.add.graphics().setDepth(19);
  const angleText = scene.add
    .text(0, 0, '', {
      fontFamily: FONT,
      fontSize: `${TEXT_MIN_PX}px`,
      fontStyle: 'bold',
      color: '#1b1b26',
      backgroundColor: '#ffffffdd',
      padding: { x: 6, y: 2 },
    })
    .setDepth(21)
    .setVisible(false);
  const powerText = scene.add
    .text(0, 0, '', {
      fontFamily: FONT,
      fontSize: `${TEXT_MIN_PX}px`,
      fontStyle: 'bold',
      color: '#1b1b26',
      backgroundColor: '#ffffffdd',
      padding: { x: 6, y: 2 },
    })
    .setOrigin(0.5)
    .setDepth(21)
    .setVisible(false);

  labels?.register(angleText, TEXT_MIN_PX);
  labels?.register(powerText, TEXT_MIN_PX);

  let team: Team | null = null;
  let aim: AimInput = { angleDeg: AIM.defaultAngleDeg, power: AIM.defaultPower };
  let dragging = false;

  const origin = (t: Team): Vec2 => layout.launchOrigins[t];

  const draw = (): void => {
    dial.clear();
    angleText.setVisible(team !== null);
    powerText.setVisible(team !== null);
    if (!team) return;
    const o = origin(team);
    const facing = TEAM_FACING[team];
    const color = TEAM_COLOR[team];

    // Guide arc from flat (0 degrees) to straight up (90 degrees).
    dial.lineStyle(3, PALETTE.shared.ink, 0.45);
    const start = facing === 1 ? -Math.PI / 2 : Math.PI;
    const end = facing === 1 ? 0 : Math.PI * 1.5;
    dial.beginPath();
    dial.arc(o.x, o.y, DIAL.maxRadius, start, end);
    dial.strokePath();

    const h = dialHandle(o, aim.angleDeg, aim.power, facing);
    dial.lineStyle(5, color, 1);
    dial.lineBetween(o.x, o.y, h.x, h.y);
    dial.fillStyle(color, 1);
    dial.fillCircle(h.x, h.y, DIAL.handleRadius);
    dial.lineStyle(4, PALETTE.shared.ink, 1);
    dial.strokeCircle(h.x, h.y, DIAL.handleRadius);
    angleText.setText(`${HUD.angle} ${HUD.angleValue(aim.angleDeg)}`);
    angleText.setPosition(h.x + (facing === 1 ? 24 : -24 - angleText.width), h.y - 36);

    // Power meter above the launcher.
    const mx = o.x - METER.w / 2;
    const my = o.y - DIAL.maxRadius - METER.rise;
    dial.fillStyle(PALETTE.shared.white, 0.9);
    dial.fillRoundedRect(mx, my, METER.w, METER.h, 10);
    dial.fillStyle(color, 1);
    const frac = Math.min(
      1,
      Math.max(0, (aim.power - AIM.powerMin) / (AIM.powerMax - AIM.powerMin)),
    );
    if (frac > 0) dial.fillRoundedRect(mx, my, METER.w * frac, METER.h, 10);
    dial.lineStyle(3, PALETTE.shared.ink, 1);
    dial.strokeRoundedRect(mx, my, METER.w, METER.h, 10);
    powerText.setText(`${HUD.power} ${HUD.powerValue(aim.power)}`);
    powerText.setPosition(o.x, my - 20);
  };

  return {
    show(next, nextAim) {
      team = next;
      aim = { ...nextAim };
      draw();
    },
    showPreview(t, dots) {
      preview.clear();
      if (!dots) return;
      const color = TEAM_COLOR[t];
      for (const d of dots) {
        preview.fillStyle(color, d.alpha);
        preview.fillCircle(d.x, d.y, 5);
        preview.lineStyle(2, PALETTE.shared.ink, d.alpha);
        preview.strokeCircle(d.x, d.y, 5);
      }
    },
    pointerDown(p) {
      if (!team) return false;
      const h = dialHandle(origin(team), aim.angleDeg, aim.power, TEAM_FACING[team]);
      if (Math.hypot(p.x - h.x, p.y - h.y) > GRAB) return false;
      dragging = true;
      return true;
    },
    pointerMove(p) {
      if (!dragging || !team) return null;
      return aimFromDrag(origin(team), p, TEAM_FACING[team], aim);
    },
    pointerUp() {
      dragging = false;
    },
    destroy() {
      dial.destroy();
      preview.destroy();
      angleText.destroy();
      powerText.destroy();
    },
  };
}
