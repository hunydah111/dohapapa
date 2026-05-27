---
name: biji-design
description: 비집고(bijigo) UI·랜딩·컴포넌트 디자인 작업의 단일 진실. UI 변경·새 페이지·스타일/모션/카피 톤·비지 마스코트 사용·랜딩 리뉴얼·F-라운드(F7+) 디자인 라운드 시 발동. 토큰 출처(globals.css)·핵심 컴포넌트 패턴·supanova 흡수 룰 3종과 금지 4종을 담는다. "디자인", "리뉴얼", "톤", "색", "히어로", "비지", "코랄", "Jua", "card", "hero", "CTA" 키워드에 반응.
---

# 비집고 디자인 시스템 (SKILL.md)

이 파일은 비집고(`C:\Users\User\실습`, package `dohapapa`) UI 작업의 단일 진실이다. 토큰의 **원본은 `src/app/globals.css`** — 충돌 시 globals.css가 이긴다. 이 문서는 "원칙·관습·금지" 레이어.

---

## 1. 브랜드 정체성 한 줄

**"따뜻하고 신뢰할 수 있는 부동산 정보 도구"** — 우디 팔레트(오트밀+코랄) · 둥근 한글 폰트(Jua+Gowun Dodum) · 비지(비버) 마스코트 표정 12종 · 데이터-드리븐 = 1회성 와우 < 매주 와도 깨끗.

차별화 = "비집고 시그니처" — 핵심 수치는 **Jua + 페일 골드**, 답은 코랄 히어로로 **먼저** 보여줌.

---

## 2. 토큰 (Tailwind v4 CSS-first, `globals.css:1-74`)

### 색
| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-accent` | `#fe7644` | **주 브랜드·CTA·로고 비버** |
| `--color-accent-hover` | `#e8662f` | CTA hover |
| `--color-coral-*` | 50~800 스케일 | 코랄 톤 단계 |
| `--color-warm` | `#e0a23a` | **허니 앰버 — 핵심 수치 강조 (Jua + 이 색 = 시그니처)** |
| `--color-warm-soft` | `#f7ead0` | 배지·하이라이트 배경 |
| `--color-warm-text` | `#9a5a1e` | 따뜻한 강조 텍스트 |
| `--color-success` | `#4f9d54` | **의미색만** — 통과/적격. 브랜드색 아님 |
| `--color-page-bg` | `#f5ecd9` | 오트밀 배경 |
| `--color-surface` | `#fffdf8` | 카드 배경 (따뜻한 화이트) |
| `--color-text-primary` | `#3a2c1d` | 진한 우드 브라운 |
| `--color-text-secondary` | `#6e5b46` | 보조 |
| `--color-text-muted` | `#9c8a72` | 메타·caption |
| `--color-border` | `rgba(70,48,24,0.12)` | 미묘한 우드 보더 |
| `--accent-home/result/plan` | `#fff4ef / #f7ead0 / #f5ecd9` | **페이지별 페일 액센트 (Mercury 패턴 — 페이지가 작품처럼 분위기 가짐)** |

### 라운드·그림자·여백
| 토큰 | 값 | 의미 |
|---|---|---|
| `--radius-card` | `1.5rem` | rounded-3xl (메인 카드) |
| `--radius-block` | `1rem` | rounded-2xl (내부 블록) |
| `--radius-chip` | `9999px` | rounded-full (배지·칩) |
| `--shadow-card` | 0/12/32px -12px 0.12α | 카드 깊이 표준 |
| `--space-section` | `4rem` | 섹션 간 큰 호흡 |
| `--space-block` | `1.5rem` | 블록 내부 표준 |

### 타입 스케일 (sober-warm: 토스 숫자 영웅화 + 당근 절제)
| 토큰 | 값 | 사용 규칙 |
|---|---|---|
| `--text-display` | `3.5rem` (56px) | **D-day·핵심 가격·금액 — 페이지당 1~2회만** (영웅화) |
| `--text-hero` | `2rem` (32px) | h1, 한 줄 20자 이내 |
| `--text-h2` | `1.375rem` (22px) | 섹션 타이틀 |
| `--text-body` | `0.9375rem` (15px) | 본문 기본 |
| `--text-caption` | `0.75rem` (12px) | 메타·디스클레임 |

