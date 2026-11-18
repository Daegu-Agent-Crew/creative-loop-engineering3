#!/usr/bin/env python3
# Generate codex image_gen batch prompts from panel-script.json (single source of truth).
# Usage: python3 scripts/gen-batch-prompts.py EP009 [pages_per_batch=2]
import json, os, sys

EP = sys.argv[1] if len(sys.argv) > 1 else "EP009"
PAGES = int(sys.argv[2]) if len(sys.argv) > 2 else 2
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ps = json.load(open(os.path.join(ROOT, f"episodes/{EP}/script/panel-script.json"), encoding="utf-8"))
panels = ps["panels"] if isinstance(ps, dict) and "panels" in ps else ps
panels = sorted(panels, key=lambda p: (p["page_number"], p["panel_id"]))

STYLE = """Bold clean ink linework, flat vibrant cell-shaded colors, rounded expressive character designs, dramatic but playful composition, distinctive 1980s Akira Toriyama manga aesthetic. Simple but expressive backgrounds with bold black shadows. Clean panel borders, dynamic perspective."""

def header(batch_no, p0, p1, first_page):
    return f"""{EP} phase4 panel generation - batch {batch_no} (pages {p0}-{p1}).

MANDATORY CONSISTENCY STEP (chairman directive 2026-11-10): BEFORE generating, READ these canonical reference images: episodes/EP006/panels/assets/p2-1.png (Wangmiao canonical) and episodes/EP006/panels/assets/p3-1.png (Shi Qiang canonical). Match their facial proportions, outfit details, ink weight and shading style EXACTLY. Hard requirement.

NOTE (EP009): Tri-Solaris in-game scenes use the dry ochre / dehydrated-body dystopian palette inherited from EP003-EP004 game worlds; real-world scenes stay in the present-day blue-grey tone. Keep the two clearly distinguishable.

Use the built-in image_gen tool to generate and save each panel image to:
/data/data/com.termux/files/home/.openclaw/workspace/creative-loop-engineering3/episodes/{EP}/panels/assets/<panel_id>.png

STYLE_BLOCK at the front of every prompt:
{STYLE}

Common rules: NO Korean text/letters in images (post-process SVG overlay). Wangmiao = neat black hair, big horn-rimmed glasses, blue-grey shirt, thin build. Shi Qiang = messy black hair, beard, narrow tired eyes, worn olive jacket. Page {first_page} opening panels carry the impact beat. After saving, verify each file is over 300KB, retry if not. Print the size table at the end.

Panels:"""

pages = sorted({p["page_number"] for p in panels})
batches = [pages[i:i + PAGES] for i in range(0, len(pages), PAGES)]
written = []
for n, pg in enumerate(batches, 1):
    sel = [p for p in panels if p["page_number"] in pg]
    lines = [header(n, pg[0], pg[-1], pg[0])]
    for p in sel:
        lines.append(f"- {p['panel_id']} ({p.get('camera_angle','normal')}, {p.get('visual_type','normal')}): {p['description']}")
    path = os.path.join(ROOT, f"prompt-{EP.lower()}-b{n}.txt")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    written.append((path, len(sel), f"p{pg[0]}-p{pg[-1]}"))
for w in written:
    print(f"{w[0]}: {w[1]} panels ({w[2]})")
print(f"total {len(panels)} panels, {len(batches)} batches")
