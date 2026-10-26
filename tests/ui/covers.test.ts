// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BUTTONS,
  PASS_SCREEN,
  RELOAD as RELOAD_COPY,
  TEAM_NAMES,
  UI_EXTRA,
} from '../../src/data/copy';
import { RELOAD, TIMING, UI } from '../../src/game/config';
import { fastWindowMs } from '../../src/game/reload';
import { TEST_IDS, Z } from '../../src/ui/types';
import {
  click,
  fractionQ,
  flush,
  key,
  mainIdeaQ,
  mathQ,
  q,
  qa,
  setup,
  vocabQ,
  wordQ,
} from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const expectBoardHidden = () => {
  expect(s.root.hasAttribute('inert')).toBe(true);
  expect(s.root.getAttribute('aria-hidden')).toBe('true');
  expect(s.root.style.visibility).toBe('hidden');
};
const expectBoardShown = () => {
  expect(s.root.hasAttribute('inert')).toBe(false);
  expect(s.root.getAttribute('aria-hidden')).not.toBe('true');
  expect(s.root.style.visibility).not.toBe('hidden');
};

describe('pass-the-mouse cover', () => {
  it('shows the heading and the next name, with no "no peeking" line (owner, 2026-10-24)', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const el = q(TEST_IDS.passScreen)!;
    expect(el.textContent).toContain(PASS_SCREEN.heading);
    expect(el.textContent).toContain(PASS_SCREEN.upNext('Sam'));
    expect(el.textContent).not.toMatch(/peek/i);
    expect(el.getAttribute('data-team')).toBe('FUTURE');
  });

  it('is opaque and covers the whole viewport', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const st = q(TEST_IDS.passScreen)!.style;
    expect(st.position).toBe('fixed');
    for (const side of ['top', 'right', 'bottom', 'left'] as const) expect(st[side]).toBe('0px');
    expect(st.width).toBe('100%');
    expect(st.height).toBe('100%');
    expect(st.zIndex).toBe(String(Z.cover));
    expect(st.opacity).toBe('1');
    expect(st.backgroundColor).not.toBe('');
    expect(st.backgroundColor).not.toBe('transparent');
    expect(st.cssText).not.toMatch(/backdrop-filter|blur|rgba/i);
  });

  it('hides and locks the board while up, and says which cover it is', () => {
    expect(s.overlay.cover).toBeNull();
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(s.overlay.cover).toBe('pass');
    expect(document.body.dataset.cover).toBe('pass');
    expectBoardHidden();
  });

  it('"I\'m ready!" resolves, removes the cover, and restores the board', async () => {
    const p = s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    click(q(TEST_IDS.passReady));
    await p;
    expect(q(TEST_IDS.passScreen)).toBeNull();
    expect(s.overlay.cover).toBeNull();
    expect(document.body.dataset.cover).toBeUndefined();
    expectBoardShown();
  });

  it('the ready button says "I\'m ready!", is a real button, and gets focus', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const b = q(TEST_IDS.passReady)!;
    expect(b.tagName).toBe('BUTTON');
    expect(b.textContent).toBe(PASS_SCREEN.ready);
    expect(document.activeElement).toBe(b);
  });

  it('has no question text in it, even right after a reload', async () => {
    const r = s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    click(q(TEST_IDS.reloadChoice(1)));
    s.clock.advance(RELOAD.rightAnswerBeatMs);
    await r;
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const text = document.body.textContent ?? '';
    expect(text).not.toContain(mathQ.prompt);
    expect(q(TEST_IDS.reloadModal)).toBeNull();
  });

  it('puts a name in as text, never as markup', () => {
    void s.overlay.showPassScreen({ nextName: '<img src=x onerror=alert(1)>', nextTeam: 'PAST' });
    expect(document.querySelector('img')).toBeNull();
    expect(q(TEST_IDS.passScreen)!.textContent).toContain('<img src=x');
  });

  it('names the next team in words, with the picture, and no round team icon', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const el = q(TEST_IDS.passScreen)!;
    expect(el.querySelector('[data-role="team-icon"], .tc-team-icon')).toBeNull();
    expect(el.textContent).not.toContain(PASS_SCREEN.icon.FUTURE);
    // Not color alone: the team tag says the side in words.
    expect(el.querySelector('.tc-team-tag')!.textContent).toBe(TEAM_NAMES.FUTURE);
    expect(el.querySelector('.tc-pass-art')).not.toBeNull();
    expect(q(TEST_IDS.passReady)!.textContent).toBe(PASS_SCREEN.ready);
    expect(q('cover-mute')).not.toBeNull();
  });

  it('has a Sound on/off button on the pass screen, and it holds no question text', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'PAST' });
    const b = q('cover-mute')!;
    click(b);
    expect(s.audio.muted).toBe(true);
    expect(b.textContent).toBe(BUTTONS.soundOff);
  });

  it('keeps Tab inside the cover', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'PAST' });
    const last = q('cover-mute')!;
    last.focus();
    const e = key(last, 'Tab');
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('pass cover voice line', () => {
  const LINE = PASS_SCREEN.heading;
  const captionLayerZ = () =>
    Number((document.querySelector('[data-layer="caption"]') as HTMLElement).style.zIndex);

  it('after the first tap, Chrono says the pass line aloud and it shows as a caption', () => {
    void s.audio.unlock();
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(s.harness.speech.spoken.map((u) => u.text)).toEqual([LINE]);
    const bar = q(TEST_IDS.captionBar)!;
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toBe(LINE);
  });

  it('never asks the voice service for a clip (no network request without a tap on it)', () => {
    const lines: Array<{ noClip?: boolean }> = [];
    const real = s.audio.speak.bind(s.audio);
    s.audio.speak = (line, o) => {
      lines.push(line);
      return real(line, o);
    };
    void s.audio.unlock();
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.noClip).toBe(true);
  });

  it('puts the caption above the pass cover so it can be read', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(captionLayerZ()).toBeGreaterThan(Z.cover);
  });

  it("never says or captions the child's name (names stay on the device)", () => {
    const said: string[] = [];
    const real = s.audio.speak.bind(s.audio);
    s.audio.speak = (line, o) => {
      said.push(line.text, ...line.captions.map((c) => c.text));
      return real(line, o);
    };
    void s.audio.unlock();
    void s.overlay.showPassScreen({ nextName: 'Zebulon', nextTeam: 'PAST' });
    expect(said.length).toBeGreaterThan(0);
    for (const t of said) expect(t).not.toContain('Zebulon');
  });

  it('makes no sound before the first tap, but the caption still shows', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(s.audio.unlocked).toBe(false);
    expect(s.harness.speech.spoken).toEqual([]);
    expect(q(TEST_IDS.captionBar)!.textContent).toBe(LINE);
  });

  it('stays silent when muted, and the caption still shows', () => {
    void s.audio.unlock();
    s.audio.setMuted(true);
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(s.harness.speech.spoken).toEqual([]);
    expect(q(TEST_IDS.captionBar)!.textContent).toBe(LINE);
  });

  it('the cover Sound off button hushes the line mid-way', () => {
    void s.audio.unlock();
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const before = s.harness.speech.cancelCalls;
    click(q('cover-mute'));
    expect(s.audio.muted).toBe(true);
    expect(s.harness.speech.cancelCalls).toBeGreaterThan(before);
  });

  it('hides the caption when captions are off in Settings', () => {
    s.overlay.applySettings({ ...s.settings, captions: false });
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
  });

  it('"I\'m ready!" skips the line: speech stops and the caption clears', async () => {
    void s.audio.unlock();
    let stopped = 0;
    const realStop = s.audio.stopSpeech.bind(s.audio);
    s.audio.stopSpeech = () => {
      stopped++;
      realStop();
    };
    const p = s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    click(q(TEST_IDS.passReady));
    await p;
    expect(stopped).toBeGreaterThan(0);
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
    expect(captionLayerZ()).toBeLessThan(Z.cover);
  });

  it('the spoken line holds no question text, even right after a reload', async () => {
    void s.audio.unlock();
    const r = s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    click(q(TEST_IDS.reloadChoice(1)));
    s.clock.advance(RELOAD.rightAnswerBeatMs);
    await r;
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const spoken = s.harness.speech.spoken.map((u) => u.text).join(' ');
    expect(spoken).not.toContain(mathQ.prompt);
    expect(q(TEST_IDS.captionBar)!.textContent).not.toContain(mathQ.prompt);
  });

  it('works with no audio at all: the caption shows and nothing throws', () => {
    s = setup({ withAudio: false });
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    expect(q(TEST_IDS.captionBar)!.textContent).toBe(LINE);
  });
});

