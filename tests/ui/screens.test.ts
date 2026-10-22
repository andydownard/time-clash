// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUTTONS,
  INTRO,
  LOADING,
  SETUP,
  TAP_TO_START,
  TEAM_NAMES,
  UI_EXTRA,
  VICTORY,
  VICTORY_CHRONO,
  gradeChipLabel,
} from '../../src/data/copy';
import { INTRO_SCRIPT } from '../../src/data/introScript';
import { CELEBRATE, DEFAULT_NAMES, TIMING } from '../../src/game/config';
import type { Players, TeamStats } from '../../src/game/types';
import { TEST_IDS, Z } from '../../src/ui/types';
import { click, flush, key, q, qa, setup } from './helpers';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

describe('tap to start', () => {
  const handlers = () => {
    const calls: string[] = [];
    return {
      calls,
      onMuteToggle: () => calls.push('mute'),
      onCaptionsToggle: () => calls.push('captions'),
    };
  };

  it('shows a big TAP TO PLAY button and the helper line, at screen level', () => {
    void s.overlay.showTapToStart(handlers());
    const b = q(TEST_IDS.tapToPlay)!;
    expect(b.tagName).toBe('BUTTON');
    expect(b.textContent).toBe(TAP_TO_START.button);
    expect(document.body.textContent).toContain(TAP_TO_START.helper);
    expect(b.closest<HTMLElement>('[data-layer="screen"]')!.style.zIndex).toBe(String(Z.screen));
  });

  it('makes no sound and calls no audio before the tap', () => {
    const unlock = vi.spyOn(s.audio, 'unlock');
    const speak = vi.spyOn(s.audio, 'speak');
    void s.overlay.showTapToStart(handlers());
    expect(unlock).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(s.audio.unlocked).toBe(false);
    expect(s.harness.elements).toHaveLength(0);
    expect(s.harness.speech.spoken).toHaveLength(0);
  });

  it('unlocks sound inside the tap handler, then resolves and goes away', async () => {
    const p = s.overlay.showTapToStart(handlers());
    click(q(TEST_IDS.tapToPlay));
    expect(s.audio.unlocked).toBe(true);
    await p;
    expect(q(TEST_IDS.tapToPlay)).toBeNull();
  });

  it('has a mute toggle and a captions toggle that call their handlers', () => {
    const h = handlers();
    void s.overlay.showTapToStart(h);
    click(q(TEST_IDS.muteToggle));
    click(q(TEST_IDS.captionsToggle));
    expect(h.calls).toEqual(['mute', 'captions']);
  });

  it('toggle labels flip with the state', () => {
    void s.overlay.showTapToStart(handlers());
    expect(q(TEST_IDS.muteToggle)!.textContent).toBe(BUTTONS.soundOn);
    click(q(TEST_IDS.muteToggle));
    expect(q(TEST_IDS.muteToggle)!.textContent).toBe(BUTTONS.soundOff);
    expect(q(TEST_IDS.captionsToggle)!.textContent).toBe(BUTTONS.captionsOn);
    click(q(TEST_IDS.captionsToggle));
    expect(q(TEST_IDS.captionsToggle)!.textContent).toBe(BUTTONS.captionsOff);
  });

  it('works with no audio manager at all', async () => {
    const t = setup({ withAudio: false });
    const p = t.overlay.showTapToStart(handlers());
    click(q(TEST_IDS.tapToPlay));
    await expect(p).resolves.toBeUndefined();
  });

  it('focuses the play button', () => {
    void s.overlay.showTapToStart(handlers());
    expect(document.activeElement).toBe(q(TEST_IDS.tapToPlay));
  });
});

