// Squads S1 helper controls, in three places so the control bar keeps its two rows:
// - the helper row (the two helpers and Hear it) floats just under the ground line, between the
//   two base health tags, where the coach line sat;
// - "GO 1 OF 2" with two dots sits in the turn strip;
// - the dasher panel (Walk out, Come back or a resting note, and Back) takes the aim panel's
//   place while the dasher is picked, since a walk needs no aim.
// Hidden when there is no squad state. Plain DOM, 56px targets, 20px text.
// Picked is shown by a thick border and an arrow, never by color alone.
import { SQUAD_COPY } from '../data/copy';
import { SQUADS } from '../game/config';
import { goLabel } from '../game/crew';
import { h } from './dom';
import { TEST_IDS, type HudHandlers, type HudSquads } from './types';

export type SquadBar = {
  /** The helper row: the two helpers, Hear it, and the first-go hint. */
  root: HTMLElement;
  /** "GO 1 OF 2" and two dots, for the turn strip. */
  goRow: HTMLElement;
  /** The dasher's move and Back. Shown in place of the aim panel while the dasher is picked. */
  panel: HTMLElement;
  /** Repaint. `active` is false while a shot flies or a cover is up. Returns true when a dasher is picked (Fire stays off). */
  update(squads: HudSquads | undefined, active: boolean): boolean;
};

const KIND_ICON: Record<string, string> = { launcher: '🎯', dasher: '🛡' };

export function createSquadBar(doc: Document, handlers: () => HudHandlers | null): SquadBar {
  const banner = h(doc, 'span', {
    class: 'tc-go-text',
    'data-testid': TEST_IDS.goBanner,
    role: 'status',
  });
  const dots = h(doc, 'span', { class: 'tc-go-dots', 'aria-hidden': 'true' });
  const goRow = h(doc, 'span', { class: 'tc-go-row', hidden: true }, banner, dots);
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
  const back = h(doc, 'button', {
    type: 'button',
    class: 'tc-helper-back',
    'data-testid': TEST_IDS.helperBack,
    hidden: true,
  });
  back.append(
    h(doc, 'span', { 'aria-hidden': 'true', text: `${SQUAD_COPY.backIcon} ` }),
    SQUAD_COPY.back,
  );
  const hear = h(doc, 'button', {
    type: 'button',
    class: 'tc-helper-hear',
    'data-testid': TEST_IDS.helperHear,
  });
  // A speaker picture keeps the row narrow enough to sit between the two health tags.
  hear.append(
    h(doc, 'span', { 'aria-hidden': 'true', text: SQUAD_COPY.hearIcon }),
    h(doc, 'span', { class: 'tc-sr-only', text: SQUAD_COPY.hear }),
  );
  hear.setAttribute('aria-label', SQUAD_COPY.hear);
  hear.setAttribute('title', SQUAD_COPY.hear);
  const hint = h(doc, 'div', { class: 'tc-go-hint', 'data-testid': TEST_IDS.goHint, hidden: true });
  hint.append(
    h(doc, 'span', { class: 'tc-go-finger', 'aria-hidden': 'true', text: SQUAD_COPY.fingerIcon }),
    h(doc, 'span', { text: SQUAD_COPY.firstGo }),
  );
  let launcherId: string | null = null;
  let live = false;
  back.addEventListener('click', () => {
    if (live && launcherId) handlers()?.onHelper?.(launcherId);
  });
  hear.addEventListener('click', () => {
    if (live) handlers()?.onHearHelper?.();
  });
  const root = h(doc, 'div', { class: 'tc-squad-bar', hidden: true }, helpers, hear, hint);
  const panel = h(
    doc,
    'div',
    { class: 'tc-dasher-panel', hidden: true },
    spots,
    h(doc, 'div', { class: 'tc-helper-tools' }, back),
  );

  return {
    root,
    goRow,
    panel,
    update(squads, active): boolean {
      root.hidden = !squads;
      goRow.hidden = !squads;
      if (!squads) {
        panel.hidden = true;
        return false;
      }
      live = active;
      launcherId = squads.helpers.find((x) => x.kind === 'launcher')?.id ?? null;
      hint.hidden = !squads.hint;
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
            h(doc, 'span', {
              class: 'tc-helper-icon',
              'aria-hidden': 'true',
              text: KIND_ICON[hp.kind] ?? '',
            }),
            h(doc, 'span', { class: 'tc-helper-name', text: hp.name }),
            h(doc, 'span', {
              class: 'tc-sr-only',
              text: ` ${SQUAD_COPY.helperKind[hp.kind] ?? ''}`,
            }),
          );
          b.addEventListener('click', () => {
            if (active) handlers()?.onHelper?.(hp.id);
          });
          return b;
        }),
      );
      const picked = squads.helpers.find((x) => x.id === squads.picked);
      const dasherUp = picked?.kind === 'dasher';
      const state = squads.dasher?.state ?? 'home';
      panel.hidden = !dasherUp;
      back.hidden = !dasherUp;
      spots.replaceChildren(...(dasherUp ? dasherMove(state) : []));
      function dasherMove(now: 'home' | 'out' | 'resting'): HTMLElement[] {
        if (now === 'out') {
          const b = h(doc, 'button', {
            type: 'button',
            class: 'tc-dash-spot',
            'data-testid': TEST_IDS.helperRecall,
          });
          b.append(
            h(doc, 'span', { 'aria-hidden': 'true', text: `${SQUAD_COPY.recallIcon} ` }),
            SQUAD_COPY.recall,
          );
          b.addEventListener('click', () => {
            if (active) handlers()?.onRecall?.();
          });
          return [b];
        }
        if (now === 'resting') {
          return [
            h(doc, 'span', {
              class: 'tc-dash-none',
              'data-testid': TEST_IDS.dasherResting,
              text: SQUAD_COPY.resting,
            }),
          ];
        }
        if (squads!.targets.length === 0)
          return [h(doc, 'span', { class: 'tc-dash-none', text: SQUAD_COPY.noSpots })];
        return squads!.targets.map((spot) => {
          const n = Number(spot.slice(1)) + 1;
          const b = h(doc, 'button', {
            type: 'button',
            class: 'tc-dash-spot',
            'data-testid': TEST_IDS.dashSpot(spot),
            'aria-label': SQUAD_COPY.spotAria(n),
            text: SQUAD_COPY.spotLabel,
          });
          b.addEventListener('click', () => {
            if (active) handlers()?.onDash?.(spot);
          });
          return b;
        });
      }
      // Fire belongs to the launcher. A picked dasher walks out (or comes back) instead.
      return dasherUp;
    },
  };
}
