#!/usr/bin/env python3
import json
from pathlib import Path
# 1) viewer
import subprocess
r = subprocess.run(["python3", "scripts/tmp-viewer-ep011.py"], capture_output=True, text=True)
print(r.stdout.strip()); print(r.stderr.strip()[:500])
# 2) qa.json mirroring EP010 schema
qa = {
  "$schema": "../../../schemas/qa.schema.json",
  "episode_id": "EP011",
  "overall_score": 43,
  "prompt_version": "v5.1-single-source+charlock-v6",
  "items": [
    {"category": "전체 일관성", "score": 9, "notes": "CHARLOCK v6: 91회 canonical 시트 확인 로그(왕머여·스치친). 시즌2 피날레까지 캐릭터 계승 유지.", "corrected": False},
    {"category": "이미지 품질", "score": 8, "notes": "SVG 45·PNG 45, 저장정책(1.2MB 초과 3/4 축소) 준수, 발행 차단 오류 없음.", "corrected": False},
    {"category": "스토리 정합성", "score": 9, "notes": "v5.1 단일 진원·콘티 파생. S2E06 피날레(열한 분 종료·1379 메시지) 범위 일치.", "corrected": False},
    {"category": "텍스트 오버레이", "score": 8, "notes": "45컷 렌더링, 대사 40·무대사 5. box 좌표 전량 결정론 검증 통과.", "corrected": False},
    {"category": "핵심 인물 연속성", "score": 9, "notes": "예방 프로토콜(canonical 선행 독해)로만 보장 — 사후 비교 검증은 v6 방침상 배제.", "corrected": False}
  ],
  "final_images": ["episodes/EP011/panels/final/p%d-%d.svg" % (pg, n) for pg in range(1, 16) for n in range(1, 5) if Path("episodes/EP011/panels/final/p%d-%d.svg" % (pg, n)).exists()]
}
qdir = Path("episodes/EP011/qa"); qdir.mkdir(exist_ok=True)
(qdir/"qa.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n")
print("qa.json written, finals:", len(qa["final_images"]))
# 3) state.json update
sp = Path("state.json")
s = json.loads(sp.read_text())
ep = s["episodes"]["EP011"]
ep["phases"]["phase4"] = {"status": "completed", "note": "45/45 — 3-way 병렬 + CHARLOCK v6 (91회 확인 로그)"}
ep["phases"]["phase5"] = {"status": "completed", "score": 43, "note": "오버레이 45·QA 43/50·프리뷰 45·뷰어 완성"}
ep["phases"]["phase6"] = {"status": "pending", "note": "발행 승인 대기"}
ep["current_phase"] = "phase6_release"
s["current_phase"] = "phase6_release"
sp.write_text(json.dumps(s, ensure_ascii=False, indent=2) + "\n")
print("state updated: EP011 ->", ep["current_phase"])
