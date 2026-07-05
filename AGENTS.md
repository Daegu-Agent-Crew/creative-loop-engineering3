# CLE3 — Creative Loop Engineering 3

## 프로젝트 개요
CLE3는 원작 텍스트를 자동으로 웹툰 에피소드로 변환하는 AI 파이프라인입니다. 6단계 Phase를 거쳐 스토리 각색부터 최종 배포까지 수행합니다.

## 6단계 파이프라인

| Phase | 이름 | 입력 | 출력 | 스키마 |
|-------|------|------|------|--------|
| 1 | Story | 원작 텍스트 | 장면/대사 JSON | `schemas/story.schema.json` |
| 2 | Characters | Story JSON | 캐릭터 디자인 명세 | `schemas/characters.schema.json` |
| 3 | Storyboard | Story + Characters | 페이지/패널 레이아웃 | `schemas/storyboard.schema.json` |
| 4 | Panels | Storyboard | 패널 이미지 | `schemas/panels.schema.json` |
| 5 | QA | 전체 산출물 | 품질 보증 리포트 | `schemas/qa.schema.json` |
| 6 | Deploy | QA 통과 산출물 | GitHub Pages 배포 | `schemas/deploy.schema.json` |

## 핵심 규칙

### 평가 루프
- 각 Phase 종료 후 루브릭 평가 진행 (5항목 × 10점 = 50점)
- 통과 기준: **≥40점** (Phase 5는 ≥42점)
- 미달 시 자동 롤백 → 이전 Phase 재실행
- 개선 예산: 총 15회, Phase당 최대 5회, 롤오버 허용

### 상태 관리
- `state.json`에서 현재 에피소드, Phase, 개선 예산 추적
- 모든 산출물은 JSON Schema로 검증
- `episodes/{episode_id}/` 디렉토리 구조 사용

### 품질 기준
- 원작 충실성 최우선
- 캐릭터 일관성 필수
- 한글 렌더링 정확도 확인
- `evaluation-rubric.md` 참고

## 디렉토리 구조
```
creative-loop-engineering3/
├── AGENTS.md              # 프로젝트 가이드 (이 파일)
├── state.json             # 파이프라인 상태
├── evaluation-rubric.md   # 평가 루브릭
├── schemas/               # JSON Schema (6개)
│   ├── story.schema.json
│   ├── characters.schema.json
│   ├── storyboard.schema.json
│   ├── panels.schema.json
│   ├── qa.schema.json
│   └── deploy.schema.json
├── episodes/              # 에피소드 산출물
├── prompts/               # Phase별 프롬프트 템플릿
├── docs/                  # GitHub Pages
└── .github/workflows/     # CI/CD
```

## 에이전트 규칙
- 각 Phase 산출물은 반드시 JSON Schema 검증 후 저장
- `improvement_budget` 초과 시 사람 개입 요청
- 롤백 시 `rollback_history`에 기록
- 배포는 Phase 5 통과 후에만 실행
