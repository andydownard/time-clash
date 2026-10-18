// Stable id for a spoken clip: "t:" + FNV-1a 64-bit of the UTF-8 text with whitespace collapsed.
// Shared contract with the voice database builder (scripts/build-voice-index.py). Keep both in step.
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export function clipId(text: string): string {
  const normal = text.split(/\s+/).filter(Boolean).join(' ');
  let h = OFFSET;
  for (const byte of new TextEncoder().encode(normal)) {
    h = ((h ^ BigInt(byte)) * PRIME) & MASK;
  }
  return `t:${h.toString(16).padStart(16, '0')}`;
}
