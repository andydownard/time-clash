// Squads S1 helper bar: "GO 1 OF 2" with two dots, the two helpers to pick, and the dash spots.
// Built once, hidden when there is no squad state. Plain DOM, 56px targets, 20px text.
// Picked is shown by a thick border and an arrow, never by color alone.
import { SQUAD_COPY } from '../data/copy';
import { SQUADS } from '../game/config';
import { goLabel } from '../game/crew';
import { h } from './dom';
import { TEST_IDS, type HudHandlers, type HudSquads } from './types';

export type SquadBar = {
  root: HTMLElement;
  /** Repaint. `active` is false while a shot flies or a cover is up. Returns true when a dasher is picked (Fire stays off). */
  update(squads: HudSquads | undefined, active: boolean): boolean;
};

export function createSquadBar(doc: Document, handlers: () => HudHandlers | null): SquadBar {
  const banner = h(doc, 'span', {
    class: 'tc-go-text',
    'data-testid': TEST_IDS.goBanner,
    role: 'status',
  });
  const dots = h(doc, 'span', { class: 'tc-go-dots', 'aria-hidden': 'true' });
  const helpers = h(doc, 'div', {
    class: 'tc-helpers',
    role: 'radiogroup',
    'aria-label': SQUAD_COPY.pick,
  });
  const spots = h(doc, 'div', {
    class: 'tc-dash-spots',
    role: 'group',
    'aria-label': SQUAD_COPY.where,
  });
  const root = h(
    doc,
    'div',
    { class: 'tc-squad-bar', hidden: true },
    h(doc, 'div', { class: 'tc-go-row' }, banner, dots),
    helpers,
    spots,
  );

  return {
    root,
    update(squads, active): boolean {
      root.hidden = !squads;
      if (!squads) return false;
      banner.textContent = goLabel(squads.goesDone);
      dots.replaceChildren(
        ...Array.from({ length: SQUADS.goesPerTurn }, (_, i) =>
          h(doc, 'span', { class: 'tc-go-dot', 'data-used': String(i < squads.goesDone) }),
        ),
      );
      helpers.replaceChildren(
        ...squads.helpers.map((hp) => {
          const b = h(doc, 'button', {
            type: 'button',
            role: 'radio',
            class: 'tc-helper',
            'data-helper': hp.id,
            'data-testid': TEST_IDS.helper(hp.id),
            'aria-checked': String(hp.id === squads.picked),
            'aria-disabled': String(!active),
          });
          b.append(
            h(doc, 'span', { class: 'tc-helper-name', text: hp.name }),
            h(doc, 'span', { class: 'tc-helper-kind', text: SQUAD_COPY.helperKind[hp.kind] }),
          );
          b.addEventListener('click', () => {
            if (active) handlers()?.onHelper?.(hp.id);
          });
          return b;
        }),
      );
      const picked = squads.helpers.find((x) => x.id === squads.picked);
      const dasherUp = picked?.kind === 'dasher';
      spots.hidden = !dasherUp;
      spots.replaceChildren(
        ...(dasherUp && squads.targets.length === 0
          ? [h(doc, 'span', { class: 'tc-dash-none', text: SQUAD_COPY.noSpots })]
          : squads.targets.map((spot) => {
              const n = Number(spot.slice(1)) + 1;
              const b = h(doc, 'button', {
                type: 'button',
                class: 'tc-dash-spot',
                'data-testid': TEST_IDS.dashSpot(spot),
                'aria-label': SQUAD_COPY.spotAria(n),
                text: SQUAD_COPY.spotLabel(n),
              });
              b.addEventListener('click', () => {
                if (active) handlers()?.onDash?.(spot);
              });
              return b;
            })),
      );
      // Fire belongs to the launcher. A picked dasher rolls instead.
      return dasherUp;
    },
  };
}
