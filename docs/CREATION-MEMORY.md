# CLE3 창작 기억과 컨텍스트 전달

CLE3에서는 Codex가 원작 분석, 각색, 시각 설계, 이미지 생성, 후보 선택과 비평을 포함한 모든 창작 행동을 수행한다. 일반 코드는 창작 판단을 대신하지 않고 기억 저장, 검색, 검증과 결정론적 조립만 담당한다.

## 두 종류의 데이터

```text
검토 가능한 장기 기억                    작업마다 다시 만드는 전달물
creation-memory.json                    Creation Context Pack
        │                                       ▲
        ├── 기준 자산과 변경 금지 속성           │
        ├── 복선과 독자 질문                     │
        ├── 패널 간 상태 변화                    │
        ├── 선호와 실패/성공 교훈                │
        └── 현재 목표와 다음 작업 ───────────────┘
```

- `episodes/{EP}/memory/creation-memory.json`은 사람이 검토하고 Git으로 변경 이력을 남기는 원본이다.
- `episodes/{EP}/bible/bible.json`은 시대·미스터리 공개 규칙, 캐릭터 표정·의상, 장소와 반복 소품의 시각 기준을 구조화한다.
- Creation Context Pack은 현재 에피소드 또는 패널에 필요한 기억만 선택한 파생 데이터다.
- 파생 Context Pack을 장기 기억에 다시 복사하지 않는다. 창작 결과의 사실, 근거와 다음 작업만 원본 기억에 반영한다.

## 작업 시작

새 에피소드이거나 기억 파일이 없으면 운영 데이터와 함께 먼저 초기화한다.

```bash
node scripts/init-episode-governance.js --episode EP002
```

초기 기억은 존재하는 스토리·캐릭터·스토리보드·패널 파일을 출처로 연결한다.
Codex는 실제 창작을 진행하면서 검증된 Canon, 복선, 연속성과 교훈을 채운다.

에피소드 전체 작업:

```bash
node scripts/build-creation-context.js --episode EP001
```

특정 패널 작업:

```bash
node scripts/build-creation-context.js \
  --episode EP001 \
  --panel p15-3 \
  --task "문이 열리는 순간의 연속성과 서사 기능 검토"
```

승인된 Bible을 실제 이미지 생성 요청으로 컴파일:

```bash
node scripts/build-creation-request.js \
  --episode EP001 \
  --panel p15-3
```

`run-panel-jobs.js`는 이 요청 카드를 자동 생성해 이미지 프롬프트와 참조 자산에 포함한다. 따라서 Codex가 패널을 만들 때 승인된 DNA, 직전 State, 이번 Delta, Camera, Narrative Function과 변경 금지 규칙을 매번 전달받는다. 승인되지 않은 Bible은 실행 단계에서 거부된다.

검토용 파일이 필요하면 저장소 내부 경로만 지정한다.

```bash
node scripts/build-creation-context.js \
  --episode EP001 \
  --panel p15-3 \
  --output episodes/EP001/memory/context-p15-3.json
```

Context Pack에는 다음 정보만 포함된다.

- 현재 목표와 작업 인계
- 대상 패널의 설명, 카메라, 등장인물과 참조 이미지
- 관련 Canon 자산과 변경 금지 속성
- 대상 패널에 등장하는 Bible 인물·의상·표정, 장소와 소품
- 관련 복선과 독자 질문
- 직전 상태, 이번 변화와 이후 상태
- 관련 사용자 선호와 성공/실패 교훈
- 생성·승인·보관 제약
- 미결 사람 결정과 승인 게이트

## 작업 종료

Codex는 창작 행동 후 다음 중 실제로 변한 항목만 `creation-memory.json`에 기록한다.

1. 새로 승인되거나 폐기된 기준 자산
2. 새로 생기거나 회수된 복선
3. 다음 패널에 전달할 상태 변화
4. 증거가 있는 성공, 실패와 사용자 선호
5. 완료 작업, 다음 작업, 차단 요소와 사람 결정

한 번의 결과를 일반 선호로 확정하지 않는다. `observed`로 기록하고 반복 증거나 사람 승인이 생겼을 때만 `validated` 또는 `approved`로 바꾼다.

## 검증

```bash
node --test tests/creation-context.test.js
node scripts/validate-episode-governance.js
node scripts/validate-episode-output.js EP001
```

검증기는 필수 소스와 증거 파일이 실제로 존재하는지, 경로가 저장소 밖으로 빠져나가지 않는지, Codex가 유일한 창작 주체로 선언되어 있는지를 검사한다.
