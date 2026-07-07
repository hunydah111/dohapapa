// 동네판(내 동네 브리핑) 데이터 — 순수 집계 함수 (v2.6).
//
// 생산: 서버 컴포넌트(LocalFrontHost)가 빌드 타임 JSON(dailyPatch·dailyRecent·regionTop·
//   regionSeries)을 이 함수로 "82개 시군구 전부의 압축 브리핑"으로 줄여 클라이언트에 넘긴다.
//   시군구 선택이 기기(localStorage)에만 있어 서버는 어느 동네인지 모른다 — 전 동네분을
//   압축해 내려보내고 클라이언트가 고른다. 원본 JSON(dailyRecent 320KB·regionTop 260KB)을
//   클라이언트 번들에 직접 실으면 무거워서 여기서 필요한 필드만 발췌한다.
// 소비: src/components/LocalFront.tsx (클라이언트 — briefFor 로 동네 1곳 뷰 도출).
//
// 편집 헌장: 인쇄되는 건 팩트뿐 — 등락은 직전 실거래 대비(pctVsPrev)만, 중위가 추정치
// 노출 금지. 강세 행은 1면과 동일한 오보 게이트(passesStrongGate) 통과분만.
// "이번 주" 같은 과장 라벨 금지 — dailyRecent 는 오늘 포함 최근 3일 롤링이므로
// 라벨은 "최근 {N}일"로 기준을 그대로 병기한다.
//
// 순수 함수 — API·파일·localStorage 접근 없음. 서버 호스트와 테스트가 같은 함수를 쓴다.

import {
  passesStrongGate,
  type BusiestRegion,
  type MajorItem,
  type PatchDealInput,
  type PatchItem,
  type RegionPulse,
} from "@/lib/patchNote";
import {
  REGION_TOP_BANDS,
  orderedBandKeys,
  type RegionTopFile,
} from "@/lib/regionTop";
import {
  regionSeriesSummary,
  type RegionSeriesFile,
  type RegionSeriesSummary,
} from "@/lib/regionSeries";

/** [오늘 이 동네] 주요·강세 행 상한 — 첫 뷰포트(375px) 무스크롤 완결을 지키는 값. */
export const LOCAL_ROW_LIMIT = 3;
/** [최근 거래 상위] 동네판 상한 — 동네면(TOP10)의 발췌판. */
export const LOCAL_TOP_LIMIT = 5;

/** 주요 거래 행 — MajorItem 발췌(동네판 조판에 필요한 필드만).
 *  refMax* = 기준점 최고가(1면 서브라인과 동일 팩트) — "최근 {기간} 최고 대비 −x%" 병기용. */
export interface LocalMajorRow {
  dong: string;
  apt: string;
  areaM2: number;
  priceKrw: number;
  dealDate: string;
  floor: number | null;
  refMaxKrw: number | null;
  refMaxPeriod: "1년" | "2개월" | null;
}

/** 강세 거래 행 — 게이트 통과 PatchItem 발췌. 비교 팩트(직전 거래) 병기 의무. */
export interface LocalStrongRow {
  dong: string;
  apt: string;
  areaM2: number;
  priceKrw: number;
  dealDate: string;
  prevKrw: number;
  prevDate: string;
  prevFloor: number | null;
  pctVsPrev: number;
}

/** [최근 거래 상위] 행 — RegionTopItem 발췌. */
export interface LocalTopRow {
  dong: string;
  apt: string;
  areaM2: number;
  priceKrw: number;
  dealDate: string;
  floor: number | null;
  prevKrw: number | null;
  prevDate: string | null;
}

/** 오늘(발행분) 그 동네 최고가 거래 — 라이벌 미니보드용 팩트. */
export interface LocalTodayMax {
  apt: string;
  areaM2: number;
  priceKrw: number;
}

/** buildLocalFrontData 입력의 dailyPatch 서브셋 — 렌더에 필요한 필드만(구 스키마 optional). */
export interface LocalPatchInput {
  generatedAt: string | null;
  mode?: "bootstrap" | "daily" | "merged";
  mergedFromDate?: string | null;
  mergedToDate?: string | null;
  nerf: PatchItem[];
  major?: MajorItem[];
  weakRegions?: RegionPulse[];
  strongRegions?: RegionPulse[];
  busiestRegions?: BusiestRegion[];
  regionCounts?: Record<string, number>;
}

/** dailyRecent.json 의 하루 묶음. */
export interface RecentDay {
  date: string;
  items: PatchDealInput[];
}

