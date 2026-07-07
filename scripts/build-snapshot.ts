// 추천 엔진 핫패스용 단지 스냅샷 빌더.
// 단지 메타 + (평형별 추정 현재가)를 src/data/complexSnapshot.json 으로 굽는다.
// 런타임(src/lib/recommend/index.ts)은 이 스냅샷을 번들로 읽어 "요청당 DB 읽기 0" 으로 동작한다.
//
// 데이터 파이프라인의 마지막 단계로 실행 (build-trend-index 다음 — 시점 보정에 추세지수를 쓰므로).
//   npx tsx --env-file=.env.local scripts/build-snapshot.ts                 # Neon 에서 읽기
//   npx tsx scripts/build-snapshot.ts --from-sqlite=prisma/dev.db           # 로컬 SQLite 백업에서 읽기
//
// 새 실거래를 적재하면 다시 굽고 커밋·배포한다(trendIndex.json 과 같은 갱신 주기).
// JSON 이 비어 있으면 추천은 빈 결과로 degrade 하므로 반드시 함께 커밋할 것.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  groupTxRows,
  mediansFromGrouped,
  medianSince,
  type RawTxRow,
  type AreaMedian,
} from "@/lib/recommend/complexMedian";

// index.ts 의 좌표 sanity 박스와 동일하게 유지 — 수도권만.
const BOX = { latMin: 36.8, latMax: 38.5, lngMin: 126.2, lngMax: 127.95 };

interface ComplexMeta {
  id: string;
  name: string;
  sigungu: string;
  dongName: string;
  buildYear: number | null;
  totalHouseholds: number | null;
  latitude: number;
  longitude: number;
  nearestElemSchoolM: number | null;
  nearestSubwayM: number | null;
}

interface SnapshotComplex extends ComplexMeta {
  medians: AreaMedian[];
}

type Source = { complexes: ComplexMeta[]; txRows: RawTxRow[]; label: string };

/** 로컬 SQLite 백업(dev.db)에서 직접 읽는다 — Neon 쿼터 소진 등으로 DB 가 막혔을 때의 경로. */
async function loadFromSqlite(path: string): Promise<Source> {
  const { DatabaseSync } = await import("node:sqlite");
  const sdb = new DatabaseSync(path, { readOnly: true });
  try {
    const complexRows = sdb
      .prepare(
        `SELECT id, name, sigungu, dongName, buildYear, totalHouseholds,
                latitude, longitude, nearestElemSchoolM, nearestSubwayM
         FROM Complex
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
           AND latitude >= ? AND latitude <= ?
           AND longitude >= ? AND longitude <= ?`,
      )
      .all(BOX.latMin, BOX.latMax, BOX.lngMin, BOX.lngMax) as Record<
      string,
      unknown
    >[];

    const sinceMs = medianSince().getTime();
    const txRaw = sdb
      .prepare(
        `SELECT complexId, area, priceKrw, dealDate, source, floor
         FROM "Transaction" WHERE dealDate >= ?`,
      )
      .all(sinceMs) as Record<string, unknown>[];

    const complexes: ComplexMeta[] = complexRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sigungu: String(r.sigungu),
      dongName: String(r.dongName),
      buildYear: r.buildYear == null ? null : Number(r.buildYear),
      totalHouseholds: r.totalHouseholds == null ? null : Number(r.totalHouseholds),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      nearestElemSchoolM:
        r.nearestElemSchoolM == null ? null : Number(r.nearestElemSchoolM),
      nearestSubwayM: r.nearestSubwayM == null ? null : Number(r.nearestSubwayM),
    }));

    const txRows: RawTxRow[] = txRaw.map((r) => ({
      complexId: String(r.complexId),
      area: Number(r.area),
      priceKrw: Number(r.priceKrw),
      dealDate: new Date(Number(r.dealDate)),
      source: r.source == null ? "MOLIT" : String(r.source),
      floor: r.floor == null ? null : Number(r.floor),
    }));

    return { complexes, txRows, label: `sqlite:${path}` };
  } finally {
    sdb.close();
  }
}

/** 평상시 경로 — Neon(Prisma)에서 읽는다. 파이프라인 마지막 단계에서 사용. */
async function loadFromPrisma(): Promise<Source> {
  const { db } = await import("@/lib/db");
  try {
    const complexes = await db.complex.findMany({
      where: {
        latitude: { gte: BOX.latMin, lte: BOX.latMax },
        longitude: { gte: BOX.lngMin, lte: BOX.lngMax },
      },
      select: {
        id: true,
        name: true,
        sigungu: true,
        dongName: true,
        buildYear: true,
        totalHouseholds: true,
        latitude: true,
        longitude: true,
        nearestElemSchoolM: true,
        nearestSubwayM: true,
      },
    });
    const txs = await db.transaction.findMany({
      where: { dealDate: { gte: medianSince() } },
      select: {
        complexId: true,
        area: true,
        priceKrw: true,
        dealDate: true,
        source: true,
        floor: true,
      },
    });
    const txRows: RawTxRow[] = txs.map((t) => ({
      complexId: t.complexId,
      area: t.area,
      priceKrw: Number(t.priceKrw),
      dealDate: t.dealDate,
      source: t.source,
      floor: t.floor,
    }));
    // lat/lng 는 box 필터로 non-null 보장.
    const meta: ComplexMeta[] = complexes.map((c) => ({
      id: c.id,
      name: c.name,
      sigungu: c.sigungu,
      dongName: c.dongName,
      buildYear: c.buildYear,
      totalHouseholds: c.totalHouseholds,
      latitude: c.latitude as number,
      longitude: c.longitude as number,
      nearestElemSchoolM: c.nearestElemSchoolM,
      nearestSubwayM: c.nearestSubwayM,
    }));
    return { complexes: meta, txRows, label: "prisma" };
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const sqliteArg = process.argv.find((a) => a.startsWith("--from-sqlite="));
  const sqlitePath = sqliteArg ? sqliteArg.slice("--from-sqlite=".length) : null;

  const src = sqlitePath
    ? await loadFromSqlite(sqlitePath)
    : await loadFromPrisma();

  const sigunguById = new Map(src.complexes.map((c) => [c.id, c.sigungu]));
  // 런타임과 동일 로직으로 평형별 추정 현재가 계산(시점 보정 포함).
  const mediansMap = mediansFromGrouped(groupTxRows(src.txRows), sigunguById);

  const out: SnapshotComplex[] = [];
  for (const c of src.complexes) {
    const medians = mediansMap.get(c.id);
    // 12개월 거래가 0건인 단지는 엔진에서 대표가격을 못 잡아 쓰이지 않는다 → 용량 절약 위해 제외.
    if (!medians || medians.length === 0) continue;
    out.push({ ...c, medians });
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: src.label,
    complexCount: out.length,
    complexes: out,
  };

  const outPath = resolve(process.cwd(), "src/data/complexSnapshot.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot), "utf8");

  const totalMedians = out.reduce((s, c) => s + c.medians.length, 0);
  console.log(
    `complexSnapshot.json 생성(${src.label}): 단지 ${out.length}개(거래 있는 것만, ` +
      `전체 ${src.complexes.length}개 중), 평형 ${totalMedians}개, 거래 ${src.txRows.length}건`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
