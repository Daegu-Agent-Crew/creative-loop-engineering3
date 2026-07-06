# 🎨 이미지 생성 4단계 워크플로우 — CLE3

> Codex CLI v0.139.0 + ChatGPT 구독 인증
> 화풍: 닥터슬럼프풍 (Akira Toriyama)
> 이미지 모델: gpt-image-2 (Codex 내장 $imagegen)

---

## 개요

```
[A] 화풍 정의  →  [B] 캐릭터 시트  →  [C] 배경  →  [D] 컷 연출
   (고정됨)        (캐릭터별)         (장소별)     (최종 합성)
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
Save to styles/characters/{캐릭터명}.png'
```

### 기존 시트 기반 추가 표정

```bash
codex -i styles/characters/{캐릭터}.png exec --sandbox workspace-write '$imagegen:
Same character as reference. Toriyama style maintained.
Expression sheet: smirking, laughing, in pain, crying, furious, resigned.
6-panel grid, upper body only.
Save to styles/characters/{캐릭터}-expressions.png'
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
Speech: "동지들, 역사는 우리에게 심판을 요구한다."

Vertical manga panel composition.
Save to episodes/EP001/panels/ep001-p01-judgment.png'
```

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
panels:     ep{NNN}-p{PP}-{scene}.png
characters: {name}.png, {name}-expressions.png
backgrounds: bg-{type}-{location}-{time}.png
```

---

## 체크리스트 (컷 1장 생성 시)
- [ ] STYLE_BLOCK 포함
- [ ] 캐릭터 블록 포함 (characters.json 기반)
- [ ] 캐릭터 시트 PNG 참조 확인
- [ ] 배경 설명 포함
- [ ] 카메라 앵글 명시
- [ ] 대사/자막 포함
- [ ] 파일명 규칙 준수
- [ ] panels.json에 메타데이터 기록
