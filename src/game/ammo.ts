// Ammo: what the shot is made of. Pure data and arithmetic, no Phaser. "Standard" is the shot
// every game has always had, so a missing or unknown ammo id plays exactly like Phase 1. The
// three special kinds cost Scrap to unlock (per player and side) and have a few uses per match,
// so they stay a choice and not a default. The Camp wallet and the uses left are not kept here.

export type AmmoId = 'standard' | 'confetti' | 'plasma' | 'bowling';

export type Ammo = {
  id: AmmoId;
  name: string;
  /** Scrap to unlock. Standard is free. */
  cost: number;
  /** Shots of this kind per match. Standard has no limit. */
  uses: number;
  /** Multiplies the launch speed (on top of the weapon). */
  speedScale: number;
  /** Multiplies the wind push. Lower means the wind matters less. */
  windScale: number;
  /** Multiplies the damage of a direct hit and a near miss. */
  damageScale: number;
  /** Multiplies the direct and near-miss blast distances. */
  radiusScale: { direct: number; near: number };
  /** How many times the shot bounces off the ground before it ends. */
  bounces: number;
  /** Vertical speed kept after a bounce (the horizontal speed is kept whole). */
  restitution: number;
};

const PLAIN = { speedScale: 1, windScale: 1, damageScale: 1, bounces: 0, restitution: 0 } as const;
const SAME_BLAST = { direct: 1, near: 1 } as const;

export const AMMO: readonly Ammo[] = [
  {
    id: 'standard',
    name: 'Standard Shot',
    cost: 0,
    uses: Number.POSITIVE_INFINITY,
    ...PLAIN,
    radiusScale: SAME_BLAST,
  },
  {
    id: 'confetti',
    name: 'Confetti Explosives',
    cost: 10,
    uses: 3,
    ...PLAIN,
    damageScale: 0.9,
    radiusScale: { direct: 1.15, near: 1.3 },
  },
  {
    id: 'plasma',
    name: 'Bouncy Plasma Spheres',
    cost: 14,
    uses: 3,
    ...PLAIN,
    damageScale: 0.9,
    bounces: 1,
    restitution: 0.6,
    radiusScale: SAME_BLAST,
  },
  {
    id: 'bowling',
    name: 'Heavy Iron Bowling Balls',
    cost: 18,
    uses: 2,
    ...PLAIN,
    speedScale: 0.85,
    windScale: 0.4,
    damageScale: 1.3,
    radiusScale: SAME_BLAST,
  },
];

export const AMMO_IDS: readonly AmmoId[] = AMMO.map((a) => a.id);

const STANDARD = AMMO[0] as Ammo;

/** The ammo with this id, or null if there is none. */
export const ammoById = (id: unknown): Ammo | null => AMMO.find((a) => a.id === id) ?? null;

/** Same as ammoById, but a missing or unknown id counts as Standard, so nothing ever throws. */
export const resolveAmmo = (id: unknown): Ammo => ammoById(id) ?? STANDARD;

export const ammoCost = (id: unknown): number => resolveAmmo(id).cost;
/** Uses per match. Standard is unlimited (Infinity). */
export const ammoUses = (id: unknown): number => resolveAmmo(id).uses;
export const effectiveSpeedScale = (id: unknown): number => resolveAmmo(id).speedScale;
export const windScale = (id: unknown): number => resolveAmmo(id).windScale;
export const damageScale = (id: unknown): number => resolveAmmo(id).damageScale;
export const radiusScale = (id: unknown): { direct: number; near: number } =>
  resolveAmmo(id).radiusScale;
export const bounces = (id: unknown): number => resolveAmmo(id).bounces;

/** A damage number after the ammo's scale, rounded to a whole point. */
export const scaleDamage = (base: number, id: unknown): number =>
  Math.round(base * resolveAmmo(id).damageScale);

/** True for an id that names a real special kind (not Standard, not junk). */
export const isSpecialAmmo = (id: unknown): boolean => {
  const a = ammoById(id);
  return a !== null && a.id !== 'standard';
};
