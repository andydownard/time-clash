// Selectors: controls that pick a value, never start an action (docs/DESIGN_SYSTEM.md, "Controls").
// - radioGroup: one value from a short set. A connected strip (.tc-chips) of flat options
//   (.tc-chip, role="radio"). The picked option is Ember with a check mark. One Tab stop; the
//   arrow keys move. More than about five values: use a native <select> (.tc-select) instead.
// - switchChip: one setting that is on or off (role="switch"), the same flat look on its own.
// Buttons (.tc-btn) start actions and links (.tc-link) are quiet rare actions. Neither is built here.
import { h } from './dom';

export type RadioOption = { text: string; testId: string; ariaLabel?: string };

export type RadioGroup = { el: HTMLElement; chips: HTMLButtonElement[]; paint: () => void };

export function radioGroup<T extends string | number>(
  doc: Document,
  spec: {
    /** Names the group for a screen reader. */
    label: string;
    values: readonly T[];
    current: () => T;
    set: (v: T) => void;
    option: (v: T) => RadioOption;
    /** Runs after every pick, by tap or by arrow key. */
    onPick?: () => void;
    describedBy?: string;
    /** Extra class on each option, such as tc-chip-wide. */
    optionClass?: string;
  },
): RadioGroup {
  const { values } = spec;
  const chips = values.map((v) => {
    const o = spec.option(v);
    return h(doc, 'button', {
      type: 'button',
      class: `tc-chip ${spec.optionClass ?? ''}`.trim(),
      role: 'radio',
      'aria-label': o.ariaLabel,
      'data-testid': o.testId,
      text: o.text,
    });
  });
  // A radio group is one stop in the Tab order. The arrow keys move inside it.
  const paint = (): void => {
    chips.forEach((c, i) => {
      const on = values[i] === spec.current();
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
  };
  const pick = (i: number): void => {
    spec.set(values[i] as T);
    paint();
    spec.onPick?.();
  };
  chips.forEach((chip, i) => {
    chip.addEventListener('click', () => pick(i));
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
      pick(to);
      chips[to]?.focus();
    });
  });
  paint();
  const el = h(
    doc,
    'div',
    {
      class: 'tc-chips',
      role: 'radiogroup',
      'aria-label': spec.label,
      'aria-describedby': spec.describedBy,
    },
    ...chips,
  );
  return { el, chips, paint };
}

/** An on/off setting. The words say the state ("Sound on"); aria-checked says it to a screen reader. */
export function switchChip(
  doc: Document,
  attrs: { testId: string; extraClass?: string },
): HTMLButtonElement {
  return h(doc, 'button', {
    type: 'button',
    class: `tc-chip tc-toggle ${attrs.extraClass ?? ''}`.trim(),
    role: 'switch',
    'aria-checked': 'false',
    'data-testid': attrs.testId,
  });
}

/** Paints a switch: its words and whether it is on. */
export function setSwitch(el: HTMLElement, on: boolean, text: string): void {
  el.textContent = text;
  el.setAttribute('aria-checked', String(on));
}
