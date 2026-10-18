// Saved bases and unlocked pieces survive a reload, and bad stored data is repaired.
import { describe, expect, it } from 'vitest';
import {
  chooseSlot,
  freshBases,
  newBuild,
  placePiece,
  saveSlot,
  toSaved,
} from '../../src/game/baseBuilder';
import { freshWallet, walletOf, withWallet, freshCamp } from '../../src/game/loadout';
import { createStorage, loadBases, loadCamp } from '../../src/storage/storage';

function backing(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const placed = (() => {
  const r = placePiece(newBuild('PAST'), 'stone', { x: 2, y: 3, ox: 0, oy: 0 });
  if (!r.ok) throw new Error('place');
  return r.state.pieces;
})();

describe('timeclash.bases', () => {
  it('is empty with nothing saved', () => {
    expect(loadBases(createStorage(backing()))).toEqual(freshBases());
  });
  it('round trips a chosen base through the backing store', () => {
    const b = backing();
    const st = chooseSlot(saveSlot(freshBases(), 'Alex', 'PAST', 2, placed), 'Alex', 'PAST', 2);
    createStorage(b).set('timeclash.bases', st);
    const back = loadBases(createStorage(b));
    expect(back.players.alex!.PAST.chosen).toBe(2);
    expect(back.players.alex!.PAST.slots[2]).toEqual(toSaved(placed));
  });
  it('survives broken JSON, wrong shapes and hand-edited bricks', () => {
    expect(loadBases(createStorage(backing({ 'timeclash.bases': '{' })))).toEqual(freshBases());
    expect(loadBases(createStorage(backing({ 'timeclash.bases': '[1,2]' })))).toEqual(freshBases());
    const evil = JSON.stringify({
      players: {
        alex: {
          PAST: {
            chosen: -4,
            slots: [
              {
                v: 1,
                p: [
                  ['stone', 'x', 1, 0, 0, 0, 1],
                  ['stone', 1, 1, 0, 0, 0, 1],
                ],
              },
            ],
          },
        },
      },
    });
    const back = loadBases(createStorage(backing({ 'timeclash.bases': evil })));
    expect(back.players.alex!.PAST.chosen).toBe(0);
    expect(back.players.alex!.PAST.slots[0]!.p).toHaveLength(1);
  });
  it('a storage that cannot save still keeps the bases for this visit', () => {
    const s = createStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    });
    const st = saveSlot(freshBases(), 'Alex', 'PAST', 0, placed);
    expect(s.set('timeclash.bases', st)).toBe(false);
    expect(loadBases(s).players.alex).toBeDefined();
  });
});

describe('unlocked pieces in the camp', () => {
  const camp = withWallet(freshCamp(), {
    ...freshWallet('Alex'),
    loadout: {
      ...freshWallet('Alex').loadout,
      PAST: {
        ...freshWallet('Alex').loadout.PAST,
        pieces: ['arch', 'laserBase', 'stone', 'arch', 7 as never],
      },
    },
  });
  it('keeps only real, locked pieces of that side, once each', () => {
    const b = backing({ 'timeclash.camp': JSON.stringify(camp) });
    const w = walletOf(loadCamp(createStorage(b)), 'Alex');
    expect(w.loadout.PAST.pieces).toEqual(['arch']);
    expect(w.loadout.FUTURE.pieces).toBeUndefined();
  });
});
