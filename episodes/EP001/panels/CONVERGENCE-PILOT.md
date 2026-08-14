# EP001 Convergence Pilot

CLE2-20의 최소 수렴 루프는 이미 생성된 패널 세 종류를 대상으로 회귀 검증한다.
기존 이미지는 baseline으로만 사용하고 후보는 `.candidates/`에 생성한다.

| 유형 | 패널 | 선정 이유 | 참조 자산 |
|---|---|---|---|
| 단일 인물 | `p2-3` | 예원제 얼굴 클로즈업으로 표정과 캐릭터 동일성을 비교하기 쉽다. | `yewenjie-v1.png` |
| 다인물 | `p15-3` | 청신과 왕먀오가 한 프레임에 등장해 두 캐릭터 참조 전달을 검증한다. | `chengxin-v1.png`, `wangmiao-v1.png` |
| 풀페이지 | `p6-1` | 빗속 정적 장면으로 여백, 실루엣, 감정 연출과 전체 구도를 검증한다. | `yewenjie-v1.png` |

## 실행 기준

- 각 패널은 후보 2개, 최대 2회 반복한다.
- 1회차 평가 후 재생성이 필요할 때만 2회차를 실행하며 `--diagnosis`를 필수로 전달한다.
- 후보 순서는 평가 전에 무작위화하고 파일명으로 우열을 암시하지 않는다.
- 절대 점수 35점 미만 후보는 비교 우승 여부와 관계없이 탈락한다.
- 두 후보가 모두 35점 미만이면 `both_bad`, 점수 차가 2점 이하이면 `tie`로 기록한다.
- 최종 선택본만 `episodes/EP001/panels/assets/`로 승격한다.
- 첫 파일럿은 사람 블라인드 선택과 AI 선택의 일치 여부를 기록한다.

## 드라이런

```bash
node scripts/run-panel-jobs.js --episode EP001 --panel p2-3 --variants 2 --max-iterations 2 --dry-run
node scripts/run-panel-jobs.js --episode EP001 --panel p15-3 --variants 2 --max-iterations 2 --dry-run
node scripts/run-panel-jobs.js --episode EP001 --panel p6-1 --variants 2 --max-iterations 2 --dry-run
```
