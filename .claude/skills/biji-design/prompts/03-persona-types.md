# 03 — 부동산 성향 유형 비지 4종 (Persona Types)

**용도:** /persona "내 부동산 성향 비지" 결과 카드. 비버(비지) 한 마리에 **소품·표정만** 얹어 유형 표현(다른 동물 X — 브랜드=비버 하나). id = tiger/fox/owl/turtle.

**프로토콜:** biji-style-bible.md §5.5 (v2 필수) 준수 — 포즈 최소·소품 가슴앞·reference 베이스·비율 그림묘사. **god류 검증된 그 구조.**

> 저장: `assets/biji-master/incoming/persona-{id}.jpg` → `node scripts/process-biji-master.cjs` → `public/biji/persona/{id}.png` → 결과화면 자동 노출(emoji 폴백 🐯🦊🦉🐢 대체).
> baseline 첨부: `C:\Users\User\OneDrive\Desktop\비버\baseline front biji.jpg` · **tiger 1장 먼저 검증 → OK면 나머지.**

공통 가드(모든 프롬프트 안에 포함됨): *Use the attached image as the EXACT base. Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do NOT make the body taller/slimmer/upright, do NOT elongate torso/legs, do NOT shrink the head. Head HUGE = upper half, total ≈1.9 head-heights, small round blob body, short stubby arms. Keep ears at 11 & 1 o'clock (visible), two front teeth, nose, cheek blushes, paddle tail w/ diamond crosshatch, uniform 2.5% #3A1E0D outline. 7 colors locked: #B07245 #F0D0A0 #3A1E0D #F4B5A8 #8E5A32 #FFFDF5 #FFFFFF. Square 1:1 2048², pure flat #FFFFFF bg, soft oval contact shadow under feet only (no gradient/glow), character ~60% height, centered, 12% white margin all sides.*

---

## 🐯 tiger — 한방 호랑이 (공격×입지)

```
Use the attached image as the EXACT base for the character "Biji". Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE REFERENCE:
- Head HUGE and round, filling the upper half. Total ≈1.9 head-heights (super-chibi, head-dominant). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, thick uniform outline.
- Keep 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (fully visible), two front teeth, nose, cheek blushes, diamond-crosshatch paddle tail. Head front-facing.

CHANGE ONLY THESE (fierce TIGER fighter look — make it clearly read as a tiger):
- TIGER STRIPES on the face: 2-3 short dark stripe marks on each cheek (angled outward), plus 2-3 short vertical stripe marks across the forehead/top of the head, color #3A1E0D (thinner than the main outline). The clear "this is a tiger" cue. Do not cover the eyes.
- The right short arm bends so the right paw is a small clenched FIST at chest height, pumped in a "let's go!" gesture. Keep the arm short. Left arm stays as reference.
- Bold confident OPEN-MOUTH grin, two front teeth visible, determined energetic eyes (eyes stay solid #3A1E0D circles with white highlight, just add a confident energy).

CANVAS & LOCK: square 1:1 2048², pure flat #FFFFFF background, soft oval contact shadow under feet only, ~60% height, centered, 12% white margin all sides. SAME beaver, SAME body, SAME pose — only headband, fist, grin change. Do not restyle, do not change proportions, do not raise arms overhead, do not rotate the head, do not cover the ears.
```
저장: `persona-tiger.jpg`

---

## 🦊 fox — 가성비 여우 (공격×실속)

