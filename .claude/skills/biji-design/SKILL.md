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
