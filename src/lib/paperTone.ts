// 지면(신문) 조판 토큰 + 하이브리드 폰트 — 단일 소스 (2026-07-11 프리미엄 하이브리드 확정).
// DailyFront(오늘의 1면)·동네판(LocalFront)·동네면(/r)·홈 헤더 제호가 공유한다.
//
// 프리미엄 하이브리드(사장 확정, mock-hybrid 검증):
//   · 세리프(나눔명조 Regular) = 코너 제목·헤드라인·단지명 — 얇고 우아하게.
//   · Pretendard(Regular/SemiBold/Bold) = 본문·라벨·숫자·가격·%·제호(비집고) 워드마크.
// 폰트는 전부 next/font/local 셀프호스팅(빌드 시 내장) — 기기에 폰트가 없어도 전 플랫폼
// 동일 렌더. ⚠️ 시스템 폰트 스택·CDN 금지("0점 폰트 폴백" 교훈). OG 카드(satori)는
// assets/ 파일을 readFile 로 직접 로드(여기 인스턴스와 무관).
// next/font 인스턴스는 반드시 여기 한 곳에서만 선언(중복 선언 금지) — 각 지면에서 import.

import localFont from "next/font/local";

/** 세리프 — 나눔명조 Regular(단일 웨이트). 코너 제목·헤드라인·단지명 전용.
 *  얇고 우아한 제목체 — 볼드 클래스(font-bold 등) 병용 금지(faux-bold 방지, 파일이 400뿐). */
export const serif = localFont({
  src: "../app/fonts/NanumMyeongjo-Regular.ttf",
  weight: "400",
  display: "swap",
  fallback: ["Nanum Myeongjo", "Batang", "serif"],
});

/** 본문·숫자 — Pretendard 3웨이트 셀프호스팅. 가격·% 는 SemiBold(font-semibold),
 *  강조는 Bold(font-bold), 나머지 Regular. 제호 "비집고" 코랄 플레이트도 이 폰트 Bold. */
export const pretendard = localFont({
  src: [
    { path: "../app/fonts/Pretendard-Regular.otf", weight: "400", style: "normal" },
    { path: "../app/fonts/Pretendard-SemiBold.otf", weight: "600", style: "normal" },
    { path: "../app/fonts/Pretendard-Bold.otf", weight: "700", style: "normal" },
  ],
  display: "swap",
  fallback: ["Pretendard", "Malgun Gothic", "sans-serif"],
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

/** 제호(코랄 플레이트) "비집고" 워드마크 = Pretendard Bold (pretendard export + font-bold).
 *  종전 Black Han Sans plateFont 는 프리미엄 하이브리드(2026-07-11)에서 폐기 — 코너 제목·
 *  헤드라인은 세리프(serif), 브랜드 워드마크는 Pretendard Bold(mock-hybrid 검증 매핑). */
