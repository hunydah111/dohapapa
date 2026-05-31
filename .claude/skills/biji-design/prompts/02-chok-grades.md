# 02 — 촉 게임 등급 5종 프롬프트 (Chok Grades)

**용도:** /play "부동산 촉" 결과화면 등급 비지 5장. 7문제 중 적중 수로 등급 부여 → 결과 카드 흰 원(80×80) 안에 노출.

**근거:** `src/lib/game/predict.ts`의 `setGrade()`. 파일명(id) = god/master/pro/mid/rookie.

**5블록 공식**(biji-style-bible.md §6) 그대로. **한 장당 변경은 표정+포즈+소품 한 컨셉만**, 정체성·비율·색은 EXACT 유지.

---

## ⚠️ 화질·경계면 안 깨지게 (모든 장 공통 — 재작업 방지)

1. **해상도**: square 1:1, **2048×2048(2K)**. (화질 ↑, 결과화면 80px로 줄여도 또렷)
2. **배경**: pure flat `#FFFFFF` only. **그라데이션·풍경·후광 글로우 금지**(가장자리로 번지면 컷아웃 때 테두리 깨짐).
3. **여백**: 캐릭터+소품+반짝이 전부 **사방 8% 이상 흰 여백** 안에 들어오게(캔버스 가장자리에 닿지 않게) → 자동 누끼 깨끗.
4. **그림자**: 발밑 soft oval contact shadow **하나만**. 캐릭터 뒤 drop shadow 금지(누끼 가장자리 헤일로 원인).
5. **라인**: uniform outline 2.5%, crisp vector edge, **반투명 글로우/안티에일리어싱 헤일로 없이** 선명하게.
6. **머리 정면 고정**: 머리 돌리지 말 것(귀 11시·1시 유지). 포즈는 팔·소품·표정으로만.

> 저장: `assets/biji-master/incoming/chok-{id}.jpg` (예: `chok-god.jpg`) → `node scripts/process-biji-master.cjs` → `public/biji/chok/{id}.png` 자동 배치 → 결과화면 자동 노출.

**Gemini 사용법:** baseline 첨부(`C:\Users\User\OneDrive\Desktop\비버\baseline front biji.jpg`) → 아래 코드블록 통째 복사 → 전송 → 비율·색·꼬리·귀 baseline과 동일 확인 후 저장.

---

