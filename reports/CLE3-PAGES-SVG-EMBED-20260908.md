# EP001 Pages SVG 표시 보정

- 요청 근거: 2026-09-08 사용자 지시 `병합 배포까지 진행`.
- 선행 병합: PR #39, main `f18d2c1db1f00250b1c4a9104a83847c947e3990`.
- 관찰: Pages run `34177824061`은 성공했지만 실제 Chromium 뷰어에서
  패널이 검게 표시되었다. SVG 응답과 원본 PNG 직접 요청은 HTTP 200이었다.
- 원인: 뷰어는 SVG를 `<img>`로 표시하며, SVG의 외부 PNG 참조는 해당
  이미지 로딩 모드에서 불러와지지 않았다. HTTP 성공이나 이미지 크기 확인만으로
  실제 그림 표시를 보장할 수 없었다.
- 변경: Release Approval·QA·최종본 검사를 먼저 통과한 배포 checkout에서
  기존 `render-panel-overlays.js --episode EP001 --embed-source`를 실행한 후
  Pages 산출물을 복사한다. 원본 PNG, 후보, 저장소 최종 SVG, QA와 승인 기록은
  변경하지 않는다. EP002는 공개 범위에 추가하지 않는다.
- 로컬 검증: 실제 EP001 49개 패널을 임시 디렉터리에 embedded SVG로 렌더링하고
  각 기존 최종 SVG와 비교했다. `href`를 제외한 차이는 0개였다.
  Node 테스트 34개, 5개 episode governance, 결정 queue schema/evidence,
  EP001 release output(49 panels, QA 43/50), asset policy, diff 검사를 통과했다.
- 회귀 방지: 승인 검사 → 이미지 포함 → 복사 순서를 테스트하고,
  embedded PNG를 디코딩한 바이트가 원본과 같으며 SVG 레이아웃이 보존됨을 검사한다.
- CLE5 전달 관찰: CI·HTTP·naturalWidth 성공과 실제 시각적 표시 성공을
  구분해야 한다. 이번 사실은 배포 패키징 검증 사례이며 창작 선호나
  release 승인으로 자동 승격하지 않는다.
- 최종 배포 확인은 이 보정 PR의 병합 commit에 대응하는 Pages 실행과
  공개 뷰어의 실제 화면을 근거로 한다.
