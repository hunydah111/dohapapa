# 00 — Geometry Baseline 프롬프트

**용도:** 비집고 마스코트 '비지(Biji)'의 **Geometry Master** 1장 생성. 갸웃 비지(Style Master)를 reference로 anchor해서 **정확히 정면, A-pose, 양손 자유, 표정 중립**의 baseline 비지를 만든다. 이 baseline jpg가 다음 단계의 모든 비율 측정 기준이 된다.

**핵심 원칙 (리서치 기반):**
- Nano Banana는 seed 미지원 → reference image anchoring + 정량 spec으로 일관성 잡음
- 한 턴에 한 변경만 (= 갸웃→정면 + A-pose + 표정 중립이 한 묶음)
- 부정형 금지 (✅ "pure white #FFFFFF background", ❌ "no shadow")
- 매 프롬프트 끝에 lock 반복

---

## 📋 사용법 (1회만)

1. **Gemini 웹** 열기 (gemini.google.com, Gemini Advanced 결제 계정)
2. **Nano Banana 모드 확인** — 모델 선택 "Gemini 2.5 Flash Image" 또는 "Image generation" (인터페이스 변경 가능, 이미지 생성 기능 켜기)
3. **이미지 첨부**: `C:\Users\User\OneDrive\Desktop\비버\갸웃하며 고민하는 비버.jpg` 첨부
4. **아래 ENGLISH PROMPT 전체 복사 → 채팅창에 붙여넣기 → 전송**
5. 받은 이미지가 마음에 들면 **`C:\Users\User\OneDrive\Desktop\비버\baseline-front-biji.png`** 로 저장 (PNG 권장, jpg면 jpg)
   - 마음에 안 들면 같은 프롬프트로 재생성 (제미나이 우측 "Regenerate" 또는 새 채팅에서 재시도)
6. 저장하면 나에게 알려줘. 그 다음 자동 측정 스크립트 돌리고 Spec YAML 자동 작성.

**좋은 baseline의 조건 (재생성 판단 기준):**
- ✅ 정확히 정면 (머리 안 돌아감, 안 기울어짐)
- ✅ 양손이 몸 옆에 자연스럽게 — 양 손바닥 다 보이고, 아무것도 안 들고 있음
- ✅ 양 눈 다 보이고 크기·위치 좌우대칭
- ✅ 꼬리가 옆으로 평평하게 보임 (안 가려짐)
- ✅ 갸웃 비지의 색·라인·이빨·꼬리 무늬 그대로 유지됨
- ❌ 한 손이 가려지거나, 물건 들고 있거나, 머리 기울거나, 배경 있으면 → 재생성

---

## 🤖 ENGLISH PROMPT (복사용 — 영어가 Nano Banana 베스트)

