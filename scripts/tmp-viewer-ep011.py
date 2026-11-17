#!/usr/bin/env python3
import json
from pathlib import Path
EP = "EP011"
root = Path(".")
sb = json.loads((root/"episodes"/EP/"storyboard"/"storyboard.json").read_text())
ov = json.loads((root/"episodes"/EP/"panels"/"text-overlays.json").read_text())
ovmap = {p["panel_id"]: p.get("overlays", []) for p in ov["panels"]}
RAW = "https://raw.githubusercontent.com/Daegu-Agent-Crew/creative-loop-engineering3/main/episodes/EP011/panels/assets"
klass = {"dialogue": "dial", "caption": "cap", "sfx": "sfx"}
secs = []
for pg in sb["pages"]:
    num = pg["page_number"]
    figs = []
    for p in pg["panels"]:
        pid = p["panel_id"]
        divs = []
        for o in ovmap.get(pid, []):
            k = klass.get(o.get("kind", "caption"), "cap")
            b = o["box"]
            sp = (o.get("speaker") or "").strip()
            tx = o["text"]
            lab = ("<b>" + sp + "</b>: " + tx) if sp else tx
            style = "left:%.1f%%;top:%.1f%%;width:%.1f%%" % (b["x"]*100, b["y"]*100, b["w"]*100)
            divs.append('<div class="t ' + k + '" style="' + style + '">' + lab + '</div>')
        figs.append('<figure class="panel"><img loading="lazy" src="' + RAW + '/' + pid + '.png" alt="' + pid + '">' + "".join(divs) + '</figure>')
    secs.append('<section class="page"><h2 class="ph">PAGE ' + ("%02d" % num) + '</h2>' + "".join(figs) + '</section>')
head = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EP011 버그 리포트 제출 — 미리보기 | CLE3</title><style>
*{box-sizing:border-box}body{margin:0;background:#0c1017;color:#eee;font-family:"Noto Sans KR","Apple SD Gothic Neo",sans-serif}
.wrap{max-width:860px;margin:auto;padding:20px 14px 70px}
.hd{padding:26px 0 20px;border-bottom:1px solid #29313f}.eyebrow{color:#8fdcff;font-size:.78rem;letter-spacing:.14em}
h1{margin:.3rem 0 .2rem;font-size:clamp(1.6rem,6vw,2.6rem)}
.sub{color:#9aa5b5;font-size:.9rem}.badge{display:inline-block;border:1px solid #3a4354;border-radius:999px;padding:5px 10px;font-size:.75rem;color:#c7d0de;margin:12px 6px 0 0}
.page{margin-top:34px}.ph{font-size:.85rem;letter-spacing:.12em;color:#8e99ab;border-bottom:1px solid #232b38;padding-bottom:6px}
.panel{position:relative;margin:12px 0;background:#11141c;border:1px solid #232b38;border-radius:8px;overflow:hidden}
.panel img{display:block;width:100%;height:auto}
.t{position:absolute;font-weight:700;line-height:1.35;text-shadow:0 0 6px #000,0 0 3px #000,1px 1px 0 #000,-1px -1px 0 #000}
.dial{font-size:clamp(12px,2.6vw,16px);color:#fff}
.cap{font-size:clamp(11px,2.2vw,13px);color:#ffe9b0}
.sfx{font-size:clamp(16px,4vw,24px);color:#ff5f5f;transform:rotate(-4deg)}
.ft{margin-top:50px;border-top:1px solid #232b38;padding-top:16px;color:#77839a;font-size:.8rem;line-height:1.7}
</style></head><body><div class="wrap">
<header class="hd"><div class="eyebrow">CLE3 · SEASON 2 · EP011</div>
<h1>버그 리포트 제출</h1>
<div class="sub">시즌2 피날레. 자기참조 주입에서 열한 분의 종료, 그리고 1379의 메시지까지.</div>
<span class="badge">15페이지 · 45컷</span><span class="badge">미리보기 (발행 승인 전)</span><span class="badge">2026-11-18</span>
</header>'''
foot = '''<footer class="ft">패널 이미지 + 대사 오버레이 미리보기 뷰어. 최종 발행본은 SVG 오버레이 확정본으로 교체됩니다.<br>
<a href="../" style="color:#8fdcff">← CLE3 홈</a> · <a href="../season.html" style="color:#8fdcff">시즌 1 전체 보기</a></footer>
</div></body></html>'''
doc = head + "".join(secs) + foot
out = root/"docs"/"episodes"/EP
out.mkdir(parents=True, exist_ok=True)
(out/"index.html").write_text(doc)
print("viewer written:", out/"index.html", len(doc), "bytes,", len(secs), "pages")
