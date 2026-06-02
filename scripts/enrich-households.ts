// 단지에 "총 세대수(totalHouseholds)" 를 채운다 — K-apt(공동주택관리정보시스템) 공개 API.
// MOLIT 실거래엔 세대수가 없어, fetch/geocode 후 이 스크립트로 보강한다. 대단지 점수·"N세대" 표시용.
//
// 실행: npx tsx --env-file=.env.local scripts/enrich-households.ts
//       npx tsx --env-file=.env.local scripts/enrich-households.ts --sigungu=강남구,송파구
//
// 멱등·재개 가능: totalHouseholds 가 null 인 단지만 대상. 하루 호출한도(공공데이터포털 기본 ~1만/일)에
// 걸리면 다음 날 다시 돌리면 남은 것만 채운다. 끝나면 build-snapshot 재실행+커밋해야 런타임에 반영된다.
//
// 동작: 시군구별 ① 단지목록(getSigunguAptList) 로 (단지명→kaptCode) 매핑 → ② 우리 단지명을 정규화
//       퍼지 매칭 → ③ 기본정보(getAphusBassInfo) 의 kaptdaCnt(세대수) 를 DB 에 기록.
//
// ⚠️ 서비스 경로·필드명(V3, kaptdaCnt 등)은 공공데이터포털 "공동주택 기본 정보 서비스" 문서 기준.
//    포털에서 해당 API 를 '활용신청'해야 키가 동작한다(MOLIT 와 같은 포털 키 재사용 가능).

import { PrismaClient } from "@prisma/client";
import { LAWD_CODES } from "@/lib/molit";

const prisma = new PrismaClient();

const LIST_URL = "https://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3";
const INFO_URL = "https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV3";

const API_KEY = process.env.KAPT_API_KEY || process.env.MOLIT_API_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 단지명 정규화 — 공백·"아파트" 제거, 소문자화. 매칭 정확도용. */
function norm(name: string): string {
  return name.replace(/\s+/g, "").replace(/아파트$/, "").toLowerCase();
}

interface AptListItem { kaptCode?: string; kaptName?: string }
interface KaptResponse {
  response?: {
    body?: {
      totalCount?: number | string;
      items?: { item?: unknown };
      item?: { kaptdaCnt?: number | string };
    };
  };
}

/** 응답의 items.item 을 항상 배열로. (공공데이터포털: 0건 빈문자열·1건 객체·N건 배열) */
function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") return [v as T];
  return [];
}

async function getJson(url: string): Promise<KaptResponse | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  try {
    return (await res.json()) as KaptResponse;
  } catch {
    return null; // XML 폴백 응답 등 — 호출자에서 무시
  }
}

/** 시군구 단지목록 → normName→kaptCode 맵. 페이지네이션. */
async function fetchSigunguAptMap(sigunguCode: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const url =
      `${LIST_URL}?serviceKey=${API_KEY}&sigunguCode=${sigunguCode}` +
      `&pageNo=${page}&numOfRows=200&_type=json`;
    const data = await getJson(url);
    const items = asArray<AptListItem>(data?.response?.body?.items?.item);
    for (const it of items) {
      if (it.kaptName && it.kaptCode) map.set(norm(it.kaptName), it.kaptCode);
    }
    const total = Number(data?.response?.body?.totalCount ?? 0);
    if (!items.length || page * 200 >= total) break;
    await sleep(120);
  }
  return map;
}

/** kaptCode → 세대수(kaptdaCnt). 없으면 null. */
async function fetchHouseholds(kaptCode: string): Promise<number | null> {
  const url = `${INFO_URL}?serviceKey=${API_KEY}&kaptCode=${kaptCode}&_type=json`;
  const data = await getJson(url);
  const item = data?.response?.body?.item;
  const cnt = Number(item?.kaptdaCnt);
  return Number.isFinite(cnt) && cnt > 0 ? cnt : null;
}

/** 시군구 단지맵에서 우리 단지명에 맞는 kaptCode 찾기 — 정확 일치 우선, 없으면 포함 매칭. */
function matchKaptCode(complexName: string, aptMap: Map<string, string>): string | null {
  const n = norm(complexName);
  if (aptMap.has(n)) return aptMap.get(n)!;
  if (n.length < 3) return null; // 너무 짧으면 포함 매칭 위험 — 스킵
  let best: string | null = null;
  for (const [key, code] of aptMap) {
    if (key.includes(n) || n.includes(key)) {
      best = code;
      break; // 첫 후보
    }
  }
  return best;
}

async function main(): Promise<void> {
  if (!API_KEY) throw new Error("KAPT_API_KEY(또는 MOLIT_API_KEY) 가 설정되지 않았습니다.");

  const arg = process.argv.find((a) => a.startsWith("--sigungu="));
  const onlySgg = arg ? arg.split("=")[1].split(",").map((s) => s.trim()) : null;

  // 세대수 비어있는 단지만(멱등). 시군구별로 묶어 단지목록 호출을 1회만.
  const targets = await prisma.complex.findMany({
    where: { totalHouseholds: null, ...(onlySgg ? { sigungu: { in: onlySgg } } : {}) },
    select: { id: true, name: true, sigungu: true },
  });
  const bySgg = new Map<string, typeof targets>();
  for (const t of targets) {
    if (!bySgg.has(t.sigungu)) bySgg.set(t.sigungu, []);
    bySgg.get(t.sigungu)!.push(t);
  }
  console.log(`세대수 보강 대상: ${targets.length.toLocaleString()}개 단지 · ${bySgg.size}개 시군구`);

  let ok = 0;
  let miss = 0;
  const codeCache = new Map<string, number | null>(); // kaptCode 재조회 방지

  for (const [sgg, list] of bySgg) {
    const code = LAWD_CODES[sgg];
    if (!code) {
      console.log(`  · ${sgg}: LAWD 코드 없음 — 스킵 (${list.length}개)`);
      miss += list.length;
      continue;
    }
    const aptMap = await fetchSigunguAptMap(code);
    let sggOk = 0;
    for (const c of list) {
      const kaptCode = matchKaptCode(c.name, aptMap);
      if (!kaptCode) { miss++; continue; }
      let households = codeCache.get(kaptCode);
      if (households === undefined) {
        households = await fetchHouseholds(kaptCode);
        codeCache.set(kaptCode, households);
        await sleep(120);
      }
      if (households != null) {
        await prisma.complex.update({ where: { id: c.id }, data: { totalHouseholds: households } });
        ok++;
        sggOk++;
      } else {
        miss++;
      }
    }
    console.log(`  · ${sgg}: ${sggOk}/${list.length} 채움 (누적 성공 ${ok})`);
  }

  console.log(`완료: 성공 ${ok.toLocaleString()}, 미매칭/실패 ${miss.toLocaleString()}`);
  console.log("→ build-snapshot 재실행 후 커밋해야 런타임(complexSnapshot.json)에 반영됩니다.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
