// 예산 백분위 — 추정 구매력이 최근 수도권 실거래가 분포에서 어느 위치인지.
// scripts/build-budget-percentile.ts 가 Neon 실데이터로 구워 budgetPercentile.json 으로 둔다.
// 비어 있으면(미생성) null 반환 → UI 에서 자동 숨김. 순수 함수.
//
// 컴플라이언스/소유주 보호: 가격 분포(공개 사실)에 '사용자 예산'을 줄 세울 뿐, 특정
// 단지/동네를 줄 세우지 않는다. 미래가치 예측이 아니라 현재 가격대 도달 범위(추정).

import data from "@/data/budgetPercentile.json";

export interface BudgetPercentileData {
  generatedAt: string;
  /** 분포에 쓰인 거래 수. */
  count: number;
  /** 길이 101 — index p = 하위 p% 지점의 가격(원). 미생성이면 빈 배열. */
  percentiles: number[];
}

const TABLE = data as BudgetPercentileData;

// 표본이 이보다 적으면 신뢰 못 해 숨김.
const MIN_COUNT = 200;

/**
 * 예산이 "상위 X% 가격대까지 닿는지" 반환 (X 작을수록 강함).
 * 예: 반환 38 → 최근 수도권 실거래의 상위 38% 가격대까지 살 수 있는 예산.
 * 데이터 없음/표본 부족/예산 0 이하면 null.
 */
export function budgetTopPercent(budgetKrw: number): number | null {
  const ps = TABLE.percentiles;
  if (ps.length < 101 || TABLE.count < MIN_COUNT || budgetKrw <= 0) return null;

  // budget 이하 거래 비율(affordable %) = budget 보다 큰 마지막 백분위 index.
  let affordPct = 0;
  for (let p = 0; p <= 100; p++) {
    if (ps[p] <= budgetKrw) affordPct = p;
    else break;
  }
  // 상위 X% = 100 - affordable%.
  return 100 - affordPct;
}

// ── 구매력 계급도 ("비버 빌드" 컨셉) ─────────────────────────────────────────
// 상위 X% → 호감형 셀럽 패러디 5등급. 위는 비현실 플렉스로 띄우고, 아래는 '짓는 중'으로 절대 안 깐다.
// 컴플라이언스: '구매력=지을 수 있는 집 규모' 비유일 뿐, 자산가치·미래가치·투자권유 아님.
// isFlex=false(그 이하)면 "상위 N%" 숫자를 숨겨 박탈감을 차단한다.
//
// 라인업 (2026-05-28 사용자 확정 — 셀럽 패러디 + 한국 정서):
//   queen  → 프레디 머큐리 (보헤미안 랩소디 흰 수트 + 반쪽 마이크 스탠드)
//   rain   → 가수 비 (깡 — 가죽 자켓 + 까만 선글라스 + 바닥 leg-sweep)
//   bieber → 저스틴 비버 (2010 리즈 시절 — 사이드 스윕 헤어 + 하늘색 셔츠 + 목걸이)
//   gukmin → 비버 (오리지널)
//   baby   → 아기비버 (오리지널)
export type BeaverTierSlug =
  | "queen"
  | "rain"
  | "bieber"
  | "gukmin"
  | "baby";

// 트레이딩 카드(BijiCard) 등급별 시각 차별화. 우디 팔레트 안에서 변주
// (SKILL.md §7 보라/네온 금지 룰). 다크 카드(textTone=light)는 락스타·무대 컨셉, 라이트는 친근 컨셉.
export type BijiOrnament = "stars" | "flames" | "gold-stars" | "notes" | "confetti" | "hearts";
export interface BeaverTierTheme {
  /** 카드 배경 — CSS background 값(linear-gradient). */
  cardBg: string;
  /** 텍스트 톤. light=흰 텍스트(다크 카드), dark=우드 브라운 텍스트(라이트 카드). */
  textTone: "light" | "dark";
  /** 카드 코너 글로우(반투명 radial). */
  glow: string;
  /** 장식 패턴 — 비지 등급 특색과 매칭. */
  ornament: BijiOrnament;
  /** 핵심 액센트(테두리·코너 별). */
  accent: string;
  /** 큰 이름 텍스트 색 override (옵션 — 미지정 시 textTone에 따라 자동). */
  nameColor?: string;
}

export interface BudgetTier {
  /** URL·공유카드 식별 슬러그. */
  slug: BeaverTierSlug;
  emoji: string;
  label: string;
  /** 결과 카드용 위트 한 줄. */
  drip: string;
  /** true면 "상위 N%" 노출, false(최하위)면 숫자 숨김. */
  isFlex: boolean;
  /** 공유 OG·카드용 비버 이미지 (public/biji/tier/…). 등급별 무드.
   *  배열이면 시드(시군구)로 결정적 랜덤 픽 — 동일 지역은 항상 같은 비지로 일관성 유지. */
  image: string | string[];
  /** 트레이딩 카드 시각 테마. */
  theme: BeaverTierTheme;
}

