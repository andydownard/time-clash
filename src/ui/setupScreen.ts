// Player setup: two cards, one per team. Name, a grade dropdown (K to 12), subject selector.
import {
  BUTTONS,
  PASS_SCREEN,
  SETUP,
  SUBJECT_LABELS,
  TEAM_HOMES,
  TEAM_NAMES,
  UI_EXTRA,
  gradeChipLabel,
} from '../data/copy';
import { COMPUTER } from '../data/computerCopy';
import { DEFAULT_NAMES, GRADE, MATCH_LENGTH, NAME, PRACTICE_BOT } from '../game/config';
import { normalizeMatchLength, type MatchLength } from '../game/matchLength';
import { withComputer } from '../game/practice';
import { TEAMS, type Grade, type Players, type Subject, type Team } from '../game/types';
import { clearMyData, loadMatchLength, loadPractice, loadSetupPicks } from '../storage/storage';
import type { SetupPick } from '../storage/types';
import { skyline } from './art';
import { COMPUTER_TEAM, createPracticeSetup } from './computerPlayer';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { radioGroup } from './selector';
import { validateSetup, type TeamErrors } from './setupForm';
import { TEST_IDS } from './types';

/**
 * First-run picks. Grade 2 and "both" give a gentle start. A parent or teacher changes them.
 * TODO(architect): move to src/game/config.ts.
 */
const START_PICK = { grade: 2 as Grade, subject: 'both' as Subject };
const SUBJECTS: readonly Subject[] = ['reading', 'math', 'both'];

type TeamState = { name: string; grade: Grade; subject: Subject };

/** Just the part Setup remembers between visits. */
const pickOf = (t: TeamState): SetupPick => ({ grade: t.grade, subject: t.subject });

const GRADES: readonly Grade[] = Array.from(
  { length: GRADE.max - GRADE.min + 1 },
  (_, i) => (GRADE.min + i) as Grade,
);

