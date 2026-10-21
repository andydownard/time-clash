// @vitest-environment jsdom
// The Computer player's picture, its thinking note, and how the battle bar names it.
import { beforeEach, describe, expect, it } from 'vitest';
import { COMPUTER, computerTurnBanner } from '../../src/data/computerCopy';
import { HUD, turnBanner } from '../../src/data/copy';
import { PRACTICE_BOT } from '../../src/game/config';
import { COMPUTER_IDS, computerFace } from '../../src/ui/computerPlayer';
import type { HudState } from '../../src/ui/types';
import { q, qa, setup } from './helpers';

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const hud = (over: Partial<HudState> = {}): HudState => ({
  activeTeam: 'FUTURE',
  names: { PAST: 'Alex', FUTURE: PRACTICE_BOT.displayName },
  baseHp: { PAST: 100, FUTURE: 100 },
  scrap: { PAST: 0, FUTURE: 0 },
  wind: 0,
  angleDeg: 45,
  power: 60,
  shotsLeft: 2,
  bonus: false,
  canFire: false,
  selected: '1',
  units: [],
  ...over,
});

describe('the Computer player name', () => {
  it('is the config name, and never says bot, AI or assistant anywhere a child reads', () => {
    expect(COMPUTER.name).toBe('Computer player');
    const strings: string[] = [
      ...(Object.values(COMPUTER) as unknown[]).filter((v): v is string => typeof v === 'string'),
      ...Object.values(COMPUTER.levels),
      COMPUTER.readBack('Hard'),
      computerTurnBanner(1),
      computerTurnBanner('POWER'),
    ];
    for (const text of strings) expect(text).not.toMatch(/\b(bot|ai|assistant)\b/i);
  });
});

describe('the picture', () => {
  it('draws a robot for Team Future and a helmet for Team Past, from shapes, no emoji', () => {
    const robot = computerFace(document, 'FUTURE');
    const helmet = computerFace(document, 'PAST');
    for (const svg of [robot, helmet]) {
      expect(svg.localName).toBe('svg');
      expect(svg.querySelectorAll('circle,path,rect').length).toBeGreaterThan(4);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.outerHTML).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(robot.innerHTML).not.toBe(helmet.innerHTML);
    expect(computerFace(document, 'FUTURE', true).getAttribute('class')).toContain('small');
  });
});

describe('the thinking note', () => {
  it('shows who is thinking, politely, and goes away', () => {
    s.overlay.showThinking({ text: COMPUTER.thinking, team: 'FUTURE' });
    const note = q(COMPUTER_IDS.thinking)!;
    expect(note.textContent).toContain(COMPUTER.thinking);
    expect(note.getAttribute('role')).toBe('status');
    expect(note.querySelector('svg')).not.toBeNull();
    // A second call updates the same note instead of stacking.
    s.overlay.showThinking({ text: COMPUTER.aiming, team: 'FUTURE' });
    expect(qa('[data-testid="computer-thinking"]')).toHaveLength(1);
    expect(q(COMPUTER_IDS.thinking)!.textContent).toContain(COMPUTER.aiming);
    s.overlay.showThinking(null);
    expect(q(COMPUTER_IDS.thinking)).toBeNull();
  });
});

describe('the battle bar for the Computer player', () => {
  it('names it and never says "Your turn" for it', () => {
    s.overlay.showHud({ onAim() {}, onFire() {}, onMuteToggle() {}, onSelect() {} });
    s.overlay.updateHud(hud({ computerTeam: 'FUTURE' }));
    const text = document.body.textContent ?? '';
    expect(text).toContain('Computer player');
    expect(text).toContain(computerTurnBanner(1));
    expect(text).toContain(COMPUTER.playingNow);
    expect(text).not.toContain(HUD.yourTurn);
    expect(text).not.toContain(turnBanner('Computer player', 1));
    s.overlay.updateHud(hud({ computerTeam: 'FUTURE', bonus: true }));
    expect(document.body.textContent).toContain(computerTurnBanner('POWER'));
  });

  it('without a computer, the bar says "Your turn" as before', () => {
    s.overlay.showHud({ onAim() {}, onFire() {}, onMuteToggle() {}, onSelect() {} });
    s.overlay.updateHud(
      hud({ activeTeam: 'PAST', names: { PAST: 'Alex', FUTURE: 'Sam' }, canFire: true }),
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain(HUD.yourTurn);
    expect(text).toContain(turnBanner('Alex', 1));
    expect(text).not.toContain(COMPUTER.playingNow);
  });
});
