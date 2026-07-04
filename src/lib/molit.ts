// 국토교통부 실거래가 공개 API wrapper.
// Endpoint: getRTMSDataSvcAptTrade (아파트 매매 실거래가 기본 자료).
// 주의: data.go.kr 에서 "아파트 매매 실거래가" 기본 API 를 활용신청해야 한다.
// ("상세 자료"=...Dev 는 별도 신청 대상이며 키가 호환되지 않음.)

import { z } from "zod";
import type { MolitDeal, MolitFetchOptions } from "@/types/molit";

// ---------------------------------------------------------------------------
// 시군구 법정동코드 (LAWD_CD, 법정동코드 앞 5자리) — 수도권 = 서울 25 + 경기 47 + 인천 10.
// 인천은 2026-05-26 추가(이전 누락). 데이터 fetch 는 Neon 쿼터 리셋 후.
// 주의: 부천시(41190)·화성시(41590) 통합코드는 구 신설로 데이터가 0건이라 제외하고,
// 하위 구 코드만 포함한다.
// ---------------------------------------------------------------------------

export const LAWD_CODES: Record<string, string> = {
  // ── 서울특별시 (25) ──
  종로구: "11110", 중구: "11140", 용산구: "11170", 성동구: "11200",
  광진구: "11215", 동대문구: "11230", 중랑구: "11260", 성북구: "11290",
  강북구: "11305", 도봉구: "11320", 노원구: "11350", 은평구: "11380",
  서대문구: "11410", 마포구: "11440", 양천구: "11470", 강서구: "11500",
  구로구: "11530", 금천구: "11545", 영등포구: "11560", 동작구: "11590",
  관악구: "11620", 서초구: "11650", 강남구: "11680", 송파구: "11710",
  강동구: "11740",
  // ── 경기도 (47) — 일반구가 있는 시 ──
  "수원시 장안구": "41111", "수원시 권선구": "41113",
  "수원시 팔달구": "41115", "수원시 영통구": "41117",
  "성남시 수정구": "41131", "성남시 중원구": "41133", "성남시 분당구": "41135",
  "안양시 만안구": "41171", "안양시 동안구": "41173",
  "안산시 상록구": "41271", "안산시 단원구": "41273",
  "고양시 덕양구": "41281", "고양시 일산동구": "41285", "고양시 일산서구": "41287",
  "용인시 처인구": "41461", "용인시 기흥구": "41463", "용인시 수지구": "41465",
  "부천시 원미구": "41192", "부천시 소사구": "41194", "부천시 오정구": "41196",
  "화성시 남양구": "41591", "화성시 향남구": "41593",
  "화성시 병점구": "41595", "화성시 동탄구": "41597",
  // ── 경기도 (47) — 구가 없는 시군 ──
  의정부시: "41150", 광명시: "41210", 평택시: "41220", 동두천시: "41250",
  과천시: "41290", 구리시: "41310", 남양주시: "41360", 오산시: "41370",
  시흥시: "41390", 군포시: "41410", 의왕시: "41430", 하남시: "41450",
  파주시: "41480", 이천시: "41500", 안성시: "41550", 김포시: "41570",
  광주시: "41610", 양주시: "41630", 포천시: "41650", 여주시: "41670",
  연천군: "41800", 가평군: "41820", 양평군: "41830",
  // ── 인천광역시 (10) — 2026-05-26 추가. 행정안전부 표준 LAWD_CD.
  // 주의: 서울 종로구와 시군구 이름 충돌(중구·동구·서구)이 있어 일부 코드는 모호하지 않게
  // "인천 " 접두를 안 붙임 — molit API 키는 LAWD_CD(숫자)라 충돌 없음. UI/공유카드의 region
  // 화이트리스트(isKnownSigungu)에서는 "중구" 단일 키가 서울·인천 둘 다 의미할 수 있음에
  // 주의. 향후 충돌이 실제로 문제될 때 "인천 중구" 등 접두 도입 검토. ──
  "인천 중구": "28110", "인천 동구": "28140", 미추홀구: "28177",
  연수구: "28185", 남동구: "28200", 부평구: "28237",
  계양구: "28245", "인천 서구": "28260", 강화군: "28710", 옹진군: "28720",
};

