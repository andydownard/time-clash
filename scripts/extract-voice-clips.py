#!/usr/bin/env python3
"""Extract Chrono's intro voice clips from db/voice.sqlite into static files.

The site is static (no server), so the game cannot read the database at run time.
This script writes each intro clip to public/audio/voice/<id>.m4a (AAC in an MP4
container, which Chromium, WebKit and iPad Safari all play).

Usage: python3 scripts/extract-voice-clips.py [--db PATH] [--out DIR] [--prefix intro-]

Safe to run again: a file whose bytes already match is left alone.
Python standard library only.
"""
import argparse
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def extract(db: Path, out: Path, prefix: str) -> list[tuple[str, int, str]]:
    """Returns (id, duration_ms, 'wrote' | 'unchanged') for each clip, in id order."""
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        rows = con.execute(
            "SELECT id, mime, duration_ms, audio FROM voice_clips WHERE id LIKE ? ORDER BY id",
            (prefix + "%",),
        ).fetchall()
    finally:
        con.close()
    if not rows:
        raise SystemExit(f"no clips with id prefix {prefix!r} in {db}")
    out.mkdir(parents=True, exist_ok=True)
    result = []
    for clip_id, mime, duration_ms, audio in rows:
        if mime != "audio/mp4":
            raise SystemExit(f"{clip_id}: expected audio/mp4, got {mime}")
        data = bytes(audio)
        target = out / f"{clip_id}.m4a"
        if target.exists() and target.read_bytes() == data:
            result.append((clip_id, duration_ms, "unchanged"))
        else:
            target.write_bytes(data)
            result.append((clip_id, duration_ms, "wrote"))
    return result


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--db", type=Path, default=ROOT / "db" / "voice.sqlite")
    p.add_argument("--out", type=Path, default=ROOT / "public" / "audio" / "voice")
    p.add_argument("--prefix", default="intro-")
    a = p.parse_args()
    for clip_id, ms, state in extract(a.db, a.out, a.prefix):
        print(f"{state:9} {clip_id}.m4a  {ms} ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
