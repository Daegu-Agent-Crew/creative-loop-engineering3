# CLE3 AI 협업 운영 프로토콜

CLE3는 모델에게 긴 규칙만 전달하는 대신 목표, 실제 파일, 도구, 레퍼런스와
실행 가능한 제약을 제공한다. Codex는 원작 분석, 각색, 시각 설계, 생성, 후보
선택과 비평을 포함한 모든 창작 행동을 수행한다. 사람은 목표를 제공하고 정책
예외와 최종 공개를 승인하거나 반려한다.

## 운영 루프

1. **Tool First**: 저장소, 파일, 이미지 생성, GitHub와 검증 도구의 접근 상태를
   `discovery/context.json`에서 확인한다.
2. **Unknown Discovery**: Known Known, Known Unknown, Unknown Known, Unknown
   Unknown 후보를 기록하고 blocking 여부를 구분한다.
3. **Reference Driven**: 스토리, 캐릭터, 콘티와 정책 파일을 경로로 연결한다.
4. **Decision Rationale**: 내부 사고 전체가 아니라 결정, 근거, 확신도, 가정,
   불확실성, 대안과 승인 상태를 저장한다.
5. **Human in the Loop**: 사람은 Story Lock, Character Lock, Storyboard Lock,
   Release Approval과 예외 작업만 승인하거나 반려한다. 승인 게이트는 창작을
   대신 수행하는 단계가 아니다.
6. **Challenge Trade-offs**: 기본 목표와 함께 기존 시간, 비용, 품질 제약을
   자동화로 다시 검토할 도전 목표를 둔다.

## 파일 소유권

```text
episodes/EPxxx/
├── discovery/context.json
├── decisions/implementation-notes.json
├── memory/creation-memory.json
└── approvals/gates.json
```

- `discovery/context.json`: 작업 전 맥락, 가치, 도구, 레퍼런스, Unknown과 가정
- `decisions/implementation-notes.json`: 검토 가능한 판단 근거와 불확실성
- `memory/creation-memory.json`: 다음 Codex 세션에 전달할 Canon, 복선, 연속성,
  선호, 교훈, 제약과 현재 작업 인계
- `approvals/gates.json`: 네 사람 승인 게이트와 예외 운영 정책
- `panels/generation-jobs.json`: 실행 단위별 근거, 확신도, 가정, 불확실성과
  에스컬레이션 이유

## 진행과 중단 기준

- `preflight.status=ready`: 정상 진행
- `preflight.status=ready_with_assumptions`: 가정을 기록하고 정상 진행
- `preflight.status=blocked`: blocking 사람 결정이나 필수 입력을 해결하기 전 중단
- non-blocking Unknown은 큐를 멈추지 않는다.
- 최대 재시도, 필수 참조 충돌, 모호한 QA, 정책/안전 불확실성은 예외 큐로 보낸다.

과거 Phase가 완료되어 있어도 명시적인 사람 승인 기록이 없으면 `approved`로
추정하지 않고 `provisional`로 표시한다.

## 검증

```bash
node scripts/init-episode-governance.js
node scripts/validate-episode-governance.js
node scripts/run-panel-jobs.js --episode EP001 --dry-run --max-jobs 3
```

초기화 스크립트는 Discovery, Decision, Approval과 Creation Memory를 함께 만들며
기존 파일을 덮어쓰지 않는다. 기준선을 다시 만들 때만 `--force`를 사용하고 변경
내용을 먼저 검토한다.
