// 비집고 패치노트 v0 — "오늘 처음 확인된 실거래"를 **그 단지 자기 시세(단지×평형 중위가)**와
// 대조해 너프(단지 시세 대비 급등 공개)·버프(급락 공개)로 분류한다.
//
// ⚠️ 기준 선택의 이유(2026-07-04 창간호 1차분 교훈): 시군구 중위가 대비로 재면
// "그 동네에서 원래 비싼/싼 단지"가 매일 상위를 도배한다(구조적 이탈 ≠ 뉴스).
// 신고가성/급락성 "선별"은 단지 자신의 최근 중위가 기준으로 잰다.
//
// ⚠️ 노출 기준(2026-07-06 사장 지시): 중위가는 우리 "추정치"라 화면에 시세로 단정
// 노출하면 위험하다("니가 제일 모르는 게 시세"). 그래서
//   - 중위가(pct)   = 내부 선별 필터 전용 (±7% 문턱·노이즈컷) — 화면 노출 금지
//   - 직전 실거래(pctVsPrev)·1년/두 달 최고가 = 화면에 노출하는 비교 팩트
// 비교는 같은 단지×밴드의 최근 60일 내 직전 실거래 기준, 표기엔 항상 날짜 병기.
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
  /** 건축년도 — 신축 첫 실거래 헤드라인 판정용. MOLIT 미제공 시 null. */
  buildYear?: number | null;
}

export interface ComplexMedianCell {
  medianKrw: number;
  sampleCount: number;
  /** 최근 1년 실거래 최고가(원) — 주간 스냅샷(complexSnapshot)의 maxKrw.
   *  구 스냅샷(다음 주간 갱신 전)엔 없으므로 optional — 없으면 최고가 갱신 판정 생략. */
  maxKrw?: number | null;
  /** 단지 좌표(스냅샷 latitude/longitude) — 행 미니맵·카카오맵 링크용. 미등재면 null. */
  lat?: number | null;
  lng?: number | null;
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
  /** (price − 단지 자기 중위가) / 단지 자기 중위가. 너프 양수, 버프 음수.
   *  ⚠️ 내부 선별 필터 전용 — 중위가는 우리 추정치라 화면에 "시세"로 단정 노출 금지
   *  (2026-07-06 사장 지시). 화면 노출은 pctVsPrev(직전 실거래 팩트)만 쓴다. */
  pct: number;
  dealDate: string;
  /** 그 단지×평형의 최근 1년 실거래 최고가(원) — 헤드라인 "1년 최고가 갱신" 판정용.
   *  스냅샷이 아직 maxKrw 를 안 주면 null/undefined (구 스키마 호환). */
  maxKrw?: number | null;
  /** 같은 단지×밴드의 직전 실거래가(원) — 60일 내(PATCH_PREV_MAX_AGE_DAYS). 없으면 null. */
  prevKrw?: number | null;
  /** 직전 실거래 계약일 YYYY-MM-DD — 비교 표기엔 항상 날짜 병기(사장 지시). */
  prevDate?: string | null;
  /** (price − prevKrw) / prevKrw — 화면 노출용 등락(실거래 팩트 기준). prev 없으면 null. */
  pctVsPrev?: number | null;
  /** 폴링창(window) 내 같은 단지×밴드 자기 제외 최고가 — "두 달 내 최고가" rung 판정용. */
  windowMaxKrw?: number | null;
  /** 단지 좌표 — 행 미니맵·카카오맵 링크용. 스냅샷 미등재(신축 등)면 null. */
  lat?: number | null;
  lng?: number | null;
}

/** 시군구 단위 하루 집계 — fresh 중개거래 중 직전 거래(60일 내)가 존재하는 거래의
 *  직전 실거래 대비 평균 등락(pctVsPrev 평균). 팩트 기준 — 중위가 추정 아님. */
export interface RegionPulse {
  sigungu: string;
  /** 직전 실거래 대비 평균 등락률(소수). 약세 음수, 강세 양수. */
  avgPct: number;
  /** 집계에 들어간(직전 거래 존재) 거래 수. */
  count: number;
}