describe('reload modal', () => {
  const open = (question = mathQ, extra: Record<string, unknown> = {}) =>
    s.overlay.showReloadModal({ question, team: 'PAST', playerName: 'Alex', ...extra });

  it('is a cover: opaque, full viewport, board hidden, body flag set', () => {
    void open();
    const el = q(TEST_IDS.reloadModal)!;
    expect(el.style.position).toBe('fixed');
    expect(el.style.zIndex).toBe(String(Z.cover));
    expect(el.style.opacity).toBe('1');
    expect(el.style.backgroundColor).not.toBe('');
    expect(s.overlay.cover).toBe('reload');
    expect(document.body.dataset.cover).toBe('reload');
    expectBoardHidden();
  });

  it('shows the heading, the prompt, and exactly 4 real choice buttons', () => {
    void open();
    const el = q(TEST_IDS.reloadModal)!;
    expect(el.textContent).toContain(RELOAD_COPY.heading);
    expect(q('reload-prompt')!.textContent).toContain('3x + 5 = 20');
    const choices = [0, 1, 2, 3].map((i) => q<HTMLButtonElement>(TEST_IDS.reloadChoice(i))!);
    expect(choices.map((c) => c.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON']);
    expect(choices.map((c) => c.textContent)).toEqual(mathQ.choices);
    expect(q(TEST_IDS.reloadChoice(4))).toBeNull();
    expect(UI.choicesPerQuestion).toBe(4);
  });

  it('does not leak the answer into attributes before the child answers', () => {
    void open();
    const html = q(TEST_IDS.reloadModal)!.outerHTML;
    expect(html).not.toMatch(/data-correct|data-answer|data-right/i);
    expect(qa('[data-state="right"]')).toHaveLength(0);
  });

  it('focuses the heading, not a choice, so no answer looks pre-picked', () => {
    void open();
    const active = document.activeElement as HTMLElement;
    expect(active.id).toBe('tc-reload-heading');
    for (let i = 0; i < 4; i++) {
      expect(active).not.toBe(q(TEST_IDS.reloadChoice(i)));
      expect(q(TEST_IDS.reloadChoice(i))!.hasAttribute('data-state')).toBe(false);
    }
  });

  it('a stray Enter or Space with nothing focused does not answer', () => {
    void open();
    key(document, 'Enter');
    key(document, ' ');
    expect(qa('[data-state]').filter((e) => e.tagName === 'BUTTON')).toHaveLength(0);
  });

  it('ignores a held-down number key (auto repeat)', async () => {
    const p = open();
    key(document, '1', { repeat: true });
    expect(qa('[data-state]').filter((e) => e.tagName === 'BUTTON')).toHaveLength(0);
    key(document, '2');
    s.clock.advance(RELOAD.rightAnswerBeatMs);
    await expect(p).resolves.toMatchObject({ choice: '5' });
  });

  it('describes the dialog with the passage and question, and labels the group from copy', () => {
    void open(mainIdeaQ);
    const el = q(TEST_IDS.reloadModal)!;
    const ids = el.getAttribute('aria-describedby')!.split(' ');
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const text = ids.map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(text).toContain('The catapult was old.');
    expect(text).toContain('What is the main idea?');
    expect(el.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe(
      UI_EXTRA.choicesLabel,
    );
  });

  it('uses the math layout for math', () => {
    void open(mathQ);
    expect(q(TEST_IDS.reloadModal)!.getAttribute('data-layout')).toBe('math');
  });

  it('uses the big reading layout for K to 3 reading', () => {
    void open(wordQ);
    expect(q(TEST_IDS.reloadModal)!.getAttribute('data-layout')).toBe('reading-young');
  });

  // The owner removed read-aloud for questions on 2026-10-23: every grade reads its own question.
  it.each([
    ['math', mathQ],
    ['fraction math', fractionQ],
    ['word choice', wordQ],
    ['vocab', vocabQ],
    ['main idea', mainIdeaQ],
  ])('has no speaker control and never speaks the question text (%s)', (_n, qn) => {
    void open(qn);
    const el = q(TEST_IDS.reloadModal)!;
    expect(el.querySelector('.tc-speak-btn, [data-testid="reload-speak"]')).toBeNull();
    expect(el.textContent).not.toContain('Hear it');
    expect(qa('button').every((b) => !/hear|listen|speak/i.test(b.textContent ?? ''))).toBe(true);
    expect(s.harness.speech.spoken).toEqual([]);
    expect(el.querySelector('#tc-reload-prompt')!.textContent!.length).toBeGreaterThan(0);
    expect(qa('.tc-choice')).toHaveLength(UI.choicesPerQuestion);
  });

  it('shows the same prompt with sound on or off (no listen-only wording)', () => {
    s = setup({ settings: { muted: true } });
    void open(wordQ);
    expect(q('reload-prompt')!.textContent).toBe(wordQ.prompt);
    click(q('cover-mute'));
    expect(q('reload-prompt')!.textContent).toBe(wordQ.prompt);
  });

  it('has a Sound on/off button on the question cover that mutes and unmutes', () => {
    void open(mathQ);
    const b = q('cover-mute')!;
    expect(b).not.toBeNull();
    expect(b.textContent).toBe(BUTTONS.soundOn);
    click(b);
    expect(s.audio.muted).toBe(true);
    expect(b.textContent).toBe(BUTTONS.soundOff);
    click(b);
    expect(s.audio.muted).toBe(false);
  });

  it('puts the captions above the question cover, and clears them when it closes', async () => {
    const p = open(mathQ);
    const z = Number(
      (document.querySelector('[data-layer="caption"]') as HTMLElement).style.zIndex,
    );
    expect(z).toBeGreaterThan(Z.cover);
    click(q(TEST_IDS.reloadChoice(1)));
    s.overlay.setCaption('hello');
    s.clock.advance(RELOAD.rightAnswerBeatMs);
    await p;
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
  });

  it('shows the passage for a main idea question', () => {
    void open(mainIdeaQ);
    expect(q(TEST_IDS.reloadModal)!.textContent).toContain('The catapult was old.');
  });

  it('renders exponents raised and fractions stacked, with a plain label', () => {
    void open(fractionQ);
    const prompt = q('reload-prompt')!;
    expect(prompt.querySelector('sup')!.textContent).toBe('2');
    expect(prompt.querySelectorAll('.tc-frac').length).toBe(2);
    expect(prompt.getAttribute('aria-label')).toBe(fractionQ.prompt);
    expect(q(TEST_IDS.reloadChoice(0))!.querySelector('.tc-frac')).not.toBeNull();
  });

  it('hint button shows the hint once', () => {
    void open();
    expect(q('reload-hint-text')).toBeNull();
    click(q(TEST_IDS.reloadHint));
    expect(q('reload-hint-text')!.textContent).toBe(mathQ.hint);
    expect(q<HTMLButtonElement>(TEST_IDS.reloadHint)!.disabled).toBe(true);
  });

  it('has no hint button when the question has no hint', () => {
    void open(vocabQ);
    expect(q(TEST_IDS.reloadHint)).toBeNull();
  });

  it('has a friendly timer ring that is decorative and has no countdown number', () => {
    void open();
    const ring = q('reload-timer')!;
    expect(ring.getAttribute('aria-hidden')).toBe('true');
    expect(ring.style.getPropertyValue('--tc-fast-ms')).toBe(`${RELOAD.fastMs}ms`);
    expect(ring.textContent).toBe('');
    expect(q(TEST_IDS.reloadModal)!.textContent).toContain(RELOAD_COPY.timerLabel);
    // One idea, led by the word Bonus, so the ring never reads as a penalty or a rush.
    expect(RELOAD_COPY.timerLabel).toBe('Bonus scrap if you answer fast. No rush!');
  });

  describe('Hide the bonus ring', () => {
    beforeEach(() => {
      s = setup({ settings: { hideBonusRing: true } });
    });

    it('draws no ring and no bonus-timer words, so a screen reader hears no timer', () => {
      void open();
      expect(q('reload-timer')).toBeNull();
      expect(q(TEST_IDS.reloadModal)!.querySelector('.tc-timer, .tc-timer-ring')).toBeNull();
      expect(q(TEST_IDS.reloadModal)!.textContent).not.toContain(RELOAD_COPY.timerLabel);
      expect(q(TEST_IDS.reloadModal)!.querySelector('[role="timer"]')).toBeNull();
    });

    it('still shows the whole question and the answers', () => {
      void open();
      expect(qa('.tc-choice').length).toBe(UI.choicesPerQuestion);
      expect(q('reload-prompt')!.textContent).not.toBe('');
    });

    it('a fast right answer still earns the bonus', async () => {
      let t = 1000;
      const p = open(mathQ, { now: () => t });
      t = 1000 + 1000;
      click(q(TEST_IDS.reloadChoice(1)));
      expect(q('reload-feedback')!.textContent).toContain(RELOAD_COPY.fastBonus);
      s.clock.advance(RELOAD.gotItDelayMs + 10);
      click(q(TEST_IDS.reloadNext));
      const r = await p;
      expect(r.correct).toBe(true);
      expect(r.elapsedMs).toBeLessThan(fastWindowMs(mathQ.kind, mathQ.grade));
    });

    it('a slow right answer loses nothing and is never marked wrong', async () => {
      let t = 1000;
      const p = open(mathQ, { now: () => t });
      t = 1000 + fastWindowMs(mathQ.kind, mathQ.grade) + 60_000;
      click(q(TEST_IDS.reloadChoice(1)));
      expect(q('reload-feedback')!.textContent).toContain(RELOAD_COPY.slowCorrect);
      expect(q('reload-feedback')!.textContent).not.toContain(RELOAD_COPY.fastBonus);
      s.clock.advance(RELOAD.gotItDelayMs + 10);
      click(q(TEST_IDS.reloadNext));
      expect((await p).correct).toBe(true);
    });
  });

  it('shows the ring when the setting is off (the default)', () => {
    s = setup({ settings: { hideBonusRing: false } });
    void open();
    expect(q('reload-timer')).not.toBeNull();
  });

  it('puts Hint in its own row as a small secondary button, set apart from the answers', () => {
    void open(mathQ);
    const hint = q(TEST_IDS.reloadHint)!;
    expect(hint.parentElement!.classList.contains('tc-hint-row')).toBe(true);
    expect(hint.classList.contains('tc-hint-btn')).toBe(true);
    expect(hint.closest('.tc-choices')).toBeNull();
    expect(hint.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('the fast time limit follows the question kind: a passage gets longer than a math fact', () => {
    void open(mainIdeaQ);
    expect(q('reload-timer')!.style.getPropertyValue('--tc-fast-ms')).toBe(
      `${fastWindowMs('mainidea', 5)}ms`,
    );
  });

  describe('answers', () => {
    it('fast right answer: reports it, shows RELOADED! and the big bonus, then resolves', async () => {
      let t = 1000;
      const p = open(mathQ, { now: () => t });
      t = 4000;
      click(q(TEST_IDS.reloadChoice(1)));
      const fb = q('reload-feedback')!;
      expect(fb.textContent).toContain(RELOAD_COPY.reloaded);
      expect(fb.textContent).toContain(RELOAD_COPY.fastBonus);
      let done = false;
      void p.then(() => (done = true));
      s.clock.advance(RELOAD.rightAnswerBeatMs - 1);
      await flush();
      expect(done).toBe(false);
      s.clock.advance(1);
      await expect(p).resolves.toEqual({ correct: true, elapsedMs: 3000, choice: '5' });
    });

    it('fast right answer pops a scrap burst with a caption and a bonus sound', () => {
      let t = 0;
      void open(mathQ, { now: () => t });
      t = 1000;
      click(q(TEST_IDS.reloadChoice(1)));
      const burst = q('reload-feedback')!.querySelector('[data-role="bonus-burst"]')!;
      expect(burst).not.toBeNull();
      expect(burst.textContent).toContain(RELOAD_COPY.bonusPop);
      expect(burst.textContent).toContain(RELOAD_COPY.bonusSound);
      expect(s.sfx).toContain('bonus');
    });

    it('slow and wrong answers get no burst and no bonus sound', () => {
      let t = 0;
      void open(mathQ, { now: () => t });
      t = 9000;
      click(q(TEST_IDS.reloadChoice(1)));
      expect(q('reload-feedback')!.querySelector('[data-role="bonus-burst"]')).toBeNull();
      expect(s.sfx).not.toContain('bonus');
    });

    it('a wrong answer never plays the bonus sound or shows a burst', () => {
      void open();
      click(q(TEST_IDS.reloadChoice(0)));
      expect(q('reload-feedback')!.querySelector('[data-role="bonus-burst"]')).toBeNull();
      expect(s.sfx).not.toContain('bonus');
    });

    it('slow right answer shows the smaller bonus', async () => {
      let t = 0;
      const p = open(mathQ, { now: () => t });
      t = 9000;
      click(q(TEST_IDS.reloadChoice(1)));
      expect(q('reload-feedback')!.textContent).toContain(RELOAD_COPY.slowCorrect);
      expect(q('reload-feedback')!.textContent).not.toContain(RELOAD_COPY.fastBonus);
      s.clock.advance(RELOAD.rightAnswerBeatMs);
      expect((await p).elapsedMs).toBe(9000);
    });

    it('exactly fastMs counts as slow (strictly under is fast)', () => {
      let t = 0;
      void open(mathQ, { now: () => t });
      t = RELOAD.fastMs;
      click(q(TEST_IDS.reloadChoice(1)));
      expect(q('reload-feedback')!.textContent).toContain(RELOAD_COPY.slowCorrect);
    });

    it('one ms under fastMs is fast', () => {
      let t = 0;
      void open(mathQ, { now: () => t });
      t = RELOAD.fastMs - 1;
      click(q(TEST_IDS.reloadChoice(1)));
      expect(q('reload-feedback')!.textContent).toContain(RELOAD_COPY.fastBonus);
    });

    it('wrong answer: kind message, shows the right answer, reloads anyway, never blocks', async () => {
      const p = open();
      click(q(TEST_IDS.reloadChoice(0)));
      const fb = q('reload-feedback')!.textContent!;
      expect(fb).toContain(RELOAD_COPY.wrong('5'));
      expect(fb).toContain(RELOAD_COPY.wrongReloaded);
      expect(q(TEST_IDS.reloadChoice(1))!.getAttribute('data-state')).toBe('right');
      expect(q(TEST_IDS.reloadChoice(0))!.getAttribute('data-state')).toBe('tried');
      click(q(TEST_IDS.reloadNext)); // ignored: too soon after the tap
      let done = false;
      void p.then(() => (done = true));
      s.clock.advance(RELOAD.gotItDelayMs);
      await flush();
      expect(done).toBe(false);
      click(q(TEST_IDS.reloadNext));
      await expect(p).resolves.toEqual({
        correct: false,
        elapsedMs: expect.any(Number),
        choice: '3',
      });
    });

    it('wrong answer stays up past the old 1.8 s, until Got it is tapped', async () => {
      const p = open();
      click(q(TEST_IDS.reloadChoice(0)));
      let done = false;
      void p.then(() => (done = true));
      s.clock.advance(RELOAD.wrongAnswerMaxMs - 1);
      await flush();
      expect(done).toBe(false);
      expect(q(TEST_IDS.reloadModal)).not.toBeNull();
      s.clock.advance(1);
      await p; // a safety timer still closes it, so play is never blocked
      expect(q(TEST_IDS.reloadModal)).toBeNull();
    });

    it('wrong answer shows the hint as the why, even if the hint was never opened', () => {
      void open(mathQ);
      click(q(TEST_IDS.reloadChoice(0)));
      expect(q('reload-why')!.textContent).toContain(mathQ.hint);
    });

    it('wrong answer on a question with no hint shows no why line', () => {
      void open(vocabQ);
      click(q(TEST_IDS.reloadChoice(1)));
      expect(q('reload-why')).toBeNull();
    });

    it('Got it is a 56px button that takes focus after an answer and works with Enter', async () => {
      const p = open();
      click(q(TEST_IDS.reloadChoice(1)));
      const next = q<HTMLButtonElement>(TEST_IDS.reloadNext)!;
      expect(next.textContent).toBe(RELOAD_COPY.gotIt);
      expect(next.classList.contains('tc-btn')).toBe(true);
      expect(document.activeElement).toBe(next);
      s.clock.advance(RELOAD.gotItDelayMs);
      click(next);
      await expect(p).resolves.toMatchObject({ correct: true });
    });

    it('there is no Got it button before an answer', () => {
      void open();
      expect(q(TEST_IDS.reloadNext)).toBeNull();
    });

    it('wrong answer never uses scary words or the word wrong in the shown message', () => {
      void open();
      click(q(TEST_IDS.reloadChoice(0)));
      expect(q('reload-feedback')!.textContent).not.toMatch(/wrong|fail|bad|incorrect/i);
    });

    it('a second tap is ignored, so there is one answer', async () => {
      let t = 0;
      const p = open(mathQ, { now: () => t });
      t = 1000;
      click(q(TEST_IDS.reloadChoice(1)));
      t = 2000;
      click(q(TEST_IDS.reloadChoice(0)));
      s.clock.advance(RELOAD.rightAnswerBeatMs);
      await expect(p).resolves.toEqual({ correct: true, elapsedMs: 1000, choice: '5' });
    });

    it('choices are disabled after an answer', () => {
      void open();
      click(q(TEST_IDS.reloadChoice(1)));
      for (let i = 0; i < 4; i++) {
        expect(q<HTMLButtonElement>(TEST_IDS.reloadChoice(i))!.getAttribute('aria-disabled')).toBe(
          'true',
        );
      }
    });

    it('removes all question DOM, restores the board, and clears the flag', async () => {
      const p = open();
      click(q(TEST_IDS.reloadChoice(1)));
      s.clock.advance(RELOAD.rightAnswerBeatMs);
      await p;
      expect(q(TEST_IDS.reloadModal)).toBeNull();
      expect(document.body.textContent).not.toContain('3x + 5');
      expect(s.overlay.cover).toBeNull();
      expect(document.body.dataset.cover).toBeUndefined();
      expectBoardShown();
    });

    it('also works after a wrong answer: everything is cleaned up', async () => {
      const p = open();
      click(q(TEST_IDS.reloadChoice(3)));
      s.clock.advance(RELOAD.gotItDelayMs);
      click(q(TEST_IDS.reloadNext));
      await p;
      expect(q(TEST_IDS.reloadModal)).toBeNull();
      expect(document.body.dataset.cover).toBeUndefined();
      expectBoardShown();
    });

    it('number keys 1 to 4 pick a choice', async () => {
      const p = open();
      key(document, '2');
      s.clock.advance(RELOAD.rightAnswerBeatMs);
      await expect(p).resolves.toMatchObject({ choice: '5', correct: true });
    });

    it('a key that is not 1 to 4 does nothing, and Escape cannot dismiss it', () => {
      void open();
      key(document, 'Escape');
      key(document, '9');
      expect(q(TEST_IDS.reloadModal)).not.toBeNull();
    });

    it('plays a clunk for a right answer and a boing for a wrong one', async () => {
      const first = open();
      click(q(TEST_IDS.reloadChoice(1)));
      expect(s.sfx).toContain('clunk');
      s.clock.advance(RELOAD.rightAnswerBeatMs);
      await first;
      s.sfx.length = 0;
      void s.overlay.showReloadModal({ question: vocabQ, team: 'FUTURE', playerName: 'Sam' });
      click(q(TEST_IDS.reloadChoice(1)));
      expect(s.sfx).toContain('boing');
    });

    it('treats a bad clock as slow but still resolves', async () => {
      const p = open(mathQ, { now: () => Number.NaN });
      click(q(TEST_IDS.reloadChoice(1)));
      s.clock.advance(RELOAD.rightAnswerBeatMs);
      const a = await p;
      expect(a.correct).toBe(true);
      expect(Number.isFinite(a.elapsedMs)).toBe(true);
    });
  });

  it("shows Chrono's line for a fast, a slow, and a wrong answer", () => {
    const quip = (k: string) => `quip:${k}`;
    let t = 0;
    void open(mathQ, { quip, now: () => t });
    t = 1000;
    click(q(TEST_IDS.reloadChoice(1)));
    expect(q('reload-feedback')!.textContent).toContain('quip:fast');
    s = setup();
    void open(mathQ, { quip, now: () => t });
    t = 0;
    t = 60000;
    click(q(TEST_IDS.reloadChoice(1)));
    expect(q('reload-feedback')!.textContent).toContain('quip:slow');
    s = setup();
    void open(mathQ, { quip });
    click(q(TEST_IDS.reloadChoice(0)));
    expect(q('reload-feedback')!.textContent).toContain('quip:wrong');
  });

  it('puts the player name in as text only', () => {
    void open(mathQ, { playerName: '<b>Alex</b>' });
    expect(q(TEST_IDS.reloadModal)!.querySelector('b')).toBeNull();
  });

  it('gives focus back to what had it before', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const p = open();
    click(q(TEST_IDS.reloadChoice(1)));
    s.clock.advance(RELOAD.rightAnswerBeatMs);
    await p;
    expect(document.activeElement).toBe(outside);
  });

  it('works when the pop animation is reduced', () => {
    s = setup({ settings: { reducedMotion: 'on' } });
    void open();
    expect(q(TEST_IDS.reloadModal)!.getAttribute('data-motion')).toBe('reduced');
    expect(TIMING.modalPopMs).toBeGreaterThan(0);
  });
});

describe('pass-the-mouse cover picture', () => {
  it('shows a picture of passing the mouse, hidden from screen readers, with the words kept', () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const art = q(TEST_IDS.passScreen)!.querySelector('svg.tc-pass-art');
    expect(art).not.toBeNull();
    expect(art!.getAttribute('aria-hidden')).toBe('true');
    expect(art!.hasAttribute('hidden')).toBe(false);
    expect(art!.querySelector('text')).toBeNull();
    expect(q(TEST_IDS.passScreen)!.textContent).toContain(PASS_SCREEN.upNext('Sam'));
  });

  it('draws one picture for the other team too', () => {
    void s.overlay.showPassScreen({ nextName: 'Alex', nextTeam: 'PAST' });
    expect(q(TEST_IDS.passScreen)!.querySelectorAll('svg.tc-pass-art')).toHaveLength(1);
  });
});

describe('cover stack', () => {
  it('a second cover on top reports itself, and the first returns when it closes', async () => {
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const r = s.overlay.showReloadModal({ question: mathQ, team: 'PAST', playerName: 'Alex' });
    expect(s.overlay.cover).toBe('reload');
    click(q(TEST_IDS.reloadChoice(1)));
    s.clock.advance(RELOAD.rightAnswerBeatMs);
    await r;
    expect(s.overlay.cover).toBe('pass');
    expect(document.body.dataset.cover).toBe('pass');
    expectBoardHidden();
  });
});
