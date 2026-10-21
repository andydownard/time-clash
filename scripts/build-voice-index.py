"""Build a voice clip volume (db/voice-k4.sqlite, ...) keyed by text hash. See db/README.md.

Offline content tool, not part of the web build. Needs kokoro-onnx and soundfile, the Kokoro v1.0 model files
(kokoro-v1.0.onnx, voices-v1.0.bin), macOS afconvert, and node (npx tsx) for the manifest.
Usage: python scripts/build-voice-index.py <model_dir> --grades 0-4 --out db/voice-k4.sqlite [--workers 3] [--bitrate 48000]

Resumable: rows that already exist with the same spoken text are kept; changed ones are rebuilt.
Id = "t:" + FNV-1a 64 of the whitespace-normalized ORIGINAL text. The voice is given the "spoken" form (toSpoken).
"""
import argparse, datetime, hashlib, json, multiprocessing as mp, os, sqlite3, subprocess, sys, tempfile

VOICE, SPEED, ENGINE = "am_michael", 0.95, "kokoro-82m"
MAX_MB = 80


def clip_id(text: str) -> str:
    h = 0xCBF29CE484222325
    for b in " ".join(text.split()).encode("utf-8"):
        h = ((h ^ b) * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return f"t:{h:016x}"


for _t, _i in [("I meant to do that!", "t:8b53121ff423c149"), ("What is 7 x 8?", "t:a080310abdfed25d"),
               ("  Welcome  to\nTime Clash! ", "t:8f4dfc255e14fe8f"), ("", "t:cbf29ce484222325")]:
    assert clip_id(_t) == _i, (_t, clip_id(_t), _i)

_kokoro = None


def _init(model_dir):
    global _kokoro
    from kokoro_onnx import Kokoro
    _kokoro = Kokoro(f"{model_dir}/kokoro-v1.0.onnx", f"{model_dir}/voices-v1.0.bin")


def _make(job):
    """Runs in a worker: (id, spoken, bitrate) -> (id, m4a bytes, duration_ms)."""
    import soundfile as sf
    cid, spoken, bitrate = job
    samples, sr = _kokoro.create(spoken, voice=VOICE, speed=SPEED, lang="en-us")
    with tempfile.TemporaryDirectory() as tmp:
        wav, m4a = f"{tmp}/a.wav", f"{tmp}/a.m4a"
        sf.write(wav, samples, sr)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(bitrate), wav, m4a], check=True)
        return cid, open(m4a, "rb").read(), round(len(samples) / sr * 1000)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model_dir")
    ap.add_argument("--grades", default="0-4")
    ap.add_argument("--out", default="db/voice-k4.sqlite")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--bitrate", type=int, default=48000)
    a = ap.parse_args()

    out = subprocess.run(["npx", "tsx", "scripts/voice-manifest.ts", "--grades", a.grades],
                         check=True, capture_output=True, text=True).stdout
    manifest = json.loads(out)
    for e in manifest:
        assert clip_id(e["text"]) == e["id"], f"TS/Python id mismatch for {e['text']!r}"

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    con = sqlite3.connect(a.out)
    con.executescript(open("db/migrations/0002_voice_clip_text_ids.sql").read())
    have = dict(con.execute("SELECT id, text_sha256 FROM voice_clip_index"))
    sha = lambda s: hashlib.sha256(s.encode()).hexdigest()
    todo = [e for e in manifest if have.get(e["id"]) != sha(e["spoken"])]
    wanted = {e["id"] for e in manifest}
    stale = [i for i in have if i not in wanted]
    print(f"{len(manifest)} clips in manifest, {len(manifest) - len(todo)} kept, {len(todo)} to build, {len(stale)} stale kept")
    by_id = {e["id"]: e for e in manifest}
    now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    jobs = [(e["id"], e["spoken"], a.bitrate) for e in todo]
    if jobs:
        ctx = mp.get_context("spawn")
        with ctx.Pool(a.workers, initializer=_init, initargs=(a.model_dir,)) as pool:
            for n, (cid, data, ms) in enumerate(pool.imap_unordered(_make, jobs), 1):
                e = by_id[cid]
                con.execute("INSERT OR REPLACE INTO voice_clip_index VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                            (cid, e["kind"], e["text"], sha(e["spoken"]), "audio/mp4", ms, len(data), data,
                             VOICE, ENGINE, now()))
                if n % 20 == 0 or n == len(jobs):
                    con.commit()
                    print(f"  built {n}/{len(jobs)}", flush=True)
    con.commit()
    con.execute("VACUUM")
    con.close()
    mb = os.path.getsize(a.out) / 1e6
    print(f"{a.out}: {mb:.1f} MB")
    if mb > MAX_MB:
        sys.exit(f"STOP: {mb:.1f} MB is over {MAX_MB} MB (GitHub rejects 100 MB). Rerun with --bitrate 32000 after deleting the file.")


if __name__ == "__main__":
    main()