```
Use the attached image as the EXACT base for the character "Biji". Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE REFERENCE:
- Head HUGE and round, upper half. Total ≈1.9 head-heights (super-chibi). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, thick uniform outline.
- Keep 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (visible), two front teeth, nose, cheek blushes, diamond-crosshatch paddle tail. Head front-facing.

CHANGE ONLY THESE (sly bargain-hunter FOX look — make it clearly read as a fox):
- FOX WHISKERS: on each cheek, 2-3 thin short whisker lines in #3A1E0D (thinner than the main outline), angled gently outward from beside the nose — the clearest "this is a fox" cue.
- FOX-POINTED EARS: keep BOTH ears at the same 11 and 1 o'clock positions, same size, with the same coral-pink inner fill — but draw the ear TIPS slightly more pointed/triangular (fox-like) instead of fully round. Ears stay fully visible, not covered.
- The right short arm bends so the right paw holds a small GOLD PRICE TAG (꼬리표) at chest height: a classic tag shape (rectangle with one angled corner and a small hole/string), color solid #E0A23A gold with #3A1E0D outline, ≈ 22% of head width. (only non-palette color, only on the tag). Left arm stays as reference.
- Right eye WINKING: right eye becomes a downward "U" curved closed line (#3A1E0D). Left eye stays a normal solid #3A1E0D circle with white highlight. Sly clever smirk: mouth corners upturned to one side, two teeth visible.

CANVAS & LOCK: square 1:1 2048², pure flat #FFFFFF background, soft oval contact shadow under feet only, ~60% height, centered, 12% white margin all sides. SAME beaver, SAME body, SAME pose — only the price tag, wink, smirk change. Do not restyle, do not change proportions, do not make it taller, do not rotate the head.
```
저장: `persona-fox.jpg`

---

## 🦉 owl — 똘똘한 부엉이 (안정×입지)

```
Use the attached image as the EXACT base for the character "Biji". Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE REFERENCE:
- Head HUGE and round, upper half. Total ≈1.9 head-heights (super-chibi). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, thick uniform outline.
- Keep 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (visible), two front teeth, nose, cheek blushes, diamond-crosshatch paddle tail. Head front-facing.

CHANGE ONLY THESE (smart, studious look):
- Add round THIN-FRAME GLASSES over both eyes: thin circular frames, color #3A1E0D (same as outline), each lens ≈ 20% of head width, a small bridge between them — frames sit on the face and must NOT cover or touch the ears. The eyes stay visible behind the clear lenses (solid #3A1E0D circles with white highlight).
- Both short arms come forward together holding a small HOUSE icon at chest height (NOT raised): simple chibi house, #F0D0A0 walls with a #8E5A32 triangular roof, #3A1E0D outline, ≈ 26% of head width. Keep arms short, body unchanged.
- Gentle confident closed-mouth smile, two teeth visible.

CANVAS & LOCK: square 1:1 2048², pure flat #FFFFFF background, soft oval contact shadow under feet only, ~60% height, centered, 12% white margin all sides. SAME beaver, SAME body, SAME pose — only glasses, held house, smile change. Do not restyle, do not change proportions, do not make it taller, do not raise arms overhead, do not rotate the head, do not cover the ears.
```
저장: `persona-owl.jpg`

---

## 🐢 turtle — 실속 거북이 (안정×실속)

```
Use the attached image as the EXACT base for the character "Biji". Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE REFERENCE:
- Head HUGE and round, upper half. Total ≈1.9 head-heights (super-chibi). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, thick uniform outline.
- Keep 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (visible), two front teeth, nose, cheek blushes, diamond-crosshatch paddle tail. Head front-facing.

CHANGE ONLY THESE (calm, thrifty saver look):
- Both short arms come forward together hugging a small PINK PIGGY BANK at chest/belly height (NOT raised): a classic piggy bank with a tiny snout, small ears, a coin slot on top, color #F4B5A8 (coral pink, from palette) with #3A1E0D outline, ≈ 30% of head width. Keep arms short, body unchanged.
- Calm content relaxed expression: eyes slightly narrowed into gentle relaxed curves OR normal but soft, a small peaceful closed-mouth smile, two teeth slightly visible.

CANVAS & LOCK: square 1:1 2048², pure flat #FFFFFF background, soft oval contact shadow under feet only, ~60% height, centered, 12% white margin all sides. SAME beaver, SAME body, SAME pose — only the held piggy bank and calm smile change. No new colors (piggy bank is #F4B5A8). Do not restyle, do not change proportions, do not make it taller, do not raise arms overhead, do not rotate the head.
```
저장: `persona-turtle.jpg`

---

## ✅ 4장 후
```bash
node scripts/process-biji-master.cjs
```
→ `public/biji/persona/{tiger,fox,owl,turtle}.png` 자동 → /persona 결과화면 자동 노출(emoji 폴백 대체).
