// Battle Plan (Phase 2): the last stop between the Camp and the battle. Pick a place (biome), Team
// Past places its castle (fort), Team Future hides its base (spot), and either side may unlock
// special ammo with Scrap. Lock it in! starts the match. The last plan is picked already, so one
// tap is enough. A plan with no castle place yet shows none picked (the Phase 1 castle). Back
// saves no plan.
import { PLAN_COPY, TEAM_NAMES } from '../data/copy';
import { AMMO, type AmmoId } from '../game/ammo';
import type { BattlePlan } from '../game/battlefield';
import { BIOME_IDS, FORT_IDS, SPOT_IDS } from '../game/config';
import { unlockAmmo } from '../game/economy';
import { walletOf, type CampState } from '../game/loadout';
import { TEAMS, type BiomeId, type FortIdValue, type SpotIdValue, type Team } from '../game/types';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { AMMO_ICON } from './hudGear';
import { TEST_IDS, type PlanOptions } from './types';

const BIOME_ICON: Record<BiomeId, string> = {
  aspen: '\u{1F342}',
  cherry: '\u{1F338}',
  temple: '\u{1F3DB}',
};
const SPOT_ICON: Record<SpotIdValue, string> = {
  skyscraper: '\u{1F3D9}',
  foodTruck: '\u{1F32E}',
  bridge: '\u{1F309}',
};
const FORT_ICON: Record<FortIdValue, string> = {
  hillFort: '\u{26F0}\u{FE0F}',
  villageWall: '\u{1F9F1}',
  drawbridge: '\u{1F3F0}',
};
/** Spots in the order a child reads them: high, middle, low. */
const SPOT_ORDER: readonly SpotIdValue[] = ['skyscraper', 'foodTruck', 'bridge'];
const SPECIAL = AMMO.filter((a) => a.id !== 'standard');

