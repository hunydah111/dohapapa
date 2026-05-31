---
name: biji-style-bible
description: Biji(비지) 마스코트의 정량 spec 단일 진실. Nano Banana 프롬프트 작성·합성 컴포넌트·후처리·새 등급/액세서리 추가 시 이 파일이 기준. SKILL.md(biji-design)가 디자인 시스템의 큰 그림, 이 파일은 캐릭터 자체의 픽셀 spec.
metadata:
  type: reference
  source: "assets/biji-master/biji-style-master.jpg (갸웃) + baseline-front-biji.jpg (정면)"
  measured: 2026-05-26
  measure_script: "scripts/measure-biji-master.cjs"
  raw_data: ".claude/skills/biji-design/biji-style-bible.generated.yml"
---

# Biji Style Bible v1

이 파일 = **비지 캐릭터의 정량 spec 단일 진실**. 새 등급·액세서리·포즈 생성 시 모든 Nano Banana 프롬프트는 이 spec을 lock으로 박는다.

**측정 방법:**
- **자동 측정** (`scripts/measure-biji-master.cjs`) — head/body 비율·dominant 색 팔레트·bbox
- **시각 분석** — 눈·볼·귀·코·꼬리 (자동 알고리즘 한계로 outline-눈 분리 실패, 다음 라운드 v2에서 개선)
- **출처 이미지** — 갸웃 비지(Style Master, 정체성 reference) + 정면 baseline(Geometry Master, 비율 측정 기준)

---

## 1. 캐릭터 정의

```yaml
name: Biji (비지)
species: kawaii chibi beaver
style: flat 2D vector with uniform outline
brand: 비집고 (dohapapa, 부동산 결정 도구)
```

## 2. 캔버스·배경 (모든 생성 동일)

```yaml
aspect_ratio: "1:1"
resolution: 1024x1024  # 2K(2048x2048)도 OK
background: pure white #FFFFFF (flat, no gradient, no scenery)
contact_shadow:
  shape: soft oval directly under feet
  opacity: 8%
  color: #000000
  blur_radius: 6% of character height
character_occupancy: 65-70% of canvas height, centered ±2% on both axes
camera: eye-level, zero perspective distortion
```

## 3. 비율 (head_width 기준 정규화, 측정값)

```yaml
total_height_in_heads: 1.86          # 약 2 heads tall (super-chibi, head-dominant)
head_to_body_ratio: "1 : 0.86"        # 머리가 몸보다 큼
head_shape: circle, head_width ≈ head_height × 1.24

# head_width = 100% 기준 (baseline 측정: 484px on 1024 canvas)
DIMENSIONS:
  total_height:  150%
  head_height:    80%
  body_height:    70%
  
  # 얼굴
  eye_diameter:        17%
  eye_spacing_inner:   30%             # 두 눈 안쪽 가장자리 사이
  eye_y_from_head_top: 52% of head_height
  
  cheek_diameter: 14%                  # 좌우 각각
  cheek_shape:    horizontal oval (width = 1.3× height)
  cheek_position: 눈 바로 아래, 양옆 대칭
  cheek_opacity:  80%
  
  nose_width:   11%
  nose_height:   8%
  nose_position: 중앙, 머리 top에서 62%
  nose_shape:   small downward triangle with rounded corners
  
  mouth_width:    21%
  mouth_position: 중앙, 머리 top에서 73%
  front_teeth:    two small white rectangles, 7% × 9% each, rounded bottom corners
  
  # 머리 부속
  ear_height:   18% of head_height
  ear_width:    16% of head_height
  ear_position: 머리 top, 11시·1시 방향 (±25° from vertical)
  ear_inner_fill: 코랄 핑크가 내부 50% 점유
  
  # 꼬리 (비버 시그니처)
  tail_length:   75%
  tail_width:    45%
  tail_position: 한쪽 옆으로 수평 (몸 뒤에서 옆으로 빠짐, 전체 silhouette 보임)
  tail_pattern:  diamond crosshatch grid drawn in outline color
  tail_y_center: 60% of body height from top
  
  # 라인
  outline_weight: 2.5% of total character height (uniform on all edges)
  outline_color:  "#3A1E0D"
```

## 4. 색 팔레트 (7색 LOCK, 다른 색 사용 금지)

| Hex | 역할 | 픽셀 비율 (측정) |
|---|---|---|
| `#B07245` | body fur (메인 브라운) | 56% |
| `#F0D0A0` | belly patch (크림) | 11% |
| `#3A1E0D` | outline + eyes + nose (다크 브라운-블랙) | 17% |
| `#F4B5A8` | cheek + inner ear (코랄 핑크) | 시각 추정 |
| `#8E5A32` | tail (더 어두운 브라운) | 8% |
| `#FFFDF5` | front teeth (따뜻한 흰색) | 미미 |
| `#FFFFFF` | background + eye highlight (순수 흰) | 30%+ |

**눈 동공:** `#3A1E0D` solid, no gradient. **눈 highlight:** 흰 점 1개, 동공 좌상단, 동공 지름의 25%.

## 5. 스타일 LOCK (모든 프롬프트 끝에 박는다)