describe('intro screen', () => {
  // unlock() flips `unlocked` synchronously, like a real tap handler.
  const start = () => {
    void s.audio.unlock();
    return s.overlay.showIntro(INTRO_SCRIPT, () => Promise.resolve());
  };

  it('shows card 1, its title, five step dots, and the first caption', async () => {
    void start();
    await flush();
    const card = q(TEST_IDS.introCard)!;
    expect(card.textContent).toContain('Welcome');
    expect(card.textContent).toContain(INTRO.cardOf(1, 5));
    expect(qa('[data-testid="intro-dots"] [data-dot]')).toHaveLength(5);
    expect(q(TEST_IDS.captionBar)!.textContent).toBe('Welcome to Time Clash!');
  });

  it('captions show above the intro screen layer', async () => {
    void start();
    const layer = q(TEST_IDS.captionBar)!.closest<HTMLElement>('[data-layer="caption"]')!;
    expect(Number(layer.style.zIndex)).toBeGreaterThan(Z.screen);
  });

  it('has Skip, Replay, and Mute as real buttons with the right words', async () => {
    void start();
    expect(q(TEST_IDS.introSkip)!.textContent).toBe(INTRO.skip);
    expect(q(TEST_IDS.introReplay)!.textContent).toBe(INTRO.replay);
    expect(q('intro-mute')!.textContent).toBe(INTRO.mute);
    for (const id of [TEST_IDS.introSkip, TEST_IDS.introReplay, 'intro-mute']) {
      expect(q(id)!.tagName).toBe('BUTTON');
    }
  });

  it('plays nothing before the first tap (audio locked), but shows captions', () => {
    const p = s.overlay.showIntro(INTRO_SCRIPT, () => Promise.resolve());
    void p;
    expect(s.harness.elements).toHaveLength(0);
    expect(s.harness.speech.spoken).toHaveLength(0);
    expect(q(TEST_IDS.captionBar)!.textContent).toBe('Welcome to Time Clash!');
  });

  it('Skip stops the voice, resolves skipped, closes, clears captions, remembers it', async () => {
    const p = start();
    await flush();
    click(q(TEST_IDS.introSkip));
    await expect(p).resolves.toBe('skipped');
    expect(q(TEST_IDS.introCard)).toBeNull();
    expect(s.harness.elements[0]!.paused).toBe(true);
    expect(s.storage.get('timeclash.introSeen')).toBe(true);
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
  });

  it('Replay goes back to card 1 and stops the old voice', async () => {
    void start();
    await flush();
    s.clock.advance(INTRO_SCRIPT[0]!.durationMs + 6000);
    await flush();
    expect(q(TEST_IDS.introCard)!.textContent).toContain('Aim');
    click(q(TEST_IDS.introReplay));
    expect(q(TEST_IDS.introCard)!.textContent).toContain('Welcome');
    expect(s.harness.elements[0]!.paused).toBe(true);
  });

  it('cards change in order as the voice finishes, and the dots follow', async () => {
    void start();
    await flush();
    const titles: string[] = [];
    for (let i = 0; i < 4; i++) {
      s.clock.advance(INTRO_SCRIPT[i]!.durationMs + 6000);
      await flush();
      titles.push(q(TEST_IDS.introCard)!.querySelector('[data-role="title"]')!.textContent!);
    }
    expect(titles).toEqual(['Aim', 'Two Shots', 'Reload', 'Wipeouts and Turns']);
    expect(q('intro-dots')!.querySelector('[aria-current="step"]')!.getAttribute('data-dot')).toBe(
      '5',
    );
  });

  it('finishing the last card resolves finished and closes', async () => {
    const p = start();
    await flush();
    for (let i = 0; i < 5; i++) {
      s.clock.advance(INTRO_SCRIPT[i]!.durationMs + 6000);
      await flush();
    }
    await expect(p).resolves.toBe('finished');
    expect(q(TEST_IDS.introCard)).toBeNull();
    expect(s.storage.get('timeclash.introSeen')).toBe(true);
  });

  it('Mute toggles the audio manager and the button text', async () => {
    void start();
    click(q('intro-mute'));
    expect(s.audio.muted).toBe(true);
    expect(q('intro-mute')!.textContent).toBe(INTRO.unmute);
    click(q('intro-mute'));
    expect(s.audio.muted).toBe(false);
  });

  it('a missing voice file falls back to speech and keeps captions', async () => {
    void start();
    await flush();
    s.harness.elements[0]!.onerror?.();
    expect(s.harness.speech.spoken[0]!.text).toBe(INTRO_SCRIPT[0]!.fallbackText);
    s.clock.advance(INTRO_SCRIPT[0]!.captions[1]!.startMs);
    expect(q(TEST_IDS.captionBar)!.textContent).toBe(INTRO_SCRIPT[0]!.captions[1]!.text);
  });

  it('with no audio manager, the play callback sets the pace and captions still run', async () => {
    const t = setup({ withAudio: false });
    let release: () => void = () => undefined;
    const played: number[] = [];
    const p = t.overlay.showIntro(INTRO_SCRIPT, (i) => {
      played.push(i);
      return new Promise<void>((r) => (release = r));
    });
    expect(played).toEqual([0]);
    expect(q(TEST_IDS.captionBar)!.textContent).toBe('Welcome to Time Clash!');
    release();
    await flush();
    expect(played).toEqual([0, 1]);
    click(q(TEST_IDS.introSkip));
    await expect(p).resolves.toBe('skipped');
  });

  describe('motion', () => {
    it('reducedMotion on: no slide animation class', async () => {
      s = setup({ settings: { reducedMotion: 'on' } });
      void start();
      const root = q(TEST_IDS.introCard)!.closest<HTMLElement>('[data-screen="intro"]')!;
      expect(root.getAttribute('data-motion')).toBe('reduced');
      expect(q(TEST_IDS.introCard)!.classList.contains('tc-slide-in')).toBe(false);
    });

    it('reducedMotion off: cards slide in', async () => {
      s = setup({ settings: { reducedMotion: 'off' }, matchMediaReduced: true });
      void start();
      const root = q(TEST_IDS.introCard)!.closest<HTMLElement>('[data-screen="intro"]')!;
      expect(root.getAttribute('data-motion')).toBe('full');
      expect(q(TEST_IDS.introCard)!.classList.contains('tc-slide-in')).toBe(true);
    });

    it('system setting follows the browser preference', async () => {
      s = setup({ settings: { reducedMotion: 'system' }, matchMediaReduced: true });
      void start();
      expect(
        q(TEST_IDS.introCard)!.closest('[data-screen="intro"]')!.getAttribute('data-motion'),
      ).toBe('reduced');
    });

    it('a new card after the first also has no slide class when reduced', async () => {
      s = setup({ settings: { reducedMotion: 'on' } });
      void start();
      await flush();
      s.clock.advance(INTRO_SCRIPT[0]!.durationMs + 6000);
      await flush();
      expect(q(TEST_IDS.introCard)!.classList.contains('tc-slide-in')).toBe(false);
    });
  });
});

