# EP002 Panels Manifest

## 현재 상태

- phase: phase4_panels
- total_panels: 57
- generated_panels: 30
- pending_panels: 27
- asset_dir: `episodes/EP002/panels/assets/`
- workflow_rule: CLE3 내부 storyboard + characters 산출물만 사용. 외부 저장소 생성 결과 재사용 금지.

## 작업 규칙

- storyboard.json의 panel_id 순서를 기준으로 생성한다.
- generation-jobs.json 기준으로 페이지 단위 배치를 우선 처리한다.
- 일반 페이지는 동시 2~3개, 복잡한 다인물/몽타주/풀페이지는 동시 1개 기준으로 처리한다.
- characters.json의 image_path를 패널 생성 참조 자산으로 사용한다.
- 생성 이미지는 모두 `episodes/{EP}/panels/assets/`에 저장한다.
- 가능하면 이미지 생성 단계에서는 대사를 직접 렌더링하지 않고, 후처리 오버레이 대상으로 남긴다.
- panels.json의 generation_prompt, reference_assets, generation_status를 함께 갱신한다.
- QA 실패 시 전체 Phase 롤백 대신 실패 패널과 인접 패널만 재생성한다.
- 실제 패널이 생성되기 전까지는 target asset slot만 유지하고 placeholder 상태로 본다.
