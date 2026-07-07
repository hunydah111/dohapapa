// 시군구 5년 전고점/현재/회복률 — 공유 타입 + 순수 집계 함수 (v2.7 회복률 지도).
//
// 생산: scripts/build-region-series.ts (주간 크론 — DB 접근은 크론에서만).
// 소비: 동네판/동네면/1면 회복률 지도 (빌드 타임 JSON import — 요청당 DB 읽기 0). [UI는 다음 단계]
//
// 편집 헌장(regionSeries.ts 6~9행 사상 계승): 이 수치는 "실거래 관측값"이다 — 시세 지수가
// 아니며, 라벨·각주에 반드시 "국토부 실거래 관측 중위(평형 혼합, 해제·직거래 제외) 기준 —
// 시세 지수 아님"을 병기한다. 평형 혼합 중위인 이유(regionSeries.ts 8~9행): 시군구 단위 월
// 표본에서 평형을 분리하면 대부분의 달이 표본 부족으로 비어 버린다 → 혼합 중위 + 각주 명시가
// 정직한 절충. ⚠️ 회복률은 거래된 평형 구성이 시기별로 달라지면 왜곡될 수 있음 → 각주 의무
// "평형 구성 변화로 실제 개별 단지 회복률과 다를 수 있음".
//
// 순수 함수 — API·파일·DB 접근 없음. 크론 스크립트와 테스트가 같은 함수를 쓴다.

import { median, roundManwon, REGION_SERIES_MIN_DEALS } from "@/lib/regionSeries";

/** 전고점 후보가 되려면 그 달 표본이 이 이상이어야 한다 — 한 달 소표본 fluke가 전고점을
 *  정의하는 것 방지(regionSeries의 MIN_DEALS=3보다 보수적으로). */
export const PEAK_MIN_DEALS = 10;

export interface RegionPeakEntry {
  /** 5년 창 내 월별 관측 중위가의 최댓값(원). 전고점. */
  peakKrw: number;
  /** 전고점 월 "YYYY-MM". */
  peakYm: string;
  /** 가장 최근 유효월(관측 중위 non-null)의 중위가(원). */
  currentKrw: number;
  currentYm: string;
  /** currentKrw / peakKrw (0~1+). 1 이상 = 신고점 회복/돌파. */
  recovery: number;
  /** 전고점 이후 저점 중위가(원)와 그 월 — "바닥 대비 반등률" 병기용(선택 필드). */
  troughKrw: number | null;
  troughYm: string | null;
}

export interface RegionPeaksFile {
  generatedAt: string | null;
  /** 관측 창 "YYYY-MM" from~to (각주 병기용). */
  windowFrom: string;
  windowTo: string;
  regions: Record<string, RegionPeakEntry>; // 시군구 풀네임 키
}

/** 집계 입력 1건 — 호출부(크론)가 해제·직거래·분양권을 이미 걸러 넘긴다. */
export interface RegionPeakTx {
  sigungu: string;
  /** "YYYY-MM" (KST 기준 계약월). */
  ym: string;
  priceKrw: number;
}

/**
 * 시군구별 5년 전고점/현재/회복률 집계.
 *
 * months 밖의 거래는 무시. 시군구 × 월 버킷 관측 중위(regionSeries와 동일 규칙 —
 * 평형 혼합 중위·만원 반올림·표본 REGION_SERIES_MIN_DEALS 미만이면 중위 미채택)를 만든 뒤:
 *  - 전고점 = 표본 ≥ PEAK_MIN_DEALS 인 달의 월 중위 최댓값(그 달 인덱스).
 *  - 현재  = 가장 최근 유효월(표본 ≥ REGION_SERIES_MIN_DEALS, 중위 non-null)의 중위.
 *  - trough = 전고점 월 이후~현재 사이 월 중위 최솟값(표본 ≥ REGION_SERIES_MIN_DEALS). 없으면 null.
 *  - 유효월 2개 미만 또는 전고점 후보 0인 시군구는 생략(파일 크기 + 페이지 graceful).
 */
