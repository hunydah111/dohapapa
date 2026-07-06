// 동네면 [최근 거래 상위] — 시군구 × 평형 밴드(59㎡급/84㎡급) 최근 60일 TOP10 (v2.4).
//
// 생산: scripts/build-region-series.ts (주간 크론 — DB 접근은 크론에서만)
//   → src/data/regionTop.json (작음, 커밋 — daily-data.yml git add 포함).
// 소비: src/app/r/[sigungu]/page.tsx (빌드 타임 JSON import — 요청당 DB 읽기 0).
//
// 편집 헌장: 이 목록은 "실거래 관측값"이다 — 시세 순위가 아니다. 각주에
// "최근 60일 공개된 중개거래(해제·직거래 제외) · 단지당 대표 1건 · 관측값" 병기 의무.
// 헌장 6조 "조작하지 않는다, 읽는다"(2026-07-06 사장 확정): 탭 강제 금지 — 두 밴드를
// 연속 게재하고, 그 동네 창 내 거래가 더 많은 밴드(deals)를 편집 기본으로 위에 놓는다
// (orderedBandKeys). 눌러야만 보이는 정보가 결론급이면 안 된다.
//
// 대표 1건 규칙: 단지×밴드 그룹에서 창(60일) 내 유효 거래 중 최신 계약일,
//   같은 날 여럿이면 최고가(과대 방지 아님 — "그 단지의 가장 최근 관측"의 대표성 규칙).
// 직전 거래 규칙: patchNote·tempSeries와 동일 — 같은 단지×밴드, 계약일이 같거나 이른 것
//   중 최신(자기 제외 — 같은 날짜 타거래 허용, 같은 날짜 여럿이면 최고가), 60일 초과는 무효.
//
// 밴드 선택: 기존 AreaRangeKey 체계 재사용 — 국민 평형 두 축만.
//   전용 59㎡ → p19_25(46~62㎡), 전용 84㎡ → p32_35(78~89㎡). 라벨은 "59㎡급"/"84㎡급".
//
// 순수 함수 — API·파일 접근 없음. 크론 스크립트와 테스트가 같은 함수를 쓴다.

import { bandOfArea } from "@/lib/plan/dday";
import { PATCH_PREV_MAX_AGE_DAYS } from "@/lib/patchNote";

/** 관측 창 — 최근 60일 공개분(계약일 기준). */
export const REGION_TOP_WINDOW_DAYS = 60;
/** 시군구 × 밴드당 인쇄 상한. */
export const REGION_TOP_LIMIT = 10;

/** 지면 탭 두 개 — 기존 밴드 체계에서 59㎡/84㎡가 속한 밴드. */
export const REGION_TOP_BANDS = [
  { key: "p19_25", label: "59㎡급" },
  { key: "p32_35", label: "84㎡급" },
] as const;
export type RegionTopBandKey = (typeof REGION_TOP_BANDS)[number]["key"];

const BAND_KEYS = new Set<string>(REGION_TOP_BANDS.map((b) => b.key));

/** 집계 입력 1건 — 호출부(크론)가 해제·직거래·분양권을 이미 걸러 넘긴다.
 *  직전 거래 후보를 위해 창보다 60일 이른 거래까지 함께 넘겨야 한다(총 120일). */
export interface RegionTopTx {
  /** 자기 자신 제외용 고유 id (DB PK). */
  id: string;
  complexId: string;
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  priceKrw: number;
  /** 계약일 YYYY-MM-DD. */
  dealDateISO: string;
  floor: number | null;
}

export interface RegionTopItem {
  apt: string;
  dong: string;
  areaM2: number;
  priceKrw: number;
  /** 계약일 YYYY-MM-DD. */
  dealDate: string;
  floor: number | null;
  /** 같은 단지×밴드의 직전 실거래(60일 내) — 없으면 null. 표기엔 항상 날짜 병기. */
  prevKrw: number | null;
  prevDate: string | null;
}

export interface RegionTopBandCell {
  /** 창 내 그 시군구×밴드 유효 거래 총수 — 편집 기본(어느 밴드를 위에) 판정 + 각주용. */
  deals: number;
  /** 가격 내림차순 상위 REGION_TOP_LIMIT (단지당 대표 1건). */
  items: RegionTopItem[];
}

export interface RegionTopFile {
  /** null = placeholder(첫 주간 갱신 전) — 페이지는 안내 문구로 graceful 처리. */
  generatedAt: string | null;
  windowDays: number;
  /** 시군구 → 밴드 → 셀. 빈 밴드/시군구는 생략. */
  regions: Record<string, Partial<Record<RegionTopBandKey, RegionTopBandCell>>>;
}

/**
 * 지면 게재 순서 — 창 내 거래가 더 많은 밴드가 편집 기본(위). 동률은 선언 순서(59→84).
 * 탭 강제 금지 원칙: 호출부는 이 순서대로 두 밴드를 연속 게재한다(접기 없이).
 */
