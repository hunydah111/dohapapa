# 04 — 동네 자랑 리그 비지 2종 (League)

**용도:** /league "동네 자랑 리그" 화면. ① **flag** = 헤더 히어로(깃발 든 비지, 응원·자랑 톤) ② **champ** = 1위 동네에 뜨는 왕관 챔피언 비지(보드 1위 행 + 내 동네가 1위일 때 자랑 카드 상단). 둘 다 비버(비지) 하나에 **소품·표정만** 얹음(다른 캐릭터 X).

**프로토콜:** biji-style-bible.md §5.5 (v2 필수) — 포즈 최소·소품 가슴앞/머리 위·reference 베이스·비율 그림묘사. **god/tiger류 검증된 그 구조.**

> 저장: `assets/biji-master/incoming/league-{id}.jpg` → `node scripts/process-biji-master.cjs` → `public/biji/league/{id}.png` → 화면 자동 노출(emoji 폴백 🚩/👑 대체).
> baseline 첨부: `C:\Users\User\OneDrive\Desktop\비버\baseline front biji.jpg` · **flag 1장 먼저 검증 → OK면 champ.**

공통 가드(아래 각 프롬프트에 이미 포함): *Use the attached image as the EXACT base. Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do NOT make the body taller/slimmer/upright, do NOT elongate torso/legs, do NOT shrink the head. Head HUGE = upper half, total ≈1.9 head-heights, small round blob body, short stubby arms. Keep ears at 11 & 1 o'clock (visible), two front teeth, nose, cheek blushes, paddle tail w/ diamond crosshatch, uniform 2.5% #3A1E0D outline. 7 colors locked: #B07245 #F0D0A0 #3A1E0D #F4B5A8 #8E5A32 #FFFDF5 #FFFFFF. Square 1:1 2048², pure flat #FFFFFF bg, soft oval contact shadow under feet only (no gradient/glow), character ~60% height, centered, 12% white margin all sides.*

---

## 🚩 flag — 깃발 든 비지 (리그 헤더, 우리 동네 응원)

```
Use the attached image as the EXACT base for the character "Biji". Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE REFERENCE:
- Head HUGE and round, filling the upper half. Total ≈1.9 head-heights (super-chibi, head-dominant). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, thick uniform outline.
- Keep 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (fully visible), two front teeth, nose, cheek blushes, diamond-crosshatch paddle tail. Head front-facing.

CHANGE ONLY THESE (proud neighborhood-pride cheerleader look):
- The right short arm bends so the right paw holds a small TRIANGULAR PENNANT FLAG on a short thin pole at chest height, raised just a little (NOT overhead): the pennant is a right triangle waving to the side, solid coral #FE7644 fill with #3A1E0D outline, the pole is a short #8E5A32 stick, whole flag ≈ 35% of head width. (coral is the only non-palette accent, only on the pennant.) Keep the arm short. Left arm stays as reference.
- Proud confident OPEN-MOUTH cheering grin, two front teeth visible, bright eager eyes (eyes stay solid #3A1E0D circles with white highlight, add a sparkle of pride).

CANVAS & LOCK: square 1:1 2048², pure flat #FFFFFF background, soft oval contact shadow under feet only, ~60% height, centered, 12% white margin all sides. SAME beaver, SAME body, SAME pose — only the held pennant flag and proud grin change. Do not restyle, do not change proportions, do not make it taller, do not raise the arm overhead, do not rotate the head, do not cover the ears.
```
저장: `league-flag.jpg`

---

## 👑 champ — 왕관 챔피언 비지 (1위 동네)

```
Use the attached image as the EXACT base for the character "Biji". Redraw THIS SAME beaver in THE SAME standing pose — only change the face and add ONE prop. Do not invent a new body.

CRITICAL — KEEP THE BODY 100% IDENTICAL TO THE REFERENCE:
- Head HUGE and round, filling the upper half. Total ≈1.9 head-heights (super-chibi, head-dominant). Small round blob body, short stubby arms, tiny feet.
- Do NOT make the body taller, slimmer, or upright. Do NOT elongate torso/legs. Do NOT shrink the head. Keep the exact same stance, arm length, silhouette, thick uniform outline.
- Keep 7 locked colors: #B07245 body, #F0D0A0 belly, #3A1E0D outline/eyes/nose, #F4B5A8 cheeks/inner ear, #8E5A32 tail, #FFFDF5 teeth, #FFFFFF background.
- Keep ears at 11 and 1 o'clock (fully visible), two front teeth, nose, cheek blushes, diamond-crosshatch paddle tail. Head front-facing.

CHANGE ONLY THESE (triumphant #1 champion look):
- A small GOLD CROWN rests on TOP of the head, sitting low on the forehead BETWEEN the two ears — it must NOT cover, touch, or hide the ears (ears stay fully visible at 11 and 1 o'clock). Simple 3-point chibi crown, solid gold #E0A23A fill with #3A1E0D outline, ≈ 40% of head width, with one tiny #F4B5A8 round jewel in the center. (gold is the only non-palette accent, only on the crown.)
- The right short arm bends so the right paw is a small clenched FIST pumped at chest height in a victorious "we're #1!" gesture. Keep the arm short. Left arm stays as reference.
- Big triumphant OPEN-MOUTH winning grin, two front teeth visible, confident proud eyes (solid #3A1E0D circles with white highlight, add a bright sparkle).

CANVAS & LOCK: square 1:1 2048², pure flat #FFFFFF background, soft oval contact shadow under feet only, ~60% height, centered, 12% white margin all sides. SAME beaver, SAME body, SAME pose — only the crown, fist, and triumphant grin change. Do not restyle, do not change proportions, do not make it taller, do not raise the arm overhead, do not rotate the head, do not cover the ears.
```
저장: `league-champ.jpg`

---

## ✅ 2장 후
```bash
node scripts/process-biji-master.cjs
```
→ `public/biji/league/{flag,champ}.png` 자동 → /league 헤더·1위 행 자동 노출(emoji 폴백 🚩/👑 대체).