export function computeRegionPeaks(
  rows: readonly RegionPeakTx[],
  months: readonly string[],
): Record<string, RegionPeakEntry> {
  const idx = new Map(months.map((ym, i) => [ym, i]));
  const pools = new Map<string, number[][]>(); // sigungu → months[i]별 가격 풀
  for (const r of rows) {
    const i = idx.get(r.ym);
    if (i === undefined) continue;
    if (!(r.priceKrw > 0)) continue;
    let pool = pools.get(r.sigungu);
    if (!pool) {
      pool = Array.from({ length: months.length }, () => []);
      pools.set(r.sigungu, pool);
    }
    pool[i].push(r.priceKrw);
  }

  const regions: Record<string, RegionPeakEntry> = {};
  // 지면 정렬 안정성 — 시군구 가나다순(regionSeries와 동일).
  for (const sigungu of [...pools.keys()].sort((a, b) => a.localeCompare(b, "ko"))) {
    const pool = pools.get(sigungu)!;
    // 월별 관측 중위(표본 부족이면 null) + 그 달 표본 수 — regionSeries와 동일 규칙.
    const counts = pool.map((p) => p.length);
    const medians = pool.map((p) => {
      if (p.length < REGION_SERIES_MIN_DEALS) return null;
      const m = median(p);
      return m === null ? null : roundManwon(m);
    });

    // 유효월(중위 non-null) 인덱스 — 2개 미만이면 생략.
    const validIdx: number[] = [];
    medians.forEach((v, i) => {
      if (v !== null) validIdx.push(i);
    });
    if (validIdx.length < 2) continue;

    // 전고점 — 표본 ≥ PEAK_MIN_DEALS 인 달의 월 중위 최댓값. 후보 0이면 생략.
    let peakIdx = -1;
    let peakKrw = -1;
    for (const i of validIdx) {
      if (counts[i] < PEAK_MIN_DEALS) continue; // 소표본 fluke 방지
      const v = medians[i]!;
      if (v > peakKrw) {
        peakKrw = v;
        peakIdx = i;
      }
    }
    if (peakIdx < 0) continue; // 전고점 후보 없음 — 생략

    // 현재 — 가장 최근 유효월(표본 ≥ MIN_DEALS 는 유효월 정의에 이미 포함).
    const currentIdx = validIdx[validIdx.length - 1];
    const currentKrw = medians[currentIdx]!;

    // trough — 전고점 월 이후 ~ 현재 사이 월 중위 최솟값(유효월만). 없으면 null.
    let troughIdx = -1;
    let troughKrw = Infinity;
    for (const i of validIdx) {
      if (i <= peakIdx || i > currentIdx) continue; // (전고점, 현재] 사이만
      const v = medians[i]!;
      if (v < troughKrw) {
        troughKrw = v;
        troughIdx = i;
      }
    }

    regions[sigungu] = {
      peakKrw,
      peakYm: months[peakIdx],
      currentKrw,
      currentYm: months[currentIdx],
      recovery: currentKrw / peakKrw,
      troughKrw: troughIdx >= 0 ? troughKrw : null,
      troughYm: troughIdx >= 0 ? months[troughIdx] : null,
    };
  }
  return regions;
}

// ── UI 소비용 순수 헬퍼(랭킹·밴드·TOP) — 동네판/동네면/1면 회복률 지도가 공유. ─────────
//
// 편집 헌장 ⑤(아래를 때리지 않는다): 랭킹은 "본인 N위" + "회복 상위 TOP5"만 노출.
// 하위/워스트 실명 랭킹은 절대 만들지 않는다 — topRecovered 는 상위만, rankOf 는 본인 조회용.

/** 회복률 밴드 4단계(시세 방향색 문법) — 인덱스가 곧 농담 단계.
 *  3 = 신고점 돌파(≥100%, 진한 UP빨강) / 2 = 90~100%(UP빨강) /
 *  1 = 75~90%(연 DOWN파랑) / 0 = <75%(진한 DOWN파랑). */
export type RecoveryBand = 0 | 1 | 2 | 3;

/** 회복률(recovery, 0~1+) → 밴드. 경계는 신고점 100% · 90% · 75%(스펙 §5·§3.2). */
export function recoveryBand(recovery: number): RecoveryBand {
  if (recovery >= 1) return 3;
  if (recovery >= 0.9) return 2;
  if (recovery >= 0.75) return 1;
  return 0;
}

/** 회복률 내림차순 정렬 키(시군구명 포함) — 동률은 시군구 가나다순으로 안정 정렬. */
export function rankByRecovery(
  regions: Record<string, RegionPeakEntry>,
): { sigungu: string; entry: RegionPeakEntry }[] {
  return Object.entries(regions)
    .map(([sigungu, entry]) => ({ sigungu, entry }))
    .sort((a, b) => {
      if (b.entry.recovery !== a.entry.recovery) return b.entry.recovery - a.entry.recovery;
      return a.sigungu.localeCompare(b.sigungu, "ko");
    });
}

/** 본인 순위 — "82곳 중 N위"의 N(1-based)과 총 M. 동률은 같은 순위를 공유(경쟁 랭킹).
 *  해당 시군구가 regions 에 없으면 null(호출부가 회복률 줄 전체 생략). */
export function rankOf(
  regions: Record<string, RegionPeakEntry>,
  sigungu: string,
): { rank: number; total: number } | null {
  const target = regions[sigungu];
  if (!target) return null;
  const total = Object.keys(regions).length;
  // 동률 경쟁 랭킹 — 나보다 회복률이 "엄격히 높은" 동네 수 + 1.
  let higher = 0;
  for (const e of Object.values(regions)) {
    if (e.recovery > target.recovery) higher += 1;
  }
  return { rank: higher + 1, total };
}

/** 가장 빨리 회복한 동네 TOP N(회복률 상위, 신고점 돌파 우선 자동 반영 — 내림차순).
 *  하위/워스트는 절대 반환하지 않는다(헌장 ⑤). 기본 5. */
export function topRecovered(
  regions: Record<string, RegionPeakEntry>,
  n = 5,
): { sigungu: string; entry: RegionPeakEntry }[] {
  return rankByRecovery(regions).slice(0, Math.max(0, n));
}
