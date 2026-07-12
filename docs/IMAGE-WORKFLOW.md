# 🎨 이미지 생성 4단계 워크플로우 — CLE3

> Codex CLI v0.139.0 + ChatGPT 구독 인증
> 화풍: 닥터슬럼프풍 (Akira Toriyama)
> 이미지 모델: gpt-image-2 (Codex 내장 $imagegen)

---

## 개요

```
[A] 화풍 정의  →  [B] 캐릭터 시트  →  [C] 패널 슬롯 동기화  →  [D] 페이지 단위 생성 큐  →  [E] 이미지 생성  →  [F] 텍스트 후처리
```

---

## [A] 화풍 정의

### STYLE_BLOCK (모든 프롬프트 맨 앞에 필수)

```
Bold clean ink linework, flat vibrant cell-shaded colors,
rounded expressive character designs, dramatic but playful composition,
distinctive 1980s Akira Toriyama manga aesthetic.
Simple but expressive backgrounds with bold black shadows.
Clean panel borders, dynamic perspective.
```

---

## [B] 캐릭터 시트

### 새 캐릭터 시트 생성

```bash
codex exec --sandbox workspace-write '$imagegen:
Character reference sheet, multiple views.
Bold clean ink linework, flat vibrant cell-shaded colors,
rounded expressive character designs, 1980s Akira Toriyama manga aesthetic.

Character: [캐릭터 외모]
Layout: 3-column grid (front/side/back). Below: 6 emotions.
Clean white background. Consistent proportions.
Save to episodes/EP001/characters/assets/{캐릭터명}.png'
```

### 기존 시트 기반 추가 표정

```bash
codex -i episodes/EP001/characters/assets/{캐릭터}.png exec --sandbox workspace-write '$imagegen:
Same character as reference. Toriyama style maintained.
Expression sheet: smirking, laughing, in pain, crying, furious, resigned.
6-panel grid, upper body only.
Save to episodes/EP001/characters/assets/{캐릭터}-expressions.png'
```

---

## [C] 배경

```bash
codex exec --sandbox workspace-write '$imagegen:
Bold clean ink linework, flat vibrant cell-shaded colors,
1980s Akira Toriyama manga aesthetic.
Background only, no characters, empty scene.
Location: [장소]
Time: [시간대]
Weather: [날씨]
Atmosphere: [분위기]
Vertical composition.
Save to styles/backgrounds/bg-{이름}-{시간}.png'
```

### 배경 카테고리
- `bg-ext-*` 실외 / `bg-int-*` 실내 / `bg-game-*` 삼체게임 / `bg-mood-*` 추상

---

## [D] 컷 연출 (최종 패널)

### 프롬프트 조립 순서
```
[1] STYLE_BLOCK
[2] SCENE: Setting, Background, Mood, Color palette
[3] CHARACTER: Character block + Expression + Pose
[4] COMPOSITION: Camera, Panel type, Text placement
[5] TEXT: Speech, Narration
```

### 실행 예시

```bash
codex exec --sandbox workspace-write '$imagegen:
Bold clean ink linework, flat vibrant cell-shaded colors,
rounded expressive character designs, 1980s Akira Toriyama manga aesthetic.

--- SCENE ---
Setting: 1960s Chinese university courtyard, late afternoon.
Background: concrete buildings, red banners, bare tree.
Mood: oppressive tension.
Color palette: faded crimson, concrete grey, white highlights.

--- CHARACTER ---
Young Chinese woman, 22, short dark hair, large round eyes, blue uniform.
Expression: grim determination, jaw clenched.
Pose: standing rigid, hands clasped behind back.

--- COMPOSITION ---
Camera: medium shot, slightly low angle.
Panel type: single panel.

--- TEXT ---
Speech balloon area reserved only. Final Korean dialogue is overlaid later.

Vertical manga panel composition.
Save to episodes/EP001/panels/assets/ep001-p01-judgment.png'
```

## 배치 운영

### 1) 슬롯/프롬프트 동기화
```bash
node scripts/sync-panels.js EP001
```

### 2) 페이지 단위 작업 큐 생성
```bash
node scripts/build-panel-jobs.js EP001
```

생성 결과:
- `episodes/EP001/panels/panels.json`
- `episodes/EP001/panels/generation-jobs.json`

### 3) 실행 원칙
- 기본 단위: 패널 1장씩이 아니라 **페이지 단위 배치**
- 일반 페이지: 동시 2~3개
- 다인물/몽타주/풀페이지: 동시 1개
- 실패 시: **해당 패널만 재생성**

---

## 카메라 앵글 참조표

| 앵글 | 효과 |
|------|------|
| close-up | 감정 집중 |
| medium shot | 인물+환경 |
| long shot | 스케일, 고립감 |
| dutch angle | 불안, 혼란 |
| bird's eye | 운명적 조감 |
| worm's eye | 위압 |
| over-shoulder | 대화 몰입 |
| extreme close-up | 극감정 |
| full-page splash | 임팩트 |

---

## 파일명 규칙
```
panels:     episodes/{EP}/panels/assets/{panel_id}.png
characters: episodes/{EP}/characters/assets/{name}.png
backgrounds: bg-{type}-{location}-{time}.png
```

---

## 체크리스트 (컷 1장 생성 시)
- [ ] STYLE_BLOCK 포함
- [ ] 캐릭터 블록 포함 (characters.json 기반)
- [ ] 캐릭터 시트 PNG 참조 확인
- [ ] 배경 설명 포함
- [ ] 카메라 앵글 명시
- [ ] 대사/자막은 후처리 오버레이 대상으로 분리
- [ ] 파일명 규칙 준수
- [ ] panels.json에 메타데이터 기록
