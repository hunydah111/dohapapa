// 지면(신문) 조판 토큰 + 명조 폰트 — 단일 소스 (2026-07-06 홈 하부 톤 통일).
// DailyFront(오늘의 1면)와 홈 하부(LandingHero·BijiCard 판정서·헤더 제호)가 공유한다.
//
// 명조는 next/font 셀프호스팅(빌드 시 내장) — 기기에 폰트가 없어도 모든 플랫폼 동일 렌더.
// next/font 인스턴스는 반드시 여기 한 곳에서만 선언(중복 선언 금지) — 양쪽에서 import.

import { Noto_Serif_KR, Black_Han_Sans } from "next/font/google";

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

/** 제호(코랄 플레이트) 전용 디스플레이 폰트 — 블랙한산스 셀프호스팅 (제호 변형 시안 A).
 *  시스템 고딕 스택은 Pretendard 없는 기기에서 맑은고딕 가짜볼드로 깨져 폐기(사장 "0점" 판정).
 *  next/font 내장이라 전 기기 동일 렌더. 지면 제호·헤더 미니 플레이트·BijiCard 워터마크 공유.
 *  명조(serif)는 헤드라인·판정서 등급명 전용으로 존치. */
export const plateFont = Black_Han_Sans({
  weight: "400", // 단일 웨이트 — 자체가 초고밀도 헤드라인체 (합성볼드 아님)
  subsets: ["latin"],
  display: "swap",
  fallback: ["Pretendard", "Malgun Gothic", "sans-serif"],
});

/** @deprecated plateFont(next/font)로 교체 — 시스템 스택은 기기별 렌더 편차로 폐기. */
export const PLATE_FONT = 'Pretendard, "Malgun Gothic", sans-serif';
