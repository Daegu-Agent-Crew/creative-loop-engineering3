#!/usr/bin/env python3
import json, hashlib, sys
from pathlib import Path
from PIL import Image
root = Path("episodes/EP011/panels")
assets = sorted((root/"assets").glob("*.png"))
print("assets:", len(assets))
LIMIT = 1_200_000
optimized = []
for f in assets:
    sz = f.stat().st_size
    if sz <= LIMIT: continue
    im = Image.open(f).convert("RGB")
    for _ in range(2):
        w, h = im.size
        im = im.resize((max(1,int(w*0.75)), max(1,int(h*0.75))), Image.LANCZOS)
        tmp = f.with_suffix(".tmp.png")
        im.save(tmp, "PNG", optimize=True)
        nsz = tmp.stat().st_size
        if nsz < sz:
            tmp.replace(f); sz = nsz
        else:
            tmp.unlink(missing_ok=True); break
        if sz <= 1_500_000: break
    optimized.append((f.name, sz))
print("optimized:", len(optimized))
for n, s in optimized[:50]: print(" ", n, s)
# update source hashes in text-overlays.json
ovp = root/"text-overlays.json"
data = json.loads(ovp.read_text())
changed = 0
for p in data["panels"]:
    f = Path(p["source_image_path"])
    h = hashlib.sha256(f.read_bytes()).hexdigest()
    if p["source_sha256"] != h: p["source_sha256"] = h; changed += 1
ovp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print("hash updated:", changed)
# previews
pv = root/"previews"
pv.mkdir(exist_ok=True)
made = 0
for f in assets:
    im = Image.open(f).convert("RGB")
    w, h = im.size
    if max(w, h) > 900:
        r = 900/max(w, h)
        im = im.resize((max(1,int(w*r)), max(1,int(h*r))), Image.LANCZOS)
    im.save(pv/(f.stem+".jpg"), "JPEG", quality=82, optimize=True)
    made += 1
print("previews:", made)
# deterministic QA
sb = json.loads(Path("episodes/EP011/storyboard/storyboard.json").read_text())
sb_ids = [p["panel_id"] for pg in sb["pages"] for p in pg["panels"]]
ov_ids = [p["panel_id"] for p in data["panels"]]
finals = sorted((root/"final").glob("*.svg"))
fails = []
if len(assets)!=45 or any(f.stat().st_size<300_000 for f in assets): fails.append("asset count/size")
if len(finals)!=45: fails.append("final svg count")
if sb_ids!=ov_ids: fails.append("id mismatch storyboard vs overlays")
for p in data["panels"]:
    for o in p.get("overlays", []):
        b = o.get("box") or {}
        if not (0<=b.get("x",0) and b.get("x",0)+b.get("w",0)<=1.01 and 0<=b.get("y",0) and b.get("y",0)+b.get("h",0)<=1.01):
            fails.append("box out of bounds: "+p["panel_id"])
if len(list(pv.glob("*.jpg")))!=45: fails.append("preview count")
dial = sum(1 for p in data["panels"] if p.get("overlays"))
print("dialogue panels:", dial, "silent:", 45-dial)
print("QA:", "PASS" if not fails else fails)
sys.exit(0 if not fails else 1)
