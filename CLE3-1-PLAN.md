# CLE3-1 구현 계획

## 1. 결론

CLE3-1은 기존의 "삼체 만화 파일 파이프라인"을 버리지 않고, 이를 첫 번째
Creative Template로 감싸는 범용 창작 워크플로우 시스템으로 재구성한다.

핵심 제품 계약은 다음과 같다.

> 모든 Codex 출력은 버전된 Artifact이고, 모든 진행은 검증된 State Transition이며,
> 사람의 목표·예외·승인 입력은 감사 가능하게 기록되고, 최종 결과는 결정론적
> Renderer가 만든다.

CLE3-1의 성공 기준은 에이전트 수가 아니라 아래 네 가지다.

1. 중단 후 같은 체크포인트에서 중복 실행 없이 재개된다.
2. 스키마에 맞지 않는 출력은 다음 단계로 넘어가지 못한다.
3. 사람의 피드백과 Codex 최종본의 차이가 다음 작업의 검색 가능한 선호 규칙으로 축적된다.
4. 같은 승인된 입력으로 다시 조립하면 같은 결과와 manifest hash가 나온다.

## 2. 현재 CLE3 파악 결과

### 유지할 자산

- Story → Characters → Storyboard → Panels → QA → Deploy의 명확한 창작 단계
- `schemas/`에 분리된 산출물 계약
- 패널 생성 큐, 복잡도별 병렬 제한, 실패 패널만 재시도하는 정책
- 이미지와 텍스트 오버레이를 분리한 후처리 구조
- `main`에 통합된 Discovery, Decision Log, Approval Gate
- GitHub Pages에서 에피소드, 단계, 산출물, QA를 한곳에 보여 주는 화면

### 현재 한계

| 영역 | 현재 상태 | CLE3-1에서 필요한 변화 |
|---|---|---|
| 오케스트레이션 | `state.json`과 여러 Node 스크립트가 상태를 개별 수정 | 단일 Transition API와 상태 그래프를 유일한 쓰기 경로로 사용 |
| 실행 | `run-panel-jobs.js`는 실제 실행기가 아니라 다음 명령 목록을 출력 | 작업 큐, lease, heartbeat, idempotency key가 있는 worker 실행 |
| 스키마 | JSON Schema 파일은 있으나 검증기는 일부 필드를 수동 검사 | 모든 입출력, 이벤트, 전이를 한 계약 계층에서 검증 |
| HITL | 승인 정보는 파일, QA 입력은 브라우저 `localStorage` | 서버 영속 Gate, suspend/resume, JSON Patch, 감사 로그 |
| 메모리 | `wiki/`와 파일 참조는 있으나 검색·주입·학습 루프 없음 | provenance가 있는 단기 상태 + 장기 지식/선호 검색 |
| 어셈블리 | SVG 오버레이는 결정론적이지만 전체 산출물 manifest가 없음 | renderer input 고정, 재현 가능한 build manifest와 hash 생성 |
| UI | 읽기 중심 대시보드, 좌표를 직접 조정할 양방향 편집기 없음 | Canvas ↔ RenderSpec JSON 양방향 편집, diff, undo/redo |
| 운영 | GitHub Pages가 정적 파일과 브라우저 PAT에 의존 | 공개 Viewer와 인증된 Control Plane 분리, PAT 저장 제거 |
| 범용성 | 에피소드·패널·특정 화풍이 코어 모델에 결합 | Workflow Template와 Renderer Adapter로 도메인 분리 |

현재 공개 사이트는 `main` 브랜치의 정적 Viewer다. Discovery, Decision Log와
네 개 승인 게이트도 `main`에 통합되어 있으므로 CLE3-1은 현재 `main`을 기준선으로
삼는다.

## 3. 제품 범위

### 3.1 CLE3-1 MVP에 포함

- 단일 운영자 또는 소규모 팀용 Creative Project/Run 관리
- 만화 제작 Template 1개
- Planning, Execution, Verification, Human Gate, Assembly의 전체 루프
- Story/Character/Storyboard/Panel 작업의 병렬 실행
- Planning Gate, Failsafe Gate, Pre-render Gate
- 체크포인트 기반 suspend/resume
- Artifact 버전, JSON Patch, diff, 승인 이력
- pgvector 기반 세계관·캐릭터·스타일·선호 검색
- Canvas 기반 텍스트/좌표 편집과 결정론적 SVG/HTML 출력
- 비용, 지연, 재시도, 승인률, 인간 수정량 관측

### 3.2 MVP에서 제외