```
Using the attached image as the EXACT identity reference for a character named "Biji" (비지). Preserve face geometry, color palette, outline style, ear shape, eye style, two front teeth, tail pattern, blush placement, and overall kawaii chibi proportions IDENTICALLY. This is the GEOMETRY BASELINE generation — it will be measured pixel-by-pixel to derive proportion specs for all future generations of this character.

[SUBJECT] Biji, the kawaii chibi beaver mascot, visually IDENTICAL to the reference image in every artistic aspect — same eye style, same nose shape, same two front teeth, same ear shape, same blush color and placement, same fur color, same belly patch, same flat paddle tail with crosshatch diamond grid pattern.

[ACTION] Standing in a balanced symmetric A-pose. Facing the camera DIRECTLY: head tilt = 0 degrees, head rotation = 0 degrees, body rotation = 0 degrees. Looking forward with both eyes fully visible and perfectly symmetric. Both arms relaxed and slightly spread outward at approximately 30 degrees from the body, palms visible, palms COMPLETELY EMPTY (no objects, no gestures, no pointing, no waving). Closed-mouth neutral smile with two front teeth slightly visible. Tail extending horizontally to one side behind the body, fully visible silhouette with the diamond grid pattern clearly drawn.

[LOCATION] Pure white background, color #FFFFFF, completely flat with no gradient and no scenery. The only shadow allowed is a soft oval contact shadow directly under both feet, opacity 8%, color #000000, blur radius equal to 6% of character height.

[COMPOSITION] Square 1:1 aspect ratio at 2K resolution (2048x2048 pixels). The character occupies 65% of canvas height, perfectly centered on both horizontal and vertical axes within 1% tolerance. Camera angle is eye-level with zero perspective distortion. Full body visible from the top of the ears to the bottom of the feet, with approximately 17% empty white space above the ears and 18% below the feet.

[STYLE] Flat 2D vector illustration style IDENTICAL to the reference image. Rendering style restricted to: flat colors only, uniform outline weight on all silhouette and feature edges, single flat shadow tone only where the reference image shows shadow, no gradients, no textures, no rim lighting, no 3D shading, no cel-shading highlights beyond what exists in reference. Color palette RESTRICTED to these hex values only: #B07A4F (body fur), #E8C9A0 (belly patch), #5A3520 (outline), #FF8C7A (cheek blush), #2D1810 (eyes), #FFFDF5 (front teeth), #FFFFFF (background). Use ONLY these 7 colors.

[PROPORTION GUIDANCE] Use the reference image proportions as the primary truth. As initial guidance: total character height ≈ 2.4 head-heights, head shape is a circle where head_width = head_height, head-to-body height ratio ≈ 1:1.4 (super-chibi), ears are small and round positioned at the top of the head approximately at the 11 and 1 o'clock positions, eyes are large round black circles with diameter approximately 28% of head width spaced approximately 1.0 eye-diameter apart, cheek blushes are oval shapes centered horizontally below each eye, two front teeth are small white rectangles below the nose with rounded bottom corners, tail is a horizontal flat paddle shape extending sideways behind the body with length approximately 80% of head width and a clearly drawn diamond grid pattern. If the reference image conflicts with these numbers, ALWAYS prefer the reference image.

[LOCK — DO NOT VIOLATE]
- Character proportions, palette, outline weight, and all visual identity features MUST match the reference image EXACTLY.
- Pose MUST be perfectly frontal A-pose with both arms free at sides and palms empty.
- Background MUST be pure white #FFFFFF with only the contact shadow under feet.
- Do not add accessories. Do not add props. Do not add background elements. Do not add text. Do not add signature.
- Do not restyle. Do not modernize. Do not switch art style. Do not 3D-ify.
- This is the GEOMETRY BASELINE — the canonical front-facing reference for all future generations of Biji.
```

---

## 🇰🇷 한국어 요약 (참고용 — 모델에 던지지 마)

위 영어 프롬프트가 시키는 것:
- 첨부한 갸웃 비지를 **정체성 reference**로 anchor (눈·코·이빨·꼬리·색·라인 그대로)
- **정확히 정면 A-pose**로 새로 그려달라 (머리 0도, 몸 0도, 양손 자유, 양손 비어있음, 표정 중립 미소)
- **2048×2048 정사각**, 캐릭터가 화면 65% 차지, 완벽 중앙
- **7색 팔레트만** 사용 (#B07A4F body / #E8C9A0 belly / #5A3520 outline / #FF8C7A blush / #2D1810 eye / #FFFDF5 teeth / #FFFFFF background)
- 액세서리·배경·텍스트 일체 추가 금지 — **순수 baseline**

---

## ⚠️ 알려진 한계 (재생성 자주 필요할 수 있음)

- Nano Banana도 첫 시도에서 머리 약간 돌아갈 수 있음 → 재생성 1~3번 시도
- "양손 비어있음"을 지켰는데 한 손이 살짝 가슴 앞에 있는 경우 → 사용 가능. 양손이 다 옆에 떨어져 있는 게 베스트.
- 색 hex가 살짝 다를 수 있음 → 측정 스크립트가 실제 픽셀로 정정함, 걱정 X
- 갸웃 비지의 그림자가 약간 다를 수 있음 → contact shadow는 후처리 가능

**3번 시도해도 좋은 baseline 안 나오면 알려줘** — 프롬프트를 조정하거나 reference image 어노테이션 추가 같은 다른 기법으로 갈게.

---

## 📦 다음 단계 (사용자가 baseline 저장 후)

내가 자동 실행:
1. **`scripts/measure-biji-master.cjs`** — baseline png 픽셀 측정 (sharp + canvas)
2. **`.claude/skills/biji-design/biji-style-bible.md`** — 측정값으로 정량 YAML spec 자동 작성
3. **`prompts/01~16-*.md`** — 등급 8종 + 액세서리 8종 프롬프트 자동 생성 (각각 측정된 spec lock + 5블록 공식)
4. **`scripts/process-biji-master.cjs`** — 받은 jpg 자동 투명 PNG + 사이즈 통일

→ 그 다음 사용자 작업 = 제미나이에 프롬프트 16번 복붙 (1~2시간), 받은 파일을 `incoming/` 폴더에 떨굼. 끝.