// Reverse map: code → 시군구 name. Built once at module load.
const CODE_TO_GU: Record<string, string> = Object.fromEntries(
  Object.entries(LAWD_CODES).map(([name, code]) => [code, name]),
);

// 알려진 시군구 이름 집합 — 공유 카드(/s/b/[grade]/[region]) 의 region 화이트리스트 검증용.
export const SIGUNGU_NAMES: ReadonlySet<string> = new Set(Object.keys(LAWD_CODES));

// 단축형·명시 접두형·공백제거형 → 풀네임 정규화 매핑.
// 사용자가 어떤 형식으로 입력해도(원미구·서울 중구·인천중구·부천시원미구) 다 매칭.
// 충돌 케이스(중구는 서울·인천 둘 다 있음)는 *명시 접두형*으로 분기 — "서울중구" → "중구"(서울),
// "인천중구" → "인천 중구"(인천). 단순 "중구"는 LAWD 직접 등록된 서울 중구로 폴백.
const ALIASES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  // 1) 공백 있는 풀네임 → 단축 마지막 토큰 + 공백제거 + 명시 접두형 alias
  //    예: "부천시 원미구" → "원미구", "부천시원미구", "부천 원미구"
  for (const full of Object.keys(LAWD_CODES)) {
    const parts = full.split(/\s+/);
    if (parts.length < 2) continue;
    const noSpace = full.replace(/\s+/g, ""); // "부천시원미구"
    if (!(noSpace in out) && !SIGUNGU_NAMES.has(noSpace)) out[noSpace] = full;
    // 마지막 토큰(단축형) — 충돌 시 첫 매핑 우선(insertion order는 LAWD_CODES 순)
    const short = parts[parts.length - 1];
    if (!(short in out) && !SIGUNGU_NAMES.has(short)) out[short] = full;
    // 첫 토큰 + 마지막 토큰 (예: "부천 원미구") — 시 접두 단축형
    if (parts.length >= 2 && parts[0].length >= 2) {
      const cityShort = parts[0].replace(/(시|특별시|광역시)$/, "");
      const altSpaced = `${cityShort} ${short}`;
      const altNoSpace = `${cityShort}${short}`;
      if (!(altSpaced in out) && !SIGUNGU_NAMES.has(altSpaced)) out[altSpaced] = full;
      if (!(altNoSpace in out) && !SIGUNGU_NAMES.has(altNoSpace)) out[altNoSpace] = full;
    }
  }
  // 2) 서울 단일 토큰 시군구 → "서울 X" / "서울X" 명시 접두형도 추가 (중구 충돌 disambig 등)
  const SEOUL_GU = [
    "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
    "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구",
    "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구",
  ];
  for (const gu of SEOUL_GU) {
    if (!LAWD_CODES[gu]) continue;
    const altSpaced = `서울 ${gu}`;
    const altNoSpace = `서울${gu}`;
    if (!(altSpaced in out) && !SIGUNGU_NAMES.has(altSpaced)) out[altSpaced] = gu;
    if (!(altNoSpace in out) && !SIGUNGU_NAMES.has(altNoSpace)) out[altNoSpace] = gu;
  }
  // 3) 인천 풀네임 ("인천 중구") → 공백제거 alias ("인천중구")
  for (const full of Object.keys(LAWD_CODES)) {
    if (!full.startsWith("인천 ")) continue;
    const noSpace = full.replace(/\s+/g, "");
    if (!(noSpace in out) && !SIGUNGU_NAMES.has(noSpace)) out[noSpace] = full;
  }
  return out;
})();

/** 수도권 시군구 중 하나인지 — 풀네임·단축형·명시 접두형·공백제거형 모두 인식. */
export function isKnownSigungu(name: string): boolean {
  return SIGUNGU_NAMES.has(name) || name in ALIASES;
}

