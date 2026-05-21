/**
 * fetch-presale.ts
 *
 * MOLIT 아파트 "분양권전매" 실거래(분양권/입주권)를 받아 DB 에 추가 적재한다.
 * 등기 전 신축(예: 디퍼·청담르엘·메이플자이)은 매매 데이터엔 없고 분양권에만 있으므로,
 * 이걸 받아야 그 단지들이 실제 실거래가로 노출된다.
 *
 * 사용법:
 *   npx tsx --env-file=.env.local scripts/fetch-presale.ts [--months=12] [--gu=all|"강남구,..."]
 *
 * 기본값: months=12, gu=all (분양권은 거래가 드물어 넓게 받는다)
 *
 * 매매 적재(fetch-molit)와 달리 **추가형(멱등)**:
 *  - 시작 시 source ∈ {분양권,입주권} 거래만 deleteMany (매매는 건드리지 않음)
 *  - 단지는 find-or-create — 공백 무시 매칭으로 매매 단지("디에이치퍼스티어아이파크")와
 *    분양권 단지("디에이치 퍼스티어 아이파크")가 중복 생성되지 않게 한다.
 * 적재 후 geocode-complexes(신규 단지 좌표) → build-trend-index 재실행 권장.
 */

import { PrismaClient } from "@prisma/client";
import { fetchSilvForRange, LAWD_CODES } from "@/lib/molit";
import type { MolitDeal } from "@/types/molit";

if (!process.env.MOLIT_API_KEY) {
  console.error("오류: MOLIT_API_KEY 미설정. .env.local 확인.");
  process.exit(1);
}

const DEFAULT_MONTHS = 12;
const PRESALE_SOURCES = ["분양권", "입주권"];

function parseArgs(): { months: number; guList: string[] } {
  let months = DEFAULT_MONTHS;
  let guList: string[] = Object.keys(LAWD_CODES);
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--months=(\d+)$/);
    if (m) { months = parseInt(m[1], 10); continue; }
    const g = arg.match(/^--gu=(.+)$/);
    if (g) {
      const raw = g[1].replace(/^"|"$/g, "");
      guList = raw === "all" ? Object.keys(LAWD_CODES)
        : raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return { months, guList };
}

function yyyymm(monthsAgo: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nowYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** 단지명 정규화 — 공백 제거(매매/분양권 표기 차이 흡수). */
const norm = (s: string) => s.replace(/\s+/g, "");

const prisma = new PrismaClient();

async function createTxChunked(
  data: { complexId: string; dealDate: Date; priceKrw: bigint; area: number; floor: number | null; source: string }[],
): Promise<void> {
  const CHUNK = 1000;
  for (let i = 0; i < data.length; i += CHUNK) {
    await prisma.transaction.createMany({ data: data.slice(i, i + CHUNK) });
  }
}

async function ingestGu(gu: string, deals: MolitDeal[]): Promise<{ complexes: number; transactions: number }> {
  if (deals.length === 0) return { complexes: 0, transactions: 0 };

  // 기존 단지(공백제거 키 → id) — 매매로 이미 있는 단지 재사용.
  const existing = await prisma.complex.findMany({
    where: { sigungu: gu },
    select: { id: true, dongName: true, name: true },
  });
  const idByNorm = new Map<string, string>();
  for (const r of existing) idByNorm.set(`${r.dongName}|${norm(r.name)}`, r.id);

  // 분양권 deals 의 신규 단지만 생성.
  const toCreate = new Map<string, { dongName: string; name: string }>();
  for (const d of deals) {
    const key = `${d.dongName}|${norm(d.apartmentName)}`;
    if (!idByNorm.has(key) && !toCreate.has(key)) {
      toCreate.set(key, { dongName: d.dongName, name: d.apartmentName });
    }
  }
  if (toCreate.size > 0) {
    await prisma.complex.createMany({
      data: [...toCreate.values()].map((c) => ({
        sigungu: gu, dongName: c.dongName, name: c.name, buildYear: null,
      })),
    });
    // 새로 만든 것 id 다시 조회.
    const refreshed = await prisma.complex.findMany({
      where: { sigungu: gu },
      select: { id: true, dongName: true, name: true },
    });
    for (const r of refreshed) idByNorm.set(`${r.dongName}|${norm(r.name)}`, r.id);
  }

  const txData = deals
    .map((d) => {
      const complexId = idByNorm.get(`${d.dongName}|${norm(d.apartmentName)}`);
      if (!complexId) return null;
      return {
        complexId,
        dealDate: d.dealDate,
        priceKrw: d.priceKrw,
        area: d.area,
        floor: d.floor ?? null,
        source: d.ownershipGbn === "입" ? "입주권" : "분양권",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  await createTxChunked(txData);
  return { complexes: toCreate.size, transactions: txData.length };
}

async function main(): Promise<void> {
  const { months, guList } = parseArgs();
  const from = yyyymm(months);
  const to = nowYYYYMM();
  console.log(`분양권 수집(추가형): ${from}~${to}, 대상 ${guList.length}개 시군구`);

  // 멱등: 기존 분양권/입주권 거래 제거(매매는 보존).
  const del = await prisma.transaction.deleteMany({ where: { source: { in: PRESALE_SOURCES } } });
  console.log(`기존 분양권/입주권 거래 ${del.count.toLocaleString()}건 삭제 후 재적재`);

  let totalC = 0, totalT = 0;
  for (const gu of guList) {
    const code = LAWD_CODES[gu];
    if (!code) { console.log(`  [건너뜀] ${gu}`); continue; }
    let deals: MolitDeal[];
    try {
      deals = await fetchSilvForRange({ sigunguCode: code, fromYearMonth: from, toYearMonth: to });
    } catch (e) {
      console.error(`  [오류] ${gu}:`, e instanceof Error ? e.message : e);
      continue;
    }
    const { complexes, transactions } = await ingestGu(gu, deals);
    totalC += complexes; totalT += transactions;
    if (transactions > 0) console.log(`  ${gu}: 신규단지 ${complexes}, 분양권거래 ${transactions}`);
  }
  console.log(`\n완료: 신규 단지 ${totalC.toLocaleString()}, 분양권/입주권 거래 ${totalT.toLocaleString()}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
