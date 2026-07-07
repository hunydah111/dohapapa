// 동네판 구독 모델 (v2.6) — "내 동네" 시군구를 기기 localStorage 에만 저장한다.
//
// 무저장 원칙(서버 stateless) 그대로 — 구독 = localStorage, 서버 전송 0, 로그인 0.
// v1 슬롯: 주 동네(main) 1 + 라이벌(rival) 1 (상향/하향 슬롯은 v2.7).
// 값은 반드시 SIGUNGU_NAMES(LAWD_CODES 풀네임 82개) 화이트리스트를 통과해야 한다 —
// 구버전 데이터·손조작 값이 렌더에 흘러들지 않게 load 시점에 재검증한다.
//
// parse/serialize 는 순수 함수 — 테스트가 localStorage 없이 검증한다.

import { SIGUNGU_NAMES } from "@/lib/molit";

export const MY_REGIONS_KEY = "biji-my-regions";

export interface MyRegions {
  /** 주 동네 — 시군구 풀네임(SIGUNGU_NAMES 키). */
  main: string;
  /** 라이벌 동네 — 선택. main 과 같으면 무의미하므로 저장·로드 시 제거. */
  rival?: string;
}

/** 저장 원본(JSON 문자열) → 검증된 MyRegions. 깨진 JSON·미지 시군구는 null.
 *  rival 은 부가 정보 — main 만 유효하면 rival 불량(미지/중복/비문자열)은 조용히 버린다. */
export function parseMyRegions(raw: string | null): MyRegions | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = parsed as { main?: unknown; rival?: unknown };
  if (typeof d.main !== "string" || !SIGUNGU_NAMES.has(d.main)) return null;
  const rival =
    typeof d.rival === "string" && SIGUNGU_NAMES.has(d.rival) && d.rival !== d.main
      ? d.rival
      : undefined;
  return rival ? { main: d.main, rival } : { main: d.main };
}

/** MyRegions → 저장용 JSON. 화이트리스트 밖 값은 저장 자체를 거부(null) —
 *  쓰기 경로에서도 검증해 localStorage 에 불량값이 앉지 않게 한다. */
export function serializeMyRegions(regions: MyRegions): string | null {
  if (!SIGUNGU_NAMES.has(regions.main)) return null;
  const rival =
    regions.rival && SIGUNGU_NAMES.has(regions.rival) && regions.rival !== regions.main
      ? regions.rival
      : undefined;
  return JSON.stringify(rival ? { main: regions.main, rival } : { main: regions.main });
}

/** 구독 저장 — 실패(프라이빗 모드 등)는 무시(부가기능). 불량값이면 저장 안 함. */
export function saveMyRegions(regions: MyRegions): void {
  const s = serializeMyRegions(regions);
  if (s === null) return;
  try {
    localStorage.setItem(MY_REGIONS_KEY, s);
  } catch {
    /* 저장 실패 무시 */
  }
}

/** 구독 로드(+화이트리스트 재검증). 없거나 깨졌으면 null. */
export function loadMyRegions(): MyRegions | null {
  try {
    return parseMyRegions(localStorage.getItem(MY_REGIONS_KEY));
  } catch {
    return null;
  }
}

/** 구독 해지 — 즉시 삭제. */
export function clearMyRegions(): void {
  try {
    localStorage.removeItem(MY_REGIONS_KEY);
  } catch {
    /* 무시 */
  }
}
