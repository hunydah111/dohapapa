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
// 상위 X% → 재미있는 등급. 위는 비현실 플렉스로 띄우고, 아래는 '짓는 중'으로 절대 안 깐다.
// 컴플라이언스: '구매력=지을 수 있는 집 규모' 비유일 뿐, 자산가치·미래가치·투자권유 아님.
// isFlex=false(그 이하)면 "상위 N%" 숫자를 숨겨 박탈감을 차단한다.
export type BeaverTierSlug =
  | "justin"
  | "fever"
  | "top"
  | "nan"
  | "gukmin"
  | "baby";

// 트레이딩 카드(BijiCard) 등급별 시각 차별화 — 비지 자세·소품·표정이 달라도 카드 자체가
// 등급 무드를 살려주면 6마리가 "같은 시리즈"로 보임. 우디 팔레트 안에서만 변주(SKILL.md §7
// 보라/네온 금지 룰). 다크 카드(textTone=light)는 락스타·엘비스 컨셉, 라이트는 친근 컨셉.
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
  /** 핵심 액센트(이름·테두리). */
  accent: string;
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
  /** 공유 OG·카드용 비버 이미지 (public/biji/tier/…). 등급별 무드. */
  image: string;
  /** 트레이딩 카드 시각 테마. */
  theme: BeaverTierTheme;
}

export const BEAVER_TIERS: Record<BeaverTierSlug, BudgetTier> = {
  justin: {
    slug: "justin", emoji: "🕺", label: "저스틴비버", drip: "취향껏 집짓는 비버", isFlex: true,
    image: "/biji/tier/justin.png",
    theme: {
      cardBg: "linear-gradient(155deg, #3a2c1d 0%, #5a3520 55%, #fe7644 100%)",
      textTone: "light",
      glow: "radial-gradient(circle at 80% 0%, rgba(224,162,58,0.55) 0%, rgba(224,162,58,0) 60%)",
      ornament: "gold-stars",
      accent: "#e0a23a",
    },
  },
  fever: {
    slug: "fever", emoji: "🔥", label: "피버", drip: "골라짓는 비버", isFlex: true,
    image: "/biji/tier/fever.png",
    theme: {
      cardBg: "linear-gradient(160deg, #fff4ef 0%, #ffb094 55%, #fe7644 100%)",
      textTone: "dark",
      glow: "radial-gradient(circle at 75% 10%, rgba(254,118,68,0.45) 0%, rgba(254,118,68,0) 65%)",
      ornament: "flames",
      accent: "#c4521f",
    },
  },
  top: {
    slug: "top", emoji: "🏆", label: "탑비버", drip: "잘나가는 비버", isFlex: true,
    image: "/biji/tier/top.png",
    theme: {
      cardBg: "linear-gradient(160deg, #fffdf8 0%, #f7ead0 55%, #e0a23a 100%)",
      textTone: "dark",
      glow: "radial-gradient(circle at 50% 0%, rgba(224,162,58,0.45) 0%, rgba(224,162,58,0) 65%)",
      ornament: "stars",
      accent: "#9a5a1e",
    },
  },
  nan: {
    slug: "nan", emoji: "😎", label: "난비버", drip: "알짜비버", isFlex: true,
    image: "/biji/tier/nan.png",
    theme: {
      cardBg: "linear-gradient(160deg, #2c2116 0%, #4a3a28 55%, #6e5b46 100%)",
      textTone: "light",
      glow: "radial-gradient(circle at 20% 15%, rgba(224,162,58,0.45) 0%, rgba(224,162,58,0) 60%)",
      ornament: "notes",
      accent: "#e0a23a",
    },
  },
  gukmin: {
    slug: "gukmin", emoji: "🦫", label: "비버", drip: "국민비버", isFlex: false,
    image: "/biji/tier/gukmin.png",
    theme: {
      cardBg: "linear-gradient(160deg, #fffdf8 0%, #efe2cf 60%, #d9c5a4 100%)",
      textTone: "dark",
      glow: "radial-gradient(circle at 50% 0%, rgba(254,118,68,0.25) 0%, rgba(254,118,68,0) 65%)",
      ornament: "confetti",
      accent: "#8a6240",
    },
  },
  baby: {
    slug: "baby", emoji: "🐣", label: "아기비버", drip: "집짓기 시작하는 비버 — 비지가 옆에서 응원", isFlex: false,
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
  if (topPercent <= 1) return BEAVER_TIERS.justin;
  if (topPercent <= 10) return BEAVER_TIERS.fever;
  if (topPercent <= 30) return BEAVER_TIERS.top;
  if (topPercent <= 50) return BEAVER_TIERS.nan;
  if (topPercent <= 70) return BEAVER_TIERS.gukmin;
  return BEAVER_TIERS.baby;
}

/** 슬러그로 등급 조회 (공유 OG·페이지용). 없으면 null. */
export function getTierBySlug(slug: string): BudgetTier | null {
  return (BEAVER_TIERS as Record<string, BudgetTier>)[slug] ?? null;
}
