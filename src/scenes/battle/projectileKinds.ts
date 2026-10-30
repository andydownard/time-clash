// Which shot each fighter fires, and which way it points in flight. Pure: no Phaser.
import type { Team, Vec2 } from '../../game/types';

export type ProjectileKind =
  | 'cannonball'
  | 'arrow'
  | 'stone'
  | 'spear'
  | 'shell'
  | 'rocket'
  | 'tracer'
  | 'laser'
  | 'bomb'
  | 'wave';

export const PROJECTILE_KINDS: readonly ProjectileKind[] = [
  'cannonball',
  'arrow',
  'stone',
  'spear',
  'shell',
  'rocket',
  'tracer',
  'laser',
  'bomb',
  'wave',
];

export const DEFAULT_KIND: Record<Team, ProjectileKind> = { PAST: 'cannonball', FUTURE: 'shell' };

const ROLE_KIND: Record<string, ProjectileKind> = {
  balloon: 'bomb',
  archer: 'arrow',
  cannon: 'cannonball',
  catapult: 'stone',
  spear: 'spear',
  tank: 'shell',
  helicopter: 'tracer',
  bunker: 'rocket',
  saber: 'wave',
  laserGun: 'laser',
};

export function kindForRole(role: string): ProjectileKind {
  return Object.prototype.hasOwnProperty.call(ROLE_KIND, role)
    ? (ROLE_KIND[role] as ProjectileKind)
    : 'cannonball';
}

const ROUND: ReadonlySet<ProjectileKind> = new Set(['cannonball', 'stone', 'bomb']);

/** True when the nose follows the path. Round shots stay as they are (stone and bomb may spin). */
export function kindFlies(kind: ProjectileKind): boolean {
  return !ROUND.has(kind);
}

/** Direction of travel in degrees at a path point (0 = right, 90 = down, as screens count). */
export function headingDegrees(path: readonly Vec2[], index: number): number {
  const n = path.length;
  if (n < 2 || !Number.isFinite(index)) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.round(index)));
  const a = path[Math.max(0, i - 1)] as Vec2;
  const b = path[Math.min(n - 1, i + 1)] as Vec2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
