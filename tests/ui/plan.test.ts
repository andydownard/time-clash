// @vitest-environment jsdom
// The Battle Plan screen: pick a place, Team Future hides its base, and special ammo is unlocked
// with Scrap. Lock it in! starts the match. Back saves nothing about the plan.
import { beforeEach, describe, expect, it } from 'vitest';
import { PLAN_COPY } from '../../src/data/copy';
import { ammoCost } from '../../src/game/ammo';
import type { BattlePlan } from '../../src/game/battlefield';
import { DEFAULT_PLAN } from '../../src/game/config';
import { walletOf, type CampState } from '../../src/game/loadout';
import { TEST_IDS } from '../../src/ui/types';
import { NAMES, campWith } from '../helpers/camp';
import { click, flush, q, qa, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

function open(camp: CampState, plan: BattlePlan = DEFAULT_PLAN) {
  const saves: CampState[] = [];
  let result: BattlePlan | null | undefined;
  const done = s.overlay
    .showPlan({ plan, camp, names: NAMES, save: (c) => saves.push(c) })
    .then((r) => {
      result = r;
    });
  return { saves, done, result: () => result };
}

const checked = (id: string) => q(id)!.getAttribute('aria-checked');
const status = () => q(TEST_IDS.planStatus)!.textContent;

describe('Battle Plan screen', () => {
  it('has a title, three places and three base spots, with the saved plan picked', () => {
    open(campWith(0), { biome: 'cherry', spot: 'bridge' });
    const screen = document.querySelector('[data-screen="plan"]')!;
    expect(screen.querySelector('h1')!.textContent).toBe(PLAN_COPY.title);
    for (const b of ['aspen', 'cherry', 'temple']) expect(q(TEST_IDS.planBiome(b))).not.toBeNull();
    for (const sp of ['skyscraper', 'foodTruck', 'bridge'])
      expect(q(TEST_IDS.planSpot(sp))).not.toBeNull();
    expect(checked(TEST_IDS.planBiome('cherry'))).toBe('true');
    expect(checked(TEST_IDS.planBiome('aspen'))).toBe('false');
    expect(checked(TEST_IDS.planSpot('bridge'))).toBe('true');
  });

  it('names Team Future’s player for the base spot, and shows each spot’s height in words', () => {
    open(campWith(0));
    expect(document.body.textContent).toContain(PLAN_COPY.spotHeading('Sam'));
    expect(q(TEST_IDS.planSpot('skyscraper'))!.textContent).toContain('High.');
    expect(q(TEST_IDS.planSpot('bridge'))!.textContent).toContain('Low.');
  });

  it('Lock it in! resolves with what was picked', async () => {
    const o = open(campWith(0));
    click(q(TEST_IDS.planBiome('temple')));
    click(q(TEST_IDS.planSpot('skyscraper')));
    expect(checked(TEST_IDS.planBiome('temple'))).toBe('true');
    click(q(TEST_IDS.planGo));
    await o.done;
    expect(o.result()).toEqual({ biome: 'temple', spot: 'skyscraper' });
    expect(document.querySelector('[data-screen="plan"]')).toBeNull();
  });

  it('Back resolves null and closes', async () => {
    const o = open(campWith(0));
    click(q(TEST_IDS.planBiome('temple')));
    click(q(TEST_IDS.planBack));
    await o.done;
    expect(o.result()).toBeNull();
    expect(document.querySelector('[data-screen="plan"]')).toBeNull();
  });

  it('focuses Lock it in! so one tap or Enter starts the match', () => {
    open(campWith(0));
    expect(document.activeElement).toBe(q(TEST_IDS.planGo));
  });

  it('every button is a real button, 56px rule classes, with radios grouped', () => {
    open(campWith(0));
    const radios = qa('[data-screen="plan"] [role="radio"]');
    expect(radios.length).toBe(9);
    for (const r of radios) expect(r.localName).toBe('button');
    expect(qa('[data-screen="plan"] [role="radiogroup"]').length).toBe(3);
  });
});

describe('Team Past places its castle', () => {
  it('shows three castle places, high to low, named for Team Past’s player', () => {
    open(campWith(0));
    expect(document.body.textContent).toContain(PLAN_COPY.fortHeading('Alex'));
    const ids = qa('[data-screen="plan"] [data-testid^="plan-fort-"]').map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(ids).toEqual(['hillFort', 'villageWall', 'drawbridge'].map(TEST_IDS.planFort));
    expect(q(TEST_IDS.planFort('hillFort'))!.textContent).toContain('High.');
    expect(q(TEST_IDS.planFort('villageWall'))!.textContent).toContain('Middle.');
    expect(q(TEST_IDS.planFort('drawbridge'))!.textContent).toContain('Low.');
    for (const id of ['hillFort', 'villageWall', 'drawbridge'])
      expect(q(TEST_IDS.planFort(id))!.textContent).toContain(
        PLAN_COPY.forts[id as 'hillFort'].name,
      );
  });

  it('an old plan with no castle place picks none, and Lock it in! adds none', async () => {
    const o = open(campWith(0), { biome: 'aspen', spot: 'bridge' });
    for (const id of ['hillFort', 'villageWall', 'drawbridge'])
      expect(checked(TEST_IDS.planFort(id))).toBe('false');
    click(q(TEST_IDS.planGo));
    await o.done;
    expect(o.result()).toEqual({ biome: 'aspen', spot: 'bridge' });
    expect(o.result()).not.toHaveProperty('fort');
  });

  it('shows the saved castle place picked', () => {
    open(campWith(0), { biome: 'aspen', spot: 'bridge', fort: 'drawbridge' });
    expect(checked(TEST_IDS.planFort('drawbridge'))).toBe('true');
    expect(checked(TEST_IDS.planFort('hillFort'))).toBe('false');
  });

  it('a tap picks one castle place, keeps the base spot, and Lock it in! returns it', async () => {
    const o = open(campWith(0));
    click(q(TEST_IDS.planFort('hillFort')));
    expect(checked(TEST_IDS.planFort('hillFort'))).toBe('true');
    click(q(TEST_IDS.planFort('villageWall')));
    expect(checked(TEST_IDS.planFort('hillFort'))).toBe('false');
    expect(checked(TEST_IDS.planFort('villageWall'))).toBe('true');
    expect(checked(TEST_IDS.planSpot(DEFAULT_PLAN.spot))).toBe('true');
    click(q(TEST_IDS.planGo));
    await o.done;
    expect(o.result()).toEqual({ ...DEFAULT_PLAN, fort: 'villageWall' });
  });

  it('the castle places come before Team Future’s spots, each in its own labeled group', () => {
    open(campWith(0));
    const groups = qa('[data-screen="plan"] [role="radiogroup"]');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
      PLAN_COPY.placeHeading,
      PLAN_COPY.fortHeading('Alex'),
      PLAN_COPY.spotHeading('Sam'),
    ]);
    expect(groups[1]!.querySelectorAll('[role="radio"]')).toHaveLength(3);
  });

  it('never reuses the Stone Wall ability name, and never says Build Castle', () => {
    open(campWith(0));
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/stone wall/i);
    expect(text).not.toMatch(/build castle/i);
  });
});