- 사용자가 임의의 에이전트 그래프를 코딩하는 범용 IDE
- 모델이 스스로 새 도구 권한을 획득하는 완전 자율 실행
- 영상/3D/게임엔진까지 동시에 지원하는 다중 Renderer
- 인간 수정 한 번만으로 전역 선호를 즉시 확정하는 무검증 자동 학습
- 초기 단계의 다중 조직 과금·정산

"범용"은 모든 창작 형식을 첫 버전에 넣는다는 뜻이 아니다. 만화 Template가
코어 밖의 설정만으로 정의되는지를 검증한 뒤, 두 번째 Template로 카드뉴스나
스토리북을 추가해 범용성을 증명한다.

## 4. 목표 아키텍처

```text
┌──────────────────────── Control Plane ────────────────────────┐
│ Web Editor / API                                              │
│   └─ Orchestrator + Policy Engine + State Transition Service  │
│        └─ Workflow Graph + Checkpoint + Event Log             │
└───────────────────────────┬────────────────────────────────────┘
                            │ validated commands/events
             ┌──────────────┼───────────────┐
             ▼              ▼               ▼
       Planning Worker  Execution Queue  Verification Worker
       WBS/TaskSpec      narrow context    rules + model judge
             └──────────────┬───────────────┘
                            ▼
                  Versioned Artifact Store
                    metadata: PostgreSQL
                    binary: S3/R2-compatible
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
        Context/Memory Engine      Deterministic Assembly
        pgvector + provenance      RenderSpec → SVG/HTML
               ▲                         │
               └──── Human Delta ────────┘
```

### 4.1 Orchestration & Policy

- 상태 변경은 `POST /runs/:id/commands` 한 경로로만 받는다.
- 명령은 현재 state, expected version, 권한, 정책, 스키마를 통과해야 event가 된다.
- event를 reducer에 적용해 새 state를 만들고 같은 DB transaction에서 checkpoint를
  저장한다.
- Workflow 정의는 코드로 버전 관리하고 Run 생성 시 `workflow_version`을 고정한다.
- 전이 guard에는 승인 여부, 재시도 예산, 필수 Artifact, schema version을 포함한다.
- 오래 실행되는 생성 작업은 graph node가 직접 붙잡지 않고 queue job을 발행한 뒤
  callback event를 기다린다.

권장 상태:

```text
draft
  → planning
  → awaiting_planning_gate
  → executing
  → verifying
      ├─ pass → awaiting_prerender_gate
      ├─ retryable_fail → executing
      └─ retry_limit → suspended_failsafe
  → assembling
  → completed

어느 실행 상태에서든 fatal/error → failed
사람 명령 suspend → suspended_manual → resume → 이전 안전 상태
```

### 4.2 Planning & Structuring

Planner는 자유 형식 문서를 직접 다음 단계에 넘기지 않는다. 다음 구조를 갖는
`PlanArtifact`를 생성한다.

- 목표, 대상 사용자, 출력 형식, 금지 조건
- WBS와 dependency DAG
- 각 Task의 입력 Artifact ID와 예상 출력 schema
- context query, token budget, model/tool policy
- verification rubric와 pass threshold
- 병렬 실행 group, timeout, retry policy
- 사람 검토가 필요한 decision point

Planning Gate에서 사람은 목표·제약을 추가하거나 승인·반려하고, Codex가 그 입력을
Plan 수정안으로 반영한다. 수정은 원본 덮어쓰기가 아니라 새 ArtifactVersion과
RFC 6902 JSON Patch로 저장한다.

### 4.3 Execution

- worker는 전체 프로젝트가 아니라 `TaskEnvelope`만 받는다.
- `TaskEnvelope`는 task spec, 최소 context bundle, input artifact refs, output schema,
  policy snapshot, idempotency key로 구성한다.
- worker는 stateless하게 두고 queue lease와 heartbeat로 고아 작업을 회수한다.
- 동일 idempotency key의 성공 결과가 있으면 모델을 다시 호출하지 않는다.
- 일반 패널 3개, 복잡 패널 1개라는 기존 정책은 template policy로 이전한다.
- provider adapter가 OpenAI 등 모델 차이를 감싸고 호출 기록에는 model, prompt hash,
  input artifact version, 비용, 지연을 남긴다.

### 4.4 Verification & Feedback

검증은 순서를 고정한다.

1. Schema validation
2. 결정론적 rule/lint 검사
3. 참조 일치 검사
4. 모델 기반 rubric 평가
5. 필요한 경우 사람 검토

