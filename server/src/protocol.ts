// Message shapes and strict validation. Hand-written on purpose: no schema library, no surprises.
// Every field is checked, unknown fields are rejected, and the frame size is capped.
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from './config';
import { isValidCode } from './roomCode';
import { UNITS } from '../../src/game/units';

export { MAX_MESSAGE_BYTES, PROTOCOL_VERSION };

export type Team = 'PAST' | 'FUTURE';
export type Subject = 'reading' | 'math' | 'both';
export const EMOTES = ['wave', 'cheer', 'oops', 'good_game'] as const;
export type Emote = (typeof EMOTES)[number];

type Base = { v: 1 };
export type ClientMessage =
  | (Base & { t: 'create_room' })
  | (Base & { t: 'join_room'; code: string })
  | (Base & { t: 'rejoin'; code: string; seat: 0 | 1; secret: string })
  | (Base & {
      t: 'setup';
      turn: number;
      seq: number;
      team: Team;
      grade: number;
      subject: Subject;
      name?: string;
    })
  | (Base & {
      t: 'fire';
      turn: number;
      seq: number;
      angleDeg: number;
      power: number;
      unit?: string;
    })
  | (Base & { t: 'answer'; turn: number; seq: number; choice: number })
  | (Base & { t: 'rematch'; turn: number; seq: number })
  | (Base & { t: 'emote'; emote: Emote })
  | (Base & { t: 'leave' })
  | (Base & { t: 'ping' });

export type ClientType = ClientMessage['t'];

export type ErrorCode =
  | 'bad_message'
  | 'too_big'
  | 'unknown_type'
  | 'not_in_room'
  | 'no_such_room'
  | 'room_full'
  | 'busy'
  | 'rejoin_failed'
  | 'not_your_turn'
  | 'wrong_phase'
  | 'stale_turn'
  | 'stale_seq'
  | 'key_reused'
  | 'bad_name'
  | 'team_taken'
  | 'slow_down'
  | 'already_in_room';

export type ParseResult =
  | { ok: true; msg: ClientMessage }
  | { ok: false; code: 'bad_message' | 'too_big' | 'unknown_type' };

type FieldCheck = (value: unknown) => boolean;
const int =
  (min: number, max: number): FieldCheck =>
  (x) =>
    typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const num =
  (min: number, max: number): FieldCheck =>
  (x) =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const oneOf =
  (...allowed: readonly (string | number)[]): FieldCheck =>
  (x) =>
    (typeof x === 'string' || typeof x === 'number') && allowed.includes(x);
const text =
  (min: number, max: number, pattern?: RegExp): FieldCheck =>
  (x) =>
    typeof x === 'string' &&
    [...x].length >= min &&
    [...x].length <= max &&
    (pattern ? pattern.test(x) : true);

const SEQ = int(0, 1_000_000_000);
const TURN = int(0, 1_000_000);
const UNIT_IDS = UNITS.map((u) => u.id);

type Spec = { required: Record<string, FieldCheck>; optional?: Record<string, FieldCheck> };
const SPECS: Record<ClientType, Spec> = {
  create_room: { required: {} },
  join_room: { required: { code: isValidCode } },
  rejoin: {
    required: { code: isValidCode, seat: oneOf(0, 1), secret: text(43, 43, /^[A-Za-z0-9_-]+$/) },
  },
  setup: {
    required: {
      turn: TURN,
      seq: SEQ,
      team: oneOf('PAST', 'FUTURE'),
      grade: int(0, 12),
      subject: oneOf('reading', 'math', 'both'),
    },
    optional: { name: text(1, 12) },
  },
  fire: {
    required: { turn: TURN, seq: SEQ, angleDeg: num(-1000, 1000), power: num(-1000, 1000) },
    optional: { unit: oneOf(...UNIT_IDS) },
  },
  answer: { required: { turn: TURN, seq: SEQ, choice: int(0, 3) } },
  rematch: { required: { turn: TURN, seq: SEQ } },
  emote: { required: { emote: oneOf(...EMOTES) } },
  leave: { required: {} },
  ping: { required: {} },
};

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isType = (t: string): t is ClientType => has(SPECS, t);

export function parseClientMessage(raw: string): ParseResult {
  if (typeof raw !== 'string') return { ok: false, code: 'bad_message' };
  if (Buffer.byteLength(raw, 'utf8') > MAX_MESSAGE_BYTES) return { ok: false, code: 'too_big' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'bad_message' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, code: 'bad_message' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.v !== PROTOCOL_VERSION || typeof obj.t !== 'string') {
    return { ok: false, code: 'bad_message' };
  }
  if (!isType(obj.t)) return { ok: false, code: 'unknown_type' };
  const spec = SPECS[obj.t];
  const optional = spec.optional ?? {};
  const allowed = new Set(['v', 't', ...Object.keys(spec.required), ...Object.keys(optional)]);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return { ok: false, code: 'bad_message' };
  }
  for (const [key, check] of Object.entries(spec.required)) {
    if (!has(obj, key) || !check(obj[key])) return { ok: false, code: 'bad_message' };
  }
  for (const [key, check] of Object.entries(optional)) {
    if (has(obj, key) && !check(obj[key])) return { ok: false, code: 'bad_message' };
  }
  return { ok: true, msg: obj as unknown as ClientMessage };
}
