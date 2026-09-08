# CLE3 완료 증거와 결정 대기 개선

관측 시각: 2026-09-08T01:23:07Z (10:23 KST)

## 구현 결과

- `operations/decision-queue.json`: EP002 병합·매핑·게이트와 EP001 동률 후보 등 8건에 담당자, 단일 결정, 대기 시작 근거, 기한과 초과 처리를 기록했다. 기존 승인·후보 원본은 변경하지 않았다.
- `config/decision-policy.json`: 현재 사용자 역할을 운영자로 명시하고 미승인 PR 2개 상한을 설정했다. 초기 검토 기한은 9월 9일 10:11 KST이며, Phase 5 이전의 공개 승인 요청은 선행 작업 대기로 구분한다.
- `scripts/decision-status.js`: GitHub 최신 head의 검사·리뷰·충돌 상태와 로컬 QA·승인·파일을 분리해서 보고한다. API 실패·필수 검사 누락·닫힌 PR을 통과나 병합 완료로 추정하지 않는다.
- `scripts/run-panel-jobs.js`: `--respect-review-limit` 및 plan 저장 시 실제 WIP를 검사하고 상한 도달·상태 미확인 시 빈 생성 큐와 종료 코드 2를 반환한다.
- `scripts/release-readiness.js`: Phase 4/5, 승인자·시각·증거, QA 합계, 정확한 최종 파일 목록, 미검토 오버레이를 검사한다. Pages의 포장·업로드 전에 실행하도록 연결했다.
- PR 검증에 큐 검증과 공개 사전조건 검사를 추가하고 Actions 요약에 대기 보고서를 표시한다. PR 템플릿도 검증·병합 결정·공개 상태를 구분한다.
- 제작 진행 때마다 기대값이 바뀌던 runner 테스트를 고정된 큐 상황으로 바꿨다.

## 실행 검증

| 명령 | 실제 결과 |
|---|---|
| `node --test tests/*.test.js` | 33/33 통과 |
| `node scripts/decision-status.js --validate` | 스키마·담당자·기한·근거 검증 통과 |
| `node scripts/validate-episode-governance.js` | 5개 에피소드 통과 |
| `node scripts/validate-episode-output.js EP001 --require-release` | 49패널, QA 43/50, 기존 공개 증거 통과 |
| `node scripts/check-panel-assets.js` | 통과; 기존 EP002 6개 PNG의 1MB 목표 초과 경고 유지 |
| `git diff --check` | 통과 |
| `node scripts/decision-status.js --github --check-start --json` | 실제 GitHub 조회 성공, 미승인 PR 1/2, 종료 코드 0 |

새 회귀 테스트는 CI 성공과 승인 분리, 필수 검사 누락·skipped·실패, API 오류,
불완전 목록, WIP 2개 보류, 닫힌 PR의 결과 미추정, 근거 없는 결정 완료 차단,
draft/needs_review, QA 목록 불일치, 파일 누락, runner의 plan 미저장을 검사했다.

## 실제 원격 관측과 CLE5 전달 범위

PR #39의 관측 head는 `e1ee73385bb53db87b96c4965b3ad5c240d9aca4`이며
`validate-assets`는 SUCCESS, mergeable은 MERGEABLE, reviewDecision은 비어 있었다.
[검사 증거](https://github.com/Daegu-Agent-Crew/creative-loop-engineering3/actions/runs/34161900624/job/101865267287).
이 결과는 개선 코드의 원격 CI 결과가 아니라 개선 전 패널 커밋에 대한 관측이다.

EP002는 QA 파일 없음·Phase 4/5 미완료·사람 공개 승인 대기·미생성 패널·미검토
오버레이 때문에 공개 차단이다. EP001은 기존 승인과 파일 조건이 유효했다.
신규 공개, 후보 선택, 기억 승격, main 병합은 이번 개선에서 실행하지 않았다.

CLE5는 이 관측 시각, 명령, 결과, 커밋과 증거 경로를 제작 관측으로 참조할 수 있다.
이것을 CLE5의 승인된 창작 선호로 해석하거나 운영 책임을 CLE3로 넘기지 않는다.

## 남은 사람 결정

현재 운영자가 PR #39 작업 병합 여부를 결정한다. EP002 매핑 기준과 provisional
게이트는 별도 결정이며, 공개 승인은 Phase 5 완료 이후다. EP001 p15-3·p6-1 후보
동률은 기존 패널을 유지한 채 결정 대기다. 상세 절차는 `docs/DECISION-OPERATIONS.md`.

공개 검사는 저장된 QA·승인과 구조적 파일 대응을 검사한다. 이미지의 새 시각 평가나
과거 QA 이후 바이트 변경에 대한 서명·해시 검증은 이 구현 범위에 포함하지 않는다.