```
- flat 2D vector, NO gradients
- NO textures (except diamond crosshatch grid on tail)
- NO rim lighting, NO 3D shading, NO cel-shading highlights beyond single eye dot
- uniform outline weight on ALL silhouette and feature edges
- single flat darker shadow tone ONLY on lower 30% of body (where reference shows it)
- character proportions, palette, outline weight MUST match reference image EXACTLY
```

## 5.5. 포즈·비율 붕괴 방지 (v2, 필수 — 2026-05-31 학습)

**사고:** 트로피를 머리 위로 드는 등 **큰 포즈 변경**을 시키니, 모델이 몸을 "자연스럽게 설 수 있는"
길쭉한 일반 마스코트 체형으로 **재구성** → 초치비 비율(키≈1.9 머리, 머리=상반신 절반) 붕괴.
얼굴·색은 맞았지만 키 ≈2.7로 늘어나고 머리가 작아짐. (스크린샷: 이상비버.png)

**원인:** ① 팔 들기/서기 같은 포즈 변경 = 모델이 몸 전체 재작도 ② 비율을 **숫자(1:0.86)로만**
박으면 모델이 못 따름 — 시각 reference만 따라감 → 포즈 앵커가 풀리면 비율도 풀림.

**필수 규칙 (모든 비지 생성 프롬프트에 적용):**
1. **포즈 변경 최소화** — 머리 위로 팔 들기·서는 자세 재구성 금지. **소품은 가슴 앞에서** 들기.
   팔은 "짧게 굽히기"만, 늘리지 말 것. 한쪽 팔만 바꾸고 반대 팔·다리·스탠스는 baseline 유지.
2. **"reference를 베이스로 깔고 표정·소품만 얹어라" 가드를 프롬프트 맨 앞에.** 표현:
   *"Use the attached image as the EXACT base. Redraw THIS SAME beaver in THE SAME pose — only
   change the face and add ONE prop. Do NOT make the body taller/slimmer/upright, do NOT elongate
   torso/legs, do NOT shrink the head."*
3. **비율은 숫자 대신 그림 묘사** — *"머리가 거대하고 상반신 절반을 채움, 키는 머리 약 2개,
   몸은 머리 밑 작고 동그란 덩어리, 팔 짧음."* (숫자는 보조로만)
4. 한 프롬프트 = 변경 하나(표정+소품 1세트). 화질 2K·사방 12% 흰여백·발밑 그림자만·글로우 가장자리 번짐 금지.
5. **god 1장 먼저 검증 → OK면 나머지.** (포즈 큰 등급부터 테스트)

→ 검증된 템플릿: `prompts/02-chok-grades.md` v2. 새 등급/포즈는 이 v2 구조 복사해서 씀.

## 6. 프롬프트 작성 공식 (Nano Banana 5블록)

```
[ANCHOR] Using the attached Geometry Master baseline as EXACT identity reference for "Biji"...
[SUBJECT] Biji, kawaii chibi beaver, identical to reference in every aspect
[ACTION] <이번 생성의 단 한 가지 변경>
[LOCATION] pure white #FFFFFF background, soft contact shadow under feet
[COMPOSITION] 1:1 canvas, character 65-70% of height, centered
[STYLE] Color palette restricted to 7 locked hex values: #B07245 #F0D0A0 #3A1E0D #F4B5A8 #8E5A32 #FFFDF5 #FFFFFF
[LOCK] Proportions, palette, outline weight match reference EXACTLY. Do not restyle.
```

**핵심 규칙:**
- 한 프롬프트에 **변경은 하나만** (등급 표정 OR 액세서리, 동시 변경 X)
- **부정형 금지** (`no shadow` ❌ → `pure white background` ✅)
- 매 프롬프트 끝에 **lock 반복** (drift 방지)
- baseline이 reference image로 항상 첨부됨 → 비율은 reference로 자동 anchor

---

## 7. 알려진 한계 & v2 계획

- **자동 측정 v1**: outline이 머리 둘레로 연결돼서 connected component가 눈을 분리 못 함. 눈/볼 spec은 baseline 시각 분석으로 보완.
- **v2 측정 알고리즘**: outline 제거 후 component 찾기 (morphological open) + 흰 highlight로 눈 찾기 (검정 동그라미 안의 흰 점 = 눈 시그니처)
- **새 등급/액세서리 추가 시**: 이 파일 §3·§4 그대로 사용 + §6 공식 따라 프롬프트 작성

## 8. 관련 파일

```
.claude/skills/biji-design/
  SKILL.md                              ← 비집고 디자인 시스템 전체 (이 파일 참조)
  biji-style-bible.md                   ← 이 파일 (정량 spec)
  biji-style-bible.generated.yml        ← 자동 측정 raw output
  prompts/
    00-geometry-baseline.md             ← baseline 생성 프롬프트 (이미 사용 완료)
    01-tier-grades.md                   ← 등급 6종 프롬프트
    02-accessories.md                   ← 액세서리 N종 프롬프트 (다음 단계)

assets/biji-master/
  biji-style-master.jpg                 ← 갸웃 비지 (Style Master 사본)
  incoming/                             ← 사용자가 제미나이 결과 떨구는 곳
  processed/                            ← process-biji-master.cjs 출력

scripts/
  measure-biji-master.cjs               ← 자동 측정 (sharp 픽셀 분석)
  process-biji-master.cjs               ← jpg→투명 PNG + 사이즈 통일 (다음 단계)
```