/** 서버 → 클라이언트로 내려가는 동네판 데이터(82개 시군구 전부, 압축). */
export interface LocalFrontData {
  generatedAt: string | null;
  mode: "bootstrap" | "daily" | "merged" | null;
  mergedFromDate: string | null;
  mergedToDate: string | null;
  /** 이번 판 공개 건수(시군구별) — dailyPatch.regionCounts 그대로(직거래 포함 공개 팩트). */
  regionCounts: Record<string, number>;
  /** [오늘 이 동네] 주요 거래(15억+) — 시군구별 상한 LOCAL_ROW_LIMIT + 총건수. */
  majors: Record<string, { rows: LocalMajorRow[]; total: number }>;
  /** [오늘 이 동네] 강세 거래 — 오보 게이트 통과분만, 시군구별 상한 + 총건수. */
  strongs: Record<string, { rows: LocalStrongRow[]; total: number }>;
  /** 직전 실거래 대비 시군구 평균 등락 — strong/weakRegions 합본(문턱 통과 동네만 존재). */
  pulses: Record<string, { avgPct: number; count: number }>;
  /** 최근 며칠(dailyRecent 롤링) 유효 공개 합산 — 0건 동네 폴백 문구용. */
  recentCounts: Record<string, number>;
  /** recentCounts 가 덮는 일수 — 라벨 "최근 {N}일" 기준점 병기용. */
  recentDaysCount: number;
  /** 이번 판(발행일·merged 면 합산 구간) 시군구별 최고가 중개거래 — 라이벌 보드 팩트. */
  todayMax: Record<string, LocalTodayMax>;
  /** [최근 거래 상위] — 거래 많은 밴드(편집 기본) 상위 LOCAL_TOP_LIMIT 발췌. */
  tops: Record<string, { bandLabel: string; deals: number; items: LocalTopRow[] }>;
  /** [12개월 추이] 요약 한 줄 — regionSeriesSummary 결과(유효 월 2개 미만 동네는 생략). */
  seriesSummaries: Record<string, RegionSeriesSummary>;
}

/** 이번 판이 덮는 계약 공개일 집합 — daily 는 발행일 하루, merged 는 합산 구간.
 *  dailyRecent 의 day.date(폴링 확인일)와 대조해 todayMax 풀을 고른다. */
export function issueDates(patch: {
  generatedAt: string | null;
  mode?: string;
  mergedFromDate?: string | null;
  mergedToDate?: string | null;
}): (date: string) => boolean {
  if (patch.generatedAt === null) return () => false;
  if (patch.mode === "merged" && patch.mergedFromDate && patch.mergedToDate) {
    const from = patch.mergedFromDate;
    const to = patch.mergedToDate;
    return (date) => date >= from && date <= to;
  }
  const today = patch.generatedAt;
  return (date) => date === today;
}

/** 가격 신호로 쓸 수 있는 아이템인지 — 해제·직거래 제외(1면 주요·강세와 동일 기준). */
function isPriceFact(d: PatchDealInput): boolean {
  return d.canceled !== true && d.dealingGbn !== "직거래";
}

