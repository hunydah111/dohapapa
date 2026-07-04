// 비집고 패치노트 v0 — "오늘 처음 확인된 실거래"를 **그 단지 자기 시세(단지×평형 중위가)**와
// 대조해 너프(단지 시세 대비 급등 공개)·버프(급락 공개)로 분류한다.
//
// ⚠️ 기준 선택의 이유(2026-07-04 창간호 1차분 교훈): 시군구 중위가 대비로 재면
// "그 동네에서 원래 비싼/싼 단지"가 매일 상위를 도배한다(구조적 이탈 ≠ 뉴스).
// 신고가성/급락성은 반드시 단지 자신의 최근 시세를 기준으로 잰다.
//
// 정직성 규약:
// - MOLIT는 '신고일'을 주지 않는다. "오늘 공개"는 "오늘 폴링에서 처음 확인"의 뜻이며,
//   UI 카피는 반드시 "오늘 공개된/확인된"으로 쓰고 "실시간"이라 말하지 않는다.
// - 계약일(dealDate)이 PATCH_SCOPE_DAYS보다 오래된 거래는 뒷북이므로 다루지 않는다.
//   (신고 지연 30일 규정상 스코프 밖 지연 신고는 존재하지만, '오늘의 변동' 콘텐츠가 아님)
//
// 순수 함수 — API·파일 접근 없음. 크론(scripts/daily-pulse.ts)과 테스트가 같은 함수를 쓴다.

import { bandOfArea } from "@/lib/plan/dday";

/** MolitDeal의 직렬화 가능 서브셋 (bigint → number 변환은 호출부 책임). */
export interface PatchDealInput {
  apartmentName: string;
  /** 계약일 YYYY-MM-DD */
  dealDateISO: string;
  priceKrw: number;
  /** 전용면적 ㎡ */
  area: number;
  sigunguName: string;
  dongName: string;
  floor: number | null;
  /** 거래유형 — "직거래"는 증여성 의심으로 너프/버프 분류에서 제외(스코프·seen엔 포함). */
  dealingGbn?: string;
  /** 해제된 거래 — 스코프에서 아예 제외(유효 거래 아님). */
  canceled?: boolean;
}

export interface ComplexMedianCell {
  medianKrw: number;
  sampleCount: number;
}

/** 거래 → 그 단지×평형의 자기 중위가. 단지를 못 찾으면 null(해당 거래는 스킵). */
export type ComplexMedianLookup = (
  deal: PatchDealInput,
) => ComplexMedianCell | null;

export interface PatchItem {
  kind: "nerf" | "buff";
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  band: string;
  priceKrw: number;
  medianKrw: number;
  /** (price − 단지 자기 중위가) / 단지 자기 중위가. 너프 양수, 버프 음수. */
  pct: number;
  dealDate: string;
}

export interface PatchResult {
  nerf: PatchItem[];
  buff: PatchItem[];
  /** 스코프(최근 계약 14일) 안 거래 수 */
  scopeDealCount: number;
  /** 그중 오늘 처음 확인된 거래 수 */
  newDealCount: number;
  /** 다음 폴링을 위한 seen 키 (스코프 내 전체, 정렬·중복 제거) */
  nextSeenKeys: string[];
}

/** 계약일 기준 스코프 일수 — 이보다 오래된 거래는 패치 대상 아님. */
export const PATCH_SCOPE_DAYS = 14;
/** 단지 자기 시세 대비 이 비율 이상이면 너프/버프로 분류. */
export const PATCH_MIN_PCT = 0.07;
/** 단지 자기 시세에서 이 비율을 넘는 괴리는 노이즈(증여성·특수거래·입력오류 의심)로 컷. */
export const PATCH_NOISE_MAX_PCT = 0.35;
/** 단지×평형 중위가 표본이 이보다 적으면 대조 자체를 신뢰하지 않음(단지 단위라 작게). */
export const PATCH_MIN_SAMPLE = 3;
/** 초저가(원) 컷 — 지분·특수 거래 방어. */
export const PATCH_MIN_PRICE_KRW = 50_000_000;
/** 너프/버프 각각 상위 N건. */
export const PATCH_TOP_N = 5;

