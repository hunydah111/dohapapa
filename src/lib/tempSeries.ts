// 온도 시계열(최대 5년) — "직전 거래보다 높게 팔린 비율"의 월별(계약월) 버킷
// (2026-07-06 시안 B · 같은 날 사장 지시로 1년 → 최대 5년 확장).
//
// 정의는 오늘의 온도(patchNote.PatchTemp)와 동일 규칙의 월 단위 확장:
//   - 각 유효 거래(해제·직거래·분양권 제외 — 호출부가 걸러 넘긴다)를
//     같은 단지×평형 밴드의 직전 거래와 비교 (계약일 기준 60일 내 — PATCH_PREV_MAX_AGE_DAYS).
//   - ±1%(PATCH_TEMP_NEUTRAL_PCT) 이내는 중립 — above/below 어디에도 안 센다(matched엔 포함).
//   - 버킷 축은 "계약월"(dealDate) — 공개일이 아니다. 지면 각주에 "계약월 기준" 병기 의무.
//
// 기간 계약: months 길이는 고정이 아니다 — 생성 스크립트가 최대 TEMP_SERIES_DEFAULT_MONTHS
//   (5년+당월)를 시도하되, DB에 데이터가 없는 앞쪽 달은 잘라낸다(null 패딩 금지 —
//   months 배열 = 실제 데이터 구간). 소급 수집(백필)이 채워지면 자동으로 길어진다.
//
// 정직성: 이 수치는 실거래 팩트 간 비교(직전 거래 대비)다 — 중위가 추정 아님.
//   단, 최근 달은 신고 지연(최대 30일)으로 미완성 집계라는 한계가 있다 — 매주 갱신되며 채워진다.
//
// 생산: scripts/build-region-series.ts (주간 크론 — DB 접근은 크론에서만) → src/data/tempSeries.json.
// 소비: DailyFront 온도 추이 차트(서버 SVG).
// 순수 함수 — API·파일 접근 없음. 크론 스크립트와 테스트가 같은 함수를 쓴다.

import { PATCH_PREV_MAX_AGE_DAYS, PATCH_TEMP_NEUTRAL_PCT } from "@/lib/patchNote";

/** 기본 버킷 수 — 5년(60) + 당월. 생성 스크립트 --months= 로 오버라이드 가능. */
export const TEMP_SERIES_DEFAULT_MONTHS = 61;

export interface TempSeriesFile {
  /** null = placeholder(첫 주간 갱신 전) — 지면은 차트를 조용히 접는다(게이지 바만). */
  generatedAt: string | null;
  /** "YYYY-MM" 오름차순 — 최대 5년+당월, DB에 있는 구간만(앞쪽 빈 달 잘림. placeholder는 []). */
  months: string[];
  /** months[i] 계약월의 직전 거래 대비 +1% 초과 건수. */
  above: number[];
  /** months[i] 계약월의 직전 거래 대비 −1% 초과 건수. */
  below: number[];
  /** months[i] 계약월에 직전 거래(60일 내)가 존재한 거래 수(중립 포함). */
  matched: number[];
}

/** 집계 입력 1건 — 호출부(크론)가 해제·직거래·분양권을 이미 걸러 넘긴다. */
export interface TempSeriesTx {
  /** 단지×평형 밴드 그룹 키 — 예: `${complexId}|${band}`. 밴드 밖 면적은 호출부가 스킵. */
  groupKey: string;
  /** 자기 자신 제외용 고유 id (DB PK). */
  id: string;
  /** 계약일 YYYY-MM-DD. */
  dealDateISO: string;
  priceKrw: number;
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * 월별 above/below/matched 집계 — patchNote.findPrev와 같은 직전 거래 규칙:
 *   같은 그룹, 계약일이 같거나 이른 것 중 최신(자기 자신 제외 — 같은 날짜 타거래 허용,
 *   같은 날짜 여럿이면 가격 최고 채택 — pct 과대 방지 쪽으로 보수적). 60일 초과 묵은
 *   직전 거래는 비교 무의미 — 미집계.
 * months 밖 계약월 거래는 버킷엔 안 들어가되 "직전 거래 후보"로는 쓰인다
 *   (호출부가 months[0]보다 2개월 이른 거래까지 넘겨야 첫 달 집계가 안 비틀린다).
 */
export function bucketTempSeries(
  txs: readonly TempSeriesTx[],
  months: readonly string[],
): { above: number[]; below: number[]; matched: number[] } {
  const idx = new Map(months.map((ym, i) => [ym, i]));
  const above = months.map(() => 0);
  const below = months.map(() => 0);
  const matched = months.map(() => 0);

  const groups = new Map<string, TempSeriesTx[]>();
  for (const t of txs) {
    if (!(t.priceKrw > 0)) continue;
    const list = groups.get(t.groupKey) ?? [];
    list.push(t);
    groups.set(t.groupKey, list);
  }

  for (const list of groups.values()) {
    for (const tx of list) {
      const mi = idx.get(tx.dealDateISO.slice(0, 7));
      if (mi === undefined) continue; // 버킷 밖 — 직전 거래 후보로만 쓰임
      let best: TempSeriesTx | null = null;
      for (const c of list) {
        if (c.id === tx.id) continue;
        if (c.dealDateISO > tx.dealDateISO) continue;
        if (
          !best ||
          c.dealDateISO > best.dealDateISO ||
          (c.dealDateISO === best.dealDateISO && c.priceKrw > best.priceKrw)
        ) {
          best = c;
        }
      }
      if (!best) continue;
      if (daysBetweenISO(best.dealDateISO, tx.dealDateISO) > PATCH_PREV_MAX_AGE_DAYS) continue;
      const pct = (tx.priceKrw - best.priceKrw) / best.priceKrw;
      matched[mi] += 1;
      if (pct > PATCH_TEMP_NEUTRAL_PCT) above[mi] += 1;
      else if (pct < -PATCH_TEMP_NEUTRAL_PCT) below[mi] += 1;
    }
  }

  return { above, below, matched };
}

/**
 * 앞쪽 빈 달 잘라내기 — monthCounts[i] = months[i] 달의 DB 유효 거래 총수(밴드 무관).
 * 첫 "데이터 있는 달"의 인덱스를 돌려준다(전부 비면 length — 호출부가 빈 파일 처리).
 * DB에 옛 데이터가 없는 구간을 null 패딩 대신 배열에서 제외하기 위한 규칙 —
 * months 배열은 항상 "실제 데이터 구간"이어야 한다(소급 백필이 채우면 자동 연장).
 */
export function trimLeadingEmptyMonths(monthCounts: readonly number[]): number {
  for (let i = 0; i < monthCounts.length; i++) {
    if (monthCounts[i] > 0) return i;
  }
  return monthCounts.length;
}
