// Forge Weapon: pick which weapon to use, unlock a new one, or forge the one in use to a higher
// level. Scrap is the only currency. Every change is saved at once through `save`, and a tap that
// cannot work (too little Scrap, already at the top) says so in words and changes nothing.
import { FORGE_COPY, TEAM_NAMES } from '../data/copy';
import { buyWeapon, equipWeapon, forgeWeapon, type Outcome } from '../game/economy';
import { TEAMS, type Team } from '../game/types';
import { FORGE, forgeCost, weaponStats, weaponsOf, type Weapon } from '../game/weapons';
import { walletOf, type CampState } from '../game/loadout';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { hudIcon } from './hudIcons';
import { forgeScene, weaponIcon } from './forgeArt';
import { TEST_IDS, type ForgeOptions } from './types';

export function showForge(ctx: UiCtx, options: ForgeOptions): Promise<void> {
  const { doc } = ctx;
  return new Promise<void>((resolve) => {
    let camp: CampState = options.camp;
    let team: Team = 'PAST';
    /** The player on the chosen side. Their Scrap and purchases are the ones shown. */
    const wallet = () => walletOf(camp, options.names[team]);

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

    /** The Level up button that sits inside the row of the weapon in use. */
    const levelUpButton = (w: Weapon, level: number): HTMLElement => {
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
      list.replaceChildren(...weaponsOf(team).map(row));
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
