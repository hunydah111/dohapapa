// 자조 밈 verdict — 판정 카드의 감정 한 줄. "지는 게 웃기면 진 사람도 공유한다."
//
// 한 방 스펙 4단계: 1:1 대결(박탈감) 기각 → 자조 유머가 공유 페이로드.
// 톤 규칙: 자조는 항상 "내가 나를" — 타인 비하·영끌 조장·절망 단정 금지, 끝은 위트.
// 결정적(deterministic): 같은 (등급, D-day, 시군구)면 항상 같은 문장 — SSR/CSR 일치·공유 일관성.

import type { DdayResult } from "@/lib/plan/dday";

type Bucket = "now" | "soon" | "grind" | "far";

/** D-day → 감정 버킷. soon ≤ 5년, grind ≤ 캡, far = 아득. */
function bucketOf(dday: DdayResult): Bucket {
  if (dday.months === 0) return "now";
  if (dday.capped) return "far";
  if (dday.days !== null && dday.days <= 1827) return "soon"; // ~5년
  return "grind";
}

// 버킷별 변주 — 시군구 글자수로 결정적 선택. 전부 자기 자신에게 하는 말.
const LINES: Record<Bucket, string[]> = {
  // 입성(now)은 자랑 톤 금지(2026-07-06 사장 지시) — 담백 긍정만.
  // "지금 자산 기준"을 못박아 미래 보장·시세 단정처럼 읽히는 것도 막는다.
  // "닿는다"류 카피도 verdict 전 버킷에서 금지(사장 카피 확정).
  now: [
    "지금 자산 기준, 가능.",
    "여긴 이미 네 사정권.",
    "지금 통장으로 되는 곳.",
  ],
  soon: [
    "버틸 만한 싸움이다.",
    "적금 만기 몇 번이면 끝.",
    "루틴만 지키면 온다.",
  ],
  grind: [
    "길다. 근데 0은 아니다.",
    "강산 한 번에 나도 변한다.",
    "숫자가 길지 길이 없진 않다.",
  ],
  far: [
    "서울이 나를 거부함 🦫",
    "여긴 일단 다음 폴더에 저장.",
    "눈높이 말고 지도를 옮길 때.",
  ],
};

/** 판정 카드 자조 한 줄. dday 없으면 null (카드는 조용히 생략). */
export function verdictLine(dday: DdayResult | null | undefined): string | null {
  if (!dday) return null;
  const lines = LINES[bucketOf(dday)];
  // 결정적 변주 — 시군구 코드포인트 합 (같은 동네·같은 상태 = 같은 문장)
  let seed = 0;
  for (const ch of dday.sigungu) seed += ch.codePointAt(0) ?? 0;
  return lines[seed % lines.length];
}