/** 어떤 형식이든 풀네임("부천시 원미구")으로 정규화. 매칭 없으면 그대로. */
export function normalizeSigungu(name: string): string {
  if (SIGUNGU_NAMES.has(name)) return name;
  return ALIASES[name] ?? name;
}

// ---------------------------------------------------------------------------
// Zod schema for a single item returned by the MOLIT API.
// Fields arrive as numbers or numeric strings depending on the record.
// ---------------------------------------------------------------------------

const MolitItemSchema = z
  .object({
    aptNm: z.string().optional().default(""),
    dealYear: z.union([z.number(), z.string()]),
    dealMonth: z.union([z.number(), z.string()]),
    dealDay: z.union([z.number(), z.string()]),
    dealAmount: z.string(),              // "120,500" in 만원
    excluUseAr: z.union([z.number(), z.string()]),
    floor: z.union([z.number(), z.string()]).optional().nullable(),
    umdNm: z.string().optional().default(""),
    buildYear: z.union([z.number(), z.string()]).optional().nullable(),
    ownershipGbn: z.string().optional().nullable(), // 분양권전매(SilvTrade)만: "분"|"입"
    dealingGbn: z.string().optional().nullable(), // 거래유형: "중개거래" | "직거래" (2023 개정판)
    cdealType: z.string().optional().nullable(), // 해제여부: "O" = 해제된 거래
  })
  .passthrough()  // tolerate extra fields the API may add without breaking schema
  .transform((item) => {
    // Parse year / month / day — API sometimes sends them as numbers.
    const year = Number(item.dealYear);
    const month = Number(item.dealMonth);
    const day = Number(item.dealDay);
    const dealDate = new Date(year, month - 1, day);

    // dealAmount is in 만원 ("120,500" → 1,205,000,000 원).
    const manWon = parseInt(item.dealAmount.replace(/,/g, ""), 10);
    const priceKrw = BigInt(manWon) * 10000n;

    const area = Number(String(item.excluUseAr).replace(/,/g, ""));

    // floor: null when missing, "0", or "-".
    const rawFloor = item.floor;
    let floor: number | null = null;
    if (rawFloor !== undefined && rawFloor !== null) {
      const f = Number(rawFloor);
      if (Number.isFinite(f) && f !== 0 && String(rawFloor).trim() !== "-") {
        floor = f;
      }
    }

    // buildYear: null when missing or non-numeric.
    let buildYear: number | null = null;
    if (item.buildYear !== undefined && item.buildYear !== null) {
      const by = Number(item.buildYear);
      if (Number.isFinite(by) && by > 0) buildYear = by;
    }

    const ownershipGbn =
      typeof item.ownershipGbn === "string" && item.ownershipGbn.trim() !== ""
        ? item.ownershipGbn.trim()
        : undefined;

    const dealingGbn =
      typeof item.dealingGbn === "string" && item.dealingGbn.trim() !== ""
        ? item.dealingGbn.trim()
        : undefined;
    // 해제여부 — "O"(또는 값 존재)면 계약 해제된 거래.
    const canceled =
      typeof item.cdealType === "string" && item.cdealType.trim() !== "";

    return {
      _aptNm: item.aptNm,
      _dealDate: dealDate,
      _priceKrw: priceKrw,
      _area: area,
      _floor: floor,
      _umdNm: item.umdNm,
      _buildYear: buildYear,
      _ownershipGbn: ownershipGbn,
      _dealingGbn: dealingGbn,
      _canceled: canceled,
    };
  });

// ---------------------------------------------------------------------------
// Internal: build a MolitDeal from a validated+transformed item.
// sigunguCode / sigunguName are injected from the call site.
// ---------------------------------------------------------------------------