---

## 3. 폰트

```
본문 = Gowun Dodum  (고운돋움, SIL OFL 무료, 한글 가독)
브랜드/제목 = Jua   (주아체, .font-jua 클래스, letter-spacing -0.01em)
```

**Jua 사용처(엄선):** 페이지 h1·D-day·핵심 가격·"비집고" 브랜드명. **본문엔 절대 쓰지 않음** (가독 떨어짐).

---

## 4. 컴포넌트 관습

### 카드
```tsx
<div className="bg-white rounded-3xl p-6 card-elevate">
```
- `card-elevate` (globals.css:176-186) = shadow + hover lift + 0.2s ease + reduced-motion 가드.
- 보더는 **그리지 않는다**. 깊이는 shadow + spacing으로 (Mercury "hard border 0").
- 내부 블록은 `rounded-2xl`.

### CTA 버튼
- 1차 = `bg-coral-600 text-white rounded-full h-12 w-full` (**풀폭**, hover `bg-coral-700`).
- 2차 = `border border-coral-200 text-coral-700 bg-white`.
- 폼 안에서도 풀폭 — 사용자 선호 확정 (한정 너비 X).

### 히어로 텍스트 위계
1. 답·결과 = 코랄 히어로 카드로 **먼저** 보여줌 (답-먼저 원칙, /plan R1).
2. 핵심 숫자 = `font-jua text-[3.5rem]` + 색은 `text-coral-600` 또는 `text-[#9a5a1e]` (페일 골드).
3. caption은 `text-text-muted text-xs`.
4. 줄바꿈 깨질 만한 카피는 `<br/>` 명시 + `text-balance` 동반.

### 색 채도 룰
- **한 화면에 코랄은 1~2 영역만** (CTA + 핵심 수치). 그 이상은 시각 피로.
- 장식적 색 박스는 `--color-warm-soft`(연한 오트밀) 우선. 코랄 박스 남발 = F6에서 18개 → 탄 톤으로 다 뺀 이력 있음.
- 보조 액션·텍스트 링크는 풀폭 세컨더리 버튼이 더 강함 (F2 revisit 결론).

---

## 5. 비지(비버) 마스코트 시스템

### 12종 mood (현재 wiring 완료)
| 파일 | mood | 상황 |
|---|---|---|
| `biji-hangang` | (직접 img) | 랜딩 메인 히어로 (한강에서 서울 야경) |
| `biji-cheer` | cheer | 결과 좋음·달성 |
| `biji-running` | running | 분석/계산 중 |
| `biji-calc` | calc | 예산 계산 화면 |
| `biji-wallet-empty` | walletEmpty | 예산 빠듯·부족액 |
| `biji-map` | map | 안전망·가장 가까운 후보 |
| `biji-search` | search | 검토·탐색 |
| `biji-face` | (직접 img) | 로고 (헤더 28px) |
| `biji-car / biji-transit` | car/transit | 통근 수단 |
| `biji-smile` | smile (기본) | 인사·입력 |
| `biji-crying` | crying | 0건 결과 |
| `biji-flustered` | flustered | 경계/에러 |
| `biji-talk` | talk | 시나리오 안내 |
| `biji-point-up` | pointUp | 다크 그래프 헤더 |
| `biji-newhome` | newhome | "이 집에서 살 날…" 축하 배너 |
| `biji-calendar / biji-compare` | — | 재방문(R3) — 한달 뒤 다시 보기·과거 플랜 비교 |
| `biji-key / biji-money / biji-thumbsup ...` | 기타 | 보조 |

### 미wiring 자산 (지금 public/biji 에는 있음)
- `biji-map` (지도 비지) — HomeExperience 결과 hero 후보
- `biji-blueprint` (도면 비지) — `/plan` hero 후보
- `biji-binoculars` (쌍안경 비지) — 더보기 섹션 후보

