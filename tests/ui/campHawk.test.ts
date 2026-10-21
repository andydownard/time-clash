// @vitest-environment jsdom
// The hawk over the Camp circles on a true oval, faces the way it flies, and banks round each end.
import { describe, expect, it, vi } from 'vitest';
import { startHawk, type Scheduler } from '../../src/ui/ambientFlights';
import { HAWK_3D, hawkPose } from '../../src/ui/flightPhysics';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 30_000 });

describe('hawkPose', () => {
  const orbit = { rx: 340, ry: 60, seconds: 16 };
  const samples = Array.from({ length: 160 }, (_, i) => hawkPose((i / 160) * orbit.seconds, orbit));

  it('travels a true oval: every point sits on the ellipse', () => {
    for (const p of samples) {
      expect((p.x / orbit.rx) ** 2 + (p.y / orbit.ry) ** 2).toBeCloseTo(1, 1);
    }
  });

  it('comes back to where it began after a lap', () => {
    expect(hawkPose(0, orbit)).toEqual(hawkPose(orbit.seconds, orbit));
    expect(hawkPose(3, orbit)).toEqual(hawkPose(3 + orbit.seconds * 2, orbit));
  });

  it('goes clockwise: right along the top, left along the bottom', () => {
    expect(hawkPose(0.5, orbit).x).toBeGreaterThan(hawkPose(0, orbit).x);
    expect(hawkPose(8.5, orbit).x).toBeLessThan(hawkPose(8, orbit).x);
    expect(hawkPose(0, orbit).y).toBeLessThan(0);
    expect(hawkPose(8, orbit).y).toBeGreaterThan(0);
  });

  it('turns for real: yaw is its heading around the vertical axis, 0 right, 90 toward us, 180 left', () => {
    expect(hawkPose(0, orbit).yaw).toBe(0);
    expect(hawkPose(4, orbit).yaw).toBe(90);
    expect(hawkPose(8, orbit).yaw).toBe(180);
    expect(hawkPose(12, orbit).yaw).toBe(270);
    for (const p of samples) {
      expect(p.yaw).toBeGreaterThanOrEqual(0);
      expect(p.yaw).toBeLessThan(360);
    }
  });

  it('turns smoothly: the heading never jumps between frames', () => {
    for (let i = 1; i < samples.length; i++) {
      const step = Math.abs(samples[i]!.yaw - samples[i - 1]!.yaw);
      expect(Math.min(step, 360 - step)).toBeLessThan(5);
    }
  });

  it('has depth: far at the top of the oval, near at the bottom, level at the turns', () => {
    expect(hawkPose(0, orbit).depth).toBe(-1);
    expect(hawkPose(8, orbit).depth).toBe(1);
    expect(hawkPose(4, orbit).depth).toBe(0);
    expect(hawkPose(12, orbit).depth).toBe(0);
    for (const p of samples) expect(p.depth).toBeCloseTo(p.y / orbit.ry, 1);
  });

  it('passes over the title on the near half and behind it on the far half', () => {
    expect(hawkPose(0, orbit).front).toBe(false);
    expect(hawkPose(8, orbit).front).toBe(true);
    for (const p of samples) expect(p.front).toBe(p.depth > 0);
  });

  it('switches over/behind exactly at the two turning points: over, behind, over, behind', () => {
    expect(hawkPose(3.99, orbit).front).toBe(false);
    expect(hawkPose(4.01, orbit).front).toBe(true);
    expect(hawkPose(11.99, orbit).front).toBe(true);
    expect(hawkPose(12.01, orbit).front).toBe(false);
    const flips = samples.filter((p, i) => p.front !== samples[(i + 1) % samples.length]!.front);
    expect(flips).toHaveLength(2);
  });

  it('is bigger on the near pass and smaller on the far pass', () => {
    const far = hawkPose(0, orbit).scale;
    const mid = hawkPose(4, orbit).scale;
    const near = hawkPose(8, orbit).scale;
    expect(far).toBeLessThan(1);
    expect(near).toBeGreaterThan(1);
    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(near);
    expect(mid).toBeCloseTo(1, 5);
  });

  it('dims on the far pass and casts a shadow on the near pass', () => {
    expect(hawkPose(0, orbit).opacity).toBeCloseTo(1 - HAWK_3D.farDim, 3);
    expect(hawkPose(0, orbit).shadow).toBe(0);
    expect(hawkPose(8, orbit).opacity).toBe(1);
    expect(hawkPose(8, orbit).shadow).toBeGreaterThan(0.5);
    expect(hawkPose(4, orbit).opacity).toBe(1);
    expect(hawkPose(4, orbit).shadow).toBe(0);
    for (const p of samples) {
      expect(p.opacity).toBeGreaterThan(0.6);
      expect(p.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('flaps its wings gently and keeps time', () => {
    const flaps = samples.map((p) => p.flap);
    expect(Math.max(...flaps)).toBeGreaterThan(Math.min(...flaps) + 10);
    for (const f of flaps) expect(Math.abs(f)).toBeLessThanOrEqual(40);
    expect(hawkPose(3, orbit).flap).toBe(hawkPose(3 + HAWK_3D.flapSeconds, orbit).flap);
  });

  it('holds still on bad input', () => {
    expect(hawkPose(Number.NaN, orbit)).toEqual(hawkPose(0, orbit));
    expect(hawkPose(5, { ...orbit, seconds: 0 })).toEqual(hawkPose(0, orbit));
  });
});

function manual() {
  let time = 0;
  let queued: Array<() => void> = [];
  const scheduler: Scheduler = {
    now: () => time,
    next: (fn) => queued.push(fn),
    cancel: () => {
      queued = [];
    },
  };
  return {
    scheduler,
    at(ms: number) {
      time = ms;
      const run = queued;
      queued = [];
      for (const fn of run) fn();
    },
    pending: () => queued.length,
  };
}

const NS = 'http://www.w3.org/2000/svg';
/** Two layers, as the Camp draws them: one under the title (back), one over it (front). */
function hawk() {
  const svg = document.createElementNS(NS, 'svg');
  const layer = (name: string): SVGElement => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'tc-camp-hawk');
    g.setAttribute('data-layer', name);
    const paths = document.createElementNS(NS, 'g');
    paths.setAttribute('class', 'tc-camp-hawk-paths');
    g.append(paths);
    svg.append(g);
    return g as SVGElement;
  };
  return { svg, back: layer('back'), front: layer('front') };
}
const shown = (el: SVGElement): boolean => el.getAttribute('display') !== 'none';
const painted = (el: SVGElement): number => el.querySelectorAll('.tc-camp-hawk-paths path').length;

describe('startHawk', () => {
  it('draws the far pass behind the title: back layer on, small, with paint', () => {
    const h = hawk();
    const m = manual();
    startHawk(h.svg, m.scheduler, { reduced: false });
    m.at(0);
    expect(shown(h.back)).toBe(true);
    expect(shown(h.front)).toBe(false);
    expect(h.back.getAttribute('transform')).toMatch(/^translate\(0 -52\) scale\(0\.\d+\)$/);
    expect(painted(h.back)).toBeGreaterThan(20);
  });

  it('draws the near pass over the title: front layer on, big', () => {
    const h = hawk();
    const m = manual();
    startHawk(h.svg, m.scheduler, { reduced: false });
    m.at(8000);
    expect(shown(h.front)).toBe(true);
    expect(shown(h.back)).toBe(false);
    expect(h.front.getAttribute('transform')).toMatch(/^translate\(0 52\) scale\(1\.\d+\)$/);
    expect(painted(h.front)).toBeGreaterThan(20);
  });

  it('moves between layers exactly at the turns', () => {
    const h = hawk();
    const m = manual();
    startHawk(h.svg, m.scheduler, { reduced: false });
    m.at(3990);
    expect([shown(h.back), shown(h.front)]).toEqual([true, false]);
    m.at(4010);
    expect([shown(h.back), shown(h.front)]).toEqual([false, true]);
    m.at(11990);
    expect([shown(h.back), shown(h.front)]).toEqual([false, true]);
    m.at(12010);
    expect([shown(h.back), shown(h.front)]).toEqual([true, false]);
  });

  it('leaves the hawk where it is drawn when motion is reduced', () => {
    const h = hawk();
    const m = manual();
    startHawk(h.svg, m.scheduler, { reduced: true });
    m.at(1000);
    expect(h.back.hasAttribute('transform')).toBe(false);
    expect(painted(h.back)).toBe(0);
    expect(m.pending()).toBe(0);
  });

  it('stops, and puts the hawk back in its still pose, when told to', () => {
    const h = hawk();
    const m = manual();
    const stop = startHawk(h.svg, m.scheduler, { reduced: false });
    m.at(8000);
    stop();
    expect(h.back.getAttribute('transform')).toBe('translate(390 96) scale(1.05)');
    expect(h.front.hasAttribute('transform')).toBe(false);
    expect([shown(h.back), shown(h.front)]).toEqual([true, false]);
    expect(painted(h.back)).toBeGreaterThan(20);
    m.at(9000);
    expect(h.back.getAttribute('transform')).toBe('translate(390 96) scale(1.05)');
  });

  it('does nothing when the picture has no hawk', () => {
    const m = manual();
    const stop = startHawk(document.createElementNS(NS, 'svg'), m.scheduler, { reduced: false });
    expect(m.pending()).toBe(0);
    expect(() => stop()).not.toThrow();
  });
});
