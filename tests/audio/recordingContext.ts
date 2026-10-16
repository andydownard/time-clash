// A fake AudioContext that records what was built and when. It never makes sound.
// Used by the music and effect tests. The older FakeAudioContext in fakes.ts stays as it was.

export type RecParam = {
  value: number;
  calls: Array<{ kind: string; value: number; time: number }>;
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
  setTargetAtTime: (v: number, t: number, c: number) => void;
  cancelScheduledValues: (t: number) => void;
};

function param(value = 0): RecParam {
  const p: RecParam = {
    value,
    calls: [],
    setValueAtTime(v, t) {
      p.value = v;
      p.calls.push({ kind: 'set', value: v, time: t });
    },
    linearRampToValueAtTime(v, t) {
      p.calls.push({ kind: 'linear', value: v, time: t });
    },
    exponentialRampToValueAtTime(v, t) {
      p.calls.push({ kind: 'exp', value: v, time: t });
    },
    setTargetAtTime(v, t) {
      p.calls.push({ kind: 'target', value: v, time: t });
    },
    cancelScheduledValues() {
      p.calls.push({ kind: 'cancel', value: 0, time: 0 });
    },
  };
  return p;
}

export type RecNode = {
  kind: 'osc' | 'gain' | 'filter' | 'source';
  type?: string;
  gain?: RecParam;
  frequency?: RecParam;
  Q?: RecParam;
  startedAt: number | null;
  stoppedAt: number | null;
  targets: unknown[];
  disconnected: boolean;
  buffer?: unknown;
  loop?: boolean;
  connect: (n: unknown) => unknown;
  disconnect: () => void;
  start: (t?: number) => void;
  stop: (t?: number) => void;
};

export class RecordingContext {
  state: 'suspended' | 'running' = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = { kind: 'destination' };
  nodes: RecNode[] = [];
  buffersMade = 0;
  failOscillator = false;
  failGain = false;
  /** When false, createBuffer and createBufferSource are missing (an old browser). */
  withNoise = true;

  constructor(opts: { withNoise?: boolean } = {}) {
    this.withNoise = opts.withNoise ?? true;
    if (!this.withNoise) {
      (this as Partial<RecordingContext>).createBuffer = undefined;
      (this as Partial<RecordingContext>).createBufferSource = undefined;
    }
  }

  private make(kind: RecNode['kind'], extra: Partial<RecNode> = {}): RecNode {
    const n: RecNode = {
      kind,
      startedAt: null,
      stoppedAt: null,
      targets: [],
      disconnected: false,
      connect: (t) => {
        n.targets.push(t);
        return t;
      },
      disconnect: () => void (n.disconnected = true),
      start: (t = this.currentTime) => void (n.startedAt = t),
      stop: (t = this.currentTime) => void (n.stoppedAt = t),
      ...extra,
    };
    this.nodes.push(n);
    return n;
  }

  createOscillator(): RecNode {
    if (this.failOscillator) throw new Error('no oscillators today');
    return this.make('osc', { type: 'sine', frequency: param(440) });
  }
  createGain(): RecNode {
    if (this.failGain) throw new Error('no gain today');
    return this.make('gain', { gain: param(1) });
  }
  createBiquadFilter(): RecNode {
    return this.make('filter', { type: 'lowpass', frequency: param(350), Q: param(1) });
  }
  createBuffer(_channels: number, length: number): { getChannelData: () => Float32Array } {
    this.buffersMade++;
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource(): RecNode {
    return this.make('source', { loop: false });
  }

  of(kind: RecNode['kind']): RecNode[] {
    return this.nodes.filter((n) => n.kind === kind);
  }
  asContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}
