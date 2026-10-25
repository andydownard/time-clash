// The Weapon Workshop: make your own Forge weapon. Pick a style, spend points on Power, Reach and
// Splash with plus and minus, pick a silly name (or type one), and forge it with Scrap. Rules live
// in src/game/customWeapons.ts; this file only draws and asks them. A typed name that is not okay
// is never used: the screen says why, kindly, and keeps the picked words.
import { FORGE_COPY, WORKSHOP_COPY as C } from '../data/copy';
import { WORKSHOP } from '../game/config';
import {
  customAsWeapon,
  customCost,
  pointsLeft,
  presetFor,
  STAT_IDS,
  tidyName,
  typedNameProblem,
  type Points,
  type StatId,
} from '../game/customWeapons';
import { forgeCustomWeapon } from '../game/economy';
import { walletOf, type CampState } from '../game/loadout';
import type { Team } from '../game/types';
import { STARTER, weaponsOf, type WeaponId } from '../game/weapons';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { customWeaponIcon, forgeScene, weaponIcon } from './forgeArt';
import { hudIcon } from './hudIcons';
import { isBlockedName } from './nameBlocklist';
import { TEST_IDS } from './types';

export type WorkshopOptions = {
  camp: CampState;
  names: Record<Team, string>;
  team: Team;
  save: (camp: CampState) => void;
};

/** The camp after the Workshop closes, and the name of the weapon made (null after Back). */
export type WorkshopResult = { camp: CampState; made: string | null };

