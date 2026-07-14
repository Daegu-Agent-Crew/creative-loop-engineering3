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
| 1 | Story (4단계) | 원작 텍스트 | analysis→outline→scenes→script | `schemas/story.schema.json` |
| 2 | Characters | Story JSON | 캐릭터 디자인 명세 | `schemas/characters.schema.json` |
| 3 | Storyboard | Story + Characters | 페이지/패널 레이아웃 | `schemas/storyboard.schema.json` |
| 4 | Panels (4단계) | Storyboard | 화풍→시트→배경→컷 | `schemas/panels.schema.json` |
| 5 | QA | 전체 산출물 | 품질 보증 리포트 | `schemas/qa.schema.json` |
| 6 | Deploy | QA 통과 산출물 | GitHub Pages 배포 | `schemas/deploy.schema.json` |

## 작업 전 Discovery와 사람 승인

- Phase 0은 저장소, 도구, 권한과 스키마를 확인한다.
- Phase 0.5는 에피소드의 `discovery/context.json`에서 Unknown Map, 레퍼런스,
  실행 가정과 사람 결정 항목을 확인한다.
- 판단 기록은 내부 사고 전체가 아니라 결정, 근거, 확신도, 불확실성, 검토한
  대안과 승인 상태만 `decisions/implementation-notes.json`에 저장한다.
- 정상 작업은 정책 범위 안에서 계속 진행한다. 사람은 Story Lock, Character
  Lock, Storyboard Lock, Release Approval과 예외 에스컬레이션만 검토한다.
- 과거 완료 Phase에 명시적 승인 기록이 없으면 승인으로 추정하지 않고
  `provisional`로 표시한다.
- 상세 운영 규칙: `docs/AI-COLLABORATION-PROTOCOL.md`

## Phase 1 상세: 4단계 스토리 각색 워크플로우

Phase 1(Story)는 다음 4단계로 내부 세분화됩니다:

```
[A] 원작 분석 → [B] 구조 설계 → [C] 장면 작성 → [D] 패널 분해
```

- **[A] 원작 분석:** 사건 추출, 테마, 캐릭터 아크, 로그라인, 가설 배당
- **[B] 구조 설계:** 3막 분할, 비트 시트(Save the Cat), 페이지 배당, 감정 곡선
- **[C] 장면 작성:** 장면별 대사, 감정, 연출 의도, 색감, 가설 태깅
- **[D] 패널 분해:** 페이지/패널 분할, 감정/연출 메모 (Phase 4에서 직접 사용)

상세 가이드: `prompts/story/v3.md` 참고

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

### Phase 4 자율 실행 정책

- 패널 생성 작업을 시작하거나 재개하는 에이전트는 먼저
  `config/panel-generation-policy.json`과
  `docs/AUTONOMOUS-PANEL-GENERATION.md`를 읽는다.
- 정상 작업의 선택, 동시 실행, 1차 QA와 재시도 판단은 저성능 작업 모델이
  정책 범위 안에서 자율적으로 처리한다.
- 실제 이미지는 `gpt-image-2`로 한 요청당 한 장씩 생성한다.
- 일반 패널은 최대 3개, 복잡 패널은 최대 1개만 동시에 실행한다.
- 같은 패널이 2회 실패하거나 입력이 모호할 때만 고성능 추론 모델로 승격한다.
- 일부 패널의 실패 때문에 전체 큐를 중단하지 않는다. 실패 작업은 보류 또는
  승격하고 다음 실행 가능한 패널을 계속 처리한다.
- `parallel_limit`은 문서용 숫자가 아니다. 실행기는 반드시 이 값을 읽어 실제
  동시 실행 수를 제한해야 한다.