### 모션 (globals.css:101-146)
| 클래스 | 의미 |
|---|---|
| `.biji-breathe` | 3s 숨쉬기 (기본 idle) |
| `.biji-blink` | 4.5s 깜빡 |
| `.biji-compass` | 2.6s 나침반 흔들 |
| `.biji-tail` | 2.8s 꼬리 |
| `.biji-hop` | 1.05s 통통 (running/cheer 영웅) |
| `.biji-pop-in` | 0.55s cubic-bezier(0.34,1.56,0.64,1) 첫 등장 |
| `.fade-in-up` | 0.4s 비동기 콘텐츠 등장 |
| `.plan-delta` | 1.5s "−N개월 당겨졌어요" 플로팅 |

**`@media (prefers-reduced-motion: reduce)` 가드 필수** — 모든 비지 모션 토큰이 이미 가드됨. 새 모션 추가 시 동일 가드 추가.

### 사용 규칙
- alt 텍스트 = "비지 마스코트" 통일.
- 첫 등장은 `biji-pop-in` 1회 → 이후 idle은 `biji-breathe`.
- 결과/플랜 단계마다 mood가 **데이터에 반응**해야 함 (cheer / running / shrug / crying). 무조건 smile = 게으름.
- **비지 가공법(중요):** 사용자가 흰 배경 jpg로 주면 → `sharp` 코너 flood-fill(HARD 246) + 가장자리 알파 페더링(SOFT 210)으로 헤일로 없는 투명 PNG (512²). 우하단 워터마크는 인접 패치로 cover. 가능하면 사용자가 **투명 PNG로 직접** 주는 게 최선.

---

## 6. 카피·컴플라이언스 톤

**규칙은 컴플라이언스 메모(CLAUDE.md)가 진실, 여긴 톤만.**

- ❌ "추천" → ✅ "조건에 맞는 단지" / "OO님께 어울리는". 발견의 의외성을 강조.
- 모든 가격·세제·대출 숫자에 "**추정**" 동행 (`isEstimate: true` 타입으로 강제).
- 정책·세제·실거래는 **언제까지 반영했는지** 기준일·확인일을 사용자가 한 눈에 보이게 표시 (`POLICY_META` + 첫화면 dataMeta 챕 패턴).
- "은행 최대 vs 안전선" 토글처럼 — 사용자에게 **고를 권한**을 주는 카피.
- D-day는 "범위" (하락/보합/상승), 단일값 금지. 끝은 항상 **희망**.
- "지금 페이스로는 시간이 걸려요—그래도 길은 있어요" 톤. 절대 "불가능"·"포기" 금지.
- 부정 → 긍정 재프레이밍: "−3.8억" → "3.8억 부족".

---

## 7. supanova-design-skill 흡수 룰 (선택적 — 라운드별로 1개씩)

> 출처 = `https://github.com/uxjoseph/supanova-design-skill` (2026-05-26 영상으로 검토). 통째 흡수 금지, 부위별 흡수.

### ✅ 흡수 OK (다음 F-라운드 후보 3개)

1. **soft-skill 스프링 모션 (MOTION_INTENSITY 7-8 격상)**
   - 적용처: PlanRaceChart D-day 글라이드·결과 카드 등장·레버 조작 시 숫자 카운트업.
   - 기반: 이미 `plan-delta`·`biji-pop-in` 있음 → 한 단계만 더.
   - 가드: `prefers-reduced-motion` 필수, 스프링은 cubic-bezier(0.34,1.56,0.64,1) 정도까지.

2. **히어로 영상화 (영상1 기법)**
   - 적용처: `biji-hangang.png` → 한강에서 서울 야경 panning **5~8s WebP 루프**.
   - 생성: 제미나이 Pro (Veo) — Pinterest 레퍼런스 → 이미지 → "16:9 천천히 화면 돌아가는 영상".
   - 가드: 모바일 데이터 비용 → 1회 fade-in 후 정지(자동재생 무한 루프 금지) · `prefers-reduced-motion` 시 정적 PNG 폴백.

3. **soft-skill Double-Bezel 카드**
   - 적용처: HeroResultCard·CandidateCard.
   - 방법: 단일 shadow → 안쪽 `ring-1 ring-coral-100/40` + 바깥 `shadow-card`로 2층 깊이.
   - 토큰 한 줄 추가로 끝, 비용 낮음.

