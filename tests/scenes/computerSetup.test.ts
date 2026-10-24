// @vitest-environment jsdom
// Setup and the battle hand-off with the Computer player (behind PRACTICE_BOT.enabled / ?computer=1).
import { beforeEach, describe, expect, it } from 'vitest';
import { COMPUTER } from '../../src/data/computerCopy';
import { PRACTICE_BOT } from '../../src/game/config';
import { SCENE_KEYS } from '../../src/scenes/registry';
import { runCampStep, runSetupStep } from '../../src/scenes/steps';
import { COMPUTER_IDS } from '../../src/ui/computerPlayer';
import { TEST_IDS } from '../../src/ui/types';
import { click, flush, q } from '../ui/helpers';
import { makeServices, tinyBank } from './fakes';
import type { BattleSceneData } from '../../src/scenes/battle/types';

let t: ReturnType<typeof makeServices>;
beforeEach(() => {
  t = makeServices();
});

describe("flag off: Setup is exactly today's Setup", () => {
  it('the config flag is off', () => {
    expect(PRACTICE_BOT.enabled).toBe(false);
  });
  it('shows no Play with row, no computer card and no How hard?', async () => {
    const p = runSetupStep(t.services);
    expect(q(COMPUTER_IDS.playWithComputer)).toBeNull();
    expect(q(COMPUTER_IDS.playWithPerson)).toBeNull();
    expect(q(COMPUTER_IDS.card)).toBeNull();
    expect(q(COMPUTER_IDS.level('hard'))).toBeNull();
    expect(document.body.textContent).not.toContain(COMPUTER.computerPlayer);
    expect(document.body.textContent).not.toContain(COMPUTER.howHard);
    click(q(TEST_IDS.setupNext));
    await p;
  });
  it('saves nothing about the computer and a saved choice is ignored at the Camp', async () => {
    t.storage.set('timeclash.practice', { opponent: 'computer', level: 'hard' });
    const p = runSetupStep(t.services);
    click(q(TEST_IDS.setupNext));
    await p;
    expect(t.storage.get('timeclash.practice')).toEqual({ opponent: 'computer', level: 'hard' });
    expect(t.storage.get('timeclash.players')![1].name).not.toBe(COMPUTER.name);
    t.services.session.bank = tinyBank;
    const p2 = runCampStep(t.services);
    await flush();
    click(q(TEST_IDS.campStart));
    await flush();
    click(q(TEST_IDS.planGo)); // Battle Plan: Lock it in!
    const route = await p2;
    expect((route.data as BattleSceneData).practice).toBeUndefined();
  });
});