export function showWorkshop(ctx: UiCtx, options: WorkshopOptions): Promise<WorkshopResult> {
  const { doc } = ctx;
  const { team, names } = options;
  const owner = names[team];
  const camp = options.camp;
  const wallet = () => walletOf(camp, owner);
  const madeSoFar = (wallet().loadout[team].custom ?? []).length;

  let base: WeaponId = STARTER[team];
  let points: Points = presetFor(base);
  // A different pair of words for each new weapon, without any randomness.
  let adj = madeSoFar % C.adjectives.length;
  let noun = (madeSoFar * 5 + 3) % C.nouns.length;
  let typed = '';

  return new Promise<WorkshopResult>((resolve) => {
    const status = h(doc, 'p', {
      class: 'tc-forge-status tc-ws-status',
      role: 'status',
      'data-testid': TEST_IDS.workshopStatus,
    });
    const say = (text: string): void => {
      status.textContent = '';
      status.textContent = text;
    };

    const back = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-forge-back',
      'data-testid': TEST_IDS.workshopBack,
      text: `← ${C.back}`,
    });
    const scrapBox = h(
      doc,
      'p',
      { class: 'tc-forge-scrap', 'data-testid': TEST_IDS.workshopScrap },
      h(doc, 'span', { class: 'tc-forge-owner', text: owner }),
      hudIcon(doc, 'scrap'),
      h(doc, 'span', { text: `${FORGE_COPY.scrap}: ` }),
      h(doc, 'span', { class: 'tc-forge-scrap-n', text: String(wallet().scrap) }),
    );

    // ---------- Style ----------
    const styleButtons = weaponsOf(team).map((w) => {
      const b = h(
        doc,
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'tc-ws-style',
          'data-base': w.id,
          'data-testid': TEST_IDS.workshopStyle(w.id),
        },
        weaponIcon(doc, w.id),
        h(doc, 'span', { class: 'tc-ws-style-name', text: C.styles[w.id] ?? w.name }),
      );
      b.addEventListener('click', () => pickStyle(w.id));
      b.addEventListener('keydown', (e) => {
        const step =
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? -1
              : 0;
        if (!step) return;
        e.preventDefault();
        const list = weaponsOf(team);
        const at = list.findIndex((x) => x.id === base);
        const next = list[(at + step + list.length) % list.length]!;
        pickStyle(next.id);
        styleButtons.find((x) => x.getAttribute('data-base') === next.id)?.focus();
      });
      return b;
    });

    function pickStyle(id: WeaponId): void {
      if (id !== base) {
        base = id;
        points = presetFor(id);
        status.textContent = '';
      }
      render();
    }

    // ---------- Points ----------
    const pointsText = h(doc, 'p', {
      class: 'tc-ws-points',
      'data-testid': TEST_IDS.workshopPoints,
    });
    const statRows = STAT_IDS.map((stat) => {
      const words = C.stats[stat];
      const less = h(doc, 'button', {
        type: 'button',
        class: 'tc-ws-step',
        'aria-label': C.less(words.name),
        'data-testid': TEST_IDS.workshopLess(stat),
        text: '−',
      });
      const more = h(doc, 'button', {
        type: 'button',
        class: 'tc-ws-step',
        'aria-label': C.more(words.name),
        'data-testid': TEST_IDS.workshopMore(stat),
        text: '+',
      });
      const value = h(doc, 'span', {
        class: 'tc-ws-value',
        'data-testid': TEST_IDS.workshopStat(stat),
      });
      const effect = h(doc, 'span', { class: 'tc-ws-effect' });
      less.addEventListener('click', () => step(stat, -1));
      more.addEventListener('click', () => step(stat, 1));
      const row = h(
        doc,
        'div',
        { class: 'tc-ws-stat', 'data-stat': stat },
        h(
          doc,
          'span',
          { class: 'tc-ws-label' },
          h(doc, 'span', { class: 'tc-ws-stat-name', text: words.name }),
          h(doc, 'span', { class: 'tc-ws-help', text: words.help }),
        ),
        less,
        value,
        more,
        effect,
      );
      return { stat, row, less, more, value, effect };
    });

    function step(stat: StatId, by: 1 | -1): void {
      const name = C.stats[stat].name;
      const next = points[stat] + by;
      if (by > 0 && next > WORKSHOP.maxPoints) say(C.atMost(name));
      else if (by > 0 && pointsLeft(points) <= 0) say(C.noPoints);
      else if (by < 0 && next < WORKSHOP.minPoints) say(C.atLeast(name));
      else {
        points = { ...points, [stat]: next };
        status.textContent = '';
      }
      render();
    }

    // ---------- Name ----------
    const select = (words: readonly string[], label: string, testid: string, at: number) => {
      const el = h(
        doc,
        'select',
        { class: 'tc-ws-select', 'aria-label': label, 'data-testid': testid },
        ...words.map((w, i) => h(doc, 'option', { value: String(i), text: w })),
      ) as HTMLSelectElement;
      el.value = String(at);
      return el;
    };
    const word1 = select(C.adjectives, C.firstWord, TEST_IDS.workshopWord1, adj);
    const word2 = select(C.nouns, C.secondWord, TEST_IDS.workshopWord2, noun);
    word1.addEventListener('change', () => {
      adj = Number(word1.value) || 0;
      render();
    });
    word2.addEventListener('change', () => {
      noun = Number(word2.value) || 0;
      render();
    });
    const typedInput = h(doc, 'input', {
      type: 'text',
      class: 'tc-input tc-ws-typed',
      'aria-label': C.typeName,
      placeholder: C.typeName,
      maxlength: String(WORKSHOP.typedNameMax),
      autocomplete: 'off',
      autocapitalize: 'words',
      spellcheck: 'false',
      'data-testid': TEST_IDS.workshopTyped,
    }) as HTMLInputElement;
    typedInput.addEventListener('input', () => {
      typed = typedInput.value;
      render();
      sayNameProblem();
    });

    const pickedName = (): string => `${C.adjectives[adj] ?? ''} ${C.nouns[noun] ?? ''}`.trim();
    /** Why the typed name is not used, or null when it is fine (or nothing is typed). */
    const typedProblem = (): string | null => {
      if (tidyName(typed) === '') return null;
      const problem =
        typedNameProblem(typed, [names.PAST, names.FUTURE]) ??
        (isBlockedName(typed) ? 'blocked' : null);
      return problem ? C.nameProblem[problem] : null;
    };
    const finalName = (): string =>
      tidyName(typed) && !typedProblem() ? tidyName(typed) : pickedName();
    function sayNameProblem(): void {
      const problem = typedProblem();
      if (problem) say(`${problem} ${C.keepPicked(pickedName())}`);
      else status.textContent = '';
    }

    // ---------- Preview and Forge ----------
    const preview = h(doc, 'div', {
      class: 'tc-ws-preview tc-forge-row',
      'data-team': team,
      'data-testid': TEST_IDS.workshopPreview,
    });
    const forgeBtn = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary tc-ws-forge',
      'data-testid': TEST_IDS.workshopForge,
    });

    const screen = h(
      doc,
      'section',
      {
        class: 'tc-screen tc-forge tc-workshop',
        'data-screen': 'workshop',
        'data-team': team,
        'data-motion': ctx.motion(),
      },
      forgeScene(doc, team),
      h(
        doc,
        'header',
        { class: 'tc-forge-head' },
        back,
        h(doc, 'h1', { class: 'tc-forge-title', text: C.title }),
        scrapBox,
      ),
      h(
        doc,
        'div',
        { class: 'tc-ws-body' },
        h(
          doc,
          'section',
          { class: 'tc-ws-panel', 'aria-label': C.pickStyle },
          h(doc, 'h2', { class: 'tc-ws-head', text: C.pickStyle }),
          h(
            doc,
            'div',
            { class: 'tc-ws-styles', role: 'radiogroup', 'aria-label': C.pickStyle },
            ...styleButtons,
          ),
          pointsText,
          ...statRows.map((r) => r.row),
        ),
        h(
          doc,
          'section',
          { class: 'tc-ws-panel', 'aria-label': C.nameIt },
          h(doc, 'h2', { class: 'tc-ws-head', text: C.nameIt }),
          h(doc, 'div', { class: 'tc-ws-words' }, word1, word2),
          typedInput,
          preview,
          forgeBtn,
          status,
        ),
      ),
    );

    function render(): void {
      for (const b of styleButtons) {
        const on = b.getAttribute('data-base') === base;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      }
      const left = pointsLeft(points);
      pointsText.textContent = C.pointsLeft(left);
      const stats = customAsWeapon({ id: 'custom:P:1', base, name: 'x', ...points });
      for (const r of statRows) {
        const n = points[r.stat];
        const name = C.stats[r.stat].name;
        r.value.textContent = String(n);
        r.value.setAttribute('aria-label', C.statLabel(name, n, WORKSHOP.maxPoints));
        r.less.setAttribute('aria-disabled', String(n <= WORKSHOP.minPoints));
        r.more.setAttribute('aria-disabled', String(n >= WORKSHOP.maxPoints || left <= 0));
        r.effect.textContent =
          r.stat === 'power'
            ? C.power(stats.direct)
            : r.stat === 'reach'
              ? C.reach(FORGE_COPY.rangeNames[stats.range])
              : C.splash(stats.near);
      }
      const cost = customCost(points);
      const name = finalName();
      preview.replaceChildren(
        customWeaponIcon(doc, base, team),
        h(
          doc,
          'span',
          { class: 'tc-forge-info' },
          h(doc, 'span', { class: 'tc-forge-name', text: name }),
          h(doc, 'span', {
            class: 'tc-forge-stats',
            text: [
              `${FORGE_COPY.damage} ${stats.direct}`,
              `${FORGE_COPY.range} ${FORGE_COPY.rangeNames[stats.range]}`,
            ].join(' · '),
          }),
        ),
      );
      forgeBtn.textContent = C.forge(cost);
      forgeBtn.setAttribute('aria-disabled', String(wallet().scrap < cost));
    }

    const close = ctx.openScreen(screen);
    const finish = (result: WorkshopResult): void => {
      close();
      resolve(result);
    };
    back.addEventListener('click', () => finish({ camp, made: null }));
    forgeBtn.addEventListener('click', () => {
      const name = finalName();
      const cost = customCost(points);
      const out = forgeCustomWeapon(camp, owner, team, { base, ...points }, name);
      if (out.ok) {
        options.save(out.camp);
        finish({ camp: out.camp, made: name });
      } else if (out.reason === 'not_enough_scrap') {
        say(C.needMore(Math.max(1, cost - wallet().scrap)));
      } else if (out.reason === 'too_many') {
        say(FORGE_COPY.full(WORKSHOP.maxPerTeam));
      } else if (out.reason === 'bad_name') {
        say(C.nameProblem.private);
      }
    });
    render();
    styleButtons.find((b) => b.getAttribute('data-base') === base)?.focus();
  });
}
