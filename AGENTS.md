# CLE3 — Creative Loop Engineering 3

## 프로젝트 개요
CLE3는 원작 텍스트를 자동으로 만화 에피소드로 변환하는 AI 파이프라인입니다.
6단계 Phase를 거쳐 스토리 각색부터 최종 배포까지 수행합니다.

## 화풍: 닥터슬럼프풍 (Akira Toriyama style)
- **결정일:** 2026-07-06 (이전 수채화풍에서 전환)
- **특징:** 깔끔한 잉크 선, 셀 채색, 둥근 캐릭터 디자인, 밝은 팔레트
- **모든 프롬프트에 STYLE_BLOCK 필수 포함**

## 화풍 고정 블록 (모든 이미지 생성 시 맨 앞에 배치)

```
STYLE_BLOCK = """
Bold clean ink linework, flat vibrant cell-shaded colors,
rounded expressive character designs, dramatic but playful composition,
distinctive 1980s Akira Toriyama manga aesthetic.
Simple but expressive backgrounds with bold black shadows.
Clean panel borders, dynamic perspective.
"""
```

## 6단계 파이프라인

| Phase | 이름 | 입력 | 출력 | 스키마 |
|-------|------|------|------|--------|
| 1 | Story | 원작 텍스트 | 장면/대사 JSON | `schemas/story.schema.json` |
| 2 | Characters | Story JSON | 캐릭터 디자인 명세 | `schemas/characters.schema.json` |
| 3 | Storyboard | Story + Characters | 페이지/패널 레이아웃 | `schemas/storyboard.schema.json` |
| 4 | Panels | Storyboard | 패널 이미지 | `schemas/panels.schema.json` |
| 5 | QA | 전체 산출물 | 품질 보증 리포트 | `schemas/qa.schema.json` |
| 6 | Deploy | QA 통과 산출물 | GitHub Pages 배포 | `schemas/deploy.schema.json` |

## Phase 4 상세: 4단계 이미지 워크플로우

Phase 4(Panels)는 다음 4단계로 내부 세분화됩니다:

```
[A] 화풍 정의 → [B] 캐릭터 시트 → [C] 배경 → [D] 컷 연출
```

- **[A] 화풍:** STYLE_BLOCK 고정 (1회성, 변경 시에만 재실행)
- **[B] 캐릭터 시트:** 각 캐릭터 다각도·표정 시트 생성
- **[C] 배경:** 장소별 배경 이미지 단독 생성 (캐릭터 없이)
- **[D] 컷 연출:** A+B+C 조합 → 최종 만화 패널 완성

상세 가이드: `docs/IMAGE-WORKFLOW.md` 참고

## 이미지 생성 도구: Codex CLI

### 환경
- **플랫폼:** Android Termux
- **Codex CLI:** v0.139.0, ChatGPT 구독 인증
- **이미지 모델:** gpt-image-2 (Codex 내장 $imagegen)
- **API key 불필요** — ChatGPT 구독으로 인증 완료

### 기본 명령어

```bash
# 대화형
codex
# 프롬프트에 "$imagegen: ..." 또는 자연어로 이미지 생성 요청

# 비대화형 (파이프라인 자동화용)
codex exec --sandbox workspace-write '$imagegen: [프롬프트]. Save to [경로]'

# 참조 이미지 첨부 (편집/파생)
codex -i reference.png exec --sandbox workspace-write '$imagegen: [프롬프트]'
```

### 주의사항
- 이미지 생성은 usage limit을 3-5배 빨리 소모
- 생성 후 반드시 `$CODEX_HOME/generated_images/`에서 프로젝트 경로로 복사
- 한 번에 1장씩 생성 권장

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
- 닥터슬럼프풍 스타일 일관성 필수
- 캐릭터 외모 일관성 (시트 기준)
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
│   └── EP001/
│       ├── script/        # Phase 1 산출물
│       ├── characters/    # Phase 2 산출물
│       ├── storyboard/    # Phase 3 산출물
│       ├── panels/        # Phase 4 산출물
│       └── qa/            # Phase 5 산출물
├── styles/                # 화풍 에셋
│   ├── characters/        # 캐릭터 시트 PNG
│   ├── backgrounds/       # 배경 PNG 라이브러리
│   └── tests/             # 화풍 테스트 이미지
├── prompts/               # Phase별 프롬프트 템플릿
│   ├── story/v2.md
│   ├── character/v2.md
│   ├── storyboard/v2.md
│   ├── image/v2.md
│   └── qa/v2.md
├── docs/                  # GitHub Pages
│   ├── IMAGE-WORKFLOW.md  # 4단계 이미지 워크플로우 상세
│   ├── index.html
│   └── js/app.js
├── wiki/                  # 세계관 위키
└── .github/workflows/     # CI/CD
```

## 에이전트 규칙
- 각 Phase 산출물은 반드시 JSON Schema 검증 후 저장
- `improvement_budget` 초과 시 사람 개입 요청
- 롤백 시 `rollback_history`에 기록
- 배포는 Phase 5 통과 후에만 실행
- 화풍 변경 시 Phase 2부터 재실행 (캐릭터 디자인이 화풍에 종속적)