/** [주요 거래] 코너 아이템 — 오늘 공개된 수도권 15억 이상 중개거래 전부. */
export interface MajorItem {
  sigungu: string;
  dong: string;
  apt: string;
  areaM2: number;
  priceKrw: number;
  dealDate: string;
  /** 단지 자기 시세 대비 이탈률(소수) — lookup 가능·표본 충분할 때만, 아니면 null. */
  pct: number | null;
  /** 건축년도 — 신축 첫 실거래 판정용. 미제공 null. */
  buildYear: number | null;
  /** 단지 자기 중위가 lookup 성공 시 그 표본수, 실패 시 null("거래 이력 없는 단지" 신호). */
  sampleCount: number | null;
  /** 같은 단지×밴드의 직전 실거래가(원) — 60일 내. 없으면 null. */
  prevKrw?: number | null;
  /** 직전 실거래 계약일 YYYY-MM-DD. */
  prevDate?: string | null;
  /** (price − prevKrw) / prevKrw — 실거래 팩트 기준 등락. prev 없으면 null. */
  pctVsPrev?: number | null;
  /** 기준점 최고가(원) — 행 서브라인 "최근 {기간} 최고" 비교용. 스냅샷 1년 최고가
   *  (maxKrw)가 있으면 그것을 우선(refMaxPeriod="1년"), 없으면 폴링창 내 자기 제외
   *  최고가(refMaxPeriod="2개월"). 비교 대상 자체가 없으면 null → 서브라인 생략. */
  windowMaxKrw?: number | null;
  /** 기준점 최고가의 계약일 — "2개월"(폴링창)일 때만. 스냅샷 "1년"은 날짜 미보관 → null. */
  windowMaxDate?: string | null;
  /** 기준점 기간 라벨 — UI 가 "1년/2개월"을 알 수 있게. */
  refMaxPeriod?: "1년" | "2개월" | null;
  /** 단지 좌표 — 행 미니맵·카카오맵 링크용. 스냅샷 미등재(신축 첫거래 등)면 null. */
  lat?: number | null;
  lng?: number | null;
}

/** 오늘의 온도 — 직전 실거래 대비(팩트 기준). fresh 중개거래 중 같은 단지×밴드에
 *  60일 내 직전 거래가 존재하는 것만 집계한다 (중위가 추정치 기준 폐기 — 2026-07-06). */
export interface PatchTemp {
  /** 직전 실거래보다 +1% 초과 높게 거래된 건수. */
  above: number;
  /** 직전 실거래보다 −1% 초과 낮게 거래된 건수. */
  below: number;
  /** 직전 거래가 존재한 거래 수(±1% 이내 중립 포함 — above/below 어디에도 안 셈). */
  matched: number;
}

