"""Build db/voice.sqlite: Chrono intro cards (docs/NARRATION.md) and funny knock-down lines (db/seed/barks.json).

Offline content tool, not part of the web build. Needs: pip install kokoro-onnx soundfile, plus the Kokoro v1.0
model files (kokoro-v1.0.onnx, voices-v1.0.bin). Engine: Kokoro-82M, Apache-2.0.
Usage: python scripts/build-voice-db.py <model_dir> [voice=am_michael]
"""
import hashlib, json, re, sqlite3, subprocess, sys, tempfile, os, datetime
import soundfile as sf
from kokoro_onnx import Kokoro

model_dir = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "am_michael"
ENGINE, SPEED = "kokoro-82m", 0.95
k = Kokoro(f"{model_dir}/kokoro-v1.0.onnx", f"{model_dir}/voices-v1.0.bin")

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
if os.path.exists("db/voice.sqlite"): os.remove("db/voice.sqlite")
con = sqlite3.connect("db/voice.sqlite")
con.executescript(open("db/migrations/0001_voice_clips.sql").read())
now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
with tempfile.TemporaryDirectory() as tmp:
    for cid, kind, text in clips:
        samples, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
        wav, m4a = f"{tmp}/{cid}.wav", f"{tmp}/{cid}.m4a"
        sf.write(wav, samples, sr)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", wav, m4a], check=True)
        data = open(m4a, "rb").read()
        con.execute("INSERT INTO voice_clips VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (cid, kind, VOICE, ENGINE, text, "audio/mp4", round(len(samples) / sr * 1000), len(data),
                     hashlib.sha256(data).hexdigest(), data, now))
con.commit(); con.execute("VACUUM"); con.close()
print(len(clips), "clips ->", "db/voice.sqlite", os.path.getsize("db/voice.sqlite") // 1024, "KB")