### ❌ 흡수 금지 (이유 명시)

1. **글래스/블러 네비게이션** — 부동산은 신뢰감 > 가벼움. 우디톤과 충돌.
2. **Iconify Solar 아이콘 시스템** — 비지 마스코트가 우리 시그니처. 아이콘으로 분산되면 비지 약화.
3. **DESIGN_VARIANCE 8-10 (비대칭 극단)** — 추천/플랜은 정보 밀도 높아 안 맞음. 랜딩 히어로 1곳만 6-7 시도 OK.
4. **보라/네온 그라데이션** — 영상1에서 말한 AI 슬롭 그 자체. 즉시 거부.

---

## 8. 작업 워크플로 (디자인 라운드)

1. **목표 설정**: 어느 화면·어떤 사용자 모먼트를 개선? (완성도 10/10·임팩트 ≥7/10 목표)
2. **변경 전 스크린샷**: `node scripts/shot.cjs <url> <out> <w> <h>` — 모바일 390×844 + 데스크탑 1280 **양쪽** 필수.
3. **편집** — globals.css 토큰 우선 변경 (개별 컴포넌트에서 색 하드코딩 금지).
4. **변경 후 스크린샷** — 양뷰 다시.
5. **검증**: `node scripts/preship.cjs` (lint·typecheck·test·smoke).
6. **commit**: `design(F<n>): <한 줄 설명>` 메시지 패턴 (F1~F6 이력 따름).

**중요**: 사용자는 폰 폭 렌더링을 직접 못 볼 수 있음 → **내가 그의 눈**. 모바일 검증 빼먹지 말 것.

---

## 9. 글로벌 컴포넌트 위치 빠른 색인

```
src/app/globals.css                 — 토큰 진실 원본
src/app/layout.tsx                  — 폰트 로드 (Gowun Dodum + Jua)
src/components/
  LandingHero.tsx                   — 메인 히어로 (한강 비지)
  HomeExperience.tsx                — 검색→결과 클라 진입
  HeroResultCard.tsx                — 결과 영웅 카드 (비버 등급 + 워터마크)
  CandidateCard.tsx                 — 단지 카드 (배지·매물보기·이집플랜 링크)
  BudgetSummary.tsx                 — 예산 카드 (신호등·스트레스·정책)
  PlanExperience.tsx                — /plan 코어 (D-day + 레버 + 차트)
  PlanRaceChart.tsx                 — 따뜻한 다크 차트
  Card.tsx / Button.tsx             — 기본 프리미티브
public/biji/*.png                   — 비지 마스코트 자산
scripts/shot.cjs                    — Playwright 스크린샷 도구
scripts/preship.cjs                 — push 전 검증 묶음
```

---

## 10. Tone Shift v1.1 (2026-05-27 진행 중) — 야옹이 스티커톤으로 전환

> **방향**: "따뜻한 우디·코랄·Jua·둥근 cute" → "모던 빈티지 스티커톤·잉크 네이비·산세리프·사이드뷰 액션".
> **컨셉**: "열심히 공부는 하되 현실은 차갑게 바라보자". *MZ 타겟·위트 섞인 선배 모먼트·다그치되 잘할 수 있어 격려*.
> **상태**: 가이드(이 섹션) + globals.css 신 토큰 주석 추가 완료. 비지 캐릭터 시안·시각 적용은 사용자 캐릭터 재그림 후.
> **백업**: tag `pre-tone-shift` + branch `backup/before-tone-shift` (커밋 `8adaf04`). 롤백 = Vercel 이전 배포 promote(가장 안전) / `git revert` / `git reset --hard pre-tone-shift`.