describe('loading screen', () => {
  it('shows the first message and 0%', () => {
    s.overlay.showLoading(LOADING.messages);
    expect(q('loading-message')!.textContent).toBe(LOADING.messages[0]);
    expect(q('loading-bar')!.getAttribute('aria-valuenow')).toBe('0');
    expect(document.body.textContent).toContain('0%');
  });

  it('rotates messages every loadingMessageMs', () => {
    s.overlay.showLoading(LOADING.messages);
    s.clock.advance(TIMING.loadingMessageMs);
    expect(q('loading-message')!.textContent).toBe(LOADING.messages[1]);
    s.clock.advance(TIMING.loadingMessageMs * (LOADING.messages.length - 1));
    expect(q('loading-message')!.textContent).toBe(LOADING.messages[0]);
  });

  it('progress updates the bar and the percent, and clamps', () => {
    const h = s.overlay.showLoading(LOADING.messages);
    h.setProgress(0.5);
    expect(q('loading-bar')!.getAttribute('aria-valuenow')).toBe('50');
    expect(document.body.textContent).toContain('50%');
    h.setProgress(7);
    expect(q('loading-bar')!.getAttribute('aria-valuenow')).toBe('100');
    h.setProgress(-3);
    expect(q('loading-bar')!.getAttribute('aria-valuenow')).toBe('0');
    h.setProgress(Number.NaN);
    expect(q('loading-bar')!.getAttribute('aria-valuenow')).toBe('0');
  });

  it('error shows the friendly text and a Retry button; Retry resolves and hides the error', async () => {
    const h = s.overlay.showLoading(LOADING.messages);
    const p = h.showError();
    const err = q('loading-error')!;
    expect(err.textContent).toContain(LOADING.errorTitle);
    expect(err.textContent).toContain(LOADING.errorBody);
    expect(q(TEST_IDS.loadingRetry)!.textContent).toBe(LOADING.errorButton);
    click(q(TEST_IDS.loadingRetry));
    await p;
    expect(q('loading-error')).toBeNull();
    expect(q(TEST_IDS.loadingRetry)).toBeNull();
  });

  it('can fail and retry more than once', async () => {
    const h = s.overlay.showLoading(LOADING.messages);
    for (let i = 0; i < 3; i++) {
      const p = h.showError();
      click(q(TEST_IDS.loadingRetry));
      await p;
    }
    expect(q(TEST_IDS.loadingRetry)).toBeNull();
  });

  it('close removes the screen and stops all timers', () => {
    const h = s.overlay.showLoading(LOADING.messages);
    h.close();
    expect(q('loading-bar')).toBeNull();
    expect(s.clock.pending()).toBe(0);
    h.close();
  });

  it('close while an error is showing still resolves Retry so no caller hangs', async () => {
    const h = s.overlay.showLoading(LOADING.messages);
    const p = h.showError();
    h.close();
    await expect(p).resolves.toBeUndefined();
  });

  it('works with an empty message list', () => {
    expect(() => s.overlay.showLoading([])).not.toThrow();
  });
});