export interface PatchResult {
  nerf: PatchItem[];
  /** 급락 실명 리스트 — UI 게재 폐지(특정 단지 비하 금지, 2026-07-06 사장 지시).
   *  데이터엔 남긴다(추후 분석용) — 렌더는 하지 않는다. */
  buff: PatchItem[];
  /** 오늘 공개된 15억 이상 중개거래 전부 — 가격 내림차순. */
  major: MajorItem[];
  /** 오늘의 온도 — matched < 30(표본 부족)이면 null. */
  temp: PatchTemp | null;
  /** [약세 동네] — 시군구별 평균 이탈률 avgPct ≤ −1%·표본 5건 이상, 약세 순 상위 3. */
  weakRegions: RegionPulse[];
  /** 대칭 집계(avgPct ≥ +1%) — 데이터용. UI 는 [강세 거래] 실명이 이미 담당하므로 비게재. */
  strongRegions: RegionPulse[];
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
/** 상승(너프) 노이즈 컷 — 이 비율 초과 괴리는 입력오류·특수거래 의심으로 제외. */
export const PATCH_NOISE_MAX_UP = 0.35;
/** 하락(버프) 노이즈 컷 — 비대칭으로 더 엄격. 중개거래 표기여도 −30% 초과 급락은
 *  증여성 의심이라 코너에서도 제외 (2026-07-04 사장 지시). */
export const PATCH_NOISE_MAX_DOWN = 0.3;
/** @deprecated PATCH_NOISE_MAX_UP / PATCH_NOISE_MAX_DOWN 비대칭 컷으로 분리됨. */
export const PATCH_NOISE_MAX_PCT = PATCH_NOISE_MAX_UP;
/** [주요 거래] 코너 하한 — 오늘 공개된 수도권 이 가격 이상 중개거래는 전부 싣는다. */
export const PATCH_MAJOR_MIN_PRICE_KRW = 1_500_000_000;
/** 오늘의 온도 최소 표본 — 직전 실거래 대비(팩트 기준)로 재정의하며 30→20으로 완화
 *  (직전 거래 존재 요건 때문에 표본이 줄어듦). 이보다 적으면 온도 비표시(null). */
export const PATCH_TEMP_MIN_MATCHED = 20;
/** 오늘의 온도 중립 밴드 — 직전 실거래 ±1% 이내는 위/아래 어느 쪽에도 안 센다. */
export const PATCH_TEMP_NEUTRAL_PCT = 0.01;
/** 직전 거래 비교 유효기간(일) — 계약일 기준 이보다 묵은 직전 거래는 비교 무의미라
 *  prev 없음(null)으로 처리 ("직전 거래가 5년 전이면 비교가 무의미" — 사장 지적 2026-07-06).
 *  현 폴링창(2개월)에선 사실상 자동이지만, 추후 스냅샷 lastKrw 등 더 긴 이력 소스를
 *  붙여도 이 규칙이 코드 레벨에서 강제되도록 명문화한다. */
export const PATCH_PREV_MAX_AGE_DAYS = 60;
/** 단지×평형 중위가 표본이 이보다 적으면 대조 자체를 신뢰하지 않음(단지 단위라 작게). */
export const PATCH_MIN_SAMPLE = 3;
/** 초저가(원) 컷 — 지분·특수 거래 방어. */
export const PATCH_MIN_PRICE_KRW = 50_000_000;
/** 너프/버프 각각 상위 N건. */
export const PATCH_TOP_N = 5;
/** [약세/강세 동네] 시군구 집계 — 대조 성공 거래가 이보다 적은 동네는 안 실음. */
export const PATCH_REGION_MIN_COUNT = 5;
/** [약세/강세 동네] 평균 이탈률 문턱(절대값) — 이보다 완만하면 중립으로 보고 생략. */
export const PATCH_REGION_MIN_AVG_PCT = 0.01;
/** [약세/강세 동네] 상위 N개 동네. */
export const PATCH_REGION_TOP_N = 3;

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

  // 0) 직전 거래 타임라인 — canceled 만 제외한 window "전체"(스코프 이전 거래 포함).
  //    화면에 노출하는 비교 기준은 우리 추정(중위가 "시세")이 아니라 실거래 팩트(직전 거래)
  //    — "니가 제일 모르는 게 시세" (2026-07-06 사장 지시).
  type TimelineDeal = { selfKey: string; dateISO: string; priceKrw: number };
  const bandKeyOf = (d: PatchDealInput): string | null => {
    const band = bandOfArea(d.area);
    return band ? `${d.sigunguName}|${d.apartmentName}|${band}` : null;
  };
  const timeline = new Map<string, TimelineDeal[]>();
  for (const d of deals) {
    if (d.canceled) continue;
    const k = bandKeyOf(d);
    if (!k) continue;
    const list = timeline.get(k) ?? [];
    list.push({ selfKey: dealKey(d), dateISO: d.dealDateISO, priceKrw: d.priceKrw });
    timeline.set(k, list);
  }
  /** 직전 거래 — 같은 단지×밴드, 계약일이 같거나 이른 것 중 최신. 자기 자신(동일 dealKey)
   *  제외, 같은 날짜 타거래는 층이 달라도 허용. 같은 날짜가 여럿이면 가격 최고를 채택
   *  (결정적이면서 pctVsPrev 과대 방지 쪽으로 보수적). 계약일 기준
   *  PATCH_PREV_MAX_AGE_DAYS(60일)보다 묵은 직전 거래는 비교 무의미 — null. */
  const findPrev = (
    d: PatchDealInput,
  ): { prevKrw: number; prevDate: string } | null => {
    const k = bandKeyOf(d);
    if (!k) return null;
    const list = timeline.get(k);
    if (!list) return null;
    const self = dealKey(d);
    let best: TimelineDeal | null = null;
    for (const c of list) {
      if (c.selfKey === self) continue;
      if (c.dateISO > d.dealDateISO) continue;
      if (
        !best ||
        c.dateISO > best.dateISO ||
        (c.dateISO === best.dateISO && c.priceKrw > best.priceKrw)
      ) {
        best = c;
      }
    }
    if (!best) return null;
    if (daysBetweenISO(best.dateISO, d.dealDateISO) > PATCH_PREV_MAX_AGE_DAYS) return null;
    return { prevKrw: best.priceKrw, prevDate: best.dateISO };
  };
  /** window 내 같은 단지×밴드의 자기 제외 최고가(+계약일) — "두 달 내 최고가" rung
   *  판정과 [주요 거래] 기준점 서브라인용. 동가면 계약일 최신 채택. */
  const findWindowMax = (
    d: PatchDealInput,
  ): { priceKrw: number; dateISO: string } | null => {
    const k = bandKeyOf(d);
    if (!k) return null;
    const list = timeline.get(k);
    if (!list) return null;
    const self = dealKey(d);
    let mx: TimelineDeal | null = null;
    for (const c of list) {
      if (c.selfKey === self) continue;
      if (
        !mx ||
        c.priceKrw > mx.priceKrw ||
        (c.priceKrw === mx.priceKrw && c.dateISO > mx.dateISO)
      ) {
        mx = c;
      }
    }
    return mx ? { priceKrw: mx.priceKrw, dateISO: mx.dateISO } : null;
  };