/** 거래 동일성 키 — 같은 거래가 매일 재폴링돼도 한 번만 '신규'로 잡히게. */
export function dealKey(d: PatchDealInput): string {
  return [
    d.sigunguName,
    d.apartmentName,
    d.area,
    d.dealDateISO,
    d.priceKrw,
    d.floor ?? "",
  ].join("|");
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function computePatch(opts: {
  deals: PatchDealInput[];
  /** 직전 폴링까지 확인된 거래 키 (없으면 빈 Set = 첫 실행) */
  seenKeys: ReadonlySet<string>;
  lookupMedian: ComplexMedianLookup;
  /** 기준일 YYYY-MM-DD (크론 TZ=Asia/Seoul 기준 오늘) */
  todayISO: string;
  /** 계약일 스코프 오버라이드 — 창간호(부트스트랩)는 3일로 좁혀 씀. 기본 PATCH_SCOPE_DAYS. */
  scopeDays?: number;
}): PatchResult {
  const { deals, seenKeys, lookupMedian, todayISO } = opts;
  const scopeDays = opts.scopeDays ?? PATCH_SCOPE_DAYS;

  // 1) 스코프: 계약일이 오늘로부터 scopeDays 이내 (미래 날짜·해제 거래는 제외)
  const scope = deals.filter((d) => {
    if (d.canceled) return false;
    const age = daysBetweenISO(d.dealDateISO, todayISO);
    return age >= 0 && age <= scopeDays;
  });

  const nextSeenKeys = Array.from(new Set(scope.map(dealKey))).sort();

  // 2) 오늘 처음 확인된 거래
  const fresh = scope.filter((d) => !seenKeys.has(dealKey(d)));

  // 3) 중위가 대조 → 분류
  const classified: PatchItem[] = [];
  for (const d of fresh) {
    // 직거래 = 가족 간 증여성 거래 가능성 — 시세 신호로 안 씀 (특히 급락 버프 오염 방지)
    if (d.dealingGbn === "직거래") continue;
    if (d.priceKrw < PATCH_MIN_PRICE_KRW) continue;
    const band = bandOfArea(d.area);
    if (!band) continue;
    const cell = lookupMedian(d);
    if (!cell || cell.sampleCount < PATCH_MIN_SAMPLE || cell.medianKrw <= 0) continue;

    const pct = (d.priceKrw - cell.medianKrw) / cell.medianKrw;
    if (Math.abs(pct) < PATCH_MIN_PCT || Math.abs(pct) > PATCH_NOISE_MAX_PCT) continue;

    classified.push({
      kind: pct > 0 ? "nerf" : "buff",
      sigungu: d.sigunguName,
      dong: d.dongName,
      apt: d.apartmentName,
      areaM2: d.area,
      band,
      priceKrw: d.priceKrw,
      medianKrw: cell.medianKrw,
      pct,
      dealDate: d.dealDateISO,
    });
  }

  // 4) 같은 단지×평형은 대표 1건만(|pct| 최대) — 도배 방지
  const byComplex = new Map<string, PatchItem>();
  for (const item of classified) {
    const k = `${item.kind}|${item.sigungu}|${item.apt}|${item.band}`;
    const prev = byComplex.get(k);
    if (!prev || Math.abs(item.pct) > Math.abs(prev.pct)) byComplex.set(k, item);
  }

  const ranked = Array.from(byComplex.values()).sort(
    (a, b) => Math.abs(b.pct) - Math.abs(a.pct),
  );

  return {
    nerf: ranked.filter((i) => i.kind === "nerf").slice(0, PATCH_TOP_N),
    buff: ranked.filter((i) => i.kind === "buff").slice(0, PATCH_TOP_N),
    scopeDealCount: scope.length,
    newDealCount: fresh.length,
    nextSeenKeys,
  };
}
