# creation-request-card 스키마 정합 — CLE3 ↔ CLE5 (이슈 #31)

- 작성: 2026-10-28 · 🤖 agent:daeguru
- 비교 대상: CLE3 schemas/creation-request-card.schema.json (8780c06f) ↔ CLE5 배포판 app.js generationRequest (CLE5-private STATUS.md L61, 8필드)

## 차이표

| 개념 | CLE5 배포판 (camelCase) | CLE3 스키마 (snake_case) | 정합 방침 |
|---|---|---|---|
| 대상 패널 | panelId + panelDescription | panel_id (+ episode_id) | 호환. CLE3은 에피소드 스코프 포함 |
| DNA 참조 | dna: string[] | dna: object | **구조 상이** — CLE3 dna는 {character/style/ref} 객체. 변환 규격 아래 명시 |
| 이전 상태 | previousState: string | state: array | 호환 (CLE3은 항목 배열, join하여 매핑) |
| 변화량 | delta: string | delta: array | 호환 (동일) |
| 카메라 | camera: string | camera: string | 동일 |
| 서사 기능 | narrativeFunction: string | narrative_function: array | 호환 |
| 품질 등급 | qualityTier | output_rules 내에 암묵 포함 | **CLE5 우선 명칭 채택 권장** (CLE3는 output_rules에 명시적 표기 권장) |
| 후보 수 | candidateCount | 없음 | **CLE5 필드 확장 권장** (CLE3은 1패널 1카드 기본) |
| Critic 제안 | 반환 섹션 (---CLE5-CRITIC-START---) | 없음 | CLE5 응답 전용 — 카드에 불요 |
| 성경 참조 | Bible snapshot (별도 import) | bible: object (required) | **CLE3 extension** — 성경 기반 생성은 CLE3 고유 |
| 컴파일 프롬프트 | 없음 (앱에서 조립) | compiled_prompt: string | **CLE3 extension** |

## 결론

- 공통 7필드(대상/DNA/state/delta/camera/narrative)는 개념 일치 — 이름 규칙만 상이(camelCase vs snake_case). 변환 레이어 최소화를 위해 **CLE5 명칭을 표준으로, CLE3은 snake_case 매핑표를 스키마 description에 유지**한다.
- CLE3 전용(bible, references, output_rules, compiled_prompt)은 extension으로 명시 — 이미 required에 포함되어 있어 상충 없음.
- 시즌 2 연동 시 첫 통합 카드 사례로 삼는다.

## 부기: .gitignore 정리

- reports/_ab0006_png/ (19MB), reports/_rt/ (87MB) — 배포용 원본 PNG 임시 산출. 리포 부풀림 방지를 위해 ignore 처리(삭제하지 않음).
