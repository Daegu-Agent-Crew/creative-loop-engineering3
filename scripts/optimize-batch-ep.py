#!/usr/bin/env python3
# Usage: python3 scripts/optimize-batch-ep.py EP009 p1-1 p2-1 ...
import sys, os
from PIL import Image
EP = sys.argv[1]
base = f"episodes/{EP}/panels"
for pid in sys.argv[2:]:
    src = f"{base}/assets/{pid}.png"
    if not os.path.exists(src):
        print(f"MISSING {src}"); continue
    im = Image.open(src).convert("RGB")
    size = os.path.getsize(src)
    if size > 1_200_000:
        im = im.resize((int(im.width*0.75), int(im.height*0.75)), Image.LANCZOS)
        im.save(src, "PNG", optimize=True)
    newsize = os.path.getsize(src)
    im2 = Image.open(src).convert("RGB")
    im2.thumbnail((900, 900), Image.LANCZOS)
    prev = f"{base}/previews/{pid}.jpg"
    os.makedirs(os.path.dirname(prev), exist_ok=True)
    im2.save(prev, "JPEG", quality=82)
    print(f"{pid}: {size}->{newsize} bytes, preview {os.path.getsize(prev)}")