function toDeal(
  transformed: z.output<typeof MolitItemSchema>,
  sigunguCode: string,
): MolitDeal {
  return {
    apartmentName: transformed._aptNm,
    dealDate: transformed._dealDate,
    priceKrw: transformed._priceKrw,
    area: transformed._area,
    floor: transformed._floor,
    sigunguCode,
    sigunguName: CODE_TO_GU[sigunguCode] ?? sigunguCode,
    dongName: transformed._umdNm,
    buildYear: transformed._buildYear,
    ownershipGbn: transformed._ownershipGbn,
    dealingGbn: transformed._dealingGbn,
    canceled: transformed._canceled,
  };
}

// ---------------------------------------------------------------------------
// Internal: shape of the top-level JSON from the MOLIT endpoint.
// ---------------------------------------------------------------------------

// `item` can be an array, a single object, or absent (when no data).
const MolitResponseSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string(),
    }),
    body: z.object({
      totalCount: z.union([z.number(), z.string()]).transform(Number),
      items: z
        .union([
          z.object({ item: z.union([z.array(z.unknown()), z.unknown()]) }),
          z.string(), // empty string when no results
          z.null(),
        ])
        .optional(),
    }),
  }),
});

// ---------------------------------------------------------------------------
// MOLIT API base URL
// ---------------------------------------------------------------------------

const BASE_URL =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

// 아파트 분양권전매 신고 자료 — 등기 전 신축의 분양권/입주권 실거래. 매매와 응답 필드 동일
// (+ ownershipGbn). 별도 활용신청 필요.
export const SILV_BASE_URL =
  "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade";

// ---------------------------------------------------------------------------
// fetchDeals — fetch a single month's transactions.
// ---------------------------------------------------------------------------

export async function fetchDeals(opts: MolitFetchOptions): Promise<MolitDeal[]> {
  const apiKey = process.env.MOLIT_API_KEY;
  if (!apiKey) throw new Error("MOLIT_API_KEY not configured");

  const pageNo = opts.pageNo ?? 1;
  const numOfRows = opts.numOfRows ?? 100;

  // serviceKey is pre-encoded as registered on data.go.kr — do NOT re-encode.
  const url =
    `${BASE_URL}?serviceKey=${apiKey}` +
    `&LAWD_CD=${opts.sigunguCode}` +
    `&DEAL_YMD=${opts.dealYearMonth}` +
    `&pageNo=${pageNo}` +
    `&numOfRows=${numOfRows}` +
    `&_type=json`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `MOLIT HTTP error: ${response.status} ${response.statusText}`,
    );
  }

  const raw: unknown = await response.json();

  const parsed = MolitResponseSchema.parse(raw);
  const { header, body } = parsed.response;

  // 성공 코드: 기본 API 는 "000", 일부 엔드포인트는 "00" 을 쓴다.
  if (header.resultCode !== "00" && header.resultCode !== "000") {
    throw new Error(`MOLIT API error: ${header.resultCode} ${header.resultMsg}`);
  }

  // Normalize items → array.
  const rawItems = normalizeItems(body.items);

  const deals: MolitDeal[] = [];
  for (const rawItem of rawItems) {
    const result = MolitItemSchema.safeParse(rawItem);
    if (!result.success) {
      // Skip malformed records rather than aborting the entire page.
      continue;
    }
    deals.push(toDeal(result.data, opts.sigunguCode));
  }

  return deals;
}

// ---------------------------------------------------------------------------
// fetchDealsForRange — iterate inclusive YYYYMM range, paginate as needed.
// ---------------------------------------------------------------------------