export const BEAVER_TIERS: Record<BeaverTierSlug, BudgetTier> = {
  queen: {
    slug: "queen", emoji: "🎤", label: "퀸비버", drip: "갈라쇼 라인 — 최정상", isFlex: true,
    image: "/biji/tier/queen.png",
    theme: {
      // 실버 그라데이션 — 갈라쇼/럭셔리 메탈 톤. Freddie 마이크·체인 실버 톤과 호응.
      // 라벨 텍스트는 dark charcoal로 silver bg 위 가독 OK (별도 nameColor override).
      cardBg: "linear-gradient(160deg, #f4f6f8 0%, #c8ccd0 50%, #8a8d93 100%)",
      textTone: "dark",
      glow: "radial-gradient(circle at 50% 0%, rgba(200,204,208,0.55) 0%, rgba(200,204,208,0) 60%)",
      ornament: "stars",
      accent: "#909296", // 실버 — corner 별 ornament 색
      nameColor: "#2c2c30", // dark charcoal — silver bg 위 큰 이름 가독성
    },
  },
  rain: {
    slug: "rain", emoji: "🕶️", label: "비  버", drip: "1일 1비집고 — 슈퍼 라인", isFlex: true,
    image: "/biji/tier/rain.png",
    theme: {
      // 깡 noir — 검정 가죽 자켓 + 골드 체인. 깊은 black + 따뜻한 우디 base.
      cardBg: "linear-gradient(155deg, #14100c 0%, #2c2218 50%, #5a4838 100%)",
      textTone: "light",
      glow: "radial-gradient(circle at 80% 10%, rgba(224,162,58,0.4) 0%, rgba(224,162,58,0) 65%)",
      ornament: "flames",
      accent: "#e0a23a",
    },
  },
  bieber: {
    slug: "bieber", emoji: "🎤", label: "저스틴비버", drip: "글로벌 — 인기 라인", isFlex: true,
    image: "/biji/tier/bieber.png",
    theme: {
      // 2010 리즈 시절 매거진 화보 — 하늘색 데님 셔츠 분위기, 청량 + 따뜻 미디엄
      cardBg: "linear-gradient(160deg, #f6faff 0%, #d8e8f4 55%, #a8c8e0 100%)",
      textTone: "dark",
      glow: "radial-gradient(circle at 50% 0%, rgba(168,200,224,0.5) 0%, rgba(168,200,224,0) 65%)",
      ornament: "hearts",
      accent: "#4a7ba8",
    },
  },
  gukmin: {
    slug: "gukmin", emoji: "🦫", label: "비버", drip: "표준 라인 — 부업 한 칸 늘리자~", isFlex: false,
    // 가장 많은 비버류라 시각 단조 차단 — 시군구 시드로 결정적 랜덤 픽 (강남구→grass, 송파구→leaf 등 일관).
    // 추후 tier-norm.png 추가하면 4장으로 확장 (gukmin v2 프롬프트로 생성 예정).
    image: [
      "/biji/tier/blossom.png",
      "/biji/tier/grass.png",
      "/biji/tier/leaf.png",
    ],
    theme: {
      cardBg: "linear-gradient(160deg, #fffdf8 0%, #efe2cf 60%, #d9c5a4 100%)",
      textTone: "dark",
      glow: "radial-gradient(circle at 50% 0%, rgba(254,118,68,0.25) 0%, rgba(254,118,68,0) 65%)",
      ornament: "confetti",
      accent: "#8a6240",
    },
  },
  baby: {
    slug: "baby", emoji: "🐣", label: "아기비버", drip: "출발선 — 우선 현금흐름 잡자", isFlex: false,
    image: "/biji/tier/baby.png",
    theme: {
      cardBg: "linear-gradient(160deg, #fffdf8 0%, #ffe6dc 55%, #ffccb7 100%)",
      textTone: "dark",
      glow: "radial-gradient(circle at 75% 15%, rgba(254,118,68,0.35) 0%, rgba(254,118,68,0) 65%)",
      ornament: "hearts",
      accent: "#c4521f",
    },
  },
};

export function budgetTier(topPercent: number): BudgetTier {
  // 5단계 — 옛 6단계(justin/fever/top/nan/gukmin/baby)에서 nan(50%) 경계를 흡수하고
  // 셀럽 패러디 3종(queen/rain/bieber)으로 상위 1·10·30% 슬롯 재정의. 중위 30~70%는 gukmin이 단일 흡수.
  if (topPercent <= 1) return BEAVER_TIERS.queen;
  if (topPercent <= 10) return BEAVER_TIERS.rain;
  if (topPercent <= 30) return BEAVER_TIERS.bieber;
  if (topPercent <= 70) return BEAVER_TIERS.gukmin;
  return BEAVER_TIERS.baby;
}

// 옛 슬러그(justin/fever/top/nan) → 새 슬러그 매핑. 옛 공유 URL(/s/b/justin/...)이
// 404나지 않게 가장 가까운 새 등급으로 폴백. 박탈감 차단 룰 유지.
const LEGACY_SLUG_ALIAS: Record<string, BeaverTierSlug> = {
  justin: "bieber", // 옛 락스타 저스틴 → 새 진짜 저스틴 비버(리즈 시절)
  fever:  "queen",  // 옛 피버 → 새 퀸비버(최상위 톤)
  top:    "bieber", // 옛 탑비버 → 비슷한 상위 라인(bieber)
  nan:    "gukmin", // 옛 난비버(엘비스) → 중위 비버
};

/** 슬러그로 등급 조회 (공유 OG·페이지용). 옛 슬러그면 alias 통해 새 등급으로 폴백. 없으면 null. */
export function getTierBySlug(slug: string): BudgetTier | null {
  const direct = (BEAVER_TIERS as Record<string, BudgetTier>)[slug];
  if (direct) return direct;
  const aliased = LEGACY_SLUG_ALIAS[slug];
  if (aliased) return BEAVER_TIERS[aliased];
  return null;
}

// 문자열 결정적 해시 — 시군구 같은 시드로 array 변주 픽.
function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

/**
 * tier.image가 array면 시드(시군구) 기반 결정적 픽, 단일 string이면 그대로.
 * 시드 없거나 빈 array면 첫 번째 폴백. SSR/CSR 동일 결과 (hydration safe).
 */
export function pickTierImage(image: string | string[], seed?: string | null): string {
  if (typeof image === "string") return image;
  if (image.length === 0) return "";
  if (image.length === 1 || !seed) return image[0];
  return image[djb2Hash(seed) % image.length];
}