export function showPlan(ctx: UiCtx, options: PlanOptions): Promise<BattlePlan | null> {
  const { doc } = ctx;
  return new Promise<BattlePlan | null>((resolve) => {
    let camp: CampState = options.camp;
    const plan: BattlePlan = { ...options.plan };

    const status = h(doc, 'p', {
      class: 'tc-plan-status',
      role: 'status',
      'data-testid': TEST_IDS.planStatus,
    });
    const say = (text: string): void => {
      status.textContent = '';
      status.textContent = text;
    };

    /** One radio card: an icon, a name and a short line or two. */
    const card = (testId: string, icon: string, lines: string[], onPick: () => void) => {
      const b = h(
        doc,
        'button',
        { type: 'button', role: 'radio', class: 'tc-chip tc-plan-card', 'data-testid': testId },
        h(doc, 'span', { class: 'tc-plan-icon', 'aria-hidden': 'true', text: icon }),
        h(
          doc,
          'span',
          { class: 'tc-plan-words' },
          ...lines.map((t, i) =>
            h(doc, 'span', { class: i === 0 ? 'tc-plan-name' : 'tc-plan-note', text: t }),
          ),
        ),
      );
      b.addEventListener('click', onPick);
      return b;
    };

    const biomeCards = BIOME_IDS.map((id) =>
      card(
        TEST_IDS.planBiome(id),
        BIOME_ICON[id],
        [PLAN_COPY.biomes[id].name, PLAN_COPY.biomes[id].note],
        () => {
          plan.biome = id;
          paint();
        },
      ),
    );
    const spotCards = SPOT_ORDER.filter((id) => (SPOT_IDS as readonly string[]).includes(id)).map(
      (id) =>
        card(
          TEST_IDS.planSpot(id),
          SPOT_ICON[id],
          [PLAN_COPY.spots[id].name, `${PLAN_COPY.spots[id].height}. ${PLAN_COPY.spots[id].note}`],
          () => {
            plan.spot = id;
            paint();
          },
        ),
    );

    const fortCards = FORT_IDS.map((id) =>
      card(
        TEST_IDS.planFort(id),
        FORT_ICON[id],
        [PLAN_COPY.forts[id].name, `${PLAN_COPY.forts[id].height}. ${PLAN_COPY.forts[id].note}`],
        () => {
          plan.fort = id;
          paint();
        },
      ),
    );

    const scrapOut = {} as Record<Team, HTMLElement>;
    const ammoButtons = {} as Record<Team, Array<{ id: AmmoId; el: HTMLButtonElement }>>;
    const teamBoxes = TEAMS.map((team) => {
      scrapOut[team] = h(doc, 'p', {
        class: 'tc-plan-scrap',
        'data-testid': TEST_IDS.planScrap(team),
      });
      ammoButtons[team] = SPECIAL.map((a) => {
        const el = h(doc, 'button', {
          type: 'button',
          class: 'tc-btn tc-btn-neutral tc-plan-ammo',
          'data-testid': TEST_IDS.planAmmo(team, a.id),
        });
        el.addEventListener('click', () => unlock(team, a.id));
        return { id: a.id, el };
      });
      return h(
        doc,
        'div',
        { class: 'tc-plan-team', 'data-team': team },
        h(doc, 'h3', {
          class: 'tc-plan-team-name',
          text: `${TEAM_NAMES[team]}: ${options.names[team]}`,
        }),
        scrapOut[team],
        h(doc, 'div', { class: 'tc-plan-ammo-list' }, ...ammoButtons[team].map((b) => b.el)),
      );
    });

    const unlock = (team: Team, id: AmmoId): void => {
      const owned = walletOf(camp, options.names[team]).loadout[team].ammo ?? [];
      if (owned.includes(id)) return;
      const out = unlockAmmo(camp, options.names[team], team, id);
      if (!out.ok) {
        if (out.reason === 'not_enough_scrap')
          say(PLAN_COPY.needScrap(AMMO.find((a) => a.id === id)!.cost));
        return;
      }
      camp = out.camp;
      options.save(camp);
      ctx.sfx('clunk');
      say(PLAN_COPY.unlocked(PLAN_COPY.ammo[id as Exclude<AmmoId, 'standard'>].name));
      paint();
    };

    const paint = (): void => {
      BIOME_IDS.forEach((id, i) =>
        biomeCards[i]!.setAttribute('aria-checked', String(plan.biome === id)),
      );
      FORT_IDS.forEach((id, i) =>
        fortCards[i]!.setAttribute('aria-checked', String(plan.fort === id)),
      );
      spotCards.forEach((el, i) =>
        el.setAttribute('aria-checked', String(plan.spot === SPOT_ORDER[i])),
      );
      for (const team of TEAMS) {
        const wallet = walletOf(camp, options.names[team]);
        scrapOut[team].textContent = `${PLAN_COPY.scrap}: ${wallet.scrap}`;
        const owned = wallet.loadout[team].ammo ?? [];
        for (const { id, el } of ammoButtons[team]) {
          const a = AMMO.find((x) => x.id === id)!;
          const has = owned.includes(id);
          const words = PLAN_COPY.ammo[id as Exclude<AmmoId, 'standard'>];
          el.setAttribute('data-owned', String(has));
          el.replaceChildren(
            h(doc, 'span', { class: 'tc-plan-icon', 'aria-hidden': 'true', text: AMMO_ICON[id] }),
            h(
              doc,
              'span',
              { class: 'tc-plan-words' },
              h(doc, 'span', { class: 'tc-plan-name', text: words.name }),
              h(doc, 'span', {
                class: 'tc-plan-note',
                text: has ? PLAN_COPY.owned(a.uses) : PLAN_COPY.unlock(a.cost),
              }),
            ),
          );
          el.title = words.note;
          el.setAttribute(
            'aria-label',
            PLAN_COPY.ammoLabel(words.name, words.note, has, a.cost, a.uses),
          );
        }
      }
    };

    const back = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-plan-back',
      'data-testid': TEST_IDS.planBack,
      text: `← ${PLAN_COPY.back}`,
    });
    const go = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary tc-btn-big tc-plan-go',
      'data-testid': TEST_IDS.planGo,
      text: PLAN_COPY.go,
    });

    const group = (heading: string, cards: HTMLElement[], team?: Team) =>
      h(
        doc,
        'section',
        { class: 'tc-plan-group', ...(team ? { 'data-team': team } : {}) },
        h(doc, 'h2', { class: 'tc-plan-heading', text: heading }),
        h(
          doc,
          'div',
          { class: 'tc-plan-cards', role: 'radiogroup', 'aria-label': heading },
          ...cards,
        ),
      );

    const screen = h(
      doc,
      'section',
      { class: 'tc-screen tc-plan', 'data-screen': 'plan', 'data-motion': ctx.motion() },
      h(
        doc,
        'header',
        { class: 'tc-plan-head' },
        back,
        h(doc, 'h1', { class: 'tc-plan-title', text: PLAN_COPY.title }),
      ),
      group(PLAN_COPY.placeHeading, biomeCards),
      group(PLAN_COPY.fortHeading(options.names.PAST), fortCards, 'PAST'),
      group(PLAN_COPY.spotHeading(options.names.FUTURE), spotCards, 'FUTURE'),
      h(
        doc,
        'section',
        { class: 'tc-plan-group tc-plan-ammo-group' },
        h(doc, 'h2', { class: 'tc-plan-heading', text: PLAN_COPY.ammoHeading }),
        h(doc, 'p', { class: 'tc-plan-hint', text: PLAN_COPY.ammoNote }),
        h(doc, 'div', { class: 'tc-plan-teams' }, ...teamBoxes),
      ),
      status,
      h(doc, 'div', { class: 'tc-plan-foot' }, go),
    );
    paint();
    const close = ctx.openScreen(screen);
    back.addEventListener('click', () => {
      close();
      resolve(null);
    });
    go.addEventListener('click', () => {
      close();
      resolve({ ...plan });
    });
    go.focus();
  });
}