describe('flag on', () => {
  beforeEach(() => {
    t.services.computerPlayer = true;
  });

  it('offers two big buttons, Another player picked first, and no How hard? yet', async () => {
    const p = runSetupStep(t.services);
    const person = q(COMPUTER_IDS.playWithPerson)!;
    const computer = q(COMPUTER_IDS.playWithComputer)!;
    expect(person.textContent).toBe(COMPUTER.anotherPlayer);
    expect(computer.textContent).toBe(COMPUTER.computerPlayer);
    expect(person.getAttribute('aria-checked')).toBe('true');
    expect(computer.getAttribute('aria-checked')).toBe('false');
    expect(q(COMPUTER_IDS.card)!.hidden).toBe(true);
    expect(q(TEST_IDS.setupName('FUTURE'))).not.toBeNull();
    click(q(TEST_IDS.setupNext));
    const route = await p;
    expect(route).toEqual({ key: SCENE_KEYS.camp });
    expect(t.storage.get('timeclash.practice')).toEqual({ opponent: 'person', level: 'medium' });
    expect(t.storage.get('timeclash.players')![1].name).not.toBe(COMPUTER.name);
  });

  it('Computer player shows How hard? with Medium picked, and hides the second human card', async () => {
    const p = runSetupStep(t.services);
    click(q(COMPUTER_IDS.playWithComputer));
    expect(q(COMPUTER_IDS.card)!.hidden).toBe(false);
    expect(q(COMPUTER_IDS.card)!.textContent).toContain(COMPUTER.name);
    expect(q(COMPUTER_IDS.card)!.textContent).toContain(COMPUTER.howHard);
    expect(q(COMPUTER_IDS.level('medium'))!.getAttribute('aria-checked')).toBe('true');
    expect(q(COMPUTER_IDS.card)!.querySelector('svg')).not.toBeNull();
    const human = q(TEST_IDS.setupName('FUTURE'))!.closest('.tc-team-card') as HTMLElement;
    expect(human.hidden).toBe(true);
    // The read-back line names the Computer player and the level.
    expect(document.body.textContent).toContain('Computer player (Medium)');
    click(q(TEST_IDS.setupNext));
    await p;
  });

  it('saves one human and the Computer player, and remembers the level', async () => {
    const p = runSetupStep(t.services);
    click(q(TEST_IDS.setupGrade('PAST', 4)));
    click(q(TEST_IDS.setupSubject('PAST', 'math')));
    click(q(COMPUTER_IDS.playWithComputer));
    click(q(COMPUTER_IDS.level('hard')));
    click(q(TEST_IDS.setupNext));
    expect(await p).toEqual({ key: SCENE_KEYS.camp });
    const [past, future] = t.storage.get('timeclash.players')!;
    expect(past).toMatchObject({ team: 'PAST', grade: 4, subject: 'math' });
    expect(future).toEqual({ name: COMPUTER.name, team: 'FUTURE', grade: 4, subject: 'math' });
    expect(t.storage.get('timeclash.practice')).toEqual({ opponent: 'computer', level: 'hard' });
  });

  it('does not ask for a second name, even when the hidden name box is empty', async () => {
    const p = runSetupStep(t.services);
    const box = q<HTMLInputElement>(TEST_IDS.setupName('FUTURE'))!;
    box.value = '';
    box.dispatchEvent(new Event('input'));
    click(q(COMPUTER_IDS.playWithComputer));
    click(q(TEST_IDS.setupNext));
    expect(await p).toEqual({ key: SCENE_KEYS.camp });
  });

  it('opens again on the last choice, and never types the computer name into a box', async () => {
    const first = runSetupStep(t.services);
    click(q(COMPUTER_IDS.playWithComputer));
    click(q(COMPUTER_IDS.level('easy')));
    click(q(TEST_IDS.setupNext));
    await first;
    const again = runSetupStep(t.services);
    expect(q(COMPUTER_IDS.playWithComputer)!.getAttribute('aria-checked')).toBe('true');
    expect(q(COMPUTER_IDS.level('easy'))!.getAttribute('aria-checked')).toBe('true');
    expect(q<HTMLInputElement>(TEST_IDS.setupName('FUTURE'))!.value).not.toBe(COMPUTER.name);
    click(q(TEST_IDS.setupNext));
    await again;
  });

  it('the Camp hands the battle a computer run only for a saved Computer player', async () => {
    t.services.session.bank = tinyBank;
    const p = runSetupStep(t.services);
    click(q(COMPUTER_IDS.playWithComputer));
    click(q(COMPUTER_IDS.level('hard')));
    click(q(TEST_IDS.setupNext));
    await p;
    const camp = runCampStep(t.services);
    await flush();
    click(q(TEST_IDS.campStart));
    await flush();
    click(q(TEST_IDS.planGo)); // Battle Plan: Lock it in!
    const route = await camp;
    expect(route.key).toBe(SCENE_KEYS.battle);
    expect((route.data as BattleSceneData).practice).toMatchObject({
      team: 'FUTURE',
      level: 'hard',
    });
  });

  it('Another player leaves the battle with no computer run', async () => {
    t.services.session.bank = tinyBank;
    const p = runSetupStep(t.services);
    click(q(TEST_IDS.setupNext));
    await p;
    const camp = runCampStep(t.services);
    await flush();
    click(q(TEST_IDS.campStart));
    await flush();
    click(q(TEST_IDS.planGo)); // Battle Plan: Lock it in!
    const route = await camp;
    expect((route.data as BattleSceneData).practice).toBeUndefined();
  });

  it('Back from Setup leaves the saved players and choice alone', async () => {
    const first = runSetupStep(t.services);
    click(q(COMPUTER_IDS.playWithComputer));
    click(q(TEST_IDS.setupNext));
    await first;
    const before = t.storage.get('timeclash.practice');
    const again = runSetupStep(t.services);
    click(q(COMPUTER_IDS.playWithPerson));
    click(q(TEST_IDS.setupBack));
    await again;
    expect(t.storage.get('timeclash.practice')).toEqual(before);
  });
});