  // 1) 스코프: 계약일이 오늘로부터 scopeDays 이내 (미래 날짜·해제 거래는 제외)
  const scope = deals.filter((d) => {
    if (d.canceled) return false;
    const age = daysBetweenISO(d.dealDateISO, todayISO);
    return age >= 0 && age <= scopeDays;
  });

  const nextSeenKeys = Array.from(new Set(scope.map(dealKey))).sort();

  // 2) 오늘 처음 확인된 거래
  const fresh = scope.filter((d) => !seenKeys.has(dealKey(d)));

  // 3) 중위가 대조 → 분류 (+ 주요 거래 · 오늘의 온도 동시 집계)
  const classified: PatchItem[] = [];
  const major: MajorItem[] = [];
  let tempAbove = 0;
  let tempBelow = 0;
  let tempMatched = 0;
  // 시군구별 등락 집계 — fresh 중개거래 중 직전 거래(60일 내) 존재분의 pctVsPrev 평균.
  const regionAgg = new Map<string, { sum: number; count: number }>();
  for (const d of fresh) {
    // 직거래 = 가족 간 증여성 거래 가능성 — 가격 신호로 안 씀 (특히 급락 버프 오염 방지)
    if (d.dealingGbn === "직거래") continue;
    if (d.priceKrw < PATCH_MIN_PRICE_KRW) continue;

    // 직전 거래 팩트 — 화면 노출용 비교 기준(온도·동네 집계·강세 행·헤드라인).
    const prev = findPrev(d);
    const pctVsPrev = prev ? (d.priceKrw - prev.prevKrw) / prev.prevKrw : null;

    // 중위가 대조 — ⚠️ 내부 선별 필터 전용(±7% 문턱·노이즈컷·표본 신뢰).
    // 우리 추정치라 화면에 "시세"로 단정 노출하지 않는다.
    // lookup 실패(null) = "거래 이력 없는 단지" 신호 → major.sampleCount=null로 보존.
    const cell = lookupMedian(d);
    const trustedMedianKrw =
      cell && cell.sampleCount >= PATCH_MIN_SAMPLE && cell.medianKrw > 0
        ? cell.medianKrw
        : null;
    const pct =
      trustedMedianKrw !== null ? (d.priceKrw - trustedMedianKrw) / trustedMedianKrw : null;

    // ── [주요 거래] — 15억 이상 중개거래 전부 (band·표본과 무관하게 게재) ──
    if (d.priceKrw >= PATCH_MAJOR_MIN_PRICE_KRW) {
      // 기준점(기간 내 최고 거래가) — 스냅샷 1년 최고가 우선, 없으면 폴링창(2개월) 최고.
      const snapMax = cell?.maxKrw ?? null;
      const wm = findWindowMax(d);
      const refMax =
        snapMax !== null && snapMax > 0
          ? { krw: snapMax, date: null as string | null, period: "1년" as const }
          : wm
            ? { krw: wm.priceKrw, date: wm.dateISO, period: "2개월" as const }
            : null;
      major.push({
        sigungu: d.sigunguName,
        dong: d.dongName,
        apt: d.apartmentName,
        areaM2: d.area,
        priceKrw: d.priceKrw,
        dealDate: d.dealDateISO,
        pct,
        buildYear: d.buildYear ?? null,
        sampleCount: cell && cell.medianKrw > 0 ? cell.sampleCount : null,
        prevKrw: prev?.prevKrw ?? null,
        prevDate: prev?.prevDate ?? null,
        pctVsPrev,
        windowMaxKrw: refMax?.krw ?? null,
        windowMaxDate: refMax?.date ?? null,
        refMaxPeriod: refMax?.period ?? null,
        lat: cell?.lat ?? null,
        lng: cell?.lng ?? null,
      });
    }

    // ── 오늘의 온도 — 직전 실거래 대비(팩트 기준). ±1% 이내는 중립(matched에만) ──
    if (pctVsPrev !== null) {
      tempMatched += 1;
      if (pctVsPrev > PATCH_TEMP_NEUTRAL_PCT) tempAbove += 1;
      else if (pctVsPrev < -PATCH_TEMP_NEUTRAL_PCT) tempBelow += 1;
      // ── [약세/강세 동네] 시군구 집계 — 온도와 같은 풀(직전 거래 존재 중개거래) ──
      const agg = regionAgg.get(d.sigunguName) ?? { sum: 0, count: 0 };
      agg.sum += pctVsPrev;
      agg.count += 1;
      regionAgg.set(d.sigunguName, agg);
    }

    // ── 너프/버프 선별(eligibility) — 기존 중위가 필터 유지(내부용) ──
    if (pct === null || trustedMedianKrw === null) continue;
    const band = bandOfArea(d.area);
    if (!band) continue;
    if (Math.abs(pct) < PATCH_MIN_PCT) continue;
    // 비대칭 노이즈 컷 — 상승 +35% 초과, 하락 −30% 초과는 제외.
    if (pct > PATCH_NOISE_MAX_UP || pct < -PATCH_NOISE_MAX_DOWN) continue;

    classified.push({
      kind: pct > 0 ? "nerf" : "buff",
      sigungu: d.sigunguName,
      dong: d.dongName,
      apt: d.apartmentName,
      areaM2: d.area,
      band,
      priceKrw: d.priceKrw,
      medianKrw: trustedMedianKrw,
      pct,
      dealDate: d.dealDateISO,
      // 최근 1년 실거래 최고가 — 스냅샷이 아직 안 주면 null(구 스키마 호환).
      maxKrw: cell?.maxKrw ?? null,
      // 직전 실거래 팩트 — 화면·헤드라인 노출용.
      prevKrw: prev?.prevKrw ?? null,
      prevDate: prev?.prevDate ?? null,
      pctVsPrev,
      windowMaxKrw: findWindowMax(d)?.priceKrw ?? null,
      lat: cell?.lat ?? null,
      lng: cell?.lng ?? null,
    });
  }

