#!/usr/bin/env python3
# EP010 v6 parallel group prompt generator: 3 page-aligned groups with CHARLOCK headers.
import json, os
ROOT = os.path.dirname(os.path.abspath(__file__))
EP = 'EP010'
sb = json.load(open(os.path.join(ROOT, f'episodes/{EP}/storyboard/storyboard.json'), encoding='utf-8'))
panels = []
for p in sb['pages']:
    for pn in p['panels']:
        pn = dict(pn)
        pn['page_number'] = p['page_number']
        panels.append(pn)
panels.sort(key=lambda x: (x['page_number'], x['panel_id']))
assert len(panels) == 45, len(panels)
groups = [('x1', 1, 4), ('x2', 5, 9), ('x3', 10, 15)]

STYLE = "Bold clean ink linework, flat vibrant cell-shaded colors, rounded expressive character designs, dramatic but playful composition, distinctive 1980s Akira Toriyama manga aesthetic. Simple but expressive backgrounds with bold black shadows. Clean panel borders, dynamic perspective."

CHARLOCK = f'''MANDATORY CHARACTER LOCK (chairman directive v6, 2026-11-13 13:31 - omit and the whole batch fails):
BEFORE generating anything, READ these canonical sheets:
- episodes/EP006/characters/assets/wangmiao-canonical.png (Wangmiao)
- episodes/EP006/characters/assets/shi-qiang-canonical.png (Shi Qiang)
- episodes/{EP}/characters/assets/yangdong-canonical.png (Yang Dong, NEW this episode)
Also READ episodes/EP006/panels/assets/p2-1.png (Wangmiao) and episodes/EP006/panels/assets/p3-1.png (Shi Qiang) and match facial proportions, outfits, ink weight and shading EXACTLY (chairman directive 2026-11-10 07:30).
Then WRITE a 3-line description of each character's features from the sheets in your log BEFORE the first generation. Generating without these descriptions is forbidden.
Before generating EACH panel, print one confirmation line in your log:
[CHARLOCK] <panel_id>: <character names> = canonical sheet standard (face proportions/hair/glasses/outfit/ink weight/shading matched)
For panels with no characters print: [CHARLOCK] <panel_id>: no characters (scenery/graphic only).
Post-hoc character QA comparison is NOT performed - this pre-read procedure is the only guarantee. Follow it strictly.

CHARACTER DNA (fixed):
- Wangmiao (왕먀오): 30s Chinese man, neat black hair, big horn-rimmed glasses with white light reflection, thin build, blue-grey shirt (no lab coat), sleeves neatly rolled. Calm scholar posture.
- Shi Qiang (스치친): 40s Chinese man, messy black hair, heavy stubble/beard, narrow tired shrewd eyes, heavy build, worn olive jacket, unlit cigarette between fingers; coffee cup is this episode's signature prop.
- Yang Dong (양동, NEW): 20s Chinese woman, oval face slightly longer than wide, narrow forehead, small straight nose, thin eyebrows, calm almond eyes, neat small mouth; straight black hair below shoulders with bangs swept from her left to her right; light sky-blue blouse under grey cardigan, small brown leather document bag. Calm, observant, restrained. Follow episodes/EP010/characters/assets/yangdong-canonical.png EXACTLY.
- Sophon system (소페르): NO human form. Appears ONLY as red sawtooth waveform, geometric UI totems and glitch shapes. No letters/numbers in image - precise values are post-processed SVG overlay.
- PDC 실험 책임자: institutional proxy. Face kept in half-shadow, no fixed look, dark suit. Do NOT give a memorable face.
- Palette: present-day scenes = blue-grey cool tone; flashback (page 12 청신) = warm sepia.'''

def header(gid, p0, p1):
    return f'''{EP} (S2E05 면벽하지 않는 자들) phase4 panel generation - parallel group ep010-{gid} (pages {p0}-{p1}).

{CHARLOCK}

Use the built-in image_gen tool to generate and save each panel image to:
/data/data/com.termux/files/home/.openclaw/workspace/creative-loop-engineering3/episodes/{EP}/panels/assets/<panel_id>.png

STYLE_BLOCK at the front of every prompt:
{STYLE}

Common rules: NO Korean text/letters in images (post-process SVG overlay). Full-page/silence panels get maximum impact. After saving, verify each file is over 300KB, retry if not. Print the size table at the end.

Panels:'''

extra = {
  'x3': '''\nEXTRA REFERENCES (this group only):\n- Pages 12 flashbacks feature 청신 (Ye Wenjie, elderly, EP001 look): BEFORE drawing p12-1/p12-2 READ episodes/EP001/panels/assets/p10-1.png and inherit that elderly scientist design (silver hair bun, deep wrinkles, calm heavy eyes), drawn in warm sepia. No letters.\n- Page 15 final page and page 11 opening beat carry the emotional peaks: maximum composition impact.'''
}
written = []
for gid, p0, p1 in groups:
    sel = [p for p in panels if p0 <= p['page_number'] <= p1]
    lines = [header(gid, p0, p1)]
    lines.append(extra[gid] if gid in extra else '')
    for pn in sel:
        chars = ', '.join(pn.get('characters_in_frame') or []) or 'no characters'
        lines.append(f"- {pn['panel_id']} ({pn.get('camera_angle','normal')}, {pn.get('visual_type','normal')}) [in frame: {chars}]: {pn['description']}")
    path = os.path.join(ROOT, f'prompt-ep010-{gid}.txt')
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    written.append((path, len(sel)))
for w in written:
    print(f'{w[0]}: {w[1]} panels')
print('total', sum(w[1] for w in written), 'panels')
