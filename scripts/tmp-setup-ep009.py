#!/usr/bin/env python3
# EP009 (S2E04) initialization: state registration + directory skeleton + bible succession
import json, os, shutil, re

ROOT = "/data/data/com.termux/files/home/.openclaw/workspace/creative-loop-engineering3"

# 1. state.json registration
sp = os.path.join(ROOT, "state.json")
state = json.load(open(sp, encoding="utf-8"))
assert "EP009" not in state["episodes"], "EP009 already registered"
state["current_episode"] = "EP009"
state["current_phase"] = "phase1_story"
state["episodes"]["EP009"] = {
    "title": "게임은 QA였다",
    "status": "in_progress",
    "current_phase": "phase1_story",
    "phases": {
        "phase0": {"status": "completed", "score": None, "note": "시즌2 각색안 승인 자산"},
        "phase0.5": {"status": "completed", "score": None, "note": "EP001~008 성경·화풍 계승"},
        "phase1": {"status": "in_progress", "score": None, "note": "S2E04 삼체 게임 재해석 — v5.1 단일 진원 착수"},
    },
    "season": 2,
    "source": "episodes/EP009/story/source-story.md",
    "note": "2026-11-12 새벽 크론 착수 (EP007·EP008은 발행 승인 대기 — 생산은 지속)",
}
json.dump(state, open(sp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(sp, "a", encoding="utf-8").write("\n")

# 2. directory skeleton
for d in ["story", "script", "storyboard", "characters",
          "panels/assets", "panels/previews", "panels/final",
          "approvals", "decisions", "discovery", "memory", "qa"]:
    os.makedirs(os.path.join(ROOT, "episodes/EP009", d), exist_ok=True)
for f in ["panels/assets/.gitkeep", "panels/previews/.gitkeep", "panels/final/.gitkeep"]:
    p = os.path.join(ROOT, "episodes/EP009", f)
    if not os.path.exists(p):
        open(p, "w").close()

# 3. source story copy (season2 master)
shutil.copy(os.path.join(ROOT, "adaptations/season2-bug-report/season2-story.md"),
            os.path.join(ROOT, "episodes/EP009/story/source-story.md"))

# 4. character bible succession from EP008 (episode_id swap + EP008-specific phrasing neutralized)
cp = os.path.join(ROOT, "episodes/EP008/characters/characters.json")
cb = json.load(open(cp, encoding="utf-8"))
cb["episode_id"] = "EP009"
for ch in cb.get("characters", []):
    for key in ["appearance", "personality", "style_notes", "source_prompt"]:
        if key in ch and isinstance(ch[key], str):
            ch[key] = ch[key].replace("이번 화의 핵심 소재(p5-4 오차의 결)", "시즌2 연속성 유지")
            ch[key] = ch[key].replace("p15 제출처 빈칸의 버그 리포트로 아크 종결.", "시즌2 아크 내 연속성 유지.")
            ch[key] = ch[key].replace("커피잔이 이번 화의 시그니처 프롭.", "커피잔·담배는 시그니처 프롭.")
out = os.path.join(ROOT, "episodes/EP009/characters/characters.json")
json.dump(cb, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(out, "a", encoding="utf-8").write("\n")

print("EP009 registered; dirs created; source-story + characters.json succeeded")
print("current_episode:", state["current_episode"], "| current_phase:", state["current_phase"])
