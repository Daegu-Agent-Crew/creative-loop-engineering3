#!/usr/bin/env python3
# EP011 (S2E06 finale) initialization: state registration + directory skeleton + bible succession
import json, os, shutil

ROOT = "/data/data/com.termux/files/home/.openclaw/workspace/creative-loop-engineering3"

# 1. state.json registration
sp = os.path.join(ROOT, "state.json")
state = json.load(open(sp, encoding="utf-8"))
assert "EP011" not in state["episodes"], "EP011 already registered"
state["current_episode"] = "EP011"
state["current_phase"] = "phase1_story"
state["episodes"]["EP011"] = {
    "title": "\ubc84\uadf8 \ub9ac\ud3ec\ud2b8 \uc81c\ucd9c",
    "status": "in_progress",
    "current_phase": "phase1_story",
    "phases": {
        "phase0": {"status": "completed", "score": None, "note": "\uc2dc\uc9982 \uac01\uc0c9\uc548 \uc2b9\uc778 \uc790\uc0b0"},
        "phase0.5": {"status": "completed", "score": None, "note": "EP001~010 \uc131\uacbd\xb7\ud654\ud48d \uacc0\uc2b9"},
        "phase1": {"status": "in_progress", "score": None, "note": "S2E06 \ud53c\ub098\ub808 \u2014 11\ubd84\uc758 \uc9c4\uc9dc + 1379 \uba54\uc2dc\uc9c0, v5.1 \ub2e8\uc77c \uc9c4\uc6d0 \ucc29\uc218"},
    },
    "season": 2,
    "source": "episodes/EP011/story/source-story.md",
    "note": "2026-11-16 \uc0c8\ubcbd \ud06c\ub860 \ucc29\uc218 (EP007~010\uc740 \ubc1c\ud589 \uc2b9\uc778 \ub300\uae30 \u2014 \uc0dd\uc0b0\uc740 \uc9c0\uc18d)",
}
json.dump(state, open(sp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(sp, "a", encoding="utf-8").write("\n")

# 2. directory skeleton
for d in ["story", "script", "storyboard", "characters",
          "panels/assets", "panels/previews", "panels/final",
          "approvals", "decisions", "discovery", "memory", "qa",
          "characters/assets"]:
    os.makedirs(os.path.join(ROOT, "episodes/EP011", d), exist_ok=True)
for f in ["panels/assets/.gitkeep", "panels/previews/.gitkeep", "panels/final/.gitkeep"]:
    p = os.path.join(ROOT, "episodes/EP011", f)
    if not os.path.exists(p):
        open(p, "w").close()

# 3. source story copy (season2 master)
shutil.copy(os.path.join(ROOT, "adaptations/season2-bug-report/season2-story.md"),
            os.path.join(ROOT, "episodes/EP011/story/source-story.md"))

# 4. character bible succession from EP010 (finale: same cast, yangdong continuing)
cp = os.path.join(ROOT, "episodes/EP010/characters/characters.json")
cb = json.load(open(cp, encoding="utf-8"))
cb["episode_id"] = "EP011"
for ch in cb.get("characters", []):
    if ch.get("name") == "\uc591\ub3d9":
        ch["role"] = "\uccad\uc2e0\uc758 \ub538. \uc5b4\uba38\ub2c8\uc758 \ubbf8\uc644\uc758 \uc2e4\ud5d8(\uc778\ub958 \ucabd \ubc84\uadf8 \ub9ac\ud3ec\ud2b8 \ucd08\uace0)\uc744 \ubb3c\ub824\ubc1b\uc740 \ubb3c\ub9ac\ud559\uc790 \u2014 S2E06 \ud53c\ub090\ub808\uc5d0\uc11c \ub9ac\ud3ec\ud2b8 \uc81c\ucd9c\uc758 \uc5f4\uc1e0"
        ch["canonical"] = "episodes/EP010/characters/assets/yangdong-canonical.png (EP010 \uace0\uc815 \uc2dc\ud2b8 \uacc0\uc2b9)"
out = os.path.join(ROOT, "episodes/EP011/characters/characters.json")
json.dump(cb, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(out, "a", encoding="utf-8").write("\n")

print("EP011 registered; dirs created; source-story + characters.json succeeded")
print("current_episode:", state["current_episode"], "| current_phase:", state["current_phase"])
