// 주요 거래 분석 — 오늘 [주요 거래](수도권 15억+ 큰 거래)를 시군구별로 묶어 직전 실거래 대비
// 평균 등락을 낸다. 1면 [주요 거래] 코너·공유 카드의 "어그로 punch" 한 줄(2026-07-11 사장).
//
// ⚠️ 정직성(편집 헌장): 이건 "그 구의 상승률"이 아니라 "오늘 큰 거래에 잡힌 그 구 단지들의
// 직전 대비 평균"이다 — 전체 시세를 대변하지 않는다(표본 = 주요 거래분, 종종 1~2건). 그래서
// 소비하는 쪽은 반드시 "주요 거래 분석" 라벨 + 건수(N건)를 병기해 한계를 드러낸다. 이 거래들의
// 평균이라는 팩트는 참이므로 딴지 불가 + 어그로는 살고, "강남구 시세 +X%" 같은 뻥튀기(호갱노노
// 톤)로 오독되지 않게 한다. 상승·하락 그날 데이터대로 뜬다 — 해석은 퍼나르는 사람 몫.
//
// 순수 함수 — API·파일·DB 접근 없음.

/** major 아이템에서 분석에 필요한 최소 필드(구 스키마 optional 방어). */
export interface MajorAnalysisInput {
  sigungu: string;
  /** (price − prevKrw) / prevKrw — 직전 실거래 대비 등락(소수). 없으면 집계 제외. */
  pctVsPrev?: number | null;
}

export interface MajorAnalysisRow {
  sigungu: string;
  /** 그 구 주요 거래들의 직전 대비 등락 평균(소수). */
  avgPct: number;
  /** 평균에 들어간 거래 수(표본 — 1건이면 표본이 얇다는 게 드러나야 한다). */
  count: number;
}

/**
 * major(가격 내림차순) → 시군구별 직전 대비 평균 등락. pctVsPrev 있는 거래만 집계.
 * 상승 큰 순 정렬(어그로 — 위가 상승) · 동률은 시군구 가나다순 안정 정렬 · limit 개까지(기본 6).
 * 집계 가능한 거래가 하나도 없으면 빈 배열(호출부가 라인 생략).
 */
export function majorAnalysis(
  major: readonly MajorAnalysisInput[],
  limit = 6,
): MajorAnalysisRow[] {
  const agg = new Map<string, { sum: number; count: number }>();
  for (const m of major) {
    if (m.pctVsPrev == null) continue;
    const a = agg.get(m.sigungu) ?? { sum: 0, count: 0 };
    a.sum += m.pctVsPrev;
    a.count += 1;
    agg.set(m.sigungu, a);
  }
  return [...agg.entries()]
    .map(([sigungu, a]) => ({ sigungu, avgPct: a.sum / a.count, count: a.count }))
    .sort((x, y) => (y.avgPct !== x.avgPct ? y.avgPct - x.avgPct : x.sigungu.localeCompare(y.sigungu, "ko")))
    .slice(0, Math.max(0, limit));
}