Verifier 결과는 단일 점수만 저장하지 않고 `Finding[]`으로 저장한다. 각 Finding은
`code`, `severity`, `artifact_path`, `evidence`, `suggested_patch`, `retry_scope`를
가진다. 재시도는 전체 Phase가 아니라 영향받은 Task와 downstream Task만
무효화한다.

같은 Task가 3회 반려되거나 비용/시간 예산을 넘으면 `suspended_failsafe`로
전이한다. 사람은 다음 중 하나를 선택한다.

- 목표·제약 피드백을 주고 Codex 수정본을 재검증
- Plan/Policy 수정 후 해당 subtree 재실행
- 현재 버전을 예외 승인
- Run 종료

### 4.5 Memory & Context Engine

메모리는 파일 저장소의 대체물이 아니다. Artifact가 원본이고 Memory는 검색용
파생 index다.

- 단기 메모리: 현재 Run state, 최근 events, 활성 decisions, 열린 findings
- 장기 사실: 세계관, 캐릭터, 연속성, 용어집
- 장기 선호: 톤, 금칙어, 레이아웃, 반복 수정 패턴
- 과거 예시: 승인된 Artifact의 요약과 위치

Context Compiler는 Task의 `context_query`를 받아 다음 순서로 묶는다.

1. policy와 금지 조건
2. 명시적으로 연결된 Artifact
3. 세계관/캐릭터의 exact key 결과
4. vector 검색 결과
5. 최근 관련 Human Delta

각 chunk에는 source artifact/version, 검색 점수, 선택 이유를 붙이고 전체 token
budget을 넘으면 우선순위가 낮은 chunk부터 제거한다. 모든 실행 결과에서 실제
주입된 ContextBundle을 재현할 수 있어야 한다.

### 4.6 Human Delta 학습

AI 원본과 인간 최종본의 차이는 다음 파이프라인으로 처리한다.

```text
Artifact v1(AI) → JSON/semantic diff → DeltaCandidate
→ 기존 선호와 중복/충돌 검사 → PreferenceCandidate
→ 다음 3회 작업에 shadow 적용 → 효과 측정
→ 자동 활성 또는 사람 승인 → PreferenceRule
```

텍스트는 문구·길이·톤 변화를, 레이아웃은 좌표·크기·정렬 변화를, 이미지 선택은
채택/폐기 이유를 분리한다. 한 번의 수정은 개인/프로젝트 후보로만 저장하고,
반복되거나 명시 승인된 규칙만 프로젝트 기본 정책으로 승격한다. 전역 규칙 승격은
항상 사람 승인을 요구한다.

### 4.7 Deterministic Assembly

AI는 `RenderSpec`까지만 만든다. Renderer는 네트워크나 모델 호출 없이 다음
입력만 사용한다.

- 고정된 Artifact version
- font와 asset의 content hash
- layout/overlay 좌표
- renderer version과 build option

출력물과 함께 `build-manifest.json`을 만들고 모든 입력/출력 hash를 기록한다.
같은 manifest로 재빌드했을 때 byte-identical output 또는 허용된 정규화 후 같은
hash가 나와야 한다.

## 5. 기술 선택

| 계층 | 권장안 | 선택 이유 |
|---|---|---|
| Web | React + TypeScript + Konva | Canvas 객체와 JSON 좌표를 양방향으로 연결하기 쉬움 |
| API | Fastify + TypeScript | 현재 Node 자산을 재사용하고 schema-first API 구성 가능 |
| 계약 | Zod를 원본으로 JSON Schema/OpenAPI 생성 | 런타임, UI, API가 같은 타입 계약 사용 |
| Workflow | 명시적 reducer/state graph + queue event | 숨은 상태 변이를 막고 테스트가 쉬움 |
| Queue | BullMQ + Redis | worker concurrency, retry, lease 운영이 단순함 |
| DB | PostgreSQL + pgvector | state/event/metadata와 vector 검색을 한 운영 경계에 둠 |
| Binary | Cloudflare R2 또는 S3 | 큰 이미지와 버전 자산을 Git에서 분리 |
| Renderer | 기존 Node SVG 로직을 package로 승격 | 현재 오버레이 코드를 최소 변경으로 결정론화 |
| Observability | OpenTelemetry + 구조화 event log | Run/Task/model 호출을 한 trace로 연결 |

첫 배포는 단일 서버에서도 가능하지만 API, worker, renderer의 프로세스 경계는
처음부터 분리한다. Workflow 프레임워크 도입은 선택 사항이다. LangGraph를 쓰더라도
영속 state와 전이 권한의 원본은 CLE3-1 DB/command contract로 유지한다.