### 10.1 야옹이 디자인 언어 7개 룰 (참고: `OneDrive\Desktop\야옹이.jpg`)
1. **2색 디자인** — 잉크 네이비 + 아이보리. 액센트 0(코랄·골드·그라데이션 제거).
2. **단일 산세리프 패밀리** — weight·크기로 위계, 폰트 가족 1개.
3. **굵기 일정한 outline 일러스트** — 평면 fill, 음영 0, 둥근 모서리.
4. **사이드뷰 액션 캐릭터** — 정면 정지 X, *움직이는 중*.
5. **메가 헤딩 + 작은 캡스 코드** — 56pt와 10pt의 *극단 대비*.
6. **빈티지 멤버십 코드** — "ESTD. 2024"·"CLUB"·"UNIT"·"TIER I·II·III"·"·" 구분자.
7. **별 스티커 배지 1개** — 비대칭 데코 1점(신념·캐치 문구).

### 10.1b 일러스트 그림체 — Rubber Hose (2026-05-27 사용자 결정)

비지 캐릭터 재제작 그림체 = **rubber hose**(1930년대 클래식 애니메이션 스타일 — 베티붑·미키마우스·큡헤드 계열). 야옹이의 빈티지 outline 톤과 *호환*되며 더 *과장 표정·동작*으로 위트 한 스푼 추가.

**Rubber hose 핵심 룰**:
- **굵은 outline** (2~3px 일정 굵기, 야옹이와 일치)
- **고무관 같은 팔다리** — 굴곡 자연·관절 없음·과장된 곡선
- **흰 장갑·큰 동그란 눈·흰 fill 강조** — 베이지 종이 톤 위 흰 fill로 도드라짐
- **표정·동작 과장** — *움직이는 중* (야옹이 룰 4 강화) + *지금 무슨 감정인지 한 눈에*
- **검은 fill 강조** — outline만이 아니라 머리카락·신발·소품 일부에 *검은 fill 블록* (rubber hose 시그니처)
- **빈티지 종이 톤** — 약간 yellow-aged paper (`#f4ead2` ↔ `#f7f0dc` 범위)

**야옹이와 차이점 (병행 가능)**:
- 야옹이 = *정적 정장 빈티지* (안경 차분·미소 1px). 인쇄 매체 톤.
- Rubber hose = *동적 만화 빈티지* (큰 눈·과장 표정). 애니메이션 톤.
- → 비지는 *야옹이 톤 + rubber hose 동적 표정* 혼합. 사이드뷰 액션 + 큰 표정 + outline 일정.

**시안 들어왔을 때 검증 체크**:
- outline 굵기 2~3px 일정?
- 표정 *과장* (눈 크기·입 굴곡·자세)?
- 검은 fill 블록 1~2곳 (머리카락 등)?
- 흰 장갑/소품 강조?
- 사이드뷰 액션?
- 색 잉크 네이비 단색 또는 검은 outline?

### 10.2 결정 (D1~D5 — 모두 사용자 컨펌)
| # | 결정 |
|---|---|
| **D1** | 코랄 `#fe7644` **완전 제거** — 위트 1곳도 X. 잉크 단색 |
| **D2** | 한강 비지 **컨셉 보존, outline 톤 재그리기** (한강+서울 야경 = 컨셉 유지) |
| **D3** | "비집고" 워드마크 폰트 **Gmarket Sans Bold** (Jua 폐기) |
| **D4** | 3티어 컬러 **잉크 단색 + 빈티지 패턴(실선·점선·이중선) + "TIER I·II·III" 코드** |
| **D5** | BijiCard 6등급 theme **잉크 단색 + ornament 코드** ("TIER VI BABY"·"TIER I JUSTIN" 등 멤버십 라벨) |

### 10.3 카피 패턴 v1.1
**구조**: *정보 + 반전·위트 1스푼 + 격려 1스푼(선택)*

- **어미 룰**: `~함·~잡았어·~하자~·~보자~`. *드려요·해요·합니다* 회피.
- **부정 → 반전**: "안 돼" → "근데 옆 동네면 가능"
- **숫자 단정**: D−11y2m·+50만·−1y11m (친절 풀이 X)
- **격려 어미 다양화** (반복 X·적재적소·닭살 회피):
  - 현 페이스 OK: "이대로 가"·"이 페이스 좋아"
  - 잠재력 강조: "너는 되는 애야"·"넌 가능해"
  - 다그침·각성: "잘좀 하자"·"정신 차리자"
  - 응원·힘들 때: "힘좀 내"·"버텨보자"
  - 반전 강조: "근데 X면 가능"·"X면 충분"
  - 격려 불필요한 자리는 *안 넣음* — 정량·반전만