  // ── [약세/강세 동네] — 시군구 평균 이탈률, 표본 5건 이상만 ──
  const regionPulses: RegionPulse[] = Array.from(regionAgg, ([sigungu, a]) => ({
    sigungu,
    avgPct: a.sum / a.count,
    count: a.count,
  })).filter((r) => r.count >= PATCH_REGION_MIN_COUNT);
  const weakRegions = regionPulses
    .filter((r) => r.avgPct <= -PATCH_REGION_MIN_AVG_PCT)
    .sort((a, b) => a.avgPct - b.avgPct) // 가장 약세부터
    .slice(0, PATCH_REGION_TOP_N);
  const strongRegions = regionPulses
    .filter((r) => r.avgPct >= PATCH_REGION_MIN_AVG_PCT)
    .sort((a, b) => b.avgPct - a.avgPct) // 가장 강세부터
    .slice(0, PATCH_REGION_TOP_N);

  // 주요 거래 — 가격 내림차순 (동가는 계약일 최신 우선).
  major.sort((a, b) => b.priceKrw - a.priceKrw || b.dealDate.localeCompare(a.dealDate));

  // 4) 같은 단지×평형은 대표 1건만 — 도배 방지.
  //    너프 대표는 pctVsPrev(화면 노출 팩트) 최대, 버프 대표는 |pct| 최대(데이터용).
  const repScore = (i: PatchItem): number =>
    i.kind === "nerf" ? i.pctVsPrev ?? Number.NEGATIVE_INFINITY : Math.abs(i.pct);
  const byComplex = new Map<string, PatchItem>();
  for (const item of classified) {
    const k = `${item.kind}|${item.sigungu}|${item.apt}|${item.band}`;
    const cur = byComplex.get(k);
    if (!cur || repScore(item) > repScore(cur)) byComplex.set(k, item);
  }
  const deduped = Array.from(byComplex.values());

