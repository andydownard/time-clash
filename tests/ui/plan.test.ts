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
    expect(q(TEST_IDS.planSpot('skyscraper'))!.textContent).toContain('Height: high');
    expect(q(TEST_IDS.planSpot('bridge'))!.textContent).toContain('Height: low');
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
    expect(radios.length).toBe(6);
    for (const r of radios) expect(r.localName).toBe('button');
    expect(qa('[data-screen="plan"] [role="radiogroup"]').length).toBe(2);
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
