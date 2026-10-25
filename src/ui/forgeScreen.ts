// Forge Weapon: pick which weapon to use, unlock a new one, or forge the one in use to a higher
// level. Scrap is the only currency. Every change is saved at once through `save`, and a tap that
// cannot work (too little Scrap, already at the top) says so in words and changes nothing.
// "Make my own weapon" opens the Weapon Workshop (workshopScreen.ts). Weapons you made sit in the
// "My weapons" section, which swaps in for the list, so the screen never scrolls.
import { FORGE_COPY, TEAM_NAMES, WORKSHOP_COPY } from '../data/copy';
import { WORKSHOP } from '../game/config';
import { customAsWeapon, isCustomWeaponId } from '../game/customWeapons';
import { buyWeapon, equipWeapon, forgeWeapon, type Outcome } from '../game/economy';
import { TEAMS, type Team } from '../game/types';
import {
  FORGE,
  forgeCost,
  weaponStats,
  weaponsOf,
  type ForgeWeapon,
  type Weapon,
} from '../game/weapons';
import { walletOf, type CampState } from '../game/loadout';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { hudIcon } from './hudIcons';
import { customWeaponIcon, forgeScene, weaponIcon } from './forgeArt';
import { TEST_IDS, type ForgeOptions } from './types';
import { showWorkshop } from './workshopScreen';

