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
  /** 건축년도 — 신축 첫 실거래 헤드라인 판정용. MOLIT 미제공 시 null. */
  buildYear?: number | null;
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
  /** 단지 자기 중위가 lookup 성공 시 그 표본수, 실패 시 null("시세 이력 없는 단지" 신호). */
  sampleCount: number | null;
}

/** 오늘의 온도 — fresh 중개거래 중 자기 중위가 대조 성공분의 위:아래 집계. */
export interface PatchTemp {
  /** 자기 시세(단지 중위가)보다 +1% 초과 위에서 거래된 건수. */
  above: number;
  /** 자기 시세보다 −1% 초과 아래에서 거래된 건수. */
  below: number;
  /** 대조 성공 거래 수(±1% 이내 중립 포함 — above/below 어디에도 안 셈). */
  matched: number;
}

export interface PatchResult {
  nerf: PatchItem[];
  buff: PatchItem[];
  /** 오늘 공개된 15억 이상 중개거래 전부 — 가격 내림차순. */
  major: MajorItem[];
  /** 오늘의 온도 — matched < 30(표본 부족)이면 null. */
  temp: PatchTemp | null;
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
/** 오늘의 온도 최소 표본 — 대조 성공 거래가 이보다 적으면 온도 비표시(null). */
export const PATCH_TEMP_MIN_MATCHED = 30;
/** 오늘의 온도 중립 밴드 — 자기 시세 ±1% 이내는 위/아래 어느 쪽에도 안 센다. */
export const PATCH_TEMP_NEUTRAL_PCT = 0.01;
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

  // 3) 중위가 대조 → 분류 (+ 주요 거래 · 오늘의 온도 동시 집계)
  const classified: PatchItem[] = [];
  const major: MajorItem[] = [];
  let tempAbove = 0;
  let tempBelow = 0;
  let tempMatched = 0;
  for (const d of fresh) {
    // 직거래 = 가족 간 증여성 거래 가능성 — 시세 신호로 안 씀 (특히 급락 버프 오염 방지)
    if (d.dealingGbn === "직거래") continue;
    if (d.priceKrw < PATCH_MIN_PRICE_KRW) continue;

    // 대조 셀 — 신뢰 가능(표본 ≥ MIN_SAMPLE·중위가 유효)할 때만 pct 계산.
    // lookup 실패(null) = "시세 이력 없는 단지" 신호 → major.sampleCount=null로 보존.
    const cell = lookupMedian(d);
    const trustedMedianKrw =
      cell && cell.sampleCount >= PATCH_MIN_SAMPLE && cell.medianKrw > 0
        ? cell.medianKrw
        : null;
    const pct =
      trustedMedianKrw !== null ? (d.priceKrw - trustedMedianKrw) / trustedMedianKrw : null;

    // ── [주요 거래] — 15억 이상 중개거래 전부 (band·표본과 무관하게 게재) ──
    if (d.priceKrw >= PATCH_MAJOR_MIN_PRICE_KRW) {
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
      });
    }

    // ── 오늘의 온도 — 대조 성공분의 위:아래. ±1% 이내는 중립(matched에만 포함) ──
    if (pct !== null) {
      tempMatched += 1;
      if (pct > PATCH_TEMP_NEUTRAL_PCT) tempAbove += 1;
      else if (pct < -PATCH_TEMP_NEUTRAL_PCT) tempBelow += 1;
    }

    // ── 너프/버프 분류 ──
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
    });
  }

  // 주요 거래 — 가격 내림차순 (동가는 계약일 최신 우선).
  major.sort((a, b) => b.priceKrw - a.priceKrw || b.dealDate.localeCompare(a.dealDate));

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
    major,
    temp:
      tempMatched >= PATCH_TEMP_MIN_MATCHED
        ? { above: tempAbove, below: tempBelow, matched: tempMatched }
        : null,
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

/**
 * 오늘의 헤드라인 선정 — 순수 함수.
 * 1. 신축 첫/두 번째 실거래(15억 이상): buildYear ≥ 기준연도−3 AND (시세 이력 없음 OR 표본 ≤ 2)
 *    → 후보 여럿이면 가격 최고.
 * 2. 신고가성 상승 이탈: nerf 중 score = pct × log10(priceKrw) 최대.
 * 3. 오늘의 최고가: major[0].
 * 4. 폴백: "시세를 흔든 거래는 없었다".
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

  // 2) 신고가성 상승 이탈 — 이탈률 × 체급(log10 가격) 가중.
  if (nerf.length > 0) {
    const top = nerf.reduce((best, i) =>
      i.pct * Math.log10(i.priceKrw) > best.pct * Math.log10(best.priceKrw) ? i : best,
    );
    const pctText = (top.pct * 100).toFixed(1).replace(/\.0$/, "");
    return {
      kind: "nerf",
      text: `${top.sigungu} ${top.apt}, 자기 시세를 ${pctText}% 웃돌았다 — ${eokText(top.priceKrw)}억`,
    };
  }

  // 3) 오늘의 최고가
  if (major.length > 0) {
    const top = major[0];
    return {
      kind: "top-major",
      text: `오늘 공개 최고가 — ${top.apt} ${eokText(top.priceKrw)}억`,
    };
  }

  // 4) 폴백
  return {
    kind: "none",
    text: `오늘 공개 ${newDealCount.toLocaleString("ko-KR")}건 — 시세를 흔든 거래는 없었다`,
  };
}
