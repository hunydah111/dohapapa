// 주요 거래 분석 — 오늘 [주요 거래](수도권 15억+ 큰 거래) 중 각 시군구의 "최고 상승"을 뽑는다.
// 1면 [주요 거래] 코너·공유 카드의 어그로 punch 한 줄 (2026-07-11 사장).
//
// ★그냥 최고 상승률로 줄세운다★ (2026-07-11 사장 재지시): 평균도 아니고, 게이트 상한컷(≤30%)·
// 자기중위 이중합의도 빼라. "직전 실거래가 확실히 1~2달 이전이면 그건 확실한 상승거래"라는
// 사장 판단대로 — 조건은 딱 둘: ①직전 실거래가 존재(pctVsPrev 계산됨 = 이미 최근 60일 내 직전만)
// ②그게 상승(+)일 것. 그 뒤엔 각 구의 최고 직전 대비 상승률만 뽑아 큰 순으로 줄세운다.
// 상한 컷을 없앴으므로 +40%든 뭐든 실제 최고 상승이 그대로 노출된다(해제·직거래는 상류에서 이미 제외).
// 상승 구만 뜬다(+ 요건) — 그날 가장 세게 오른 동네들. 해석("강남 오르고…")은 사람 몫.
//
// 순수 함수 — API·파일·DB 접근 없음.

/** major 아이템에서 분석에 필요한 최소 필드(표시용 + 상승률). */
export interface MajorAnalysisInput {
  sigungu: string;
  /** 최고 상승 단지명 — "강남 개포래미안포레스트 +14%" 병기용. */
  apt: string;
  /** (price − prevKrw) / prevKrw — 직전 실거래(최근 60일) 대비 등락(소수). 없으면 직전 없음. */
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
 * major(가격 내림차순) → 시군구별 "최고 상승". 조건은 딱 둘: 직전 실거래 존재(=최근 60일) · 상승(+).
 * 각 구의 최고 직전 대비 상승률을 상승 큰 순 정렬 · 동률은 시군구 가나다순 · limit 개까지(기본 6).
 * 상승 거래가 하나도 없는 구는 제외. 아무 것도 없으면 빈 배열(호출부가 라인 생략).
 */
export function majorAnalysis(
  major: readonly MajorAnalysisInput[],
  limit = 6,
): MajorAnalysisRow[] {
  const best = new Map<string, { topPct: number; apt: string }>();
  for (const m of major) {
    // 직전 실거래(최근 60일)가 있고 그게 상승(+)인 것만 — 상한 컷·이중합의 없이 순수 최고 상승 줄세우기.
    if (m.pctVsPrev == null || m.pctVsPrev <= 0) continue;
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