export function showSetup(ctx: UiCtx, initial: Players | null): Promise<Players>;
export function showSetup(
  ctx: UiCtx,
  initial: Players | null,
  options: { back: true; computer?: boolean },
): Promise<Players | null>;
export function showSetup(
  ctx: UiCtx,
  initial: Players | null,
  options: { computer: boolean },
): Promise<Players>;
export function showSetup(
  ctx: UiCtx,
  initial: Players | null,
  options?: { back?: true; computer?: boolean },
): Promise<Players | null> {
  const { doc } = ctx;

  const defaults = (): Record<Team, TeamState> => ({
    PAST: { name: DEFAULT_NAMES.PAST, ...START_PICK },
    FUTURE: { name: DEFAULT_NAMES.FUTURE, ...START_PICK },
  });
  const state = defaults();
  // Last time's grade and subject. Names are not kept here.
  const remembered = loadSetupPicks(ctx.storage);
  for (const team of TEAMS) {
    const pick = remembered[team];
    if (pick) state[team] = { ...state[team], ...pick };
  }
  if (initial) {
    // The Computer player is not a name to type back in. Its side starts fresh.
    for (const p of initial) {
      if (p.name === PRACTICE_BOT.displayName) continue;
      state[p.team] = { name: p.name, grade: p.grade, subject: p.subject };
    }
  }

  // Set once the read-back line exists. Every chip pick calls it.
  let onPick: () => void = () => {};
  const inputs = {} as Record<Team, HTMLInputElement>;
  const gradeSelects = {} as Record<Team, HTMLSelectElement>;
  const errorEls = {} as Record<Team, HTMLElement>;

  const painters: Array<() => void> = [];
  // The Play with choice. Off by default: with no `computer` option nothing below changes Setup.
  const practice = options?.computer
    ? createPracticeSetup(ctx, loadPractice(ctx.storage), () => painters.forEach((p) => p()))
    : null;

  // How long the match runs. Normal unless a parent changed it. It sits on the button row, so Setup stays one screen.
  let matchLength: MatchLength = loadMatchLength(ctx.storage);
  const lengthGroup = radioGroup<MatchLength>(doc, {
    label: SETUP.matchLengthLabel,
    values: MATCH_LENGTH.ids,
    current: () => matchLength,
    set: (v) => (matchLength = normalizeMatchLength(v)),
    option: (v) => ({ text: SETUP.matchLengthChips[v] ?? v, testId: TEST_IDS.setupMatchLength(v) }),
    onPick: () => onPick(),
    describedBy: 'tc-length-help',
  });
  painters.push(lengthGroup.paint);
  const lengthRow = h(
    doc,
    'div',
    { class: 'tc-length', 'data-testid': TEST_IDS.setupMatchLengthRow },
    h(doc, 'span', { class: 'tc-label', 'aria-hidden': 'true', text: SETUP.matchLengthLabel }),
    lengthGroup.el,
    h(doc, 'p', { class: 'tc-sr-only', id: 'tc-length-help', text: SETUP.matchLengthHelper }),
  );

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

    // Grade is a native dropdown: 13 choices, and an iPad shows its own big picker wheel.
    const gradeId = `tc-grade-${lower}`;
    const noteId = `tc-grade-note-${lower}`;
    const gradeSelect = h(
      doc,
      'select',
      {
        class: 'tc-select',
        id: gradeId,
        'data-testid': TEST_IDS.setupGrade(team),
        'aria-describedby': `tc-grade-help-${lower} ${noteId}`,
      },
      ...GRADES.map((g) => h(doc, 'option', { value: g, text: gradeChipLabel(g) })),
    );
    gradeSelects[team] = gradeSelect;
    const youngNote = h(doc, 'p', {
      class: 'tc-muted',
      id: noteId,
      'data-testid': LOCAL_IDS.setupGradeNote(team),
      text: SETUP.youngReaderNote,
    });
    const paintGrade = (): void => {
      gradeSelect.value = String(state[team].grade);
      youngNote.hidden = state[team].grade > GRADE.grownUpNoteMax;
    };
    gradeSelect.addEventListener('change', () => {
      const g = Number(gradeSelect.value);
      if (Number.isInteger(g) && g >= GRADE.min && g <= GRADE.max) state[team].grade = g as Grade;
      paintGrade();
      onPick();
    });
    const subjects = radioGroup<Subject>(doc, {
      label: `${TEAM_NAMES[team]} ${SETUP.subjectLabel}`,
      values: SUBJECTS,
      current: () => state[team].subject,
      set: (v) => (state[team].subject = v),
      option: (v) => ({ text: SUBJECT_LABELS[v], testId: TEST_IDS.setupSubject(team, v) }),
      onPick: () => onPick(),
      optionClass: 'tc-chip-wide',
    });
    painters.push(paintGrade, subjects.paint);

    return h(
      doc,
      'div',
      {
        class: 'tc-team-card',
        'data-team': team,
        role: 'group',
        'aria-labelledby': `tc-team-title-${lower}`,
      },
      h(
        doc,
        'h2',
        { class: 'tc-team-head', id: `tc-team-title-${lower}` },
        h(doc, 'span', {
          class: 'tc-team-mark',
          'aria-hidden': 'true',
          text: PASS_SCREEN.icon[team],
        }),
        h(doc, 'span', { class: 'tc-team-title', text: TEAM_NAMES[team] }),
        ' ',
        h(doc, 'span', { class: 'tc-team-home', text: `(${TEAM_HOMES[team]})` }),
      ),
      h(doc, 'label', { class: 'tc-label', for: nameId, text: SETUP.nameLabel }),
      input,
      err,
      h(doc, 'label', { class: 'tc-label', for: gradeId, text: SETUP.gradeLabel }),
      h(doc, 'span', { class: 'tc-select-wrap' }, gradeSelect),
      youngNote,
      // Heard by screen readers on the grade dropdown.
      h(doc, 'p', { class: 'tc-sr-only', id: `tc-grade-help-${lower}`, text: SETUP.gradeHelper }),
      h(doc, 'p', { class: 'tc-label', 'aria-hidden': 'true', text: SETUP.subjectLabel }),
      subjects.el,
    );
  });
  const humanCards = cards;
  // Computer player picked: its card takes the place of the Team Future card.
  if (practice) {
    painters.push(() => {
      humanCards[1]!.hidden = practice.isComputer();
      practice.card.hidden = !practice.isComputer();
    });
  }
  // Says the picks in words for a screen reader. Sighted players already see them on the cards.
  const readBack = h(doc, 'p', {
    class: 'tc-sr-only',
    'data-testid': LOCAL_IDS.setupReadBack,
    'aria-live': 'polite',
  });
  const paintReadBack = (): void => {
    readBack.textContent = TEAMS.map((t) =>
      practice?.isComputer() && t === COMPUTER_TEAM
        ? `${TEAM_NAMES[t]}: ${COMPUTER.readBack(COMPUTER.levels[practice.choice().level])}`
        : SETUP.readBack(
            TEAM_NAMES[t],
            gradeChipLabel(state[t].grade),
            SUBJECT_LABELS[state[t].subject],
          ),
    ).join('. ');
  };
  onPick = paintReadBack;
  painters.push(paintReadBack);
  painters.forEach((p) => p());

  // ---- Clear my data (asks first) ----
  const note = h(doc, 'p', { class: 'tc-muted', role: 'status' });
  const confirmRow = h(doc, 'div', { class: 'tc-row', hidden: true });
  // A quiet link, not a button: it is rare, and it asks first.
  const clearBtn = h(doc, 'button', {
    type: 'button',
    class: 'tc-link',
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
    practice?.reset();
    matchLength = loadMatchLength(ctx.storage);
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
  // Back leaves without saving. It is only there when there is somewhere to go back to.
  const backBtn = options?.back
    ? h(doc, 'button', {
        type: 'button',
        class: 'tc-btn tc-btn-neutral',
        'data-testid': TEST_IDS.setupBack,
        text: `← ${BUTTONS.back}`,
      })
    : null;
  const form = h(
    doc,
    'form',
    { class: 'tc-setup-form', novalidate: true },
    ...(practice ? [practice.playWithRow] : []),
    h(
      doc,
      'div',
      { class: 'tc-team-cards' },
      cards[0],
      h(doc, 'div', { class: 'tc-vs', 'aria-hidden': 'true', text: SETUP.versus }),
      cards[1],
      ...(practice ? [practice.card] : []),
    ),
    readBack,
    h(doc, 'p', { class: 'tc-sr-only', text: SETUP.matchHelper }),
    h(
      doc,
      'div',
      { class: 'tc-row tc-row-start' },
      ...(backBtn ? [backBtn] : []),
      lengthRow,
      nextBtn,
    ),
    h(
      doc,
      'div',
      { class: 'tc-privacy' },
      h(doc, 'p', { class: 'tc-muted', text: SETUP.namesStay }),
      clearBtn,
      confirmRow,
      note,
    ),
  );
  const screen = h(
    doc,
    'section',
    {
      class: `tc-screen tc-setup tc-split${practice ? ' tc-setup-choice' : ''}`,
      'data-screen': 'setup',
      'data-motion': ctx.motion(),
    },
    skyline(doc),
    h(doc, 'h1', { class: 'tc-setup-title', text: SETUP.heading }),
    h(doc, 'p', { class: 'tc-setup-sub', text: SETUP.subtitle }),
    form,
  );
  const close = ctx.openScreen(screen);

  return new Promise<Players | null>((resolve) => {
    backBtn?.addEventListener('click', () => {
      ctx.sfx('click');
      close();
      resolve(null);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const alone = practice?.isComputer() === true;
      const result = validateSetup({
        PAST: {
          name: inputs.PAST.value,
          grade: state.PAST.grade,
          subject: state.PAST.subject,
        },
        // Playing alone: the other side is not typed, so check it with the default name.
        FUTURE: alone
          ? { name: DEFAULT_NAMES.FUTURE, grade: state.PAST.grade, subject: state.PAST.subject }
          : {
              name: inputs.FUTURE.value,
              grade: state.FUTURE.grade,
              subject: state.FUTURE.subject,
            },
      });
      if (result.ok) {
        ctx.sfx('click');
        if (practice) ctx.storage.set('timeclash.practice', practice.choice());
        ctx.storage.set('timeclash.matchLength', matchLength);
        ctx.storage.set('timeclash.setupPicks', {
          PAST: pickOf(state.PAST),
          FUTURE: pickOf(state.FUTURE),
        });
        close();
        resolve(alone ? withComputer(result.players, COMPUTER_TEAM) : result.players);
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