  // [강세 거래] 게재 요건 — 직전 거래 팩트가 있고(60일 내) 그보다 높게 팔린 것만.
  // 표시할 팩트가 없으면 안 싣는다. 정렬은 pctVsPrev 내림차순.
  const nerfPublished = deduped
    .filter((i) => i.kind === "nerf" && i.prevKrw != null && (i.pctVsPrev ?? 0) > 0)
    .sort((a, b) => (b.pctVsPrev ?? 0) - (a.pctVsPrev ?? 0))
    .slice(0, PATCH_TOP_N);
  // buff 는 데이터 보존용(렌더 안 함) — 기존 |pct| 정렬 유지.
  const buffRanked = deduped
    .filter((i) => i.kind === "buff")
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, PATCH_TOP_N);

  return {
    nerf: nerfPublished,
    buff: buffRanked,
    major,
    temp:
      tempMatched >= PATCH_TEMP_MIN_MATCHED
        ? { above: tempAbove, below: tempBelow, matched: tempMatched }
        : null,
    weakRegions,
    strongRegions,
    scopeDealCount: scope.length,
    newDealCount: fresh.length,
    nextSeenKeys,
  };
}

// ── 오늘의 헤드라인 — "뉴스가치 사다리" (2026-07-04 사장 확정) ──────────────────
// 위에서 첫 매치 채택. 하락(버프) 아이템은 어떤 경우에도 헤드라인 금지
// (중개거래 표기여도 가족 간 거래 의심 — 급락을 1면 헤드라인으로 확성하지 않는다).

export interface HeadlineResult {
  kind: "first-trade" | "nerf" | "top-major" | "none";
  text: string;
}

/** 신축 판정 — 건축년도가 기준연도−3 이상. */
const FIRST_TRADE_BUILD_YEAR_WINDOW = 3;

function eokText(krw: number): string {
  const v = krw / 100_000_000;
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** "2026-06-25" → "6/25" — 비교 표기 날짜 병기용(사장 지시: 직전 거래엔 항상 날짜). */
function mdText(dateISO: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateISO);
  return m ? `${Number(m[1])}/${Number(m[2])}` : dateISO;
}

