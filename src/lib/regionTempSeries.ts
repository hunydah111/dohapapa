// 동네별 온도 시계열 — 시군구 × 월 버킷 above/below/matched (2026-07-13 사장 "시계열 확장 ㄱㄱ").
//
// 전역 온도 시계열(tempSeries)과 완전히 같은 규칙(직전 거래 = 같은 단지×평형 밴드 60일 내,
// ±1% 중립 — 2026-07-13 사장 확정 유지)을 시군구 단위로 쪼갠 것. 단지는 정확히 한 시군구에
// 속하므로 구별 부분집합으로 매칭해도 전역 매칭과 동일하다(경계 왜곡 없음).
//
// 생산: scripts/build-region-series.ts(주간 크론) → src/data/regionTempSeries.json.
// 소비: 동네면(/r/[sigungu]) [온도 추이] 코너 — TempTrendChart 재사용(그 동네 폭등기·
//   급락기 관측 평균 참조선, 최저점 마커가 자동으로 그 동네 기준이 된다).
// ⚠️ 동네 단위 월 표본은 얇다(수십~수백 건) — 지면 각주에 출렁임 경고 병기 의무.
//
// 순수 함수 — API·파일 접근 없음.

import { bucketTempSeries, type TempSeriesFile, type TempSeriesTx } from "@/lib/tempSeries";

export interface RegionTempSeriesEntry {
  above: number[];
  below: number[];
  matched: number[];
}

export interface RegionTempSeriesFile {
  /** null = placeholder(첫 주간 굽기 전) — 지면은 코너를 조용히 접는다. */
  generatedAt: string | null;
  /** 전역 tempSeries와 같은 창(같은 트리밍) — "YYYY-MM" 오름차순. */
  months: string[];
  /** 시군구 가나다순(결정적 직렬화). 관측 전무 구는 생략. */
  regions: Record<string, RegionTempSeriesEntry>;
}

export type RegionTempSeriesTx = TempSeriesTx & { sigungu: string };

/** 시군구별로 쪼개 전역과 같은 버킷 규칙 적용. 관측(matched) 전무 구는 생략. */
export function bucketRegionTempSeries(
  txs: readonly RegionTempSeriesTx[],
  months: readonly string[],
): Record<string, RegionTempSeriesEntry> {
  const bySig = new Map<string, RegionTempSeriesTx[]>();
  for (const t of txs) {
    const list = bySig.get(t.sigungu) ?? [];
    list.push(t);
    bySig.set(t.sigungu, list);
  }
  const out: Record<string, RegionTempSeriesEntry> = {};
  for (const sig of [...bySig.keys()].sort((a, b) => a.localeCompare(b, "ko"))) {
    const b = bucketTempSeries(bySig.get(sig)!, months);
    if (b.matched.every((m) => m === 0)) continue;
    out[sig] = b;
  }
  return out;
}

/** 지면용 — 시군구 항목을 TempSeriesFile 모양으로(TempTrendChart·tempStory 재사용).
 *  placeholder·미수록이면 null(코너 생략). */
export function regionSeriesFor(
  file: RegionTempSeriesFile,
  sigungu: string,
): TempSeriesFile | null {
  if (!file.generatedAt || file.months.length < 2) return null;
  const e = file.regions[sigungu];
  if (!e) return null;
  return {
    generatedAt: file.generatedAt,
    months: file.months,
    above: e.above,
    below: e.below,
    matched: e.matched,
  };
}