export function orderedBandKeys(
  cells: Partial<Record<RegionTopBandKey, RegionTopBandCell>>,
): RegionTopBandKey[] {
  return REGION_TOP_BANDS.map((b) => b.key)
    .filter((k) => (cells[k]?.items.length ?? 0) > 0)
    .sort((a, b) => (cells[b]?.deals ?? 0) - (cells[a]?.deals ?? 0));
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** "최신 우선, 같은 날짜면 최고가" 비교 — 대표 선정과 직전 거래 선정이 같은 규칙. */
function fresher(a: RegionTopTx, b: RegionTopTx): boolean {
  return (
    a.dealDateISO > b.dealDateISO ||
    (a.dealDateISO === b.dealDateISO && a.priceKrw > b.priceKrw)
  );
}

/**
 * 시군구 × 밴드별 최근 거래 상위. windowStartISO(포함) 이후 계약분이 창.
 *  - 단지×밴드당 대표 1건(창 내 최신·같은 날 최고가) → 가격 내림차순 상위 10.
 *  - 대표의 직전 거래(자기 제외·60일 내)를 prevKrw/prevDate로 병기 — 없으면 null.
 *  - deals = 창 내 그 시군구×밴드 유효 거래 총수(대표로 안 뽑힌 거래 포함).
 *  - 밴드 밖 면적·비양수 가격은 스킵. 빈 밴드·시군구는 결과에서 생략(파일 크기).
 */
export function buildRegionTop(
  txs: readonly RegionTopTx[],
  windowStartISO: string,
): RegionTopFile["regions"] {
  // 단지×밴드 그룹핑 — 직전 거래 후보(창 밖 과거분)도 같은 그룹에 담는다.
  const groups = new Map<string, RegionTopTx[]>();
  // 창 내 유효 거래 총수 — `${sigungu}|${band}` 키.
  const dealCounts = new Map<string, number>();
  for (const t of txs) {
    if (!(t.priceKrw > 0)) continue;
    const band = bandOfArea(t.areaM2);
    if (!band || !BAND_KEYS.has(band)) continue;
    const key = `${t.complexId}|${band}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
    if (t.dealDateISO >= windowStartISO) {
      const ck = `${t.sigungu}|${band}`;
      dealCounts.set(ck, (dealCounts.get(ck) ?? 0) + 1);
    }
  }

  // 그룹 → 대표 1건 + 직전 거래.
  const reps = new Map<string, Map<RegionTopBandKey, RegionTopItem[]>>();
  for (const [key, list] of groups) {
    const band = key.slice(key.indexOf("|") + 1) as RegionTopBandKey;
    let rep: RegionTopTx | null = null;
    for (const t of list) {
      if (t.dealDateISO < windowStartISO) continue; // 창 밖 — 직전 후보로만
      if (!rep || fresher(t, rep)) rep = t;
    }
    if (!rep) continue;

    let prev: RegionTopTx | null = null;
    for (const c of list) {
      if (c.id === rep.id) continue;
      if (c.dealDateISO > rep.dealDateISO) continue;
      if (!prev || fresher(c, prev)) prev = c;
    }
    if (prev && daysBetweenISO(prev.dealDateISO, rep.dealDateISO) > PATCH_PREV_MAX_AGE_DAYS) {
      prev = null; // 60일 초과 묵은 직전 거래는 비교 무의미
    }

    let bands = reps.get(rep.sigungu);
    if (!bands) {
      bands = new Map();
      reps.set(rep.sigungu, bands);
    }
    const items = bands.get(band) ?? [];
    items.push({
      apt: rep.apt,
      dong: rep.dong,
      areaM2: rep.areaM2,
      priceKrw: rep.priceKrw,
      dealDate: rep.dealDateISO,
      floor: rep.floor,
      prevKrw: prev ? prev.priceKrw : null,
      prevDate: prev ? prev.dealDateISO : null,
    });
    bands.set(band, items);
  }

  // 가격 내림차순 상위 10 — 동률은 최신 계약일 우선(안정 정렬용 2차 키).
  const regions: RegionTopFile["regions"] = {};
  for (const sigungu of [...reps.keys()].sort((a, b) => a.localeCompare(b, "ko"))) {
    const bands = reps.get(sigungu)!;
    const out: Partial<Record<RegionTopBandKey, RegionTopBandCell>> = {};
    for (const { key } of REGION_TOP_BANDS) {
      const items = bands.get(key);
      if (!items || items.length === 0) continue;
      out[key] = {
        deals: dealCounts.get(`${sigungu}|${key}`) ?? 0,
        items: items
          .sort((a, b) => b.priceKrw - a.priceKrw || (a.dealDate < b.dealDate ? 1 : -1))
          .slice(0, REGION_TOP_LIMIT),
      };
    }
    if (Object.keys(out).length > 0) regions[sigungu] = out;
  }
  return regions;
}
