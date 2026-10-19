// Clip id: "t:" + FNV-1a 64-bit hex of the text, whitespace squeezed. Shared with the voice service.
export function clipId(text: string): string {
  const bytes = new TextEncoder().encode(text.split(/\s+/).filter(Boolean).join(' '));
  let h = 0xcbf29ce484222325n;
  for (const b of bytes) h = ((h ^ BigInt(b)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return `t:${h.toString(16).padStart(16, '0')}`;
}
