// Player setup: two cards, one per team. Names, grade chips (K to 12), subject chips.
import {
  SETUP,
  SUBJECT_LABELS,
  TEAM_HOMES,
  TEAM_NAMES,
  UI_EXTRA,
  gradeChipLabel,
  gradeLabel,
} from '../data/copy';
import { DEFAULT_NAMES, GRADE, NAME } from '../game/config';
import { TEAMS, type Grade, type Players, type Subject, type Team } from '../game/types';
import { clearMyData } from '../storage/storage';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { validateSetup, type TeamErrors } from './setupForm';
import { TEST_IDS } from './types';

/**
 * First-run picks. Grade 2 and "both" give a gentle start. A parent or teacher changes them.
 * TODO(architect): move to src/game/config.ts.
 */
const START_PICK = { grade: 2 as Grade, subject: 'both' as Subject };
const SUBJECTS: readonly Subject[] = ['reading', 'math', 'both'];

type TeamState = { name: string; grade: Grade; subject: Subject };

export function showSetup(ctx: UiCtx, initial: Players | null): Promise<Players> {
  const { doc } = ctx;

  const defaults = (): Record<Team, TeamState> => ({
    PAST: { name: DEFAULT_NAMES.PAST, ...START_PICK },
    FUTURE: { name: DEFAULT_NAMES.FUTURE, ...START_PICK },
  });
  const state = defaults();
  if (initial) {
    for (const p of initial) state[p.team] = { name: p.name, grade: p.grade, subject: p.subject };
  }

  const inputs = {} as Record<Team, HTMLInputElement>;
  const errorEls = {} as Record<Team, HTMLElement>;

  /** A group of radio-style chips with arrow-key movement. */
  function chipGroup<T extends string | number>(
    team: Team,
    label: string,
    values: readonly T[],
    current: () => T,
    set: (v: T) => void,
    make: (v: T) => HTMLButtonElement,
  ): { el: HTMLElement; chips: HTMLButtonElement[]; paint: () => void } {
    const chips = values.map((v) => make(v));
    const paint = (): void => {
      chips.forEach((c, i) => {
        const on = values[i] === current();
        c.setAttribute('aria-checked', String(on));
        c.tabIndex = on ? 0 : -1;
      });
    };
    chips.forEach((chip, i) => {
      chip.addEventListener('click', () => {
        set(values[i] as T);
        paint();
      });
      chip.addEventListener('keydown', (e) => {
        const move =
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? -1
              : 0;
        if (!move) return;
        e.preventDefault();
        const to = Math.min(values.length - 1, Math.max(0, i + move));
        set(values[to] as T);
        paint();
        chips[to]?.focus();
      });
    });
    const el = h(
      doc,
      'div',
      { class: 'tc-chips', role: 'radiogroup', 'aria-label': `${TEAM_NAMES[team]} ${label}` },
      ...chips,
    );
    return { el, chips, paint };
  }

  const painters: Array<() => void> = [];

  const cards = TEAMS.map((team) => {
    const lower = team.toLowerCase();
    const nameId = `tc-name-${lower}`;
    const input = h(doc, 'input', {
      type: 'text',
      class: 'tc-input',
      id: nameId,
      maxlength: NAME.maxLength,
      autocomplete: 'off',
      placeholder: SETUP.namePlaceholder,
      'data-testid': TEST_IDS.setupName(team),
      'aria-describedby': `tc-err-${lower}`,
    });
    input.value = state[team].name;
    inputs[team] = input;
    const err = h(doc, 'p', {
      class: 'tc-error',
      id: `tc-err-${lower}`,
      role: 'alert',
      'data-testid': LOCAL_IDS.setupError(team),
    });
    errorEls[team] = err;
    input.addEventListener('input', () => {
      state[team].name = input.value;
      err.textContent = '';
      input.removeAttribute('aria-invalid');
    });

    const grades = chipGroup<Grade>(
      team,
      SETUP.gradeLabel,
      Array.from({ length: GRADE.max - GRADE.min + 1 }, (_, i) => (GRADE.min + i) as Grade),
      () => state[team].grade,
      (g) => (state[team].grade = g),
      (g) =>
        h(doc, 'button', {
          type: 'button',
          class: 'tc-chip',
          role: 'radio',
          'aria-label': gradeChipLabel(g),
          'data-testid': TEST_IDS.setupGrade(team, g),
          text: gradeLabel(g),
        }),
    );
    const subjects = chipGroup<Subject>(
      team,
      SETUP.subjectLabel,
      SUBJECTS,
      () => state[team].subject,
      (s) => (state[team].subject = s),
      (s) =>
        h(doc, 'button', {
          type: 'button',
          class: 'tc-chip tc-chip-wide',
          role: 'radio',
          'data-testid': TEST_IDS.setupSubject(team, s),
          text: SUBJECT_LABELS[s],
        }),
    );
    painters.push(grades.paint, subjects.paint);

    return h(
      doc,
      'fieldset',
      { class: 'tc-team-card', 'data-team': team },
      h(doc, 'legend', { text: `${TEAM_NAMES[team]} (${TEAM_HOMES[team]})` }),
      h(doc, 'label', { for: nameId, text: SETUP.nameLabel }),
      input,
      err,
      h(doc, 'p', { class: 'tc-label', text: SETUP.gradeLabel }),
      grades.el,
      h(doc, 'p', { class: 'tc-muted', text: SETUP.gradeHelper }),
      h(doc, 'p', { class: 'tc-label', text: SETUP.subjectLabel }),
      subjects.el,
      h(doc, 'p', { class: 'tc-muted', text: SETUP.subjectHelper }),
    );
  });
  painters.forEach((p) => p());

  // ---- Clear my data (asks first) ----
  const note = h(doc, 'p', { class: 'tc-muted', role: 'status' });
  const confirmRow = h(doc, 'div', { class: 'tc-row', hidden: true });
  const clearBtn = h(doc, 'button', {
    type: 'button',
    class: 'tc-btn tc-btn-neutral',
    'data-testid': LOCAL_IDS.clearData,
    text: UI_EXTRA.clearData,
  });
  const yes = h(doc, 'button', {
    type: 'button',
    class: 'tc-btn tc-btn-neutral',
    'data-testid': LOCAL_IDS.clearDataYes,
    text: UI_EXTRA.clearDataYes,
  });
  const no = h(doc, 'button', {
    type: 'button',
    class: 'tc-btn tc-btn-neutral',
    'data-testid': LOCAL_IDS.clearDataNo,
    text: UI_EXTRA.clearDataNo,
  });
  confirmRow.append(h(doc, 'p', { text: UI_EXTRA.clearDataAsk }), yes, no);
  clearBtn.addEventListener('click', () => {
    note.textContent = '';
    confirmRow.hidden = false;
    clearBtn.hidden = true;
    no.focus();
  });
  no.addEventListener('click', () => {
    confirmRow.hidden = true;
    clearBtn.hidden = false;
    clearBtn.focus();
  });
  yes.addEventListener('click', () => {
    clearMyData(ctx.storage);
    Object.assign(state, defaults());
    for (const t of TEAMS) {
      (inputs[t] as HTMLInputElement).value = state[t].name;
      errorEls[t]!.textContent = '';
    }
    painters.forEach((p) => p());
    confirmRow.hidden = true;
    clearBtn.hidden = false;
    note.textContent = UI_EXTRA.clearDataDone;
    clearBtn.focus();
  });

  const nextBtn = h(doc, 'button', {
    type: 'submit',
    class: 'tc-btn tc-btn-primary',
    'data-testid': TEST_IDS.setupNext,
    text: SETUP.start,
  });
  const form = h(
    doc,
    'form',
    { class: 'tc-setup-form', novalidate: true },
    h(doc, 'div', { class: 'tc-team-cards' }, ...cards),
    h(doc, 'div', { class: 'tc-row' }, nextBtn),
    h(doc, 'div', { class: 'tc-privacy' }, clearBtn, confirmRow, note),
  );
  const screen = h(
    doc,
    'section',
    { class: 'tc-screen tc-setup', 'data-screen': 'setup', 'data-motion': ctx.motion() },
    h(doc, 'h1', { text: SETUP.heading }),
    form,
  );
  const close = ctx.openScreen(screen);

  return new Promise<Players>((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const result = validateSetup({
        PAST: { name: inputs.PAST.value, grade: state.PAST.grade, subject: state.PAST.subject },
        FUTURE: {
          name: inputs.FUTURE.value,
          grade: state.FUTURE.grade,
          subject: state.FUTURE.subject,
        },
      });
      if (result.ok) {
        ctx.sfx('click');
        close();
        resolve(result.players);
        return;
      }
      let focused = false;
      for (const t of TEAMS) {
        const errors: TeamErrors = result.errors[t];
        const text = errors.name ?? errors.grade ?? errors.subject ?? '';
        errorEls[t]!.textContent = text;
        const input = inputs[t] as HTMLInputElement;
        if (errors.name) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        if (errors.name && !focused) {
          input.focus();
          focused = true;
        }
      }
    });
  });
}
