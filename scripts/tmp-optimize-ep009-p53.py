#!/usr/bin/env python3
import os
from PIL import Image
base = "episodes/EP009/panels"
pid = "p5-3"
src = f"{base}/assets/{pid}.png"
im = Image.open(src).convert("RGB")
size = os.path.getsize(src)
if size > 1_200_000:
    im = im.resize((int(im.width*0.75), int(im.height*0.75)), Image.LANCZOS)
    im.save(src, "PNG", optimize=True)
newsize = os.path.getsize(src)
im2 = Image.open(src).convert("RGB")
im2.thumbnail((900, 900), Image.LANCZOS)
prev = f"{base}/previews/{pid}.jpg"
im2.save(prev, "JPEG", quality=82)
print(f"{pid}: {size}->{newsize} bytes, preview {os.path.getsize(prev)}")
