"""Check a voice volume against the manifest: python scripts/check-voice-index.py db/voice-k4.sqlite --grades 0-4"""
import argparse, json, sqlite3, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("db")
ap.add_argument("--grades", default="0-4")
a = ap.parse_args()
manifest = json.loads(subprocess.run(["npx", "tsx", "scripts/voice-manifest.ts", "--grades", a.grades],
                                     check=True, capture_output=True, text=True).stdout)
rows = {r[0]: r[1:] for r in sqlite3.connect(a.db).execute("SELECT id, bytes, duration_ms, kind, length(audio) FROM voice_clip_index")}
bad = []
for e in manifest:
    r = rows.get(e["id"])
    if r is None: bad.append((e["id"], "missing", e["text"][:60])); continue
    nbytes, ms, kind, alen = r
    if nbytes <= 0 or alen != nbytes: bad.append((e["id"], "bytes", nbytes, alen))
    elif not 500 <= ms <= 40000: bad.append((e["id"], "duration", ms, e["text"][:60]))
    elif kind != e["kind"]: bad.append((e["id"], "kind", kind, e["kind"]))
for b in bad: print("BAD", b)
kinds = {}
for e in manifest:
    r = rows.get(e["id"])
    if r: kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
tot = sum(rows[e["id"]][0] for e in manifest if e["id"] in rows)
ms = sum(rows[e["id"]][1] for e in manifest if e["id"] in rows)
print(f"clips {len(manifest) - len(bad)}/{len(manifest)} ok, per kind {kinds}, audio {tot/1e6:.1f} MB, {ms/60000:.1f} minutes")
sys.exit(1 if bad else 0)