- **회피**: 추천·드려요·따뜻한 친구톤·이모지 남발·"같이 차근차근"

**예시**
- ❌ "지금 페이스로는 시간이 걸려요—그래도 길은 있어요"
- ✅ "이대로면 D−11y2m. 부업 +50만이면 −1y11m. 잘할 수 있어!"

### 10.4 보존 vs 변환 표
| 자산 | 결정 | 메모 |
|---|---|---|
| 워드마크 "비집고" | **보존** | 폰트만 Gmarket Sans Bold |
| 한강 비지 컨셉 | **보존** | 스타일만 outline 재그리기 |
| 컴플라이언스 ("추정"·"추천 회피"·POLICY_META·REGULATION_META·DISCLAIMER) | **완전 보존** | 톤 무관 |
| 모델 가정 카드 (`docs/model-assumptions.md`) | **보존** | |
| 스냅샷 추천 엔진·단지별 LTV·BijiCard 트레이딩 시스템 | **보존** | 기술 코어 |
| 비지 모션 | **보존** | walking loop 1종 추가 후보 |
| 코랄 `#fe7644` | **제거** (D1) | |
| 허니 앰버 `#e0a23a` | **제거** | 시그니처 수치 강조는 *크기*로 |
| Jua 폰트 | **제거** (워드마크 포함, D3) | |
| Gowun Dodum 본문 | **Pretendard 교체** | |
| 우드 브라운 `#3a2c1d` 본문 | **잉크 네이비 `#1f2a55` 교체** | |
| 카드 그림자 | **outline 1.5px로 교체** | |
| 카드 라운드 24px | **16px 축소** | |
| 3티어 의미색 | **잉크 단색 + 패턴** (D4) | |
| BijiCard 6등급 컬러 theme | **잉크 + ornament 코드** (D5) | |

### 10.5 신 토큰 (globals.css 주석 블록·아직 활성화 X)
```css
--color-ink:        #1f2a55;   /* 본문·헤딩·outline */
--color-ink-soft:   #3b4878;   /* 보조 잉크 */
--color-paper:      #f4ead2;   /* 페이지 배경 (아이보리) */
--color-paper-card: #fbf4de;   /* 카드 베이스 */
--color-shadow-tan: #c8b78d;   /* 1mm offset shadow */
--font-sans:        "Pretendard", -apple-system, sans-serif;
--font-heading:     "Gmarket Sans Bold";
--font-mono:        "JetBrains Mono";
--outline-card:     1.5px solid var(--color-ink);
--shadow-card:      2px 2px 0 var(--color-shadow-tan);
--radius-card:      1rem;
--radius-block:     0.75rem;
```

### 10.6 단계 (0·1·3 지금 가능. 2·4·5 시안 후)
| 단계 | 의존 | 상태 |
|---|---|---|
| 0. 가이드 SKILL.md | — | ✅ 이 섹션 |
| 1. 토큰 후보 주석 추가 | 결정 | 진행 중 |
| **2. 비지 캐릭터 시안 (사용자)** | — | 대기 |
| 3. 카피 패턴 v1.1 적용 | 결정 | 드래프트 작성 중 |
| 4. 시각 적용 (랜딩 → 예산 → 단지 → 플랜 → 결과·BijiCard 한 묶음 PR) | 시안 | 대기 |
| 5. OG·favicon 재발행 | 4 완료 | 대기 |

### 10.7 위험·완화
- **정체성 잃을 위험** → 워드마크 + 한강 컨셉 + 비지 모티프 보존
- **OG 캐시 잔존 1~7일** → 5단계 OG 재발행
- **점진 vs 한 번에** → 4단계는 한 묶음 PR (두 톤 공존 회피)
- **BijiCard 6등급 재설계가 가장 큰 시각 결정** → ornament·텍스처·"TIER VI" 코드로 차별화
- **컴플라이언스 충돌** → "잡았어 = 발견의 의외성, 추천 아님" 카피 패턴에 명시

