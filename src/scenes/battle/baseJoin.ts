// Built bases in battle: which bricks join their same-material neighbours, so a stretch of one
// material is drawn as one piece with an outline only round its outer edge (the same rule as the
// builder, src/ui/materialJoin.ts). Pure, no Phaser. It only reads the bricks' boxes: it never
// changes a box, hit points or collision. A brick that fell no longer counts as a neighbour, so
// the edge it leaves behind gets its outline back.
import { footprint, pieceById } from '../../game/baseBuilder';
import type { BrickId, BrickView, Team } from '../../game/types';
import {
  cellsOfPiece,
  joinKey,
  joinsForBrick,
  mirrorJoins,
  type Joins,
  type Tile,
} from '../../ui/materialJoin';

/** The joins of each square of each standing brick of `team`, in the brick's own picture frame. */
export function brickJoins(team: Team, bricks: Record<BrickId, BrickView>): Map<BrickId, Joins[]> {
  const flip = team === 'FUTURE';
  const mine: Array<{ id: BrickId; tiles: Tile[]; cw: number; own: boolean }> = [];
  for (const [id, b] of Object.entries(bricks) as Array<[BrickId, BrickView]>) {
    if (b.team !== team || !b.alive) continue;
    const def = pieceById(b.piece);
    const cells = cellsOfPiece(b.piece, b.rot ?? 0);
    if (!def || cells.length === 0) continue;
    const f = footprint(def, b.rot ?? 0);
    const cw = b.box.w / f.w;
    const ch = b.box.h / f.h;
    const tiles = cells.map((q) => {
      // The picture of a Team Future brick is turned round, so its squares sit mirrored.
      const col = flip ? f.w - 1 - q.c : q.c;
      const l = b.box.x + col * cw;
      const t = b.box.y + q.r * ch;
      return { l, t, r: l + cw, b: t + ch, mat: q.mat };
    });
    mine.push({ id, tiles, cw: Math.min(cw, ch), own: def.cells !== undefined });
  }
  const all = mine.flatMap((m) => m.tiles);
  const out = new Map<BrickId, Joins[]>();
  for (const m of mine) {
    const joins = joinsForBrick(m.tiles, all, m.own, m.cw * 0.03);
    if (joins) out.set(m.id, flip ? joins.map(mirrorJoins) : joins);
  }
  return out;
}

/** A key for a brick's joins ("" when it touches nothing of its material). */
export const joinsKeyOf = (joins: readonly Joins[] | undefined): string =>
  joins ? joins.map(joinKey).join('/') : '';