### Phase 4 운영 원칙
- 패널 1장씩 완전 직렬 생성하지 않는다. 기본 단위는 `page` 배치다.
- `scripts/sync-panels.js`는 패널 슬롯/프롬프트를 정리하고, `scripts/build-panel-jobs.js`는 실행 큐를 만든다.
- 일반 패널은 동시 2~3개, 복잡한 다인물/몽타주/풀페이지는 동시 1개 기준으로 처리한다.
- 이미지 생성 단계에서는 대사/자막을 가능한 한 비우고, 텍스트는 후처리 오버레이 대상으로 본다.
- QA 실패 시 전체 Phase 롤백 대신 실패 패널과 인접 패널만 재검토/재생성한다.

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
├── config/
│   └── panel-generation-policy.json # Phase 4 자율 실행 정책
├── evaluation-rubric.md   # 평가 루브릭
├── schemas/               # Phase 산출물 및 운영 데이터 JSON Schema
│   ├── story.schema.json
│   ├── characters.schema.json
│   ├── storyboard.schema.json
│   ├── panels.schema.json
│   ├── qa.schema.json
│   ├── deploy.schema.json
│   ├── discovery.schema.json
│   ├── decision-log.schema.json
│   └── approvals.schema.json
├── episodes/              # 에피소드 산출물
│   └── EP001/
│       ├── script/        # Phase 1 산출물
│       ├── characters/    # Phase 2 산출물
│       ├── storyboard/    # Phase 3 산출물
│       ├── panels/        # Phase 4 산출물
│       ├── discovery/     # 작업 맥락, Unknown, 도구, 레퍼런스
│       ├── decisions/     # 검토 가능한 판단 근거와 불확실성
│       ├── qa/            # Phase 5 산출물
│       └── approvals/     # 사람 승인 게이트
├── styles/                # 화풍 에셋
│   ├── characters/        # 캐릭터 시트 PNG
│   ├── backgrounds/       # 배경 PNG 라이브러리
│   └── tests/             # 화풍 테스트 이미지
├── prompts/               # Phase별 프롬프트 템플릿
│   ├── story/v2.md (deprecated)
│   ├── story/v3.md
│   ├── character/v2.md
│   ├── storyboard/v2.md
│   ├── image/v2.md
│   └── qa/v2.md
├── docs/                  # GitHub Pages
│   ├── IMAGE-WORKFLOW.md  # 4단계 이미지 워크플로우 상세
│   ├── AUTONOMOUS-PANEL-GENERATION.md # 자율 실행/인계 가이드
│   ├── index.html
│   └── js/app.js
├── scripts/
│   ├── sync-panels.js     # storyboard + characters -> panels.json 동기화
│   ├── build-panel-jobs.js # panels.json -> generation-jobs.json 배치 큐 생성
│   ├── init-episode-governance.js # 에피소드 운영 데이터 초기화
│   └── validate-episode-governance.js # 운영 데이터/참조/큐 검증
├── wiki/                  # 세계관 위키
└── .github/workflows/     # CI/CD
```

## 에이전트 규칙
- 에피소드 작업 시작 또는 기준선 변경 전에 `discovery/context.json`을 확인하고
  `preflight.status`가 `blocked`면 정상 실행을 시작하지 않는다.
- Unknown을 모두 해소할 때까지 기다리지 않는다. non-blocking 항목은 가정을
  기록하고 진행하며, 가치/방향/최종 승인 또는 정책 예외만 사람에게 요청한다.
- 각 Phase 산출물은 반드시 JSON Schema 검증 후 저장
- `improvement_budget` 초과 시 사람 개입 요청
- 롤백 시 `rollback_history`에 기록
- 배포는 Phase 5 통과 후에만 실행
- 화풍 변경 시 Phase 2부터 재실행 (캐릭터 디자인이 화풍에 종속적)
- Phase 4 재개 시 `docs/AUTONOMOUS-PANEL-GENERATION.md`의 시작 체크리스트를
  따르고, 기존 PNG 파일과 JSON 상태를 먼저 대조한다.
- Phase 4 패널 생성 속도를 높이기 위해 수동 1장 직렬 작업을 기본값으로 삼지
  않는다. 먼저 `node scripts/build-panel-jobs.js EPxxx`로 큐를 갱신하고,
  `node scripts/run-panel-jobs.js --episode EPxxx --dry-run --max-jobs 3`로
  다음 실행 배치를 선택한다. 저성능 워커가 선택·QA·재시도 판단을 맡고,
  이미지만 `gpt-image-2`로 생성한다.
- 패널 자산을 추가하는 모든 작업은 `config/asset-storage-policy.json`과
  `docs/ASSET-STORAGE-POLICY.md`를 따른다. 원본/후보/실패 이미지는 Git에
  커밋하지 않고, 커밋 전 `node scripts/check-panel-assets.js`를 실행한다.
- 패널 텍스트 후처리는 페이지 단위로 진행한다. 이미지가 생성된 페이지는
  `node scripts/build-text-overlays.js --episode EPxxx --generated-only`로
  `text-overlays.json`을 갱신하고,
  `node scripts/render-panel-overlays.js --episode EPxxx --page N`으로
  `episodes/EPxxx/panels/final/*.svg` 최종본을 만든다. 대시보드는 final이
  있으면 원본 PNG 대신 후처리 SVG를 먼저 보여준다.
