// How each Phase 2 biome looks behind the fight: the tree (or column) colors and shape. Pure data,
// no Phaser, so tests can check it. The shapes reuse the aspen geometry, so every biome is as calm
// and readable as the first one. Art-only shades, not UI tokens (see visual.ts ART).
import type { BiomeId } from '../../game/types';
import { ART } from './visual';

export type BiomeLook = {
  /** 'trees' draws trunks and leaf clumps. 'columns' draws broken temple columns. */
  kind: 'trees' | 'columns';
  trunk: number;
  bark: number;
  leafFar: number;
  leafNear: number;
};

export const BIOME_LOOKS: Record<BiomeId, BiomeLook> = {
  aspen: {
    kind: 'trees',
    trunk: ART.aspenTrunk,
    bark: ART.aspenBark,
    leafFar: ART.aspenLeafFar,
    leafNear: ART.aspenLeafNear,
  },
  /** Dark trunks and soft pink blossoms. */
  cherry: {
    kind: 'trees',
    trunk: 0x5b4256,
    bark: 0x2a1d2c,
    leafFar: 0xb46a96,
    leafNear: 0xe08cb8,
  },
  /** Pale sandstone columns with green vines on top. */
  temple: {
    kind: 'columns',
    trunk: 0xc9b98f,
    bark: 0x6d5f45,
    leafFar: 0x4f7a4a,
    leafNear: 0x5f8f55,
  },
};

/** The look for a layout's biome. Missing or unknown is aspen (Phase 1). */
export const biomeLook = (biome: unknown): BiomeLook =>
  typeof biome === 'string' && Object.prototype.hasOwnProperty.call(BIOME_LOOKS, biome)
    ? BIOME_LOOKS[biome as BiomeId]
    : BIOME_LOOKS.aspen;
