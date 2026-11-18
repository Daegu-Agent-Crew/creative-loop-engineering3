#!/usr/bin/env python3
# EP011 finalize step 2: build panels.json from canonical panel-script after generation.
import json, os, sys

EP = "EP011"
ps = json.load(open(f"episodes/{EP}/script/panel-script.json", encoding="utf-8"))
panels = sorted(ps["panels"], key=lambda p: (p["page_number"], p["panel_id"]))
STYLE = "Bold clean ink linework, flat vibrant cell-shaded colors, rounded expressive character designs, dramatic but playful composition, distinctive 1980s Akira Toriyama manga aesthetic. Simple but expressive backgrounds with bold black shadows. Clean panel borders, dynamic perspective."
out, missing = [], []
for p in panels:
    img = f"episodes/{EP}/panels/assets/{p['panel_id']}.png"
    ok = os.path.exists(img) and os.path.getsize(img) >= 300_000
    if not ok:
        missing.append(p["panel_id"])
    refs = []
    for c in p.get("characters_in_frame", []):
        if c == "왕먀오": refs.append("episodes/EP006/characters/assets/wangmiao-canonical.png")
        elif c == "스치친": refs.append("episodes/EP006/characters/assets/shi-qiang-canonical.png")
        elif c == "양동": refs.append("episodes/EP010/characters/assets/yangdong-canonical.png")
        elif c == "청신": refs.append("episodes/EP001/panels/assets/p10-1.png")
    out.append({
        "panel_id": p["panel_id"], "page_number": p["page_number"],
        "description": p["description"], "camera_angle": p["camera_angle"],
        "visual_type": p["visual_type"], "characters_in_frame": p.get("characters_in_frame", []),
        "reference_assets": refs, "image_path": img,
        "generation_prompt": STYLE, "style": "dr-slump-toriyama",
        "generation_status": "generated" if ok else "missing",
        "text_strategy": "postprocess_overlay", "ai_score": None, "human_score": None,
    })
doc = {"episode_id": EP, "panels": out}
with open(f"episodes/{EP}/panels/panels.json", "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"panels.json written: {len(out)} panels, missing={missing if missing else 0}")
sys.exit(1 if missing else 0)
