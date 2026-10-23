#!/usr/bin/env python3
"""Measure the intro clips and write src/data/introTimings.json.

For each public/audio/voice/intro-*.m4a it records the real length and the quiet gaps
(pauses between sentences). src/data/introScript.ts uses the gaps to time captions.

Usage: python3 scripts/measure-intro-timings.py [--check]

--check re-measures and fails if the committed file is out of date (no write).
Needs macOS `afconvert` to decode the AAC (no new dependencies). Python standard library only.
Offline: reads the clips already in the repo. It does not run Kokoro and records no audio.
Limit: the gaps come from silence in the audio, not from the text. A sentence spoken without
a pause before the next one leaves no gap, and then the caption times fall back to the
sentence-length estimate for that card.
"""
import argparse
import array
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIPS = ROOT / "public" / "audio" / "voice"
OUT = ROOT / "src" / "data" / "introTimings.json"
RATE = 16000
WINDOW_MS = 10
QUIET_RATIO = 0.03  # quiet = window RMS below 3% of the loudest window
MIN_GAP_MS = 120  # shorter dips are inside words, not between sentences
MERGE_MS = 150  # two quiet runs this close are one pause (a comma dip beside a full stop)


def decode(clip: Path) -> tuple[array.array, int]:
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "clip.wav"
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", f"LEI16@{RATE}", "-c", "1", str(clip), str(wav)],
            check=True,
        )
        with wave.open(str(wav)) as w:
            return array.array("h", w.readframes(w.getnframes())), w.getframerate()


def measure(clip: Path) -> dict:
    samples, rate = decode(clip)
    win = rate * WINDOW_MS // 1000
    rms = [
        (sum(x * x for x in samples[i : i + win]) / win) ** 0.5
        for i in range(0, len(samples) - win + 1, win)
    ]
    limit = max(rms) * QUIET_RATIO
    gaps, start = [], None
    for i, r in enumerate(rms + [limit * 2]):  # sentinel closes a trailing gap
        if r < limit and start is None:
            start = i
        elif r >= limit and start is not None:
            ms = (i - start) * WINDOW_MS
            if ms >= MIN_GAP_MS:
                gaps.append({"startMs": start * WINDOW_MS, "endMs": i * WINDOW_MS})
            start = None
    merged: list[dict] = []
    for g in gaps:
        if merged and g["startMs"] - merged[-1]["endMs"] <= MERGE_MS:
            merged[-1]["endMs"] = g["endMs"]
        else:
            merged.append(g)
    gaps = merged
    total = len(samples) * 1000 // rate
    # Drop the leading and trailing silence: only gaps inside the speech separate sentences.
    gaps = [g for g in gaps if g["startMs"] > 0 and g["endMs"] < total - WINDOW_MS]
    return {"durationMs": total, "gaps": gaps}


def build() -> dict:
    return {p.name: measure(p) for p in sorted(CLIPS.glob("intro-*.m4a"))}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    text = json.dumps(build(), indent=1) + "\n"
    if args.check:
        if OUT.read_text() != text:
            print(f"{OUT} is out of date; run scripts/measure-intro-timings.py", file=sys.stderr)
            return 1
        return 0
    OUT.write_text(text)
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
