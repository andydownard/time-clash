"""Build db/voice.sqlite: Chrono intro cards (docs/NARRATION.md) and funny knock-down lines (db/seed/barks.json).

Offline content tool, not part of the web build. Needs: pip install kokoro-onnx soundfile, plus the Kokoro v1.0
model files (kokoro-v1.0.onnx, voices-v1.0.bin). Engine: Kokoro-82M, Apache-2.0.
Usage: python scripts/build-voice-db.py <model_dir> [voice=am_michael]

Resumable: a row whose text and voice are unchanged is kept as it is. A changed or new line is recorded
again. Rows no longer in the script are kept (nothing is deleted). Set ESPEAK_DATA_PATH to a short copy of
espeakng_loader's espeak-ng-data folder if espeak fails on a long path (see db/README.md).
"""
import hashlib, json, re, sqlite3, subprocess, sys, tempfile, os, datetime

model_dir = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "am_michael"
ENGINE, SPEED, BITRATE = "kokoro-82m", 0.95, 64000
DB = "db/voice.sqlite"

clips = []  # (id, kind, text)
narr = open("docs/NARRATION.md").read()
for n, title, text in re.findall(r"\*\*Card (\d): ([^(\n]+?)\s*\(about[^\n]*\n> ([^\n]+)", narr):
    slug = re.sub(r"[^a-z]+", "-", title.lower()).strip("-")
    clips.append((f"intro-{int(n):02d}-{slug}", "intro", text.strip()))
barks = json.load(open("db/seed/barks.json"))
for side in ("past", "future", "bot_helper"):
    for i, line in enumerate(barks[side]):
        clips.append((f"bark-{side}-{i:02d}", "bark", line))

os.makedirs("db", exist_ok=True)
con = sqlite3.connect(DB)
con.executescript(open("db/migrations/0001_voice_clips.sql").read())
have = {r[0]: (r[1], r[2]) for r in con.execute("SELECT id, text, voice FROM voice_clips")}
todo = [c for c in clips if have.get(c[0]) != (c[2], VOICE)]
stale = [i for i in have if i not in {c[0] for c in clips}]
print(f"{len(clips)} clips, {len(clips) - len(todo)} kept, {len(todo)} to record, {len(stale)} stale kept")

if todo:
    import soundfile as sf
    from kokoro_onnx import EspeakConfig, Kokoro

    k = Kokoro(f"{model_dir}/kokoro-v1.0.onnx", f"{model_dir}/voices-v1.0.bin",
               espeak_config=EspeakConfig(data_path=os.environ.get("ESPEAK_DATA_PATH")))
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    with tempfile.TemporaryDirectory() as tmp:
        for cid, kind, text in todo:
            samples, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
            wav, m4a = f"{tmp}/{cid}.wav", f"{tmp}/{cid}.m4a"
            sf.write(wav, samples, sr)
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE), wav, m4a], check=True)
            data = open(m4a, "rb").read()
            ms = round(len(samples) / sr * 1000)
            con.execute("INSERT OR REPLACE INTO voice_clips VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                        (cid, kind, VOICE, ENGINE, text, "audio/mp4", ms, len(data),
                         hashlib.sha256(data).hexdigest(), data, now))
            print(f"  recorded {cid}  {ms} ms  {text}")
    con.commit()
    con.execute("VACUUM")
con.close()
print(len(clips), "clips ->", DB, os.path.getsize(DB) // 1024, "KB")
