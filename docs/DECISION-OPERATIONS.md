# CLE3 결정 대기와 완료 증거

CI 성공은 검사한 커밋에 대한 결과다. PR 병합은 작업 통합 결정이고, 공개 발행은
Phase 5 QA와 사람 Release Approval을 갖춘 별도 결정이다. 셋을 하나의
`complete` 플래그로 올리지 않는다.

## 매일 읽는 보고서

```bash
node scripts/decision-status.js --github
node scripts/decision-status.js --github --json
node scripts/decision-status.js --validate
```

보고서는 파일을 수정하거나 메시지를 전송하지 않는다. 원본 승인, QA 점수와 최종
파일 목록, PNG/SVG의 존재, 오버레이 검토 상태를 대조한다. GitHub 조회는 `gh`의
로그인 또는 `GH_TOKEN`을 사용한다. 토큰은 출력하지 않는다. `--github`를 생략하거나
네트워크가 실패하면 CI·WIP는 `unknown`이며 이전 성공값을 재사용하지 않는다.
전체 PR 목록이 1,000개 제한에 도달하면 불완전한 목록으로 보고 WIP를 미확인 처리한다.

PR별로 최신 head SHA, check 결과와 URL, 충돌·리뷰 상태를 보고한다. 필수 검사
`validate-assets`가 없으면 `unknown`, skipped/neutral/진행 중이면 `pending`이다.
검사 통과·충돌 없음이어도 `human_decision_required`일 뿐 병합하지 않는다.
열린 목록에서 사라진 PR은 `not_open_verify_outcome`으로 표시한다. 담당자는
`gh pr view <번호> --json state,mergedAt,url`로 병합/취소 여부를 확인하고 목록을 정리한다.
PR이 merged라는 확인도 에피소드의 공개 상태를 바꾸지 않는다.

GitHub Actions의 Validate panel assets 실행 요약에도 이 보고서를 표시한다.
보고 시점의 최신 PR head를 읽으므로, 현재 실행 자체가 진행 중이면 pending이
정상이다. 이것은 해당 workflow 실행의 최종 결과를 대신하지 않는다.

## 대기 항목의 소유자와 기한

`config/decision-policy.json`의 `cle3-maintainer`는 현재 CLE3 운영자, 즉 작업을
요청한 사용자 역할이다. 외부 담당자에게 임의 배정한 것이 아니다. 위임 시 역할의
설명을 바꾸고 대기 항목 `owner`를 갱신한다.

`operations/decision-queue.json`의 각 항목에는 다음을 기록한다.

- `request`: 지금 요청하는 결정 한 가지
- `owner`: 정책에 등록한 담당자 역할
- `waiting_since`, `waiting_since_basis`: 대기 시각과 그 근거
- `due_at`, `overdue_action`: 기한과 초과 시 해당 의존 작업 처리
- `source_path`, `evidence`: 원본 게이트/후보/맥락과 검토 파일

초기 범위는 EP002의 병합·매핑·게이트, EP001의 보류 중인 동률 후보 2건이다.
EP003~EP005를 재개할 때 해당 에피소드의 결정 항목도 추가한다. PR #39는 GitHub의
생성 시각을 사용했다. 다른 항목은 과거 요청 시각을 확인할 수 없어 2026-09-08을
`tracking_started`로 기록했다. 이는 과거에 요청이나 승인이 있었다는 뜻이 아니다.

초기 운영 기한은 추적 시작 후 24시간인 2026-09-09 10:11 KST다. 새 요청은 정책의
`review_sla_hours`를 기준으로 명시적 기한을 정한다. 매일 실행할 때 마감을 자동
연장하지 않는다. 기한 초과 보고에는 `overdue=true`와 처리 문구가 함께 나타난다.
알림 발송이나 자동 승인은 하지 않는다.

Release 항목은 Phase 5 완료 전 `waiting_prerequisite`이고 사람 결정 지연으로
집계하지 않는다. Phase 5를 완료하는 작업자는 실제 검토 요청 시각과 새 기한을
기록한다. 페이지 매핑 충돌은 해당 패널의 오버레이를 보류하고, 독립 작업은 계속한다.

결정이 도착하면 원본 `approvals/gates.json` 또는 후보 선택 기록을 먼저 갱신한다.
이후 큐를 `resolved`로 바꾸고 `resolution`에 `decided_by`, `decided_at`, `decision`,
`evidence`를 기록한다. 큐만 resolved로 바꿔 미승인 게이트를 우회하면 검증 실패다.
원본 게이트만 결정된 경우 보고서는 `source_decided_sync_required`로 정리를 요청한다.
기존 패널 유지 결정도 증거와 함께 남기며, 기억 승격은 별도 정책을 따른다.

## 미승인 PR 상한 시험 운영

```bash
node scripts/decision-status.js --check-start --json
node scripts/run-panel-jobs.js --episode EP002 --dry-run --max-jobs 3 --respect-review-limit
```

열린 PR 중 `reviewDecision != APPROVED`인 것을 미승인으로 센다. 리뷰가 없거나
수정 요청 상태인 PR, draft PR도 포함한다. API에서 리뷰 결정을 제공하지 않을 때도
승인으로 추정하지 않는다. 기본 상한은 2개다. 상한 도달 또는 조회 실패 시 종료 코드
2와 빈 `selected_jobs`를 반환하고 새 생성·plan 저장을 보류한다. 검사와 결정 정리,
기존 산출물 후처리는 계속할 수 있다.

`--write-plan`은 항상 상한을 검사한다. 기존의 플래그 없는 `--dry-run`은 로컬
진단·테스트 호환성을 위해 네트워크 없이 동작하므로, 자동화에서는 반드시
`--respect-review-limit`을 사용한다. 이 값은 병렬 패널 수(최대 3개)와 별개다.

## 공개 직전 강제 검사

```bash
node scripts/validate-episode-output.js EP001 --require-release
```

현재 Pages workflow는 EP001만 포장한다. 포장·업로드 전에 이 검사를 실행한다.
수동 workflow 실행에도 동일하게 적용한다. 기존 승인과 QA를 읽으며 새 승인을 쓰지 않는다.

- Phase 4·5 완료, Release Approval의 `approved`·담당자·시각·실제 증거 파일
- QA 5개 점수 합계 42/50 이상, 최종 이미지 목록의 정확한 일치
- 패널/오버레이 ID의 일대일 대응, 생성 상태와 실제 소스·SVG 파일
- `draft`/`needs_review` 차단, 오버레이 소스 경로 일치
- 기존 공개 뷰어·Bible export·asset manifest 검사

기존 EP001의 `rendered`는 텍스트 패널에도 쓰인다. 이 상태 자체를 승인으로 읽지
않고 에피소드 QA와 사람 공개 승인을 함께 요구한다. 이 검사는 구조와 기록의
일치 여부를 확인한다. 실제 시각 품질을 새로 평가하거나 과거 QA가 파일의 바이트
변경까지 검토했는지 증명하지는 않는다. 공개 산출물을 수정하면 QA·승인 범위를
사람이 다시 확인해야 한다.

## CLE5와의 경계

CLE3는 원작 각색·패널 제작·QA·사람 승인·발행의 원본을 관리한다. CLE5에 전달할
관측은 검증 명령, 실행 결과, 커밋 SHA, 산출물 경로와 보류 사유다. CLE5의 제품
피드백과 승인된 기억은 CLE5의 독립 정책을 따른다. CLE3 CI 성공이나 후보 점수는
CLE5의 승인된 선호로 자동 승격하지 않는다.