## 6. 핵심 데이터 모델

| Entity | 핵심 필드 |
|---|---|
| `Project` | owner, policy_profile, memory_scope |
| `CreativeRun` | workflow_version, state, state_version, budget, suspended_from |
| `WorkflowDefinition` | nodes, edges, guards, artifact contracts |
| `Task` | dependency_ids, status, attempt, idempotency_key, context_query |
| `Artifact` | kind, schema_name, active_version_id |
| `ArtifactVersion` | payload/object_uri, schema_version, producer, content_hash |
| `Event` | command_id, type, actor, prior_version, payload, created_at |
| `Checkpoint` | run_id, state_version, state_snapshot, open_jobs |
| `Gate` | type, status, blocking, artifact_version, decision, actor |
| `Finding` | severity, evidence, retry_scope, suggested_patch |
| `HumanDelta` | base_version, final_version, json_patch, semantic_summary |
| `PreferenceRule` | scope, condition, instruction, confidence, status, provenance |
| `MemoryChunk` | source_version, text, embedding, tags, validity interval |
| `RenderBuild` | render_spec_version, renderer_version, input/output hashes |

모든 mutable row는 `version`을 가져 optimistic concurrency로 갱신한다. Artifact는
수정하지 않고 새 version을 추가한다.

## 7. HITL 화면 설계

### 7.1 Run Console

- 현재 graph와 각 node 상태
- 실행 중 job, 시도 횟수, 비용, context source
- 열린 Gate와 Finding을 우선순위순으로 표시
- suspend/resume/retry/terminate 명령

### 7.2 Planning Gate

- 좌측: WBS/DAG
- 중앙: Artifact 초안 미리보기
- 우측: schema-aware form/JSON tree
- 변경 diff, 영향받는 downstream Task, 예상 재실행 비용 표시
- 승인 시 승인 대상 Artifact version을 고정

### 7.3 Pre-render Editor

- Canvas에서 텍스트 상자 이동·크기 조절·정렬
- 우측에서 같은 `RenderSpec` JSON을 즉시 표시
- drag가 JSON Patch를 만들고 undo/redo stack에 저장
- overflow, safe area, 겹침, 읽기 순서를 즉시 lint
- AI 제안, 인간 최종본, 렌더 결과를 나란히 비교

### 7.4 Failsafe Inbox

- 3회 반려, 정책 충돌, 비용 초과, reference 모호성만 모음
- 실패 이력과 각 시도의 차이를 한 화면에서 비교
- 수정 범위가 전체 Run인지 특정 subtree인지 실행 전 표시

## 8. 저장소 재구성안

```text
apps/
├── web/                 # Control Plane + Canvas Editor
├── api/                 # command, query, auth API
└── worker/              # planner/executor/verifier queue consumers
packages/
├── contracts/           # Zod, JSON Schema, OpenAPI
├── workflow-kernel/     # reducer, graph, guard, checkpoint
├── context-engine/      # retrieval, token budgeting, provenance
├── policy-engine/       # tone, forbidden terms, retry/cost policy
├── renderer-comic/      # deterministic SVG/HTML assembly
├── model-adapters/      # model/provider boundary
└── observability/
templates/
└── comic/
    ├── workflow.ts
    ├── schemas/
    ├── rubrics/
    └── prompts/
legacy/
└── cle3-file-pipeline/  # 마이그레이션 완료 전 기존 스크립트 보존
```

기존 `episodes/`, `prompts/`, `wiki/`, `scripts/render-panel-overlays.js`는 삭제하지
않고 importer와 comic template의 fixture로 먼저 연결한다.

## 9. 구현 로드맵

### M0. 기준선과 안전 정리, 1주

- discovery 브랜치 검토·병합 또는 필요한 commit만 선별
- 현재 5개 에피소드 Artifact inventory와 schema validation report 생성
- 공개 Viewer에서 GitHub PAT 저장 제거
- 원작/캐릭터/화풍 자산의 사용 권리와 공개 범위를 별도 register로 기록
- EP001 한 페이지를 golden fixture로 고정

완료 조건: 기존 공개 Viewer 기능을 유지하고, 모든 현재 Artifact의 import 가능/수정
필요 상태를 report로 확인한다.

### M1. Workflow Kernel, 2주

