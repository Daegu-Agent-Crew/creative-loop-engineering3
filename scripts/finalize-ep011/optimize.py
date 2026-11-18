#!/usr/bin/env python3
# EP011 finalize step 1: optimize PNGs over 1.2MB and create 900px JPEG previews.
import os, sys
from PIL import Image

base = "episodes/EP011/panels"
assets = os.path.join(base, "assets")
previews = os.path.join(base, "previews")
os.makedirs(previews, exist_ok=True)
ids = sorted(f[:-4] for f in os.listdir(assets) if f.endswith(".png"))
low, opt, prev = [], 0, 0
for pid in ids:
    src = os.path.join(assets, pid + ".png")
    size = os.path.getsize(src)
    if size < 300_000:
        low.append((pid, size))
    im = Image.open(src).convert("RGB")
    if size > 1_200_000:
        im = im.resize((int(im.width * 0.75), int(im.height * 0.75)), Image.LANCZOS)
        im.save(src, "PNG", optimize=True)
        opt += 1
    im2 = Image.open(src).convert("RGB")
    im2.thumbnail((900, 900), Image.LANCZOS)
    im2.save(os.path.join(previews, pid + ".jpg"), "JPEG", quality=82)
    prev += 1
print(f"panels={len(ids)} optimized={opt} previews={prev} under300KB={len(low)}")
for pid, size in low:
    print(f"LOW {pid} {size}")
