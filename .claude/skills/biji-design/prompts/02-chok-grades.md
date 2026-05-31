# 02 — 촉 게임 등급 5종 프롬프트 (Chok Grades) — v2

**용도:** /play "부동산 촉" 결과화면 등급 비지 5장. id = god/master/pro/mid/rookie.

## ⚠️ v2 수정 이유 (v1 실패 분석)
v1은 비율이 **전혀 다르게** 나옴(이상비버.png): baseline은 머리가 절반인 초치비(키≈1.9 머리),
결과는 키≈2.7로 **쭉 늘어나고 머리 작아진 꼿꼿한 마스코트** 체형. 얼굴·색은 맞았음.
- **원인**: "두 팔 머리 위로 들어 트로피" 같은 **큰 포즈 변경**. 이미지 모델은 팔 들기/서기를
  그리라 하면 몸을 "자연스럽게 설 수 있는" 길쭉한 비율로 **재구성**, reference 치비 비율을 버림.
  + 비율을 숫자(1:0.86)로만 박아서 모델이 못 따름(시각 reference만 따라감).
- **v2 해법**: ①포즈 변경 최소화(머리 위 금지·소품은 가슴 앞) ②"reference를 베이스로 깔고
  표정·소품만 얹어라 / 몸 길게·꼿꼿·머리 작게 만들지 마라" 가드를 맨 앞 ③비율을 숫자 대신
  그림 묘사("머리가 상반신 절반, 키는 머리 2개, 몸은 작은 덩어리").

> 저장: `assets/biji-master/incoming/chok-{id}.jpg` → `node scripts/process-biji-master.cjs`
> → `public/biji/chok/{id}.png` 자동 배치 → 결과화면 자동 노출(emoji 폴백 대체).
> baseline 첨부: `C:\Users\User\OneDrive\Desktop\비버\baseline front biji.jpg`
> **god 한 장 먼저 검증 → OK면 나머지 4장.**

---

## 🏆 1. god (촉신, 7/7) — 트로피 가슴 앞으로

```
Use the attached image as the EXACT base for the character "Biji". You are redrawing THIS SAME beaver in THE SAME standing pose — only changing the face expression and adding ONE prop. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE ATTACHED REFERENCE:
- The head is HUGE and round, filling the entire upper half of the character. Total height is only about 1.9 head-heights — super-chibi, head-dominant baby proportions. The body is a small round blob beneath the big head, with short stubby arms and tiny feet.
- Do NOT make the body taller, slimmer, or more upright. Do NOT elongate the torso or legs. Do NOT shrink the head or enlarge the body. Keep the exact same stance, short arm length, body silhouette, and uniform thick outline as the reference.
- Keep all 7 locked colors: #B07245 body fur, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (fully visible), two front teeth, nose, cheek blushes, and the diamond-crosshatch paddle tail exactly as reference. Head stays front-facing.

CHANGE ONLY THESE:
- Both short arms reach FORWARD and together in front of the lower chest, holding a small GOLD TROPHY CUP at chest/belly height (NOT raised above the head). Trophy ≈ 30% of head width, two small handles, solid #E0A23A gold with #3A1E0D outline. Keep the arms short and the body unchanged — the arms just come forward, they do NOT stretch upward.
- Proud happy OPEN-MOUTH smile, two front teeth visible.
- 2 small gold sparkle stars (4-pointed, #E0A23A with #3A1E0D outline, ≈ 6% of head width) floating beside the head on the left and right (NOT above).

CANVAS: square 1:1, 2048×2048, pure flat #FFFFFF background, soft oval contact shadow under the feet only (no other shadow, no gradient, no glow). Character + trophy occupy ~60% of canvas height, centered, with at least 12% pure-white margin on all four sides so nothing touches the edges.

LOCK: This is the SAME beaver, SAME body, SAME pose as the attached reference — only the held trophy, smile, and two side stars are added. Gold #E0A23A appears ONLY on the trophy and stars. Do not restyle, do not change proportions, do not make it taller, do not raise arms overhead, do not rotate the head.
```
저장: `chok-god.jpg`

---

## 😏 2. master (촉고수, 6/7) — 손가락총 + 윙크

```
Use the attached image as the EXACT base for the character "Biji". You are redrawing THIS SAME beaver in THE SAME standing pose — only changing the face expression and adding ONE small gesture. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE ATTACHED REFERENCE:
- The head is HUGE and round, filling the upper half of the character. Total height ≈ 1.9 head-heights (super-chibi, head-dominant). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, and thick uniform outline as the reference.
- Keep all 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (visible), two front teeth, nose, cheek blushes, paddle tail with diamond crosshatch. Head front-facing.

CHANGE ONLY THESE:
- The right short arm bends so the right paw is at chest height making a small "FINGER GUN" gesture pointing slightly to the side (one digit forward, thumb up). Keep the arm SHORT — just bend it, do not lengthen it. The left arm stays exactly as the reference.
- Right eye WINKING: the right eye becomes a downward "U" curved closed line in #3A1E0D (same weight as outline). Left eye stays the normal solid #3A1E0D circle with a white highlight dot.
- Cocky closed-mouth smirk: mouth corners upturned to one side, two teeth visible.
- One tiny coral spark at the fingertip: a small 4-pointed sparkle, fill #FE7644 with #3A1E0D outline, ≈ 5% of head width (the only non-palette color, only here).

CANVAS: square 1:1, 2048×2048, pure flat #FFFFFF background, soft oval contact shadow under feet only (no gradient, no glow). Character occupies ~60% of canvas height, centered, at least 12% pure-white margin on all four sides.

LOCK: SAME beaver, SAME body, SAME pose as the attached reference — only the wink, smirk, finger-gun paw, and fingertip spark change. Do not restyle, do not change proportions, do not make it taller, do not rotate the head. Do not add sunglasses, hat, or chain.
```
저장: `chok-master.jpg`

