#!/usr/bin/env python3
# EP010 (S2E05) initialization: state registration + directory skeleton + bible succession
import json, os, shutil

ROOT = "/data/data/com.termux/files/home/.openclaw/workspace/creative-loop-engineering3"

# 1. state.json registration
sp = os.path.join(ROOT, "state.json")
state = json.load(open(sp, encoding="utf-8"))
assert "EP010" not in state["episodes"], "EP010 already registered"
state["current_episode"] = "EP010"
state["current_phase"] = "phase1_story"
state["episodes"]["EP010"] = {
    "title": "면벽하지 않는 자들",
    "status": "in_progress",
    "current_phase": "phase1_story",
    "phases": {
        "phase0": {"status": "completed", "score": None, "note": "시즌2 각색안 승인 자산"},
        "phase0.5": {"status": "completed", "score": None, "note": "EP001~009 성경·화풍 계승"},
        "phase1": {"status": "in_progress", "score": None, "note": "S2E05 노이즈 면벽 — v5.1 단일 진원 착수"},
    },
    "season": 2,
    "source": "episodes/EP010/story/source-story.md",
    "note": "2026-11-14 새벽 크론 착수 (EP007~009는 발행 승인 대기 — 생산은 지속)",
}
json.dump(state, open(sp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(sp, "a", encoding="utf-8").write("\n")

# 2. directory skeleton
for d in ["story", "script", "storyboard", "characters",
          "panels/assets", "panels/previews", "panels/final",
          "approvals", "decisions", "discovery", "memory", "qa",
          "characters/assets"]:
    os.makedirs(os.path.join(ROOT, "episodes/EP010", d), exist_ok=True)
for f in ["panels/assets/.gitkeep", "panels/previews/.gitkeep", "panels/final/.gitkeep"]:
    p = os.path.join(ROOT, "episodes/EP010", f)
    if not os.path.exists(p):
        open(p, "w").close()

# 3. source story copy (season2 master)
shutil.copy(os.path.join(ROOT, "adaptations/season2-bug-report/season2-story.md"),
            os.path.join(ROOT, "episodes/EP010/story/source-story.md"))

# 4. character bible succession from EP009 (neutralize EP009-specific phrasing, add 양동)
cp = os.path.join(ROOT, "episodes/EP009/characters/characters.json")
cb = json.load(open(cp, encoding="utf-8"))
cb["episode_id"] = "EP010"
for ch in cb.get("characters", []):
    for key in ["appearance", "personality", "style_notes", "source_prompt", "role"]:
        if key in ch and isinstance(ch[key], str):
            ch[key] = ch[key].replace("안경 렌즈의 흰 반사가 이번 화의 핵심 소재(p5-4 오차의 결)", "안경 렌즈의 흰 반사는 시그니처 연출")
            ch[key] = ch[key].replace("p13 '디버거 프롬프트' UI로만 나타난다", "위조 엔진 UI 토템(붉은 톱니 파형·디버거 프롬프트)으로만 나타난다")
cb["characters"].append({
    "name": "양동",
    "role": "S2E05 신규 — 청신의 딸. 어머니의 미완의 실험(인류 쪽 버그 리포트 초고)을 물려받은 물리학자",
    "appearance": "20대 중국 여성, 어머니 청신을 닮은 차분한 이목구비, 어깨 아래 검은 생머리, 앞머리 옆으로 넘김, 회색 카디건 위 연한 하늘색 블라우스, 작은 가죽 서류가방(어머니의 육필 원고 보관). 외형은 첫 배치에서 canonical 시트로 고정한다.",
    "personality": "침묵하고 관찰적. 죄책이 아니라 질문을 유산으로 받아들임",
    "style_notes": "청신(EP001 70대)과의 얼굴 유사성 — 눈매·입가. 복장은 딸 세대로 현대적",
    "canonical": "episodes/EP010/characters/assets/yangdong-canonical.png (첫 배치 생성)",
})
out = os.path.join(ROOT, "episodes/EP010/characters/characters.json")
json.dump(cb, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(out, "a", encoding="utf-8").write("\n")

print("EP010 registered; dirs created; source-story + characters.json succeeded")
print("current_episode:", state["current_episode"], "| current_phase:", state["current_phase"])
