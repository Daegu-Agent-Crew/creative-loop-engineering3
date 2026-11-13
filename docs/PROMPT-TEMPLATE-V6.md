# 패널 생성 프롬프트 공통 블록 (v6 — 회장님 지시 2026-11-13 13:31 "캐릭터 일관성 유지 대책 강화, 사후 검증 배제")

## MANDATORY CHARACTER LOCK (생성 전 필수, 생략 시 배치 전체 실패)

패널 생성 전 반드시 먼저 canonical 시트를 읽고, 각 패널 생성 직전에 아래 확인 줄을 로그에 출력한다:
[CHARLOCK] <panel_id>: <캐릭터명> = canonical 시트 기준 (안면비율/헤어/안경/복장/잉크농도/명암 일치)

canonical 시트 (고정 경로, 절대 변경 금지):
- 왕머여: episodes/EP006/characters/assets/wangmiao-canonical.png
- 스치친: episodes/EP006/characters/assets/shi-qiang-canonical.png

규칙:
1. codex는 배치 시작 시 canonical 시트 2장을 먼저 READ하고 각 캐릭터의 특징을 3줄씩 기술한 후 생성을 시작한다 (기술 없이 생성 시작 금지).
2. 모든 패널 프롬프트에 캐릭터 외형을 canonical 기준 상세 문구로 포함한다 (일반 명사 금지).
3. 새 캐릭터 첫 등장 화: 첫 배치에서 canonical 시트를 만들어 동일 경로 규칙(episodes/<해당화>/characters/assets/<이름>-canonical.png)으로 고정한 뒤 이후 화에서 계승한다.
4. 시대/세계 팔레트: 플래시백=세피아, 현재=청회색, 삼체 게임=황사 금색 — canonical 시트의 캐릭터 외형은 팔레트와 무관하게 동일 유지.
5. 사후 검증(QA에서 캐릭터 비교)은 수행하지 않는다 — 위 예방 절차가 일관성을 보장한다.

## STYLE_BLOCK (모든 프롬프트 맨 앞)

Bold clean ink linework, flat vibrant cell-shaded colors, rounded expressive character designs, dramatic but playful composition, distinctive 1980s Akira Toriyama manga aesthetic. Simple but expressive backgrounds with bold black shadows. Clean panel borders, dynamic perspective.

## 기타

- 이미지에 한글 텍스트 금지 (후처리 SVG 오버레이)
- 각 파일 300KB 이상 확인, 미달 재시도
