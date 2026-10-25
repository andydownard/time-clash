import { describe, expect, it } from 'vitest';
import { SETUP } from '../../src/data/copy';
import { validatePlayerName, validateSetup } from '../../src/ui/setupForm';

describe('validatePlayerName', () => {
  it('accepts a normal name and trims it', () => {
    expect(validatePlayerName('  Alex  ')).toEqual({ ok: true, name: 'Alex' });
  });

  it('accepts exactly 1 and exactly 12 characters', () => {
    expect(validatePlayerName('A').ok).toBe(true);
    expect(validatePlayerName('Abcdefghijkl').ok).toBe(true);
  });

  it('rejects 13 characters with the friendly message', () => {
    const r = validatePlayerName('Abcdefghijklm');
    expect(r).toEqual({ ok: false, reason: 'too-long', message: SETUP.nameTooLong });
  });

  it('rejects empty and whitespace-only', () => {
    expect(validatePlayerName('')).toEqual({
      ok: false,
      reason: 'empty',
      message: SETUP.nameEmpty,
    });
    expect(validatePlayerName('   \t ').ok).toBe(false);
  });

  it('measures length after trimming, not before', () => {
    expect(validatePlayerName('   Abcdefghijkl   ').ok).toBe(true);
  });

  it('counts emoji as one character each', () => {
    expect(validatePlayerName('🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉').ok).toBe(true);
    expect(validatePlayerName('🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉🐉').ok).toBe(false);
  });

  it('does not throw on non-strings', () => {
    expect(validatePlayerName(undefined as unknown as string).ok).toBe(false);
    expect(validatePlayerName(null as unknown as string).ok).toBe(false);
    expect(validatePlayerName(42 as unknown as string).ok).toBe(false);
  });

  describe('blocklist', () => {
    // ROT13 keeps the words out of plain sight in the repo. Decoded here for the test.
    const rot = (s: string) =>
      s.replace(/[a-z]/gi, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      });
    const blocked = { ok: false, reason: 'blocked', message: SETUP.nameBlocked };

    it.each(['fuvg', 'shpx', 'ovgpu', 'qnza', 'uryy', 'nff', 'ONFGNEQ'])(
      'rejects %s',
      (encoded) => {
        expect(validatePlayerName(rot(encoded))).toEqual(blocked);
      },
    );

    it('rejects shouting, spaced-out, and number-swapped versions', () => {
      expect(validatePlayerName(rot('SHPX'))).toEqual(blocked);
      expect(validatePlayerName(rot('shpx').split('').join(' '))).toEqual(blocked);
      expect(validatePlayerName('5h1t')).toEqual(blocked);
      expect(validatePlayerName('sh!t'.replace('!', '1'))).toEqual(blocked);
    });

    it('rejects a bad word inside a longer name', () => {
      expect(validatePlayerName('xx' + rot('shpx') + 'xx')).toEqual(blocked);
    });

    it('rejects the game-tone words as names', () => {
      for (const w of ['Kill', 'DEAD', 'blood', 'gore', 'Die', 'defeat']) {
        expect(validatePlayerName(w).ok).toBe(false);
      }
    });

    it('does not block innocent names that contain short bad letters', () => {
      for (const n of [
        'Cassie',
        'Hancock',
        'Jessica',
        'Shelley',
        'Dickens',
        'Michelle',
        'Scunthorpe',
        'Bass',
        'Hellen',
        'Diego',
        'Diane',
      ]) {
        expect(validatePlayerName(n).ok, n).toBe(true);
      }
    });
  });
});

describe('validateSetup', () => {
  const good = {
    PAST: { name: 'Alex', grade: 2, subject: 'reading' },
    FUTURE: { name: 'Sam', grade: 8, subject: 'math' },
  } as const;

  it('builds Players with Past first and Future second', () => {
    const r = validateSetup(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.players).toEqual([
        { name: 'Alex', team: 'PAST', grade: 2, subject: 'reading' },
        { name: 'Sam', team: 'FUTURE', grade: 8, subject: 'math' },
      ]);
    }
  });

  it('allows kindergarten (grade 0) and grade 12', () => {
    const r = validateSetup({
      ...good,
      PAST: { ...good.PAST, grade: 0 },
      FUTURE: { ...good.FUTURE, grade: 12 },
    });
    expect(r.ok).toBe(true);
  });

  it('allows both players to share a name', () => {
    expect(validateSetup({ ...good, FUTURE: { ...good.FUTURE, name: 'Alex' } }).ok).toBe(true);
  });

  it.each([-1, 13, 1.5, Number.NaN, 99])('rejects grade %s', (grade) => {
    const r = validateSetup({ ...good, PAST: { ...good.PAST, grade } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.PAST.grade).toBeTruthy();
  });

  it('rejects an unknown subject', () => {
    const r = validateSetup({ ...good, FUTURE: { ...good.FUTURE, subject: 'gym' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.FUTURE.subject).toBeTruthy();
  });

  it('reports errors per team and does not mix them up', () => {
    const r = validateSetup({ ...good, FUTURE: { ...good.FUTURE, name: '' } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.PAST).toEqual({});
      expect(r.errors.FUTURE.name).toBe(SETUP.nameEmpty);
    }
  });

  it('reports both teams when both are wrong', () => {
    const r = validateSetup({
      PAST: { name: ' ', grade: 3, subject: 'both' },
      FUTURE: { name: 'x'.repeat(13), grade: 3, subject: 'both' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.PAST.name).toBe(SETUP.nameEmpty);
      expect(r.errors.FUTURE.name).toBe(SETUP.nameTooLong);
    }
  });

  it('trims names in the output', () => {
    const r = validateSetup({ ...good, PAST: { ...good.PAST, name: '  Jo  ' } });
    if (r.ok) expect(r.players[0].name).toBe('Jo');
    else throw new Error('expected ok');
  });
});

describe('validateSetup without the retired Focus switch', () => {
  const base = {
    PAST: { name: 'Alex', grade: 3, subject: 'math' },
    FUTURE: { name: 'Sam', grade: 8, subject: 'math' },
  } as const;

  it('never adds a topic, even when an old caller passes one', () => {
    const old = { ...base, PAST: { ...base.PAST, topic: 'multiplication' } } as never;
    const r = validateSetup(old);
    expect(r.ok && r.players[0]).not.toHaveProperty('topic');
    expect(r.ok && r.players[1]).not.toHaveProperty('topic');
  });
  it('keeps different grades per side', () => {
    const r = validateSetup(base);
    expect(r.ok && [r.players[0].grade, r.players[1].grade]).toEqual([3, 8]);
  });
});