export async function fetchDealsForRange(opts: {
  sigunguCode: string;
  fromYearMonth: string;
  toYearMonth: string;
  /** 엔드포인트 — 기본 매매(BASE_URL), 분양권은 SILV_BASE_URL. */
  baseUrl?: string;
}): Promise<MolitDeal[]> {
  const months = expandMonthRange(opts.fromYearMonth, opts.toYearMonth);
  const numOfRows = 1000;
  const baseUrl = opts.baseUrl ?? BASE_URL;
  const all: MolitDeal[] = [];

  for (const ym of months) {
    // Fetch first page to learn totalCount.
    const firstPage = await fetchDealsPageRaw(
      { sigunguCode: opts.sigunguCode, dealYearMonth: ym, pageNo: 1, numOfRows },
      baseUrl,
    );

    all.push(...parsePage(firstPage.rawItems, opts.sigunguCode));

    const totalCount = firstPage.totalCount;
    const totalPages = Math.ceil(totalCount / numOfRows);

    // Fetch additional pages if paginated.
    for (let page = 2; page <= totalPages; page++) {
      const pageData = await fetchDealsPageRaw(
        { sigunguCode: opts.sigunguCode, dealYearMonth: ym, pageNo: page, numOfRows },
        baseUrl,
      );
      all.push(...parsePage(pageData.rawItems, opts.sigunguCode));
    }
  }

  return all;
}

/** 분양권전매(SilvTrade) 범위 수집 — fetchDealsForRange 의 분양권 엔드포인트 버전. */
export async function fetchSilvForRange(opts: {
  sigunguCode: string;
  fromYearMonth: string;
  toYearMonth: string;
}): Promise<MolitDeal[]> {
  return fetchDealsForRange({ ...opts, baseUrl: SILV_BASE_URL });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Fetch a page and return the raw items array + totalCount without parsing deals. */
async function fetchDealsPageRaw(
  opts: Required<MolitFetchOptions>,
  baseUrl: string = BASE_URL,
): Promise<{
  rawItems: unknown[];
  totalCount: number;
}> {
  const apiKey = process.env.MOLIT_API_KEY;
  if (!apiKey) throw new Error("MOLIT_API_KEY not configured");

  const url =
    `${baseUrl}?serviceKey=${apiKey}` +
    `&LAWD_CD=${opts.sigunguCode}` +
    `&DEAL_YMD=${opts.dealYearMonth}` +
    `&pageNo=${opts.pageNo}` +
    `&numOfRows=${opts.numOfRows}` +
    `&_type=json`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`MOLIT HTTP error: ${response.status} ${response.statusText}`);
  }

  const raw: unknown = await response.json();
  const parsed = MolitResponseSchema.parse(raw);
  const { header, body } = parsed.response;

  // 성공 코드: 기본 API 는 "000", 일부 엔드포인트는 "00" 을 쓴다.
  if (header.resultCode !== "00" && header.resultCode !== "000") {
    throw new Error(`MOLIT API error: ${header.resultCode} ${header.resultMsg}`);
  }

  return {
    rawItems: normalizeItems(body.items),
    totalCount: body.totalCount,
  };
}

/** Normalise the `items` field (array | single object | empty string | missing) → array. */
function normalizeItems(
  items: z.output<typeof MolitResponseSchema>["response"]["body"]["items"],
): unknown[] {
  if (!items || typeof items === "string") return [];
  if ("item" in items) {
    const item = items.item;
    if (Array.isArray(item)) return item;
    if (item !== null && item !== undefined) return [item];
  }
  return [];
}

/** Parse a raw items array into MolitDeal[], skipping invalid records. */
function parsePage(rawItems: unknown[], sigunguCode: string): MolitDeal[] {
  const deals: MolitDeal[] = [];
  for (const rawItem of rawItems) {
    const result = MolitItemSchema.safeParse(rawItem);
    if (result.success) {
      deals.push(toDeal(result.data, sigunguCode));
    }
  }
  return deals;
}

/**
 * Expand "202401" .. "202404" → ["202401", "202402", "202403", "202404"].
 * Handles year wrap-around correctly.
 */
function expandMonthRange(from: string, to: string): string[] {
  let year = parseInt(from.slice(0, 4), 10);
  let month = parseInt(from.slice(4, 6), 10);
  const toYear = parseInt(to.slice(0, 4), 10);
  const toMonth = parseInt(to.slice(4, 6), 10);

  const results: string[] = [];

  while (year < toYear || (year === toYear && month <= toMonth)) {
    results.push(`${year}${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return results;
}
