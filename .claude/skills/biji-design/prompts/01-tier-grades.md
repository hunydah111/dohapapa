# 01 — 등급 6종 프롬프트 (Tier Grades)

**용도:** 비지 등급 6장 생성. 각 등급의 표정·소품만 baseline에서 변경, 정체성·비율·색은 EXACT 유지.

**근거:** `src/lib/budgetPercentile.ts`의 `BEAVER_TIERS` 6등급. 합성 트레이딩 카드의 메인 일러스트로 사용.

**작업 시간:** 각 5~10분 (재생성 1~3번 포함) × 6장 ≈ 30~60분.

---

## 📋 공통 사용법

매 등급마다:
1. Gemini 웹 열기
2. **baseline 첨부**: `C:\Users\User\OneDrive\Desktop\비버\baseline front biji.jpg`
3. 해당 등급의 영어 프롬프트 코드블록 전체 복사 → 붙여넣기 → 전송
4. 결과 확인:
   - ✅ 비율·색·라인·꼬리·이빨 → baseline과 동일
   - ✅ 표정·소품만 등급에 맞게 변경됨
   - ❌ 머리 돌아감, 색 변경, 배경 추가, 양손 위치 크게 변함 → 재생성
5. OK면 **`C:\Users\User\실습\assets\biji-master\incoming\tier-{slug}.jpg`** 로 저장
   - 파일명 정확히! (예: `tier-fever.jpg`, `tier-justin.jpg` 등)
6. 6장 다 모이면 `node scripts/process-biji-master.cjs` 한 번 → 자동 후처리

---