describe('setup screen', () => {
  const field = (team: 'PAST' | 'FUTURE') => q<HTMLInputElement>(TEST_IDS.setupName(team))!;
  const type = (team: 'PAST' | 'FUTURE', v: string) => {
    field(team).value = v;
    field(team).dispatchEvent(new Event('input', { bubbles: true }));
  };
  const next = () => click(q(TEST_IDS.setupNext));

  it('shows two team cards with names prefilled from the defaults', () => {
    void s.overlay.showSetup(null);
    expect(field('PAST').value).toBe(DEFAULT_NAMES.PAST);
    expect(field('FUTURE').value).toBe(DEFAULT_NAMES.FUTURE);
    expect(document.body.textContent).toContain(TEAM_NAMES.PAST);
    expect(document.body.textContent).toContain(TEAM_NAMES.FUTURE);
    expect(document.body.textContent).toContain(SETUP.heading);
    expect(document.body.textContent).toContain(SETUP.gradeHelper);
  });

  it('says that each team picks its own grade, and what Both means', () => {
    expect(SETUP.gradeHelper).toBe(
      'Each team gets questions for its own grade. That keeps it fair.',
    );
    expect(SETUP.subjectHelper).toBe('Both mixes reading and math.');
    void s.overlay.showSetup(null);
    const text = document.body.textContent!;
    expect(text).toContain(SETUP.subjectHelper);
    expect(text.split(SETUP.subjectHelper).length - 1).toBe(2); // once per team card
  });

  it('offers multiplication to Team Past and division to Team Future, both start off', async () => {
    const p = s.overlay.showSetup(null);
    const chip = q(TEST_IDS.setupTopic('PAST', 'multiplication'))!;
    const divChip = q(TEST_IDS.setupTopic('FUTURE', 'division'))!;
    expect(chip.getAttribute('aria-checked')).toBe('false');
    expect(divChip.getAttribute('aria-checked')).toBe('false');
    expect(divChip.textContent).toBe('Focus: Division');
    expect(q(TEST_IDS.setupTopic('FUTURE', 'multiplication'))).toBeNull();
    expect(q(TEST_IDS.setupTopic('PAST', 'division'))).toBeNull();
    next();
    const players = await p;
    expect(players[0]).not.toHaveProperty('topic');
    expect(players[1]).not.toHaveProperty('topic');
  });

  it('turns the division focus on for Team Future and hands it to the game', async () => {
    const p = s.overlay.showSetup(null);
    click(q(TEST_IDS.setupTopic('FUTURE', 'division')));
    expect(q(TEST_IDS.setupTopic('FUTURE', 'division'))!.getAttribute('aria-checked')).toBe('true');
    expect(q(TEST_IDS.setupTopic('PAST', 'multiplication'))!.getAttribute('aria-checked')).toBe(
      'false',
    );
    next();
    const players = await p;
    expect(players[1].topic).toBe('division');
    expect(players[0]).not.toHaveProperty('topic');
  });

  it('turns the focus on and off, keeps it with different grades, and hands it to the game', async () => {
    const p = s.overlay.showSetup(null);
    click(q(TEST_IDS.setupGrade('PAST', 3)));
    click(q(TEST_IDS.setupGrade('FUTURE', 8)));
    const chip = q(TEST_IDS.setupTopic('PAST', 'multiplication'))!;
    click(chip);
    expect(chip.getAttribute('aria-checked')).toBe('true');
    click(chip);
    expect(chip.getAttribute('aria-checked')).toBe('false');
    click(chip);
    next();
    const players = await p;
    expect(players[0].topic).toBe('multiplication');
    expect([players[0].grade, players[1].grade]).toEqual([3, 8]);
  });

  it('shows a saved focus as on', () => {
    const players: Players = [
      { name: 'Alex', team: 'PAST', grade: 3, subject: 'math', topic: 'multiplication' },
      { name: 'Sam', team: 'FUTURE', grade: 8, subject: 'math' },
    ];
    void s.overlay.showSetup(players);
    expect(q(TEST_IDS.setupTopic('PAST', 'multiplication'))!.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('shows saved players when given', () => {
    const players: Players = [
      { name: 'Alex', team: 'PAST', grade: 2, subject: 'reading' },
      { name: 'Sam', team: 'FUTURE', grade: 8, subject: 'math' },
    ];
    void s.overlay.showSetup(players);
    expect(field('PAST').value).toBe('Alex');
    expect(q(TEST_IDS.setupGrade('FUTURE', 8))!.getAttribute('aria-checked')).toBe('true');
    expect(q(TEST_IDS.setupSubject('PAST', 'reading'))!.getAttribute('aria-checked')).toBe('true');
  });

  it('has 13 grade chips per team labelled K and 1 to 12, and 3 subject chips', () => {
    void s.overlay.showSetup(null);
    const chips = qa('[data-testid^="setup-grade-PAST-"]');
    expect(chips).toHaveLength(13);
    expect(chips[0]!.textContent).toBe('K');
    expect(chips[12]!.textContent).toBe('12');
    expect(chips[0]!.getAttribute('aria-label')).toBe(gradeChipLabel(0));
    expect(qa('[data-testid^="setup-subject-FUTURE-"]')).toHaveLength(3);
  });

  it('resolves with validated players in Past, Future order', async () => {
    const p = s.overlay.showSetup(null);
    type('PAST', '  Alex ');
    type('FUTURE', 'Sam');
    click(q(TEST_IDS.setupGrade('PAST', 0)));
    click(q(TEST_IDS.setupGrade('FUTURE', 12)));
    click(q(TEST_IDS.setupSubject('PAST', 'reading')));
    click(q(TEST_IDS.setupSubject('FUTURE', 'math')));
    next();
    await expect(p).resolves.toEqual([
      { name: 'Alex', team: 'PAST', grade: 0, subject: 'reading' },
      { name: 'Sam', team: 'FUTURE', grade: 12, subject: 'math' },
    ]);
    expect(q(TEST_IDS.setupNext)).toBeNull();
  });

  it('selecting a chip unselects the others', () => {
    void s.overlay.showSetup(null);
    click(q(TEST_IDS.setupGrade('PAST', 5)));
    click(q(TEST_IDS.setupGrade('PAST', 6)));
    const checked = qa('[data-testid^="setup-grade-PAST-"][aria-checked="true"]');
    expect(checked).toHaveLength(1);
    expect(checked[0]!.textContent).toBe('6');
  });

  it('arrow keys move through grade chips', () => {
    void s.overlay.showSetup(null);
    click(q(TEST_IDS.setupGrade('PAST', 5)));
    key(q(TEST_IDS.setupGrade('PAST', 5))!, 'ArrowRight');
    expect(q(TEST_IDS.setupGrade('PAST', 6))!.getAttribute('aria-checked')).toBe('true');
    key(q(TEST_IDS.setupGrade('PAST', 6))!, 'ArrowLeft');
    key(q(TEST_IDS.setupGrade('PAST', 5))!, 'ArrowLeft');
    expect(q(TEST_IDS.setupGrade('PAST', 4))!.getAttribute('aria-checked')).toBe('true');
  });

  it('arrow keys stop at the ends', () => {
    void s.overlay.showSetup(null);
    click(q(TEST_IDS.setupGrade('PAST', 0)));
    key(q(TEST_IDS.setupGrade('PAST', 0))!, 'ArrowLeft');
    expect(q(TEST_IDS.setupGrade('PAST', 0))!.getAttribute('aria-checked')).toBe('true');
  });

  it('an empty name shows the friendly message, does not resolve, and focuses the field', async () => {
    let done = false;
    void s.overlay.showSetup(null).then(() => (done = true));
    type('FUTURE', '   ');
    next();
    await flush();
    expect(done).toBe(false);
    expect(q(TEST_IDS.setupName('FUTURE'))).not.toBeNull();
    expect(q('setup-error-FUTURE')!.textContent).toBe(SETUP.nameEmpty);
    expect(q('setup-error-FUTURE')!.getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(field('FUTURE'));
    expect(field('FUTURE').getAttribute('aria-invalid')).toBe('true');
    expect(q('setup-error-PAST')!.textContent).toBe('');
  });

  it('a name over 12 characters is refused', () => {
    void s.overlay.showSetup(null);
    type('PAST', 'abcdefghijklm');
    next();
    expect(q('setup-error-PAST')!.textContent).toBe(SETUP.nameTooLong);
  });

  it('a blocked name is refused with a gentle message', () => {
    void s.overlay.showSetup(null);
    type('PAST', 'Kill');
    next();
    expect(q('setup-error-PAST')!.textContent).toBe(SETUP.nameBlocked);
  });

  it('fixing the name clears the error and then resolves', async () => {
    const p = s.overlay.showSetup(null);
    type('PAST', '');
    next();
    type('PAST', 'Jo');
    expect(q('setup-error-PAST')!.textContent).toBe('');
    next();
    const players = await p;
    expect(players[0].name).toBe('Jo');
  });

  it('Enter in a name field submits the form', async () => {
    const p = s.overlay.showSetup(null);
    field('PAST')
      .closest('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await expect(p).resolves.toHaveLength(2);
  });

  it('Next button says "Let\'s clash!" and the name fields are labelled', () => {
    void s.overlay.showSetup(null);
    expect(q(TEST_IDS.setupNext)!.textContent).toBe(SETUP.start);
    expect(field('PAST').getAttribute('maxlength')).toBe('12');
    const labelId = field('PAST').getAttribute('aria-labelledby') ?? field('PAST').id;
    expect(labelId).toBeTruthy();
  });

  it('Clear my data asks first, then wipes timeclash keys and resets the form', async () => {
    s.storage.set('timeclash.introSeen', true);
    s.storage.set('timeclash.settings', { ...s.settings, volume: 0.1 });
    void s.overlay.showSetup([
      { name: 'Alex', team: 'PAST', grade: 2, subject: 'reading' },
      { name: 'Sam', team: 'FUTURE', grade: 8, subject: 'math' },
    ]);
    click(q('clear-data'));
    expect(document.body.textContent).toContain(UI_EXTRA.clearDataAsk);
    expect(s.storage.get('timeclash.introSeen')).toBe(true);
    click(q('clear-data-no'));
    expect(s.storage.get('timeclash.introSeen')).toBe(true);
    click(q('clear-data'));
    click(q('clear-data-yes'));
    expect(s.storage.get('timeclash.introSeen')).toBeNull();
    expect(s.storage.get('timeclash.settings')).toBeNull();
    expect(field('PAST').value).toBe(DEFAULT_NAMES.PAST);
    expect(document.body.textContent).toContain(UI_EXTRA.clearDataDone);
  });

  it('names go in as text and values, never markup', () => {
    void s.overlay.showSetup([
      { name: '<img src=x>', team: 'PAST', grade: 2, subject: 'both' },
      { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'both' },
    ]);
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('victory screen', () => {
  const stats = (n: number, fast: number | null): TeamStats => ({
    shotsFired: n,
    directHits: 2,
    nearHits: 1,
    questionsAnswered: 3,
    correctAnswers: 2,
    fastestAnswerMs: fast,
    scrapEarned: 5,
  });
  const opts = {
    winner: 'PAST' as const,
    names: { PAST: 'Alex', FUTURE: 'Sam' },
    stats: { PAST: stats(8, 2500), FUTURE: stats(7, null) },
  };

  it('names the winner and gives Chrono a line that fits the match', () => {
    void s.overlay.showVictory(opts);
    const v = q(TEST_IDS.victory)!;
    expect(v.textContent).toContain(VICTORY.heading('Alex'));
    // Both sides landed 3 hits: a close match. The dignity line is the losing fighter's, on the canvas.
    expect(v.textContent).toContain(VICTORY_CHRONO.close);
    expect(v.textContent).not.toContain(VICTORY.goodSport);
    expect(v.textContent).toContain(VICTORY.wipeout);
  });

  it('gives every player at least one award, and never ranks them side by side', () => {
    void s.overlay.showVictory(opts);
    const v = q(TEST_IDS.victory)!;
    for (const team of ['PAST', 'FUTURE'] as const) {
      const card = v.querySelector(`[data-award-team="${team}"]`)!;
      expect(card).not.toBeNull();
      expect(card.querySelectorAll('li').length).toBeGreaterThan(0);
      for (const li of card.querySelectorAll('li')) {
        expect(Object.values(VICTORY.awards)).toContain(li.textContent);
      }
    }
    expect(v.textContent).toContain(VICTORY.awardsHeading);
    expect(v.querySelector('table')).toBeNull();
    expect(v.textContent).not.toContain('Right answers');
    expect(v.textContent).not.toContain('Fastest answer');
  });

  it("puts Chrono's line in a Chrono speech bubble", () => {
    void s.overlay.showVictory(opts);
    const bubble = q(TEST_IDS.victory)!.querySelector('[data-role="chrono-says"]')!;
    expect(bubble.textContent).toContain(UI_EXTRA.chronoName);
    expect(bubble.textContent).toContain(VICTORY_CHRONO.close);
    expect(bubble.getAttribute('role')).toBe('status');
  });

  it('Rematch is the biggest button on the screen', () => {
    void s.overlay.showVictory(opts);
    expect(q(TEST_IDS.rematch)!.classList.contains('tc-btn-big')).toBe(true);
    expect(q(TEST_IDS.backToCamp)!.classList.contains('tc-btn-big')).toBe(false);
  });

  it('Rematch resolves rematch', async () => {
    const p = s.overlay.showVictory(opts);
    click(q(TEST_IDS.rematch));
    await expect(p).resolves.toBe('rematch');
    expect(q(TEST_IDS.victory)).toBeNull();
  });

  it('Back to Camp resolves back-to-camp', async () => {
    const p = s.overlay.showVictory(opts);
    click(q(TEST_IDS.backToCamp));
    await expect(p).resolves.toBe('back-to-camp');
  });

  it('button words match the vocabulary table', () => {
    void s.overlay.showVictory(opts);
    expect(q(TEST_IDS.rematch)!.textContent).toBe(VICTORY.rematch);
    expect(q(TEST_IDS.backToCamp)!.textContent).toBe(VICTORY.backToCamp);
    expect(q(TEST_IDS.victory)!.textContent).not.toMatch(/menu|defeat|retry|play again/i);
  });

  it('plays the cheer once', () => {
    void s.overlay.showVictory(opts);
    expect(s.sfx.filter((n) => n === 'cheer')).toHaveLength(1);
  });

  it('throws confetti that is decoration only and stays out of the layout', () => {
    void s.overlay.showVictory(opts);
    const c = q(TEST_IDS.victory)!.querySelector('[data-role="confetti"]')!;
    expect(c).not.toBeNull();
    expect(c.getAttribute('aria-hidden')).toBe('true');
    expect(c.querySelectorAll('.tc-confetti-bit')).toHaveLength(CELEBRATE.confettiCount);
    expect(c.textContent).toBe('');
  });

  it('puts names in as text', () => {
    void s.overlay.showVictory({ ...opts, names: { PAST: '<b>A</b>', FUTURE: 'S' } });
    expect(q(TEST_IDS.victory)!.querySelector('b')).toBeNull();
  });
});

describe('settings and misc', () => {
  it('mount twice does not duplicate layers', () => {
    s.overlay.mount(s.root, s.canvas);
    expect(qa('[data-layer="cover"]')).toHaveLength(1);
  });

  it('every button and input in a screen is one of the sized components', async () => {
    void s.overlay.showSetup(null);
    const allowed = ['tc-btn', 'tc-chip', 'tc-input', 'tc-choice', 'tc-icon-btn', 'tc-range'];
    const bad = qa('button, input').filter((el) => !allowed.some((c) => el.classList.contains(c)));
    expect(bad.map((b) => b.outerHTML)).toEqual([]);
  });
});
