// 지면(신문) 조판 토큰 + 명조 폰트 — 단일 소스 (2026-07-06 홈 하부 톤 통일).
// DailyFront(오늘의 1면)와 홈 하부(LandingHero·BijiCard 판정서·헤더 제호)가 공유한다.
//
// 명조는 next/font 셀프호스팅(빌드 시 내장) — 기기에 폰트가 없어도 모든 플랫폼 동일 렌더.
// next/font 인스턴스는 반드시 여기 한 곳에서만 선언(중복 선언 금지) — 양쪽에서 import.

import { Noto_Serif_KR } from "next/font/google";

export const serif = Noto_Serif_KR({
  weight: ["700", "900"],
  subsets: ["latin"],
  display: "swap",
  fallback: ["Nanum Myeongjo", "Batang", "serif"],
});

// ── 조판 토큰 (bijigo-front-mockup 시안 A) ──────────────────────────────────
/** 종이 — 페이지·지면 바탕. */
export const PAPER = "#fbfaf6";
/** 먹 — 본문·헤드라인·괘선(강). */
export const INK = "#191713";
/** 보조 먹 — 캡션·메타. */
export const INK_SOFT = "#5d574c";
/** 괘선 — 코너 구분선·카드 보더. */
export const RULE = "#c9c3b4";
/** 코랄 — 제호 플레이트·CTA·판정 링크에만. */
export const CORAL = "#e8571f";
/** 그린 — 통과·긍정 의미색 (시세 방향엔 사용하지 않음 — UP/DOWN 참조). */
export const GREEN = "#2e7d52";

/** 시세 방향색 — 한국 증권·부동산 시세면 문법 (2026-07-06 사장 확정: 상승=빨강·하락=파랑).
 *  주의: 경보·조바심 용도의 빨강은 여전히 금지 — UP은 오직 '상승 수치·기호'에만 쓴다. */
export const UP = "#c9252d";
export const DOWN = "#2563a8";