## 🥇 1. 저스틴비버 (justin, 🕺) — 취향껏 집짓는 비버 (상위 1%) — 블링블링 락스타 ver.

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245 (body fur), #F0D0A0 (belly), #3A1E0D (outline/eyes/nose), #F4B5A8 (cheeks/inner ear), #8E5A32 (tail), #FFFDF5 (teeth), #FFFFFF (background)
- Eye spacing (30% inner edges), eye position (52% from head top) — eyes themselves hidden behind sunglasses but their position is unchanged
- Cheek blushes (14% diameter ovals, below each eye), still visible at the bottom of the cheeks below sunglasses
- Ear position (11 and 1 o'clock on head top), ear size, ear inner pink fill — ears must NOT be covered or hidden
- Two front teeth, nose shape, mouth position
- Tail: horizontal paddle to one side, diamond crosshatch grid pattern, color #8E5A32
- Outline weight 2.5% of character height, uniform, color #3A1E0D
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — bling-bling Justin Bieber celebrity look):
- Small black 5-pointed star-shaped sunglasses covering both eyes (solid #3A1E0D fill, no lens reflection, total sunglasses width approximately 50% of head width to cover both eyes naturally — must NOT hide or cover the ears at all)
- THICK GOLD CHAIN NECKLACE wrapped around the neck and draping down to chest level: classic chunky hip-hop style chain made of round oval links, link size approximately 3% of head width each, chain thickness visible. Chain color: solid #E0A23A (gold) with #3A1E0D outline.
- LARGE GOLD STAR PENDANT hanging from the bottom of the chain at chest center, 4-pointed star shape, approximately 14% of head width, color #E0A23A with #3A1E0D outline.
- Right paw raised high upward in a confident "rockstar/pop star pointing up" gesture (right arm bent at elbow, paw fully visible above head height, index finger or full paw pointing up)
- Left paw on hip in confident stance
- Confident smirk: mouth corners noticeably upturned to one side, two teeth visible (closed mouth)
- 3 floating gold sparkle stars (4-pointed, color #E0A23A with #3A1E0D outline, each ≈ 7% of head width) in the upper canvas area around the head — slightly larger and more luxurious than previous version

CANVAS: square 1:1, character occupies 65-70% of canvas height, centered horizontally and vertically within 2% tolerance. The chain and pendant must fit within the body silhouette.

LOCK: Character proportions, body fur color #B07245, belly color #F0D0A0, outline weight, ear placement, tail pattern MUST match reference EXACTLY. Gold #E0A23A appears ONLY on the chain, pendant, and floating stars — nowhere else. Sunglasses remain solid #3A1E0D (no gold). Do not put gold on the body, ears, tail, or background. Do not add a hat or cap (ears must stay fully visible). Do not add a microphone. Do not restyle. Do not switch art style. Body fur color is NOT changed — the chain hangs ON TOP of the visible belly area.
```

**저장 파일명:** `tier-justin.jpg`

---

## 🔥 2. 피버 (fever, 🔥) — 골라짓는 비버 (상위 10%) — 눈에서 귀여운 불꽃 ver.

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245 (body fur), #F0D0A0 (belly), #3A1E0D (outline/eyes/nose), #F4B5A8 (cheeks/inner ear), #8E5A32 (tail), #FFFDF5 (teeth), #FFFFFF (background)
- Eye size (17% of head width), eye spacing, position — eyes themselves UNCHANGED: still solid #3A1E0D circles with single white highlight dot upper-left
- Cheek blushes, ear position and shape, tail pattern
- Two front teeth, nose, mouth shape position
- Outline weight 2.5% of character height, uniform
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — cute "fired up" expression):
- Two small CUTE CARTOON flames rising from directly above each eye, each flame approximately 1.5× the eye diameter tall, positioned right above each pupil and extending upward into the upper head area (flames reach roughly the top of the head, do not exceed it)
- Flame shape: ROUNDED organic blob outline like a friendly kawaii anime flame — NOT sharp pointed realistic fire. 2-3 gentle rounded peaks at the top, soft curves throughout. Think Pokemon/Digimon style cute flame.
- Flame color: outer fill #FE7644 (coral orange), inner core fill #E0A23A (gold), with #3A1E0D outline matching character outline weight. The coral and gold are the ONLY colors outside the locked palette, and they appear ONLY on the flames.
- Both paws clenched into small chibi fists held at chest height (right paw fist at right chest, left paw fist at left chest — excited "let's go!" determined pose, arms bent at elbows pointing outward slightly)
- Excited closed-mouth smile (mouth corners noticeably upturned, two front teeth visible, slight excited energy)
- Cheek blushes slightly more saturated (same #F4B5A8 color, opacity raised to 90% instead of 80%) to convey heat/excitement

CANVAS: square 1:1, character occupies 65-70% of canvas height, centered. Flames must fit within the canvas with at least 5% white space above their highest peak.

LOCK: Character proportions, palette (except #FE7644 and #E0A23A used ONLY on flames), outline weight, ear placement, tail pattern, eye geometry, nose, mouth position MUST match reference EXACTLY. The flames and fist pose are the ONLY changes. Do not restyle. Do not change body color. Do not add background elements other than the flames and contact shadow. Do not make the flames scary or realistic — they must be CUTE and friendly. Do not replace the eyes themselves; the eyes remain normal and the flames rise from ABOVE them.
```

**저장 파일명:** `tier-fever.jpg`

---

## 🏆 3. 탑비버 (top, 🏆) — 잘나가는 비버 (상위 30%) — 금수저 입에 ver.

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245 (body fur), #F0D0A0 (belly), #3A1E0D (outline/eyes/nose), #F4B5A8 (cheeks/inner ear), #8E5A32 (tail), #FFFDF5 (teeth), #FFFFFF (background)
- Eye spacing (30% inner edges), eye position (52% from head top), eye color (solid #3A1E0D with single white highlight)
- Cheek blushes (14% diameter), ear position and shape, tail pattern
- Nose shape, nose position (62% from head top), two front teeth presence
- Outline weight 2.5% of character height, uniform
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — "born with a gold spoon" Korean cultural icon):
- A gold-colored spoon held horizontally in the mouth (the spoon goes from cheek to cheek, slightly tilted at maybe 5-10 degrees for playful effect, with the rounded spoon-bowl end on the character's right side and the handle end on the character's left side — or vice versa, whichever looks more natural)
- Spoon length approximately 35% of head width (slightly wider than the mouth so the bowl and handle ends are visible outside the lip line)
- Spoon shape: classic dinner spoon silhouette — oval rounded bowl on one end, straight cylindrical handle on the other end, simple chibi style
- Spoon color: solid fill #E0A23A (gold), with #3A1E0D outline matching character outline weight. Gold is the ONLY color outside the locked palette, and it appears ONLY on the spoon.
- The two front teeth are still slightly visible, but the spoon rests in front of them horizontally — teeth visible above the spoon
- Mouth shape: closed and slightly smug/satisfied smile holding the spoon, mouth corners gently upturned
- Eyes: slightly narrower/relaxed in a confident "I've got this" expression — eye HEIGHT reduced to ~13% of head width (width stays at 17%), as if Biji is slightly squinting with satisfaction. Eyes remain solid #3A1E0D with white highlight.
- Both paws: relaxed at sides exactly like baseline (do NOT change paw position — only the face and spoon change)

CANVAS: square 1:1, character occupies 65-70% of canvas height, centered.

LOCK: Character proportions, palette (except gold #E0A23A used ONLY on the spoon), outline weight, ear placement, tail pattern, paw positions MUST match reference EXACTLY. The spoon and slightly smug expression are the ONLY changes. Do not restyle. Do not add background elements other than the contact shadow. Do not add a star, trophy, crown, or any other prop — the gold spoon is the single visual hero of this image.
```

**저장 파일명:** `tier-top.jpg`

---

## 😎 4. 난비버 (nan, 😎) — 알짜비버 (상위 50%) — 엘비스 퐁파두르 ver.

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245 (body fur), #F0D0A0 (belly), #3A1E0D (outline/eyes/nose), #F4B5A8 (cheeks/inner ear), #8E5A32 (tail), #FFFDF5 (teeth), #FFFFFF (background)
- Eye size (17% of head width), eye spacing (30%), eye position (52% from head top), eye color
- Cheek blushes (14% diameter), ear position and shape, tail pattern, nose shape
- Two front teeth, mouth position
- Outline weight 2.5% of character height, uniform, color #3A1E0D
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — cute Elvis Presley pompadour "I'm somebody" look):
- ELVIS PRESLEY-STYLE POMPADOUR HAIRSTYLE on top of the head:
  - A single bold pompadour wave swept up and forward from the forehead, the front lifted high and curling slightly forward at the tip
  - Hair width approximately 60% of head width, height approximately 40% of head height — the hairstyle rises ABOVE the top of the head silhouette
  - Hair color: solid #3A1E0D (dark brown-black, the same color as the character outline)
  - The hair has #3A1E0D outline matching character outline weight, with one subtle white highlight stroke (#FFFFFF) along the upper-front curve of the wave to suggest glossy hair shine
  - CRITICAL: the hair must NOT cover the ears — both ears remain fully visible at their normal 11 and 1 o'clock positions, sticking out on either side of the pompadour
  - The hair starts at the top of the head (above the eyes) and rises upward — it does NOT cover the eyes or face
  - Small sideburn hint on each cheek side (tiny #3A1E0D triangular wedge ≈ 4% of head width at each side of the face, near the cheek/ear meeting point) — optional but adds Elvis vibe
- Both paws on hips in a confident "akimbo" standing pose (right paw bent at elbow with paw on hip, left paw bent at elbow with paw on hip)
- Slight cool smirk: mouth corners gently upturned to one side, two teeth visible (closed-mouth confident smile)
- One small music note (♪, color #3A1E0D, ≈ 8% of head width) floating in the upper canvas area near the head — optional but reinforces the rockstar vibe

CANVAS: square 1:1, character occupies 65-70% of canvas height, centered. The pompadour must fit within the canvas with at least 5% white space above its highest point.

LOCK: Character proportions, palette (no new colors needed — hair uses #3A1E0D already in palette), outline weight, EAR placement and visibility (ears stay fully visible beside the pompadour), tail pattern, eye geometry MUST match reference EXACTLY. The pompadour, akimbo pose, and smirk are the ONLY changes. Do not restyle. Do not add a microphone, guitar, or other props. Do not add a costume/jumpsuit on the body. Do not cover the ears with hair under any circumstances. The body fur color #B07245 is NOT changed — only the top of the head gets the hair.
```

**저장 파일명:** `tier-nan.jpg`

---

## 🦫 5. 국민비버 (gukmin, 🦫) — 국민비버 (상위 70%)

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions, all 7 locked palette colors, eye/cheek/ear/tail/nose/mouth specs
- Outline weight 2.5%, color #3A1E0D
- Pure white background with soft oval contact shadow

ADD ONLY (this is the change):
- Right paw raised in a friendly waving gesture (paw at head height, fingers slightly spread, waving)
- Left paw relaxed at side
- Warm friendly closed-mouth smile (mouth corners gently upturned, two teeth slightly visible)
- Cheek blushes slightly larger (16% diameter instead of 14%, same color #F4B5A8, same 80% opacity) to convey warmth
- No additional props, no glasses, no items

CANVAS: square 1:1, character occupies 65-70% of canvas height, centered.

LOCK: Character proportions, palette, outline weight, ear placement, tail pattern MUST match reference EXACTLY. Do not restyle. Do not add background elements other than the contact shadow.
```

**저장 파일명:** `tier-gukmin.jpg`

---

## 🐣 6. 아기비버 (baby, 🐣) — 집짓기 시작하는 비버 (하위 30%) — 쪽쪽이 + 두건 ver.

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245 (body fur), #F0D0A0 (belly), #3A1E0D (outline/eyes/nose), #F4B5A8 (cheeks/inner ear), #8E5A32 (tail), #FFFDF5 (teeth), #FFFFFF (background)
- Eye spacing, eye position, eye color (solid #3A1E0D with white highlight)
- Cheek blushes present, ear position and shape, tail pattern, nose shape
- Outline weight 2.5% of character height, uniform, color #3A1E0D
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — innocent baby look with pacifier and bonnet):
- BABY PACIFIER (쪽쪽이) held in the mouth:
  - The pacifier's round handle ring sits in front of the mouth, diameter approximately 14% of head width, color #FFFDF5 (warm white) with #3A1E0D outline (the ring is a thick rounded torus shape, like a classic baby pacifier handle)
  - Behind/inside the ring, a small rounded soft pink nipple base extends into the mouth, color #F4B5A8 with #3A1E0D outline, approximately 10% of head width tall
  - The pacifier covers the mouth completely — front teeth NOT visible (hidden by pacifier)
  - Slight playful tilt: pacifier rotated 5-10 degrees off horizontal
- BABY BONNET / HEAD BANDANA (아기 머리두건):
  - A soft baby bonnet covering the top of the head (the upper third of the head)
  - Color: #F4B5A8 (coral pink, from locked palette) with #3A1E0D outline matching character outline weight
  - CRITICAL: the bonnet sits AROUND and BETWEEN the ears — both ears must remain FULLY VISIBLE poking up through their normal positions (11 and 1 o'clock). The bonnet does NOT cover the ears.
  - The bonnet has a small bow knot (나비매듭) at the front center top, color #F4B5A8, bow approximately 12% of head width wide
  - Optional: 3 small white polka dots (#FFFFFF) scattered on the bonnet fabric for cuteness, each dot ≈ 3% of head width
- Slightly larger eyes for baby look: 20% of head width diameter (instead of normal 17%), white highlight slightly enlarged to 30% of pupil
- Cheek blushes larger and more saturated: 17% diameter (instead of 14%), opacity 90%, same #F4B5A8 color — for that baby-chubby look
- Both paws relaxed at sides exactly like baseline, OR very slightly raised in a tiny baby reach (within 10 degrees of baseline pose — keep it minimal)
- 2 small floating hearts (#F4B5A8 with #3A1E0D outline, each ≈ 5% of head width) in the upper canvas area, optional

CANVAS: square 1:1, character occupies 65-70% of canvas height, centered. The bonnet and pacifier must fit within the canvas.

LOCK: Character proportions, palette (no new colors needed — bonnet and pacifier use #F4B5A8 and #FFFDF5 from locked palette), outline weight, EAR placement and visibility (ears stay fully visible above/beside bonnet), tail pattern MUST match reference EXACTLY. The pacifier, bonnet, and slightly bigger eyes/cheeks are the ONLY changes. Do not restyle. Do not cover the ears with the bonnet under any circumstances. Do not add background elements other than the floating hearts and contact shadow. The bonnet must look like a soft cloth wrap, not a hat — no stiff brim, no firm shape.
```

**저장 파일명:** `tier-baby.jpg`

---

## ✅ 6장 다 받은 후 (자동 후처리)

```bash
node scripts/process-biji-master.cjs
```

이 스크립트가 자동으로:
1. `assets/biji-master/incoming/tier-*.jpg` 전부 스캔
2. 코너 flood-fill (HARD 246) + 가장자리 페더링 (SOFT 210)로 투명 PNG 변환
3. 512×512 정사각으로 사이즈 통일
4. `public/biji/tier/{slug}.png` 로 배치 (`/biji/tier/fever.png` 등)
5. 처리된 jpg는 `assets/biji-master/incoming/_processed/`로 이동

**다음 단계 (사용자 6장 처리 끝나면):**
- `02-accessories.md` 액세서리 N종 프롬프트
- 트레이딩 카드 컴포넌트 (`src/components/BijiCard.tsx`) 코드
- 동적 OG 합성 (`src/app/opengraph-image.tsx` 업그레이드)
