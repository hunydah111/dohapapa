// 주요 거래 분석 — 오늘 [주요 거래](수도권 15억+ 큰 거래) 중 각 시군구의 "최고 상승"을 뽑는다.
// 1면 [주요 거래] 코너·공유 카드의 어그로 punch 한 줄 (2026-07-11 사장).
//
// 최고 상승률로 줄세우되 이상치 컷 복원 (2026-07-12 사장 "+89%가 말이 될까"):
// 7/11 "게이트 다 빼라" 재지시로 순수 정렬을 했더니 수지구 +89%(직전 8.2억이 증여성 이상
// 저가, 시세 15억대)·성동 +163% 같은 "직전 거래 오류"가 그날의 상승처럼 인쇄됐다 —
// 금강펜테리움 +40.5% 사태의 재림. 절충: 평균으로 돌아가지 않고 "최고 상승"은 유지하되
// ①상한 컷 +30%(passesStrongGate와 동일 — 직전 이상 저가 대비 뻥튀기 차단)
// ②자기 중위가 대비도 상승(pct>0 방향 합의 — 7% 문턱까진 요구 않음, 중위가 없으면 제외)
// 을 통과한 것만 줄세운다. 해제·직거래는 상류에서 이미 제외.
//
// 순수 함수 — API·파일·DB 접근 없음.

/** major 아이템에서 분석에 필요한 최소 필드(표시용 + 상승률). */
export interface MajorAnalysisInput {
  sigungu: string;
  /** 최고 상승 단지명 — "강남 개포래미안포레스트 +14%" 병기용. */
  apt: string;
  /** (price − prevKrw) / prevKrw — 직전 실거래(최근 60일) 대비 등락(소수). 없으면 직전 없음. */
  pctVsPrev?: number | null;
  /** 자기 중위가 대비 이탈률(소수) — 이상치 방향 합의용. lookup 불가·표본 부족이면 null. */
  pct?: number | null;
}

export interface MajorAnalysisRow {
  sigungu: string;
  /** 그 구 주요 거래 중 오보 게이트 통과한 것의 "최고" 직전 대비 상승률(소수). */
  topPct: number;
  /** 최고 상승을 낸 단지명. */
  apt: string;
}

/** 직전 대비 상한 컷 — passesStrongGate와 동일(+30% 초과 = 직전 이상 저가 의심). */
export const MAJOR_ANALYSIS_MAX_PCT = 0.3;

/**
 * major(가격 내림차순) → 시군구별 "최고 상승"(이상치 컷 통과분). 조건: 직전 실거래
 * 존재(=최근 60일) · 상승(+) · 직전 대비 ≤ +30% · 자기 중위가 대비도 상승(pct>0).
 * 각 구의 최고 직전 대비 상승률을 상승 큰 순 정렬 · 동률은 시군구 가나다순 · limit 개까지(기본 6).
 * 상승 거래가 하나도 없는 구는 제외. 아무 것도 없으면 빈 배열(호출부가 라인 생략).
 */
export function majorAnalysis(
  major: readonly MajorAnalysisInput[],
  limit = 6,
): MajorAnalysisRow[] {
  const best = new Map<string, { topPct: number; apt: string }>();
  for (const m of major) {
    if (m.pctVsPrev == null || m.pctVsPrev <= 0) continue;
    // 이상치 컷(2026-07-12): 직전 이상 저가 대비 뻥튀기(+89% 등) 차단 — 상한 + 방향 합의.
    if (m.pctVsPrev > MAJOR_ANALYSIS_MAX_PCT) continue;
    if (m.pct == null || m.pct <= 0) continue;
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
