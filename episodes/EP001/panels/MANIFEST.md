# EP001 Panels Manifest

## 현재 상태

- phase: phase4_panels
- total_panels: 49
- generated_panels: 14
- pending_panels: 35
- asset_dir: `episodes/EP001/panels/assets/`
- final_dir: `episodes/EP001/panels/final/`
- text_overlay: `episodes/EP001/panels/text-overlays.json`
- workflow_rule: CLE3 내부 storyboard + characters 산출물만 사용. 외부 저장소 생성 결과 재사용 금지.

## 작업 규칙

- storyboard.json의 panel_id 순서를 기준으로 생성한다.
- characters.json의 image_path를 패널 생성 참조 자산으로 사용한다.
- 생성 이미지는 모두 `episodes/{EP}/panels/assets/`에 저장한다.
- panels.json의 generation_prompt, reference_assets, generation_status를 함께 갱신한다.
- 대사/자막/독백은 `text-overlays.json`에서 관리하고 `panels/final/*.svg`로 후처리 렌더링한다.
- 실제 패널이 생성되기 전까지는 target asset slot만 유지하고 placeholder 상태로 본다.
