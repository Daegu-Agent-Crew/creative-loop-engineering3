# 패널 자산 저장 정책

이 저장소는 GitHub Pages로 직접 배포되므로 현재 공개 웹에 필요한 경량 자산은
Git에 둔다. 원본 PNG, 후보 이미지, 실패 이미지, 편집 원본은 Git에 넣지 않는다.

Git LFS는 GitHub Pages 자산 제공과 맞지 않으므로 CLE3 Pages용 패널에는 쓰지
않는다. 에피소드가 늘어 원본 보관이 필요하면 GitHub Release 또는 외부 오브젝트
스토리지를 사용한다.

## 규칙

- Git에 남길 패널 자산은 가능하면 WebP를 우선한다.
- 기존 PNG는 보존한다. 히스토리 재작성 없이 앞으로의 증가만 제어한다.
- 새 패널 자산은 1MB 이하를 목표로 하고, 4MB를 넘기면 CI에서 실패한다.
- 한 PR에서 에피소드별 패널 자산 증가량은 30MB를 넘기지 않는다.
- `*-base.png`, `*-original.png`, `*-candidate.png`, `*-rejected.png`는 커밋하지 않는다.
- 원본 PNG가 필요하면 GitHub Release 또는 외부 저장소에 올리고, Git에는 링크만 남긴다.

## 다음 에이전트 체크리스트

1. 패널 생성 전 `config/asset-storage-policy.json`을 읽는다.
2. 생성 결과를 바로 커밋하지 말고 파일 크기와 이름을 먼저 확인한다.
3. 임시·후보·원본 파일은 Git에 추가하지 않는다.
4. `node scripts/check-panel-assets.js`를 실행한다.
5. CI가 경고한 target 초과 파일은 가능하면 WebP로 변환하거나 재생성한다.

현재 정책은 기존 PNG를 삭제하지 않는다. 목표는 안전하게 앞으로의 증가 속도를
늦추는 것이다.