## 🏆 1. god (촉신, 7/7) — 트로피 번쩍, 최고의 촉

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245 (body fur), #F0D0A0 (belly), #3A1E0D (outline/eyes/nose), #F4B5A8 (cheeks/inner ear), #8E5A32 (tail), #FFFDF5 (teeth), #FFFFFF (background)
- Eye spacing (30% inner edges), eye position (52% from head top), cheek blushes (14% diameter)
- Ear position (11 and 1 o'clock), ear size, ear inner pink fill — ears must NOT be covered
- Two front teeth, nose shape, mouth position, tail (horizontal paddle, diamond crosshatch, #8E5A32)
- Outline weight 2.5% of character height, uniform, color #3A1E0D
- Head stays front-facing (do NOT rotate the head)
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — triumphant champion lifting a trophy):
- Both paws raised high above the head together, holding up a GOLD TROPHY CUP (classic two-handled winner's cup): cup height approximately 35% of head width, color solid #E0A23A (gold) with #3A1E0D outline, simple chibi shape with a small base, two side handles
- Both arms bent at the elbow and lifted upward so the trophy sits just above the head — the trophy must NOT touch the top canvas edge (keep 8%+ white margin above it)
- Big proud OPEN-MOUTH smile (happy, wide), two front teeth visible
- Eyes turned into cheerful upward curves OR sparkling — two small 4-pointed white sparkle glints (#FFFFFF) inside the eyes for a starry triumphant look
- 3 floating gold sparkle stars (4-pointed, #E0A23A with #3A1E0D outline, each ≈ 7% of head width) around the trophy in the upper area, all within the canvas with white margin

CANVAS: square 1:1, 2048×2048, character + raised trophy occupy ~62-68% of canvas height, centered horizontally and vertically, at least 8% pure-white margin on all four sides.

LOCK: Character proportions, body fur #B07245, belly #F0D0A0, outline weight, ear placement, tail pattern MUST match reference EXACTLY. Gold #E0A23A appears ONLY on the trophy and floating stars. Pure white flat background, no gradient, no glow bleed to edges, single soft contact shadow only. Do not add a crown or cape. Do not restyle. Do not rotate the head.
```

**저장 파일명:** `chok-god.jpg`

---

## 🔥 2. master (촉고수, 6/7) — 손가락총 윙크, 자신만만

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245, #F0D0A0, #3A1E0D, #F4B5A8, #8E5A32, #FFFDF5, #FFFFFF
- Eye spacing, cheek blushes, ear position/size/inner pink, two front teeth, nose, tail pattern
- Outline weight 2.5%, uniform, #3A1E0D
- Head stays front-facing (do NOT rotate the head)
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — cocky "finger gun" confident pose):
- Right paw raised to chest/shoulder height making a "FINGER GUN" gesture pointing toward the viewer/slightly to the side (paw shaped like a pointing gesture, one digit extended forward, thumb up)
- A tiny coral spark at the fingertip: one small 4-pointed sparkle, fill #FE7644 (coral) with #3A1E0D outline, ≈ 5% of head width (the ONLY non-palette color, only on this spark)
- Left paw resting confidently on the hip (arm bent at elbow)
- One eye WINKING: the right eye becomes a downward "U" curved closed line (#3A1E0D, same weight as outline), the left eye stays the normal solid #3A1E0D circle with white highlight
- Cocky closed-mouth smirk: mouth corners clearly upturned to one side, two teeth visible
- Cheek blushes normal

CANVAS: square 1:1, 2048×2048, character occupies ~62-68% of canvas height, centered, at least 8% pure-white margin on all four sides.

LOCK: Character proportions, palette (except #FE7644 used ONLY on the fingertip spark), outline weight, ear placement, tail pattern MUST match reference EXACTLY. Pure white flat background, no gradient, no glow bleed, single soft contact shadow only. Do not add sunglasses, hat, or chain (those belong to other grades). Do not restyle. Do not rotate the head.
```

**저장 파일명:** `chok-master.jpg`

---

## 😎 3. pro (촉상수, 5/7) — 선글라스 + 엄지척, 여유

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245, #F0D0A0, #3A1E0D, #F4B5A8, #8E5A32, #FFFDF5, #FFFFFF
- Eye position (52% from head top) and spacing — eyes hidden behind sunglasses but position unchanged
- Cheek blushes (still visible below the sunglasses), ear position/size/inner pink, two front teeth, nose, tail pattern
- Outline weight 2.5%, uniform, #3A1E0D
- Head stays front-facing (do NOT rotate the head)
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — relaxed cool look):
- Simple RECTANGULAR SUNGLASSES covering both eyes: solid #3A1E0D fill (no lens reflection, no gold), total width ≈ 52% of head width to cover both eyes naturally — must NOT cover or touch the ears
- Right paw raised to chest height giving a clear THUMBS-UP (closed fist with thumb pointing straight up)
- Left paw relaxed at side
- Relaxed confident closed-mouth smile, mouth corners gently upturned, two teeth visible
- Cheek blushes normal, visible just below the sunglasses

CANVAS: square 1:1, 2048×2048, character occupies ~62-68% of canvas height, centered, at least 8% pure-white margin on all four sides.

LOCK: Character proportions, palette (sunglasses are #3A1E0D, already in palette — NO new colors), outline weight, ear placement and visibility, tail pattern MUST match reference EXACTLY. Pure white flat background, no gradient, no glow bleed, single soft contact shadow only. Sunglasses are plain rectangular and solid #3A1E0D — NOT star-shaped, NO gold, NO chain. Do not restyle. Do not rotate the head.
```

**저장 파일명:** `chok-pro.jpg`

---

## 🙂 4. mid (촉중수, 4/7) — 브이(V) 사인, 무난한 미소

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245, #F0D0A0, #3A1E0D, #F4B5A8, #8E5A32, #FFFDF5, #FFFFFF
- Eye size (17%, solid #3A1E0D with white highlight), eye spacing, cheek blushes, ear position/size/inner pink, two front teeth, nose, tail pattern
- Outline weight 2.5%, uniform, #3A1E0D
- Head stays front-facing (do NOT rotate the head)
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — easy-going "not bad" peace sign):
- Right paw raised near the cheek making a small "V / PEACE SIGN" (two digits up in a V), paw at cheek height
- Left paw relaxed at side
- Gentle CONTENT closed-mouth smile (mild, friendly, mouth corners softly upturned, two teeth slightly visible) — relaxed satisfied vibe, not super excited
- Eyes normal solid #3A1E0D circles with white highlight (calm, friendly)
- Cheek blushes normal (#F4B5A8, 80%)

CANVAS: square 1:1, 2048×2048, character occupies ~62-68% of canvas height, centered, at least 8% pure-white margin on all four sides.

LOCK: Character proportions, palette (NO new colors), outline weight, ear placement, tail pattern MUST match reference EXACTLY. Pure white flat background, no gradient, no glow bleed, single soft contact shadow only. Do not add glasses, hat, props, or floating elements — just the V-sign paw and gentle smile. Do not restyle. Do not rotate the head.
```

**저장 파일명:** `chok-mid.jpg`

---

## 🐣 5. rookie (촉린이, 0~3/7) — 머리 긁적, 감 잡는 중

```
Using the attached image (the Geometry Master baseline of "Biji") as the EXACT identity reference. Generate Biji with ONE specific addition described below.

PRESERVE EXACTLY (do not change ANY of these):
- All body proportions: head-to-body ratio 1:0.86, total height 1.86 heads, head_width = head_height × 1.24
- All 7 locked palette colors: #B07245, #F0D0A0, #3A1E0D, #F4B5A8, #8E5A32, #FFFDF5, #FFFFFF
- Eye spacing, eye color (solid #3A1E0D with white highlight), cheek blushes, ear position/size/inner pink, two front teeth, nose, tail pattern
- Outline weight 2.5%, uniform, #3A1E0D
- Head stays front-facing (do NOT rotate the head — convey "puzzled" with the paw and props, not by tilting the head)
- Pure white #FFFFFF background with soft oval contact shadow under feet

ADD ONLY (this is the change — sheepish newbie "still figuring it out"):
- Right paw raised to scratch the back/side of the head (paw touching the head near the right ear, elbow bent up) — classic "hmm, not sure" head-scratch
- Left paw relaxed at side
- Sheepish small awkward smile: mouth a small gentle wavy/asymmetric line, ONE tooth peeking, slightly embarrassed
- Eyes: keep both as normal solid #3A1E0D circles with white highlight, but make them look slightly innocent/round (you may enlarge to 18% of head width)
- One small SWEAT DROP near the temple/forehead on the upper-right of the head: teardrop shape, fill #FFFFFF with #3A1E0D outline, ≈ 6% of head width
- One small QUESTION MARK "?" floating in the upper area beside the head: color #3A1E0D, ≈ 10% of head width, fully within the canvas with white margin

CANVAS: square 1:1, 2048×2048, character occupies ~62-68% of canvas height, centered, at least 8% pure-white margin on all four sides.

LOCK: Character proportions, palette (NO new colors — sweat drop is white+outline, "?" is #3A1E0D), outline weight, ear placement and visibility (the scratching paw is BESIDE the ear, not covering it), tail pattern MUST match reference EXACTLY. Pure white flat background, no gradient, no glow bleed, single soft contact shadow only. Keep the head front-facing. Do not add a hat, pacifier, or bonnet (those belong to other grades). Do not restyle.
```

**저장 파일명:** `chok-rookie.jpg`

---

## ✅ 5장 다 받은 후

```bash
node scripts/process-biji-master.cjs
```

→ `incoming/chok-*.jpg` 자동 누끼+512² → `public/biji/chok/{god,master,pro,mid,rookie}.png` 배치.
결과화면이 emoji 폴백(🏆🔥😎🙂🐣)에서 비지로 자동 전환됨(코드 수정 불필요).

검증: `/play` 7문제 풀고 결과화면에서 등급별 비지 노출 확인.