---

## 😎 3. pro (촉상수, 5/7) — 선글라스 + 엄지척

```
Use the attached image as the EXACT base for the character "Biji". You are redrawing THIS SAME beaver in THE SAME standing pose — only changing the face and adding ONE small gesture. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE ATTACHED REFERENCE:
- The head is HUGE and round, filling the upper half. Total height ≈ 1.9 head-heights (super-chibi, head-dominant). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, and thick uniform outline as the reference.
- Keep all 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (visible), two front teeth, nose, cheek blushes (visible below the sunglasses), paddle tail with diamond crosshatch. Head front-facing.

CHANGE ONLY THESE:
- Add simple RECTANGULAR SUNGLASSES over both eyes: solid #3A1E0D fill (no reflection, no gold), width ≈ 52% of head width, covering both eyes naturally — must NOT touch or cover the ears.
- The right short arm bends so the right paw is at chest height giving a clear THUMBS-UP (closed fist, thumb pointing up). Keep the arm SHORT — just bend it. The left arm stays exactly as the reference.
- Relaxed cool closed-mouth smile, corners gently upturned, two teeth visible.

CANVAS: square 1:1, 2048×2048, pure flat #FFFFFF background, soft oval contact shadow under feet only (no gradient, no glow). Character occupies ~60% of canvas height, centered, at least 12% pure-white margin on all four sides.

LOCK: SAME beaver, SAME body, SAME pose as the attached reference — only the sunglasses, thumbs-up paw, and smile change. Sunglasses are plain rectangular solid #3A1E0D (NOT star-shaped, NO gold, NO chain). Do not restyle, do not change proportions, do not make it taller, do not rotate the head.
```
저장: `chok-pro.jpg`

---

## ✌️ 4. mid (촉중수, 4/7) — V사인 + 잔잔한 미소

```
Use the attached image as the EXACT base for the character "Biji". You are redrawing THIS SAME beaver in THE SAME standing pose — only changing the face and adding ONE small gesture. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE ATTACHED REFERENCE:
- The head is HUGE and round, filling the upper half. Total height ≈ 1.9 head-heights (super-chibi, head-dominant). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, and thick uniform outline as the reference.
- Keep all 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (visible), two front teeth, nose, cheek blushes, paddle tail with diamond crosshatch. Head front-facing. Eyes stay normal solid #3A1E0D circles with white highlight.

CHANGE ONLY THESE:
- The right short arm bends so the right paw is up near the cheek making a small "V / PEACE SIGN" (two digits up in a V). Keep the arm SHORT — just bend it. The left arm stays exactly as the reference.
- Gentle CONTENT closed-mouth smile (mild and friendly, corners softly upturned, two teeth slightly visible) — relaxed "not bad" vibe, not super excited.

CANVAS: square 1:1, 2048×2048, pure flat #FFFFFF background, soft oval contact shadow under feet only (no gradient, no glow). Character occupies ~60% of canvas height, centered, at least 12% pure-white margin on all four sides.

LOCK: SAME beaver, SAME body, SAME pose as the attached reference — only the V-sign paw and gentle smile change. No new colors. Do not restyle, do not change proportions, do not make it taller, do not rotate the head. Do not add glasses, hats, or floating items.
```
저장: `chok-mid.jpg`

---

## 🐣 5. rookie (촉린이, 0~3/7) — 머리 긁적 + 물음표

```
Use the attached image as the EXACT base for the character "Biji". You are redrawing THIS SAME beaver in THE SAME standing pose — only changing the face and adding ONE small gesture. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE ATTACHED REFERENCE:
- The head is HUGE and round, filling the upper half. Total height ≈ 1.9 head-heights (super-chibi, head-dominant). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, and thick uniform outline as the reference.
- Keep all 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (visible), two front teeth, nose, cheek blushes, paddle tail with diamond crosshatch. Head stays front-facing — show "puzzled" with the paw and props, NOT by tilting the head.

CHANGE ONLY THESE:
- The right short arm bends UP so the right paw lightly scratches the side of the head next to the right ear (classic "hmm, not sure" head-scratch). Keep the arm SHORT and the paw BESIDE the ear (not covering it). The left arm stays exactly as the reference.
- Sheepish small awkward smile: mouth a small gentle wavy line, one tooth peeking.
- One small SWEAT DROP on the upper-right of the head: teardrop shape, fill #FFFFFF with #3A1E0D outline, ≈ 6% of head width.
- One small QUESTION MARK "?" floating beside the head in the upper area: color #3A1E0D, ≈ 9% of head width, fully inside the canvas with white margin.

CANVAS: square 1:1, 2048×2048, pure flat #FFFFFF background, soft oval contact shadow under feet only (no gradient, no glow). Character occupies ~60% of canvas height, centered, at least 12% pure-white margin on all four sides.

LOCK: SAME beaver, SAME body, SAME pose as the attached reference — only the head-scratch paw, sheepish smile, sweat drop, and "?" change. No new colors (sweat is white+outline, "?" is #3A1E0D). Do not restyle, do not change proportions, do not make it taller, do not rotate the head. Do not add a hat, pacifier, or bonnet.
```
저장: `chok-rookie.jpg`

---

## ✅ 5장 후
```bash
node scripts/process-biji-master.cjs
```
→ `public/biji/chok/{god,master,pro,mid,rookie}.png` 자동 → 결과화면 자동 노출.