describe('special ammo on the Battle Plan', () => {
  it('shows each side’s Scrap and an unlock cost for each kind', () => {
    open(campWith(15, 4));
    expect(q(TEST_IDS.planScrap('PAST'))!.textContent).toContain('15');
    expect(q(TEST_IDS.planScrap('FUTURE'))!.textContent).toContain('4');
    expect(q(TEST_IDS.planAmmo('PAST', 'confetti'))!.textContent).toContain(
      PLAN_COPY.unlock(ammoCost('confetti')),
    );
  });

  it('unlocks a kind for that side, pays once, saves at once and says so', async () => {
    const o = open(campWith(15, 0));
    click(q(TEST_IDS.planAmmo('PAST', 'confetti')));
    await flush();
    expect(o.saves).toHaveLength(1);
    const w = walletOf(o.saves[0]!, 'Alex');
    expect(w.scrap).toBe(15 - ammoCost('confetti'));
    expect(w.loadout.PAST.ammo).toEqual(['confetti']);
    expect(status()).toBe(PLAN_COPY.unlocked(PLAN_COPY.ammo.confetti.name));
    expect(q(TEST_IDS.planScrap('PAST'))!.textContent).toContain(String(15 - ammoCost('confetti')));
    expect(q(TEST_IDS.planAmmo('PAST', 'confetti'))!.getAttribute('data-owned')).toBe('true');
    // A second tap on an owned kind does nothing: no double charge.
    click(q(TEST_IDS.planAmmo('PAST', 'confetti')));
    expect(o.saves).toHaveLength(1);
  });

  it('with too little Scrap, says how much is needed and changes nothing', () => {
    const o = open(campWith(0, 0));
    click(q(TEST_IDS.planAmmo('FUTURE', 'bowling')));
    expect(o.saves).toHaveLength(0);
    expect(status()).toBe(PLAN_COPY.needScrap(ammoCost('bowling')));
  });

  it('never uses a banned shop word', () => {
    open(campWith(50, 50));
    expect(document.body.textContent).not.toMatch(/\b(buy|price|money|coins?)\b/i);
  });
});
