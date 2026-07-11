// 주요 거래 분석 — 오늘 [주요 거래](수도권 15억+ 큰 거래) 중 각 시군구의 "최고 상승"을 뽑는다.
// 1면 [주요 거래] 코너·공유 카드의 어그로 punch 한 줄 (2026-07-11 사장).
//
// ★평균 아님, "최고 상승"★ (2026-07-11 사장 지적): 2건 평균은 표본이 얇으면 무의미하고
// 어그로도 약하다. 대신 각 구에서 "확실한 상승거래" 하나의 최고 직전 대비 상승률을 쓴다.
// "확실한 상승"의 정의 = [강세 거래] 코너와 같은 오보 게이트(passesStrongGate):
//   · 직전 실거래가 60일 내(pctVsPrev 존재 = 이미 최근 직전만) · 직전 대비 +7%↑
//   · 자기 중위 대비도 +7%↑(이중 합의 — "직전이 이상치" 오보 방지) · ≤+30%(상한 컷).
// 이 게이트를 통과한 것만 세므로 "직전이 이상거래여서 뻥튀기된" 상승은 빠진다.
// 상승 구만 뜬다(게이트가 +상승 요건) — 그날 오른 동네들의 확실한 최고 상승. 해석은 사람 몫.
//
// 순수 함수 — API·파일·DB 접근 없음.

import { passesStrongGate } from "@/lib/patchNote";

/** major 아이템에서 분석에 필요한 최소 필드(passesStrongGate 입력 + 표시용). */
export interface MajorAnalysisInput {
  sigungu: string;
  /** 최고 상승 단지명 — "강남 개포래미안포레스트 +14%" 병기용. */
  apt: string;
  /** 자기 중위가 대비 이탈률(게이트 이중 합의용). */
  pct: number | null;
  prevKrw?: number | null;
  /** (price − prevKrw) / prevKrw — 직전 실거래 대비 등락(소수). */
  pctVsPrev?: number | null;
}

export interface MajorAnalysisRow {
  sigungu: string;
  /** 그 구 주요 거래 중 오보 게이트 통과한 것의 "최고" 직전 대비 상승률(소수). */
  topPct: number;
  /** 최고 상승을 낸 단지명. */
  apt: string;
}

/**
 * major(가격 내림차순) → 시군구별 "최고 상승"(오보 게이트 통과분). 상승 큰 순 정렬 ·
 * 동률은 시군구 가나다순 · limit 개까지(기본 6). 게이트 통과 거래가 하나도 없는 구는 제외.
 * 게이트 통과가 하나도 없으면 빈 배열(호출부가 라인 생략).
 */
export function majorAnalysis(
  major: readonly MajorAnalysisInput[],
  limit = 6,
): MajorAnalysisRow[] {
  const best = new Map<string, { topPct: number; apt: string }>();
  for (const m of major) {
    if (m.pctVsPrev == null || m.pct == null) continue;
    // "확실한 상승거래"만 — [강세 거래]와 동일 오보 게이트(직전 60일·이중 합의·상한 컷).
    if (!passesStrongGate({ pct: m.pct, prevKrw: m.prevKrw, pctVsPrev: m.pctVsPrev })) continue;
    const cur = best.get(m.sigungu);
    if (!cur || m.pctVsPrev > cur.topPct) {
      best.set(m.sigungu, { topPct: m.pctVsPrev, apt: m.apt });
    }
  }
  return [...best.entries()]
    .map(([sigungu, v]) => ({ sigungu, topPct: v.topPct, apt: v.apt }))
    .sort((a, b) => (b.topPct !== a.topPct ? b.topPct - a.topPct : a.sigungu.localeCompare(b.sigungu, "ko")))
    .slice(0, Math.max(0, limit));
}