- Project/Run/Task/Artifact/Event/Checkpoint DB schema
- command → validation → event → reducer → checkpoint transaction
- comic workflow graph와 gate guard
- suspend/resume, retry budget, idempotency 구현
- 기존 `state.json` importer

완료 조건: 프로세스를 강제 종료한 뒤 같은 checkpoint에서 재개되고 완료된 Task를
다시 호출하지 않는다.

### M2. Execution + Verification + Context, 2주

- worker queue, lease, heartbeat, concurrency policy
- TaskEnvelope와 provider adapter
- schema/rule/model verifier와 Finding 모델
- wiki/캐릭터/승인 산출물 indexer, pgvector 검색
- ContextBundle provenance와 token budget

완료 조건: 독립 패널은 병렬 실행되고, schema 오류와 3회 반려는 각각 즉시 차단과
Failsafe suspend로 이어진다.

### M3. HITL Editor + Assembly, 2주

- Planning Gate 편집/승인
- Failsafe Inbox
- Canvas ↔ RenderSpec JSON 양방향 편집
- JSON Patch, version diff, undo/redo
- 기존 SVG renderer package화, build manifest/hash

완료 조건: Canvas에서 좌표를 옮기면 JSON Patch가 저장되고 재렌더링되며, 같은
manifest 재빌드가 동일 결과를 만든다.

### M4. Delta Learning + Pilot, 1주

- HumanDelta extractor와 PreferenceCandidate 생성
- shadow retrieval, 충돌/중복 검사, 승인/승격 UI
- EP001 전체 이관과 end-to-end 실행
- 운영 dashboard와 runbook

완료 조건: 인간이 반복 수정한 규칙이 다음 Run의 ContextBundle에 provenance와 함께
주입되고, 적용 여부를 비교할 수 있다.

## 10. 검증 전략

### 계약 테스트

- 모든 schema의 valid/invalid fixture
- schema version migration과 backward compatibility
- JSON Patch 적용 전후 schema 보존

### 상태 머신 테스트

- 허용/금지 전이 property test
- 동시에 두 승인 명령이 들어오는 optimistic lock test
- worker crash, callback 중복, queue redelivery test
- retry limit, 비용 초과, manual suspend/resume test

### 결정론 테스트

- golden RenderSpec snapshot
- 동일 manifest 반복 build hash 비교
- font/asset/renderer version 변경 시 hash 변화 확인

### Context/Memory 평가

- 고정 질의셋의 recall@k와 잘못된 세계관 주입률
- token budget 준수
- source 없는 memory chunk의 차단
- 충돌하는 PreferenceRule의 scope/priority 처리

### E2E 시나리오

1. Goal 입력부터 Planning Gate 승인까지
2. 병렬 패널 생성 중 worker 종료와 재개
3. 검증 3회 실패 후 Failsafe Gate 개입
4. Pre-render drag 편집 후 JSON/화면/최종 SVG 일치
5. Human Delta가 다음 episode의 context에 반영

## 11. 운영 지표와 출시 기준

| 지표 | 초기 출시 기준 |
|---|---|
| schema-invalid artifact의 다음 단계 진입 | 0건 |
| crash/resume 중복 모델 호출 | 0건 |
| 체크포인트 복구 성공률 | 99% 이상 |
| 3회 초과 자동 재시도 | 0건 |
| build manifest 재현률 | 100% |
| context provenance 누락 | 0건 |
| Planning Gate 이후 구조 재작업률 | 기준선 대비 감소 |
| 첫 검증 통과율 | episode별 추적, 목표는 pilot 후 설정 |
| 인간 수정량 | Artifact별 JSON Patch 규모로 추적 |
| 패널당 비용/시간 | p50/p95 모두 추적 |

숫자를 임의로 좋아 보이게 정하지 않고 EP001 golden run으로 baseline을 만든 뒤
EP002에서 개선 폭을 검증한다.

## 12. 우선순위 결정

가장 먼저 만들 것은 Vector DB나 멀티에이전트 UI가 아니다. 우선순위는 다음과
같다.

1. 상태 전이와 Artifact version을 단일 원본으로 만든다.
2. 실제 실행 queue와 checkpoint/resume을 닫힌 루프로 만든다.
3. 세 개 Human Gate를 영속 상태로 연결한다.
4. 결정론적 Renderer와 manifest를 고정한다.
5. 그 위에 Context retrieval과 Delta learning을 붙인다.

이 순서를 지켜야 Memory가 잘못된 출력과 임시 결정을 장기 기억으로 증폭하지
않고, HITL도 단순 메모 입력이 아니라 파이프라인을 실제로 통제한다.
