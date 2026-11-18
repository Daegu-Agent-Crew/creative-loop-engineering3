#!/usr/bin/env python3
# Generate 3 parallel codex prompt files for EP011 (v5 parallel + v6 CHARLOCK format).
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EP = "EP011"
ps = json.load(open(os.path.join(ROOT, f"episodes/{EP}/script/panel-script.json"), encoding="utf-8"))
panels = sorted(ps["panels"], key=lambda p: (p["page_number"], p["panel_id"]))
assert len(panels) == 45, f"expected 45 panels, got {len(panels)}"

STYLE = "Bold clean ink linework, flat vibrant cell-shaded colors, rounded expressive character designs, dramatic but playful composition, distinctive 1980s Akira Toriyama manga aesthetic. Simple but expressive backgrounds with bold black shadows. Clean panel borders, dynamic perspective."

DNA = """CHARACTER DNA (fixed):
- Wangmiao (왕먀오): 30s Chinese man, neat black hair, big horn-rimmed glasses with white light reflection, thin build, blue-grey shirt (no lab coat), sleeves neatly rolled. Calm scholar posture.
- Shi Qiang (스치친): 40s Chinese man, messy black hair, heavy stubble/beard, narrow tired shrewd eyes, heavy build, worn olive jacket, unlit cigarette between fingers.
- Yang Dong (양동, inherited from EP010): 20s Chinese woman, oval face slightly longer than wide, narrow forehead, small straight nose, thin eyebrows, calm almond eyes, neat small mouth; straight black hair below shoulders with bangs swept from her left to her right; light sky-blue blouse under grey cardigan, small brown leather document bag. Calm, observant, restrained. Follow episodes/EP010/characters/assets/yangdong-canonical.png EXACTLY.
- 청신 (sepia flashback ONLY, this episode page 5): elderly woman scientist, EP001 look - BEFORE drawing p5-1 READ episodes/EP001/panels/assets/p10-1.png and inherit that elderly scientist design (silver hair bun, deep wrinkles, calm heavy eyes), drawn in warm sepia. Appears ONLY in the sepia flashback. No letters.
- Sophon system (소페르): NO human form. Appears ONLY as red sawtooth waveform, geometric UI totems, patch blocks and glitch shapes. No letters/numbers in image - precise values are post-processed SVG overlay.
- PDC 실험 책임자: institutional proxy. Face kept in half-shadow, no fixed look, dark suit. Do NOT give a memorable face.
- 연구원 (researchers, multiple facilities): generic varied lab staff, non-recurring, no memorable faces, simple lab attire. Different facilities may differ slightly in uniform color accent.
- 1379 감시자 (final page p15-1): NO face, NO body, NO silhouette - only the small white unofficial message slot in the patch layer. All words/numbers are post-processed overlay.
- Palette: present-day scenes = blue-grey cool tone; p5-1 청신 flashback = warm sepia; original-signal particle trajectories = pure white on dark screens for maximum contrast."""

LOCK = """MANDATORY CHARACTER LOCK (chairman directive v6, 2026-11-13 13:31 - omit and the whole batch fails):
BEFORE generating anything, READ these canonical sheets:
- episodes/EP006/characters/assets/wangmiao-canonical.png (Wangmiao)
- episodes/EP006/characters/assets/shi-qiang-canonical.png (Shi Qiang)
- episodes/EP010/characters/assets/yangdong-canonical.png (Yang Dong)
Also READ episodes/EP006/panels/assets/p2-1.png (Wangmiao) and episodes/EP006/panels/assets/p3-1.png (Shi Qiang) and match facial proportions, outfits, ink weight and shading EXACTLY (chairman directive 2026-11-10 07:30).
Then WRITE a 3-line description of each character's features from the sheets in your log BEFORE the first generation. Generating without these descriptions is forbidden.
Before generating EACH panel, print one confirmation line in your log:
[CHARLOCK] <panel_id>: <character names> = canonical sheet standard (face proportions/hair/glasses/outfit/ink weight/shading matched)
For panels with no characters print: [CHARLOCK] <panel_id>: no characters (scenery/graphic only).
Post-hoc character QA comparison is NOT performed - this pre-read procedure is the only guarantee. Follow it strictly."""

GROUPS = [("x1", 1, 5, "Page 1 full-page top-shot silence panel opens the episode."),
          ("x2", 6, 10, "Page 6 full-page ultra-wide silence panel is the episode midpoint impact beat."),
          ("x3", 11, 15, "Pages 11/14 full-page silence panels and the final p15-1 cliffhanger carry the ending impact.")]

for gname, p0, p1, note in GROUPS:
    sel = [p for p in panels if p0 <= p["page_number"] <= p1]
    lines = [f"{EP} (S2E06 버그 리포트 제출) phase4 panel generation - parallel group ep011-{gname} (pages {p0}-{p1}).", ""]
    lines += LOCK.split("\n") + [""]
    lines += DNA.split("\n") + [""]
    lines += [
        "Use the built-in image_gen tool to generate and save each panel image to:",
        f"/data/data/com.termux/files/home/.openclaw/workspace/creative-loop-engineering3/episodes/{EP}/panels/assets/<panel_id>.png",
        "",
        "STYLE_BLOCK at the front of every prompt:",
        STYLE,
        "",
        f"Common rules: NO Korean text/letters in images (post-process SVG overlay). Full-page/silence panels get maximum impact. {note} After saving, verify each file is over 300KB, retry if not. Print the size table at the end.",
        "",
        "Panels:",
        "",
    ]
    for p in sel:
        chars = ", ".join(p.get("characters_in_frame", [])) or "no characters"
        pal = p.get("color_palette", "")
        lines.append(f"- {p['panel_id']} ({p.get('camera_angle','normal')}, {p.get('visual_type','normal')}) [in frame: {chars}] (palette: {pal}): {p['description']}")
    path = os.path.join(ROOT, f"prompt-{EP.lower()}-{gname}.txt")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"{path}: {len(sel)} panels (pages {p0}-{p1})")
print("done")
