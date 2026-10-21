// The small angle guide at the muzzle, its draggable tip, and the dotted preview.
// Power is shown and set only in the bottom bar. The same angle shows on the DOM slider,
// and the arrow keys change it there.
import Phaser from 'phaser';
import { HUD } from '../../data/copy';
import { AIM, TEAM_FACING } from '../../game/config';
import type { AimInput, BattleLayout, Team, Vec2 } from '../../game/types';
import { angleArc, angleFromDrag, angleLabelSpot, guideTip } from './geometry';
import type { PreviewDot } from './types';
import type { LabelScaler } from './textScale';
import { TEXT_ROLES, textStyle, type TextRole } from './textStyle';
import { DIAL, PALETTE, TEAM_COLOR } from './visual';

const GRAB = DIAL.grabRadius;
const readoutRole = (t: Team): TextRole => (t === 'PAST' ? 'readoutPast' : 'readoutFuture');

/** What the guide shows right now. Read by the e2e hook. */
export type AimArtState = {
  team: Team | null;
  /** Where the guide starts: the muzzle of the fighter about to fire. */
  origin: Vec2 | null;
  /** Every text the aim art draws right now. */
  texts: string[];
};

export type AimArt = {
  /** Draw the guide for a team at its firing point, or hide it with null. */
  show(team: Team | null, aim: AimInput, origin?: Vec2): void;
  state(): AimArtState;
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

  labels?.register(angleText, TEXT_ROLES.readoutPast.basePx);

  let team: Team | null = null;
  let aim: AimInput = { angleDeg: AIM.defaultAngleDeg, power: AIM.defaultPower };
  // The firing point of the fighter about to shoot. Falls back to the team's layout launcher.
  let from: Vec2 | null = null;

  let dragging = false;

  const origin = (t: Team): Vec2 => from ?? layout.launchOrigins[t];

  const draw = (): void => {
    dial.clear();
    angleText.setVisible(team !== null);
    if (!team) return;
    const o = origin(team);
    const facing = TEAM_FACING[team];
    const color = TEAM_COLOR[team];

    // A short arc from flat up to the aim, then a short line to the tip. Ink outline under the team color.
    const arc = angleArc(aim.angleDeg, facing);
    const tip = guideTip(o, aim.angleDeg, facing);
    const flat = { x: o.x + facing * DIAL.arcRadius, y: o.y };
    dial.lineStyle(7, PALETTE.shared.ink, 0.85);
    dial.lineBetween(o.x, o.y, flat.x + facing * 14, flat.y);
    dial.lineStyle(3, color, 0.9);
    dial.lineBetween(o.x, o.y, flat.x + facing * 14, flat.y);
    if (aim.angleDeg > 0) {
      dial.lineStyle(7, PALETTE.shared.ink, 0.85);
      dial.beginPath();
      dial.arc(o.x, o.y, DIAL.arcRadius, arc.start, arc.end);
      dial.strokePath();
      dial.lineStyle(3, color, 1);
      dial.beginPath();
      dial.arc(o.x, o.y, DIAL.arcRadius, arc.start, arc.end);
      dial.strokePath();
    }
    dial.lineStyle(8, PALETTE.shared.ink, 1);
    dial.lineBetween(o.x, o.y, tip.x, tip.y);
    dial.lineStyle(4, color, 1);
    dial.lineBetween(o.x, o.y, tip.x, tip.y);
    // A small handle at the tip. The grab circle around it is much larger and invisible.
    dial.fillStyle(color, 1);
    dial.fillCircle(tip.x, tip.y, DIAL.handleRadius);
    dial.lineStyle(3, PALETTE.shared.ink, 1);
    dial.strokeCircle(tip.x, tip.y, DIAL.handleRadius);

    const role = readoutRole(team);
    angleText.setColor(TEXT_ROLES[role].color);
    angleText.setText(HUD.angleValue(aim.angleDeg));
    const spot = angleLabelSpot(o, aim.angleDeg, facing);
    const x = spot.anchorX === 0 ? spot.x : spot.x - angleText.width;
    angleText.setPosition(
      Math.min(layout.width - angleText.width - 8, Math.max(8, x)),
      Math.max(8, spot.y - angleText.height / 2),
    );
  };

  return {
    show(next, nextAim, nextOrigin) {
      team = next;
      aim = { ...nextAim };
      from = nextOrigin ? { ...nextOrigin } : null;
      draw();
    },
    state() {
      return {
        team,
        origin: team ? { ...origin(team) } : null,
        texts: team ? [angleText.text] : [],
      };
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
      const h = guideTip(origin(team), aim.angleDeg, TEAM_FACING[team]);
      if (Math.hypot(p.x - h.x, p.y - h.y) > GRAB) return false;
      dragging = true;
      return true;
    },
    pointerMove(p) {
      if (!dragging || !team) return null;
      const angleDeg = angleFromDrag(origin(team), p, TEAM_FACING[team], aim.angleDeg);
      return { angleDeg, power: aim.power };
    },
    pointerUp() {
      dragging = false;
    },
    destroy() {
      dial.destroy();
      preview.destroy();
      angleText.destroy();
    },
  };
}
