// The angle dial, the draggable handle, the power meter, and the dotted preview.
// The same numbers show on the DOM sliders, and the arrow keys change them there.
import Phaser from 'phaser';
import { HUD } from '../../data/copy';
import { AIM, TEAM_FACING } from '../../game/config';
import type { AimInput, BattleLayout, Team, Vec2 } from '../../game/types';
import { aimFromDrag, aimVector, dialHandle, meterLeft } from './geometry';
import type { PreviewDot } from './types';
import type { LabelScaler } from './textScale';
import { TEXT_ROLES, textStyle, type TextRole } from './textStyle';
import { DIAL, PALETTE, TEAM_COLOR } from './visual';

const METER = { w: 210, h: 28, rise: 64, segments: 5 } as const;
const GRAB = DIAL.grabRadius;
/** Tick marks around the guide arc, in degrees. */
const TICKS = [0, 15, 30, 45, 60, 75, 90] as const;
const readoutRole = (t: Team): TextRole => (t === 'PAST' ? 'readoutPast' : 'readoutFuture');

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
    .text(0, 0, '', textStyle('readoutPast'))
    .setDepth(21)
    .setVisible(false);
  const powerText = scene.add
    .text(0, 0, '', textStyle('readoutPast'))
    .setOrigin(0.5)
    .setDepth(21)
    .setVisible(false);

  labels?.register(angleText, TEXT_ROLES.readoutPast.basePx);
  labels?.register(powerText, TEXT_ROLES.readoutPast.basePx);

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

    // Guide: a soft sector, a bold arc from flat (0 degrees) to straight up (90), and tick marks.
    const start = facing === 1 ? -Math.PI / 2 : Math.PI;
    const end = facing === 1 ? 0 : Math.PI * 1.5;
    dial.fillStyle(color, 0.14);
    dial.slice(o.x, o.y, DIAL.maxRadius, start, end, false);
    dial.fillPath();
    dial.lineStyle(5, PALETTE.shared.ink, 0.7);
    dial.beginPath();
    dial.arc(o.x, o.y, DIAL.maxRadius, start, end);
    dial.strokePath();
    dial.lineStyle(3, color, 1);
    dial.beginPath();
    dial.arc(o.x, o.y, DIAL.maxRadius, start, end);
    dial.strokePath();
    for (const deg of TICKS) {
      const v = aimVector(deg, facing);
      const long = deg % 45 === 0;
      const inner = DIAL.maxRadius - (long ? 16 : 9);
      dial.lineStyle(long ? 4 : 3, PALETTE.shared.ink, 1);
      dial.lineBetween(
        o.x + v.x * inner,
        o.y + v.y * inner,
        o.x + v.x * (DIAL.maxRadius + 4),
        o.y + v.y * (DIAL.maxRadius + 4),
      );
    }

    const h = dialHandle(o, aim.angleDeg, aim.power, facing);
    dial.lineStyle(9, PALETTE.shared.ink, 1);
    dial.lineBetween(o.x, o.y, h.x, h.y);
    dial.lineStyle(5, color, 1);
    dial.lineBetween(o.x, o.y, h.x, h.y);
    // The handle: a big ring with a grip dot, so it reads as something to drag.
    dial.fillStyle(color, 1);
    dial.fillCircle(h.x, h.y, DIAL.handleRadius);
    dial.lineStyle(4, PALETTE.shared.ink, 1);
    dial.strokeCircle(h.x, h.y, DIAL.handleRadius);
    dial.fillStyle(PALETTE.shared.ink, 1);
    dial.fillCircle(h.x, h.y, 5);

    const role = readoutRole(team);
    angleText.setColor(TEXT_ROLES[role].color);
    powerText.setColor(TEXT_ROLES[role].color);
    angleText.setText(`${HUD.angle} ${HUD.angleValue(aim.angleDeg)}`);
    const ax = h.x + (facing === 1 ? 32 : -32 - angleText.width);
    angleText.setPosition(
      Math.min(layout.width - angleText.width - 8, Math.max(8, ax)),
      Math.max(8, h.y - 44),
    );

    // Power meter above the launcher: a dark track, five segments, a team-colored fill.
    const mx = meterLeft(o.x, facing, layout.width, METER.w);
    const my = o.y - DIAL.maxRadius - METER.rise;
    dial.fillStyle(PALETTE.shared.ink, 1);
    dial.fillRoundedRect(mx, my, METER.w, METER.h, 12);
    const frac = Math.min(
      1,
      Math.max(0, (aim.power - AIM.powerMin) / (AIM.powerMax - AIM.powerMin)),
    );
    if (frac > 0) {
      dial.fillStyle(color, 1);
      dial.fillRoundedRect(mx + 3, my + 3, (METER.w - 6) * frac, METER.h - 6, 9);
    }
    dial.lineStyle(2, PALETTE.shared.ink, 1);
    for (let i = 1; i < METER.segments; i++) {
      const x = mx + (METER.w * i) / METER.segments;
      dial.lineBetween(x, my + 3, x, my + METER.h - 3);
    }
    dial.lineStyle(3, PALETTE.past.parchment, 1);
    dial.strokeRoundedRect(mx, my, METER.w, METER.h, 12);
    powerText.setText(`${HUD.power} ${HUD.powerValue(aim.power)}`);
    powerText.setPosition(mx + METER.w / 2, my - 28);
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
        preview.fillCircle(d.x, d.y, 6);
        preview.lineStyle(3, PALETTE.shared.ink, d.alpha);
        preview.strokeCircle(d.x, d.y, 6);
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