/** 등락률(소수) → "8.3" (소수 1자리, .0 생략). */
function pctText(pct: number): string {
  const s = (pct * 100).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/**
 * 오늘의 헤드라인 선정 — 순수 함수. 비교 문구는 전부 실거래 팩트만
 * (중위가 "시세" 단정 금지 — 2026-07-06 사장 지시).
 * 1. 신축 첫/두 번째 실거래(15억 이상): buildYear ≥ 기준연도−3 AND (거래 이력 없음 OR 표본 ≤ 2)
 *    → 후보 여럿이면 가격 최고. (원래 팩트 서술 — 그대로)
 * 2. 신고가성 상승 — 후보(pctVsPrev 내림차순)를 돌며 문구 사다리 첫 매치:
 *    ① 최근 1년 최고가(maxKrw) 갱신 ② 두 달(폴링창) 내 최고가 ③ 직전 거래 대비
 *    ④ 비교 팩트 없음 → 이 후보 스킵, 다음 후보/다음 rung.
 * 3. 오늘의 최고가: major[0].
 * 4. 폴백: "판을 흔든 거래는 없었다".
 */
export function pickHeadline(opts: {
  major: MajorItem[];
  nerf: PatchItem[];
  /** 폴백 문구용 — 오늘 공개(신규 확인) 건수. */
  newDealCount: number;
  /** 기준일 YYYY-MM-DD — 신축 판정 기준연도. */
  todayISO: string;
}): HeadlineResult {
  const { major, nerf, newDealCount, todayISO } = opts;
  const baseYear = Number(todayISO.slice(0, 4));

  // 1) 신축 첫/두 번째 실거래
  const firstTrades = major.filter(
    (m) =>
      m.buildYear !== null &&
      m.buildYear >= baseYear - FIRST_TRADE_BUILD_YEAR_WINDOW &&
      (m.sampleCount === null || m.sampleCount <= 2) &&
      m.priceKrw >= PATCH_MAJOR_MIN_PRICE_KRW,
  );
  if (firstTrades.length > 0) {
    const top = firstTrades.reduce((best, m) => (m.priceKrw > best.priceKrw ? m : best));
    const eok = eokText(top.priceKrw);
    // 시세 이력 자체가 없으면 "입주 후 첫 실거래", 표본 1~2면 "{n}번째 거래"(기존 표본 + 이번).
    const text =
      top.sampleCount === null || top.sampleCount === 0
        ? `${top.apt} 입주 후 첫 실거래 — ${eok}억 공개`
        : `${top.apt} ${top.sampleCount + 1}번째 거래 ${eok}억`;
    return { kind: "first-trade", text };
  }

  // 2) 신고가성 상승 — 실거래 팩트 사다리. 후보는 입력 순서(computePatch 가
  //    pctVsPrev 내림차순으로 게재 목록을 만든다)대로 훑고, 팩트가 잡히는 첫 후보 채택.
  for (const cand of nerf) {
    const eok = eokText(cand.priceKrw);
    // 2-① 최근 1년 최고가 갱신 — 주간 스냅샷의 관측 실거래 최고가(maxKrw) 대비.
    //      등락률은 (price − maxKrw) / maxKrw 로 재계산.
    const maxKrw = cand.maxKrw ?? null;
    if (maxKrw !== null && maxKrw > 0 && cand.priceKrw > maxKrw) {
      return {
        kind: "nerf",
        text: `${cand.sigungu} ${cand.apt}, 최근 1년 최고가 ${pctText(
          (cand.priceKrw - maxKrw) / maxKrw,
        )}% 갱신 — ${eok}억`,
      };
    }
    const prevKrw = cand.prevKrw ?? null;
    const pctVsPrev = cand.pctVsPrev ?? null;
    if (prevKrw !== null && cand.prevDate && pctVsPrev !== null && pctVsPrev > 0) {
      const prevMd = mdText(cand.prevDate);
      // 2-② 두 달(폴링창) 내 최고가 — window 내 자기 제외 최고가보다도 높음.
      const windowMaxKrw = cand.windowMaxKrw ?? null;
      if (windowMaxKrw !== null && cand.priceKrw > windowMaxKrw) {
        return {
          kind: "nerf",
          text: `${cand.sigungu} ${cand.apt}, 두 달 내 최고가 — 직전 거래(${prevMd})보다 ${pctText(pctVsPrev)}% 높게 팔렸다`,
        };
      }
      // 2-③ 직전 거래 대비 — 날짜 병기 의무.
      return {
        kind: "nerf",
        text: `${cand.sigungu} ${cand.apt}, 직전 거래(${prevMd})보다 ${pctText(pctVsPrev)}% 높게 팔렸다 — ${eok}억`,
      };
    }
    // 2-④ 비교 팩트 없음(구 스키마 등) — 이 후보 스킵, 다음 후보로.
  }

  // 3) 오늘의 최고가
  if (major.length > 0) {
    const top = major[0];
    return {
      kind: "top-major",
      text: `오늘 공개 최고가 — ${top.apt} ${eokText(top.priceKrw)}억`,
    };
  }

  // 4) 폴백 — "시세" 단어 화면 노출 금지.
  return {
    kind: "none",
    text: `오늘 공개 ${newDealCount.toLocaleString("ko-KR")}건 — 판을 흔든 거래는 없었다`,
  };
}