/** dailyPatch·dailyRecent·regionTop·regionSeries → 동네판 압축 데이터(전 시군구). */
export function buildLocalFrontData(opts: {
  patch: LocalPatchInput;
  recentDays: readonly RecentDay[];
  regionTop: RegionTopFile;
  series: RegionSeriesFile;
}): LocalFrontData {
  const { patch, recentDays, regionTop, series } = opts;

  // ── 주요 거래(15억+) — 시군구별 발췌(상한 LOCAL_ROW_LIMIT, 입력은 가격 내림차순). ──
  const majors: LocalFrontData["majors"] = {};
  for (const m of patch.major ?? []) {
    const cell = (majors[m.sigungu] ??= { rows: [], total: 0 });
    cell.total += 1;
    if (cell.rows.length < LOCAL_ROW_LIMIT) {
      cell.rows.push({
        dong: m.dong,
        apt: m.apt,
        areaM2: m.areaM2,
        priceKrw: m.priceKrw,
        dealDate: m.dealDate,
        floor: m.floor ?? null,
        refMaxKrw: m.windowMaxKrw ?? null,
        refMaxPeriod: m.refMaxPeriod ?? null,
      });
    }
  }

  // ── 강세 거래 — 1면과 동일 오보 게이트(직전 팩트 + 이중 합의 + 상한 컷) 재적용. ──
  const strongs: LocalFrontData["strongs"] = {};
  for (const i of patch.nerf) {
    if (i.prevDate == null || !passesStrongGate(i)) continue;
    const cell = (strongs[i.sigungu] ??= { rows: [], total: 0 });
    cell.total += 1;
    if (cell.rows.length < LOCAL_ROW_LIMIT) {
      cell.rows.push({
        dong: i.dong,
        apt: i.apt,
        areaM2: i.areaM2,
        priceKrw: i.priceKrw,
        dealDate: i.dealDate,
        prevKrw: i.prevKrw!,
        prevDate: i.prevDate,
        prevFloor: i.prevFloor ?? null,
        pctVsPrev: i.pctVsPrev!,
      });
    }
  }

  // ── 시군구 평균 등락 — 강세·약세 집계 합본(둘 다 문턱 5건·±1% 통과 동네만 존재). ──
  const pulses: LocalFrontData["pulses"] = {};
  for (const r of [...(patch.strongRegions ?? []), ...(patch.weakRegions ?? [])]) {
    pulses[r.sigungu] = { avgPct: r.avgPct, count: r.count };
  }

  // ── 최근 며칠 합산(0건 폴백) + 이번 판 최고가(라이벌 보드) ──
  const recentCounts: Record<string, number> = {};
  const todayMax: Record<string, LocalTodayMax> = {};
  const inIssue = issueDates(patch);
  for (const day of recentDays) {
    for (const d of day.items) {
      if (d.canceled === true) continue; // 해제는 공개 건수에서도 제외(유효 거래 아님)
      recentCounts[d.sigunguName] = (recentCounts[d.sigunguName] ?? 0) + 1;
      // 최고가는 가격 팩트 — 직거래(증여성 의심)까지 제외, 이번 판 확인분만.
      if (!inIssue(day.date) || !isPriceFact(d)) continue;
      const cur = todayMax[d.sigunguName];
      if (!cur || d.priceKrw > cur.priceKrw) {
        todayMax[d.sigunguName] = {
          apt: d.apartmentName,
          areaM2: d.area,
          priceKrw: d.priceKrw,
        };
      }
    }
  }

  // ── [최근 거래 상위] — 편집 기본 밴드(거래 많은 쪽)의 상위 5 발췌. ──
  const tops: LocalFrontData["tops"] = {};
  if (regionTop.generatedAt !== null) {
    for (const [sigungu, cells] of Object.entries(regionTop.regions)) {
      const key = orderedBandKeys(cells)[0];
      if (!key) continue;
      const cell = cells[key]!;
      const band = REGION_TOP_BANDS.find((b) => b.key === key)!;
      tops[sigungu] = {
        bandLabel: band.label,
        deals: cell.deals,
        items: cell.items.slice(0, LOCAL_TOP_LIMIT).map((it) => ({
          dong: it.dong,
          apt: it.apt,
          areaM2: it.areaM2,
          priceKrw: it.priceKrw,
          dealDate: it.dealDate,
          floor: it.floor,
          prevKrw: it.prevKrw,
          prevDate: it.prevDate,
        })),
      };
    }
  }

  // ── [12개월 추이] 요약 — 유효 월 2개 미만 동네는 생략(regionSeriesSummary null). ──
  const seriesSummaries: Record<string, RegionSeriesSummary> = {};
  if (series.generatedAt !== null && series.months.length > 0) {
    for (const [sigungu, entry] of Object.entries(series.regions)) {
      const s = regionSeriesSummary(series.months, entry);
      if (s) seriesSummaries[sigungu] = s;
    }
  }

  return {
    generatedAt: patch.generatedAt,
    mode: patch.mode ?? null,
    mergedFromDate: patch.mergedFromDate ?? null,
    mergedToDate: patch.mergedToDate ?? null,
    regionCounts: patch.regionCounts ?? {},
    majors,
    strongs,
    pulses,
    recentCounts,
    recentDaysCount: recentDays.length,
    todayMax,
    tops,
    seriesSummaries,
  };
}

/** 동네 1곳의 브리핑 뷰 — 클라이언트가 구독 시군구로 도출한다. 없는 데이터는 null/0. */
export interface RegionBrief {
  sigungu: string;
  /** 이번 판 공개 건수(직거래 포함 공개 팩트) — 0이면 폴백 문구. */
  todayCount: number;
  majors: { rows: LocalMajorRow[]; total: number };
  strongs: { rows: LocalStrongRow[]; total: number };
  /** 직전 실거래 대비 평균 등락 — 집계 문턱(5건·±1%) 미달 동네는 null(생략). */
  pulse: { avgPct: number; count: number } | null;
  /** 최근 recentDaysCount 일 유효 공개 합산. */
  recentCount: number;
  /** 이번 판 최고가 중개거래 — 없으면 null. */
  todayMax: LocalTodayMax | null;
  top: { bandLabel: string; deals: number; items: LocalTopRow[] } | null;
  seriesSummary: RegionSeriesSummary | null;
}

/** 데이터 묶음에서 동네 1곳 브리핑 도출 — 순수 셀렉터. */
export function briefFor(data: LocalFrontData, sigungu: string): RegionBrief {
  return {
    sigungu,
    todayCount: data.regionCounts[sigungu] ?? 0,
    majors: data.majors[sigungu] ?? { rows: [], total: 0 },
    strongs: data.strongs[sigungu] ?? { rows: [], total: 0 },
    pulse: data.pulses[sigungu] ?? null,
    recentCount: data.recentCounts[sigungu] ?? 0,
    todayMax: data.todayMax[sigungu] ?? null,
    top: data.tops[sigungu] ?? null,
    seriesSummary: data.seriesSummaries[sigungu] ?? null,
  };
}

/** 콜드스타트 예시 동네 — 이번 판 최다 공개 동네(동률은 가나다). 발행 전·0건이면 null. */
export function pickColdStartSigungu(data: LocalFrontData): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [sigungu, count] of Object.entries(data.regionCounts)) {
    if (
      count > bestCount ||
      (count === bestCount && best !== null && sigungu.localeCompare(best, "ko") < 0)
    ) {
      best = sigungu;
      bestCount = count;
    }
  }
  return best;
}
