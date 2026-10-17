// Upgrade Base: spend Scrap on stronger walls, more health, a force field, missiles or a repair
// squad. Each choice has three levels. Scrap is the only currency. Every change is saved at once
// through `save`, and a tap that cannot work says why in words and changes nothing.
import { TEAM_NAMES, UPGRADE_COPY, upgradeEffect } from '../data/copy';
import { buyUpgrade } from '../game/economy';
import { walletOf, type CampState } from '../game/loadout';
import { TEAMS, type Team } from '../game/types';
import { UPGRADE_MAX_LEVEL, upgradeCost, upgradesOf, type Upgrade } from '../game/upgrades';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { upgradeIcon, upgradeScene } from './upgradeArt';
import { TEST_IDS, type ForgeOptions } from './types';

export function showUpgrade(ctx: UiCtx, options: ForgeOptions): Promise<void> {
  const { doc } = ctx;
  return new Promise<void>((resolve) => {
    let camp: CampState = options.camp;
    let team: Team = 'PAST';
    /** The player on the chosen side. Their Scrap and purchases are the ones shown. */
    const wallet = () => walletOf(camp, options.names[team]);

    const status = h(doc, 'p', {
      class: 'tc-forge-status',
      role: 'status',
      'data-testid': TEST_IDS.upgradeStatus,
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
      { class: 'tc-forge-scrap', 'data-testid': TEST_IDS.upgradeScrap },
      ownerName,
      h(doc, 'span', { text: `${UPGRADE_COPY.scrap}: ` }),
      scrapValue,
    );
    const list = h(doc, 'section', { class: 'tc-forge-list', 'aria-label': UPGRADE_COPY.title });
    const back = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-forge-back',
      'data-testid': TEST_IDS.upgradeBack,
      text: `← ${UPGRADE_COPY.back}`,
    });
    const teamChips = TEAMS.map((t) => {
      const chip = h(doc, 'button', {
        type: 'button',
        role: 'radio',
        class: 'tc-chip tc-forge-team',
        'data-team': t,
        'data-testid': TEST_IDS.upgradeTeam(t),
        text: TEAM_NAMES[t],
      });
      chip.addEventListener('click', () => {
        team = t;
        status.textContent = '';
        render();
      });
      return chip;
    });
    let art: SVGElement = upgradeScene(doc, team);
    const screen = h(
      doc,
      'section',
      {
        class: 'tc-screen tc-forge tc-upgrade',
        'data-screen': 'upgrade',
        'data-motion': ctx.motion(),
      },
      art,
      h(
        doc,
        'header',
        { class: 'tc-forge-head' },
        back,
        h(doc, 'h1', { class: 'tc-forge-title', text: UPGRADE_COPY.title }),
        scrapBox,
      ),
      h(
        doc,
        'div',
        { class: 'tc-forge-picker', role: 'radiogroup', 'aria-label': UPGRADE_COPY.pickTeam },
        ...teamChips,
      ),
      list,
      status,
    );

    const row = (u: Upgrade): HTMLElement => {
      const level = wallet().loadout[team].upgrades[u.id] ?? 0;
      const cost = upgradeCost(u, level);
      const state = level >= UPGRADE_MAX_LEVEL ? 'max' : level > 0 ? 'owned' : 'locked';
      const affordable = cost === null || wallet().scrap >= cost;
      const button = h(
        doc,
        'button',
        {
          type: 'button',
          class: 'tc-forge-row',
          'data-team': team,
          'data-state': state,
          'aria-disabled': String(cost === null || !affordable),
          'data-testid': TEST_IDS.upgradeRow(u.id),
        },
        upgradeIcon(doc, u.id),
        h(
          doc,
          'span',
          { class: 'tc-forge-info' },
          h(doc, 'span', { class: 'tc-forge-name', text: u.name }),
          h(doc, 'span', {
            class: 'tc-forge-stats',
            text: [
              upgradeEffect(u.effect, u.perLevel * Math.max(1, level)),
              UPGRADE_COPY.level(level, UPGRADE_MAX_LEVEL),
            ].join(' · '),
          }),
          level > 0
            ? h(doc, 'span', {
                class: 'tc-forge-owned',
                text: UPGRADE_COPY.ownedBy(options.names[team]),
              })
            : null,
        ),
        h(doc, 'span', {
          class: 'tc-forge-badge',
          text: cost === null ? UPGRADE_COPY.topLevel : UPGRADE_COPY.cost(cost),
        }),
      );
      button.addEventListener('click', () => {
        const outcome = buyUpgrade(camp, options.names[team], team, u.id);
        if (outcome.ok) {
          camp = outcome.camp;
          options.save(camp);
          say(UPGRADE_COPY.upgraded(u.name, level + 1));
        } else if (outcome.reason === 'not_enough_scrap') {
          say(UPGRADE_COPY.needMore(Math.max(1, (cost ?? 0) - wallet().scrap)));
        } else if (outcome.reason === 'max_level') {
          say(UPGRADE_COPY.atTop);
        }
        render();
      });
      return button;
    };

    function render(): void {
      screen.setAttribute('data-team', team);
      const next = upgradeScene(doc, team);
      art.replaceWith(next);
      art = next;
      ownerName.textContent = options.names[team];
      scrapValue.textContent = String(wallet().scrap);
      for (const chip of teamChips) {
        const on = chip.getAttribute('data-team') === team;
        chip.setAttribute('aria-checked', String(on));
        chip.tabIndex = on ? 0 : -1;
      }
      list.replaceChildren(...upgradesOf(team).map(row));
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
