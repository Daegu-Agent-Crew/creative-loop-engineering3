#!/usr/bin/env python3
# EP011 finalize step 3: build docs/episodes/EP011/index.html preview viewer (EP010 format).
import json, os, html

EP = "EP011"
TITLE = "버그 리포트 제출"
SUB = "버그 리포트 6화. 모순된 입력이 아니라 원본 데이터 — 인류가 처음으로 제출한 오류 보고."
DATE = "2026-11-17"
RAW = "https://raw.githubusercontent.com/Daegu-Agent-Crew/creative-loop-engineering3/main"

ps = json.load(open(f"episodes/{EP}/script/panel-script.json", encoding="utf-8"))
panels = sorted(ps["panels"], key=lambda p: (p["page_number"], p["panel_id"]))
ov = json.load(open(f"episodes/{EP}/panels/text-overlays.json", encoding="utf-8"))
ovmap = {p["panel_id"]: p.get("overlays", []) for p in ov["panels"]}

parts = []
page = 0
for p in panels:
    if p["page_number"] != page:
        page = p["page_number"]
        if page > 1:
            parts.append("</section>")
        parts.append(f'<section class="page"><h2 class="ph">PAGE {page:02d}</h2>')
    pid = p["panel_id"]
    img = f"{RAW}/episodes/{EP}/panels/assets/{pid}.png"
    fig = [f'<figure class="panel"><img loading="lazy" src="{img}" alt="{pid}">']
    for o in ovmap.get(pid, []):
        b = o.get("box", {})
        kind = {"dialogue": "dial", "caption": "cap", "sfx": "sfx", "narration": "cap", "note": "cap"}.get(o["kind"], "cap")
        left = b.get("x", 0.07) * 100; top = b.get("y", 0.06) * 100; w = b.get("w", 0.5) * 100
        sp = html.escape(o.get("speaker", "")); tx = html.escape(o["text"])
        label = f"<b>{sp}</b>: " if sp and kind == "dial" else ""
        fig.append(f'<div class="t {kind}" style="left:{left:.1f}%;top:{top:.1f}%;width:{w:.1f}%">{label}{tx}</div>')
    fig.append("</figure>")
    parts.append("".join(fig))
parts.append("</section>")

body = "\n".join(parts)
html_doc = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EP011 {TITLE} — 미리보기 | CLE3</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#0c1017;color:#eee;font-family:"Noto Sans KR","Apple SD Gothic Neo",sans-serif}}
.wrap{{max-width:860px;margin:auto;padding:20px 14px 70px}}
.hd{{padding:26px 0 20px;border-bottom:1px solid #29313f}}.eyebrow{{color:#8fdcff;font-size:.78rem;letter-spacing:.14em}}
h1{{margin:.3rem 0 .2rem;font-size:clamp(1.6rem,6vw,2.6rem)}}
.sub{{color:#9aa5b5;font-size:.9rem}}.badge{{display:inline-block;border:1px solid #3a4354;border-radius:999px;padding:5px 10px;font-size:.75rem;color:#c7d0de;margin:12px 6px 0 0}}
.page{{margin-top:34px}}.ph{{font-size:.85rem;letter-spacing:.12em;color:#8e99ab;border-bottom:1px solid #232b38;padding-bottom:6px}}
.panel{{position:relative;margin:12px 0;background:#11141c;border:1px solid #232b38;border-radius:8px;overflow:hidden}}
.panel img{{display:block;width:100%;height:auto}}
.t{{position:absolute;font-weight:700;line-height:1.35;text-shadow:0 0 6px #000,0 0 3px #000,1px 1px 0 #000,-1px -1px 0 #000}}
.dial{{font-size:clamp(12px,2.6vw,16px);color:#fff}}
.cap{{font-size:clamp(11px,2.2vw,13px);color:#ffe9b0}}
.sfx{{font-size:clamp(16px,4vw,24px);color:#ff5f5f;transform:rotate(-4deg)}}
.ft{{margin-top:50px;border-top:1px solid #232b38;padding-top:16px;color:#77839a;font-size:.8rem;line-height:1.7}}
</style></head><body><div class="wrap">
<header class="hd"><div class="eyebrow">CLE3 · SEASON 2 · EP011</div>
<h1>{TITLE}</h1>
<div class="sub">{SUB}</div>
<span class="badge">15페이지 · 45컷</span><span class="badge">미리보기 (발행 승인 전)</span><span class="badge">{DATE}</span>
</header>
{body}
<footer class="ft">패널 이미지 + 대사 오버레이 미리보기 뷰어. 최종 발행본은 SVG 오버레이 확정본으로 교체됩니다.<br>
<a href="../" style="color:#8fdcff">← CLE3 홈</a> · <a href="../season.html" style="color:#8fdcff">시즌 1 전체 보기</a></footer>
</div></body></html>'''
os.makedirs(f"docs/episodes/{EP}", exist_ok=True)
with open(f"docs/episodes/{EP}/index.html", "w", encoding="utf-8") as f:
    f.write(html_doc)
print(f"viewer written: docs/episodes/{EP}/index.html ({len(panels)} panels)")