export function showForge(ctx: UiCtx, options: ForgeOptions): Promise<void> {
  const { doc } = ctx;
  return new Promise<void>((resolve) => {
    let camp: CampState = options.camp;
    let team: Team = 'PAST';
    /** The player on the chosen side. Their Scrap and purchases are the ones shown. */
    const wallet = () => walletOf(camp, options.names[team]);
    const mine = () => (wallet().loadout[team].custom ?? []).map(customAsWeapon);
    /** 'all' is the catalog list. 'mine' is "My weapons". It starts on the one in use. */
    const startView = (): 'all' | 'mine' =>
      isCustomWeaponId(wallet().loadout[team].weapon) && mine().length > 0 ? 'mine' : 'all';
    let view = startView();

    const status = h(doc, 'p', {
      class: 'tc-forge-status',
      role: 'status',
      'data-testid': TEST_IDS.forgeStatus,
    });
    const say = (text: string): void => {
      // Cleared first, so the same words are read out again on a repeat tap.
      status.textContent = '';
      status.textContent = text;
    };

    const ownerName = h(doc, 'span', { class: 'tc-forge-owner' });
    const scrapValue = h(doc, 'span', { class: 'tc-forge-scrap-n' });
    const scrapBox = h(
      doc,
      'p',
      { class: 'tc-forge-scrap', 'data-testid': TEST_IDS.forgeScrap },
      ownerName,
      hudIcon(doc, 'scrap'),
      h(doc, 'span', { text: `${FORGE_COPY.scrap}: ` }),
      scrapValue,
    );
    const list = h(doc, 'section', { class: 'tc-forge-list', 'aria-label': FORGE_COPY.title });
    const back = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-forge-back',
      'data-testid': TEST_IDS.forgeBack,
      text: `← ${FORGE_COPY.back}`,
    });
    const teamChips = TEAMS.map((t) => {
      const chip = h(doc, 'button', {
        type: 'button',
        role: 'radio',
        class: 'tc-chip tc-forge-team',
        'data-team': t,
        'data-testid': TEST_IDS.forgeTeam(t),
        text: TEAM_NAMES[t],
      });
      chip.addEventListener('click', () => {
        team = t;
        view = startView();
        status.textContent = '';
        render();
      });
      return chip;
    });
    const picker = h(
      doc,
      'div',
      { class: 'tc-forge-picker', role: 'radiogroup', 'aria-label': FORGE_COPY.pickTeam },
      ...teamChips,
    );
    const mineToggle = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-forge-minebtn',
      'data-testid': TEST_IDS.forgeMine,
    });
    const make = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-primary tc-forge-make',
      'data-testid': TEST_IDS.forgeMake,
      text: `★ ${FORGE_COPY.makeOwn}`,
    });
    const foot = h(doc, 'div', { class: 'tc-forge-foot' });
    let art: SVGElement = forgeScene(doc, team);
    const screen = h(
      doc,
      'section',
      { class: 'tc-screen tc-forge', 'data-screen': 'forge', 'data-motion': ctx.motion() },
      art,
      h(
        doc,
        'header',
        { class: 'tc-forge-head' },
        back,
        h(doc, 'h1', { class: 'tc-forge-title', text: FORGE_COPY.title }),
        scrapBox,
      ),
      picker,
      list,
      foot,
      status,
    );

    /** Saves when a change worked, and says why when it did not. `cost` is what it needed. */
    const apply = (outcome: Outcome, ok: string, cost: number): void => {
      if (outcome.ok) {
        camp = outcome.camp;
        options.save(camp);
        say(ok);
      } else if (outcome.reason === 'not_enough_scrap') {
        say(FORGE_COPY.needMore(Math.max(1, cost - wallet().scrap)));
      } else if (outcome.reason === 'max_level') {
        say(FORGE_COPY.atTop);
      }
      render();
    };

    /** The Level up button that sits inside the row of the weapon in use (or under My weapons). */
    const levelUpButton = (w: Pick<ForgeWeapon, 'id' | 'name'>, level: number): HTMLElement => {
      const cost = forgeCost(level);
      const text = cost === null ? FORGE_COPY.levelUpMax : FORGE_COPY.levelUp(cost);
      const button = h(doc, 'button', {
        type: 'button',
        class: 'tc-btn tc-btn-primary tc-forge-levelup',
        'aria-label': FORGE_COPY.levelUpLabel(w.name, text),
        'aria-disabled': String(cost === null || wallet().scrap < cost),
        'data-level': `${level}/${FORGE.maxLevel}`,
        'data-weapon': w.id,
        'data-testid': TEST_IDS.forgeUpgrade,
        text,
      });
      button.addEventListener('click', () => {
        apply(
          forgeWeapon(camp, options.names[team], team),
          FORGE_COPY.forged(w.name, level + 1),
          cost ?? 0,
        );
      });
      return button;
    };

    const row = (w: Weapon): HTMLElement => {
      const loadout = wallet().loadout[team];
      const level = loadout.owned[w.id] ?? 0;
      const state = loadout.weapon === w.id ? 'equipped' : level > 0 ? 'owned' : 'locked';
      const stats = weaponStats(w, Math.max(1, level));
      const badge =
        state === 'equipped'
          ? FORGE_COPY.equipped
          : state === 'locked'
            ? FORGE_COPY.unlockCost(w.cost)
            : '';
      const affordable = state !== 'locked' || wallet().scrap >= w.cost;
      const pick = h(
        doc,
        'button',
        {
          type: 'button',
          class: 'tc-forge-pick',
          'data-state': state,
          'aria-pressed': String(state === 'equipped'),
          'aria-disabled': String(!affordable),
          'data-testid': TEST_IDS.forgeWeapon(w.id),
        },
        weaponIcon(doc, w.id),
        h(
          doc,
          'span',
          { class: 'tc-forge-info' },
          h(
            doc,
            'span',
            { class: 'tc-forge-namerow' },
            h(doc, 'span', { class: 'tc-forge-name', text: w.name }),
            state === 'equipped' ? h(doc, 'span', { class: 'tc-forge-badge', text: badge }) : null,
          ),
          h(doc, 'span', {
            class: 'tc-forge-stats',
            text: [
              `${FORGE_COPY.damage} ${stats.direct}`,
              `${FORGE_COPY.range} ${FORGE_COPY.rangeNames[w.range]}`,
              `${FORGE_COPY.level} ${Math.max(1, level)}`,
            ].join(' · '),
          }),
          level > 0
            ? h(doc, 'span', {
                class: 'tc-forge-owned',
                text: FORGE_COPY.ownedBy(options.names[team]),
              })
            : null,
        ),
        badge && state !== 'equipped'
          ? h(doc, 'span', { class: 'tc-forge-badge', text: badge })
          : null,
      );
      pick.addEventListener('click', () => {
        if (state === 'locked') {
          apply(
            buyWeapon(camp, options.names[team], team, w.id),
            FORGE_COPY.unlocked(w.name),
            w.cost,
          );
        } else if (state === 'owned') {
          apply(
            equipWeapon(camp, options.names[team], team, w.id),
            FORGE_COPY.equippedNow(w.name),
            0,
          );
        } else {
          say(FORGE_COPY.equippedNow(w.name));
        }
      });
      return h(
        doc,
        'div',
        {
          class: 'tc-forge-row tc-forge-item',
          'data-team': team,
          'data-state': state,
          'data-poor': String(!affordable),
        },
        pick,
        state === 'equipped' ? levelUpButton(w, Math.max(1, level)) : null,
      );
    };

    /** One of your own weapons, as a card in the My weapons grid. */
    const card = (w: ForgeWeapon): HTMLElement => {
      const loadout = wallet().loadout[team];
      const level = loadout.owned[w.id] ?? 1;
      const state = loadout.weapon === w.id ? 'equipped' : 'owned';
      const stats = weaponStats(w, level);
      const pick = h(
        doc,
        'button',
        {
          type: 'button',
          class: 'tc-forge-pick',
          'data-state': state,
          'aria-pressed': String(state === 'equipped'),
          'aria-label': [
            w.name,
            FORGE_COPY.mine,
            state === 'equipped' ? FORGE_COPY.equipped : null,
            `${FORGE_COPY.damage} ${stats.direct}`,
            `${FORGE_COPY.range} ${FORGE_COPY.rangeNames[w.range]}`,
            `${FORGE_COPY.level} ${level}`,
          ]
            .filter(Boolean)
            .join(', '),
          'data-testid': TEST_IDS.forgeWeapon(w.id),
        },
        customWeaponIcon(doc, w.base, team),
        h(
          doc,
          'span',
          { class: 'tc-forge-info' },
          h(
            doc,
            'span',
            { class: 'tc-forge-namerow' },
            h(doc, 'span', { class: 'tc-forge-name', text: w.name }),
            state === 'equipped'
              ? h(doc, 'span', { class: 'tc-forge-badge', text: FORGE_COPY.equipped })
              : null,
          ),
          h(doc, 'span', {
            class: 'tc-forge-stats',
            // Damage and level only, so a card stays one line and six fit (range is in the
            // Workshop and in the name for a screen reader).
            text: [`${FORGE_COPY.damage} ${stats.direct}`, `${FORGE_COPY.level} ${level}`].join(
              ' · ',
            ),
          }),
        ),
      );
      pick.addEventListener('click', () => {
        if (state === 'owned') {
          apply(
            equipWeapon(camp, options.names[team], team, w.id),
            FORGE_COPY.equippedNow(w.name),
            0,
          );
        } else {
          say(FORGE_COPY.equippedNow(w.name));
        }
      });
      return h(
        doc,
        'div',
        {
          class: 'tc-forge-row tc-forge-item tc-forge-card',
          'data-team': team,
          'data-state': state,
          'data-mine': 'true',
        },
        pick,
      );
    };

    function renderFoot(): void {
      const own = mine();
      const kids: HTMLElement[] = [];
      if (own.length > 0) {
        mineToggle.textContent =
          view === 'mine' ? `← ${FORGE_COPY.allWeapons}` : `★ ${FORGE_COPY.myWeapons(own.length)}`;
        mineToggle.setAttribute('aria-pressed', String(view === 'mine'));
        kids.push(mineToggle);
      }
      make.setAttribute('aria-disabled', String(own.length >= WORKSHOP.maxPerTeam));
      kids.push(make);
      const loadout = wallet().loadout[team];
      const using = own.find((w) => w.id === loadout.weapon);
      if (view === 'mine' && using) kids.push(levelUpButton(using, loadout.owned[using.id] ?? 1));
      foot.replaceChildren(...kids);
    }

    mineToggle.addEventListener('click', () => {
      view = view === 'mine' ? 'all' : 'mine';
      status.textContent = '';
      render();
      mineToggle.focus();
    });

    make.addEventListener('click', () => {
      if (mine().length >= WORKSHOP.maxPerTeam) {
        say(FORGE_COPY.full(WORKSHOP.maxPerTeam));
        return;
      }
      screen.setAttribute('inert', '');
      void showWorkshop(ctx, { camp, names: options.names, team, save: options.save }).then(
        (result) => {
          screen.removeAttribute('inert');
          camp = result.camp;
          if (result.made) {
            view = 'mine';
            render();
            say(WORKSHOP_COPY.forged(result.made));
            const id = wallet().loadout[team].weapon;
            list.querySelector<HTMLElement>(`[data-testid="${TEST_IDS.forgeWeapon(id)}"]`)?.focus();
          } else {
            render();
            make.focus();
          }
        },
      );
    });

    function render(): void {
      screen.setAttribute('data-team', team);
      const next = forgeScene(doc, team);
      art.replaceWith(next);
      art = next;
      ownerName.textContent = options.names[team];
      scrapValue.textContent = String(wallet().scrap);
      for (const chip of teamChips) {
        const on = chip.getAttribute('data-team') === team;
        chip.setAttribute('aria-checked', String(on));
        chip.tabIndex = on ? 0 : -1;
      }
      if (view === 'mine' && mine().length === 0) view = 'all';
      screen.setAttribute('data-view', view);
      list.setAttribute('data-view', view);
      list.replaceChildren(...(view === 'mine' ? mine().map(card) : weaponsOf(team).map(row)));
      renderFoot();
    }

    const close = ctx.openScreen(screen);
    back.addEventListener('click', () => {
      close();
      resolve();
    });
    render();
    back.focus();
  });
}
