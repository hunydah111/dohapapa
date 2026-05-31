// MOLIT 매매 실거래를 dev.db(sqlite)에 직접 채운다 — Neon 우회(쿼터 회피). 데이터 밀도=신뢰도.
// 멱등: 지정 기간·구의 거래 DELETE 후 재삽입. 단지는 find-or-create(중복 방지).
// 사용:
//   TZ=Asia/Seoul npx tsx --env-file=.env.local scripts/fill-molit-sqlite.ts \
//     [--from=202506] [--to=202510] [--gu=인천 중구,연수구|all] [--limit=N] [--db=prisma/dev.db]
//   --gu 생략 시 전체 수도권. 월 인자는 YYYYMM.

import { fetchDealsForRange, LAWD_CODES } from "@/lib/molit";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const FROM = arg("from") ?? "202506";
const TO = arg("to") ?? "202510";
const DB = arg("db") ?? "prisma/dev.db";
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const GU_ARG = arg("gu"); // "인천 중구,연수구" | "all" | undefined(=all)

// from월 1일 ~ (to월+1) 1일 (KST) — 멱등 DELETE 범위.
const ms = (yyyymm: string, addMonth = 0) => {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6)) - 1 + addMonth;
  return new Date(Date.UTC(y, m, 1) - 9 * 3600 * 1000).getTime(); // KST 1일 00:00
};
const fromMs = ms(FROM);
const toMs = ms(TO, 1); // exclusive (to월 다음달 1일)

async function main() {
  const db = new DatabaseSync(DB) as unknown as {
    prepare: (s: string) => { all: (...p: unknown[]) => unknown[]; run: (...p: unknown[]) => unknown };
    exec: (s: string) => void;
    close: () => void;
  };

  // 대상 구 결정
  const allGus = Object.entries(LAWD_CODES);
  const guFilter = GU_ARG && GU_ARG !== "all" ? new Set(GU_ARG.split(",").map((s) => s.trim())) : null;
  const targetGus = (guFilter ? allGus.filter(([g]) => guFilter.has(g)) : allGus).slice(0, LIMIT);

  // 멱등: 채울 기간·구의 기존 거래 제거(스코프). 구 지정 시 그 구만, 아니면 기간 전체.
  const guNames = targetGus.map(([g]) => g);
  const placeholders = guNames.map(() => "?").join(",");
  const delN = db
    .prepare(
      `DELETE FROM "Transaction" WHERE dealDate >= ? AND dealDate < ?` +
        (guFilter ? ` AND complexId IN (SELECT id FROM Complex WHERE sigungu IN (${placeholders}))` : ""),
    )
    .run(...(guFilter ? [fromMs, toMs, ...guNames] : [fromMs, toMs]));
  console.log(`대상 구 ${targetGus.length} · 기존 ${FROM}~${TO} 거래 삭제: ${JSON.stringify(delN)}`);

  const insComplex = db.prepare(
    `INSERT INTO Complex (id,name,sigungu,dongName,buildYear,createdAt) VALUES (?,?,?,?,?,?)`,
  );
  const insTx = db.prepare(
    `INSERT INTO "Transaction" (id,complexId,dealDate,priceKrw,area,floor,source) VALUES (?,?,?,?,?,?, 'MOLIT')`,
  );

  const gus = targetGus;
  let totalTx = 0, totalNewCx = 0;
  const now = Date.now();

  for (const [gu, code] of gus) {
    let deals;
    try {
      deals = await fetchDealsForRange({ sigunguCode: code, fromYearMonth: FROM, toYearMonth: TO });
    } catch (e) {
      console.log(`✗ ${gu}(${code}) fetch 실패: ${(e as Error).message}`);
      continue;
    }
    if (deals.length === 0) { console.log(`· ${gu}: 0건`); continue; }

    // 기존 단지 맵(이 구) — dongName|name → id
    const existing = db.prepare(`SELECT id,dongName,name FROM Complex WHERE sigungu = ?`).all(gu) as Record<string, unknown>[];
    const idMap = new Map<string, string>();
    for (const r of existing) idMap.set(`${r.dongName}|${r.name}`, String(r.id));

    db.exec("BEGIN");
    let newCx = 0;
    for (const d of deals) {
      const key = `${d.dongName}|${d.apartmentName}`;
      let cid = idMap.get(key);
      if (!cid) {
        cid = randomUUID();
        insComplex.run(cid, d.apartmentName, gu, d.dongName, d.buildYear ?? null, now);
        idMap.set(key, cid);
        newCx++;
      }
      insTx.run(randomUUID(), cid, d.dealDate.getTime(), Number(d.priceKrw), d.area, d.floor ?? null);
    }
    db.exec("COMMIT");
    totalTx += deals.length; totalNewCx += newCx;
    console.log(`✓ ${gu}: 거래 ${deals.length} · 신규단지 ${newCx}`);
  }

  console.log(`\n완료 — 거래 ${totalTx} · 신규단지 ${totalNewCx} (${gus.length}개 구)`);
  db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
