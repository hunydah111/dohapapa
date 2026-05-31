// 좌표 없는 단지를 Kakao Local API 로 지오코딩한다.
// MOLIT 데이터엔 좌표가 없으므로, fetch-molit.ts 실행 후 이 스크립트를 돌려야
// 추천 엔진이 단지를 통근 계산에 포함시킬 수 있다.
//
// 실행: npx tsx --env-file=.env.local scripts/geocode-complexes.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface KakaoDoc {
  place_name: string;
  category_name: string;
  x: string; // lng
  y: string; // lat
}

async function kakaoSearch(query: string): Promise<KakaoDoc[]> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) throw new Error("KAKAO_REST_KEY 가 설정되지 않았습니다.");
  const url =
    "https://dapi.kakao.com/v2/local/search/keyword.json?query=" +
    encodeURIComponent(query);
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { documents?: KakaoDoc[] };
  return data.documents ?? [];
}

/** 단지명에 가장 잘 맞는 좌표를 찾는다. 카테고리에 "아파트"가 있으면 우선. */
async function geocodeComplex(
  sigungu: string,
  dongName: string,
  name: string,
): Promise<{ lat: number; lng: number } | null> {
  const queries = [`${dongName} ${name}`, `${sigungu} ${name}`, name];
  for (const q of queries) {
    const docs = await kakaoSearch(q);
    if (docs.length === 0) continue;
    // 카테고리에 "아파트" 포함된 결과 우선, 없으면 첫 결과.
    const apt = docs.find((d) => d.category_name.includes("아파트"));
    const pick = apt ?? docs[0];
    const lat = parseFloat(pick.y);
    const lng = parseFloat(pick.x);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

interface Target { id: string; name: string; sigungu: string; dongName: string }

async function main(): Promise<void> {
  // Neon(기본) 또는 로컬 dev.db(--from-sqlite=) — 인천 등 sqlite 전용 단지 지오코딩.
  const sqliteArg = process.argv.find((a) => a.startsWith("--from-sqlite="));
  type Sdb = { prepare: (s: string) => { all: (...p: unknown[]) => Record<string, unknown>[]; run: (...p: unknown[]) => unknown }; close: () => void };
  let sdb: Sdb | null = null;

  let targets: Target[];
  if (sqliteArg) {
    const { DatabaseSync } = await import("node:sqlite");
    sdb = new DatabaseSync(sqliteArg.slice("--from-sqlite=".length)) as unknown as Sdb;
    targets = sdb!
      .prepare(`SELECT id,name,sigungu,dongName FROM Complex WHERE latitude IS NULL OR longitude IS NULL`)
      .all()
      .map((r) => ({ id: String(r.id), name: String(r.name), sigungu: String(r.sigungu), dongName: String(r.dongName) }));
  } else {
    targets = (await prisma.complex.findMany({
      where: { OR: [{ latitude: null }, { longitude: null }] },
      select: { id: true, name: true, sigungu: true, dongName: true },
    })) as Target[];
  }
  console.log(`지오코딩 대상: ${targets.length.toLocaleString()}개 단지${sqliteArg ? " (sqlite)" : ""}`);

  const updateStmt = sdb ? sdb.prepare(`UPDATE Complex SET latitude=?, longitude=? WHERE id=?`) : null;
  const save = async (id: string, lat: number, lng: number) => {
    if (updateStmt) updateStmt.run(lat, lng, id);
    else await prisma.complex.update({ where: { id }, data: { latitude: lat, longitude: lng } });
  };

  let ok = 0;
  let fail = 0;
  const BATCH = 6;

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (c) => {
        try {
          const coord = await geocodeComplex(c.sigungu, c.dongName, c.name);
          if (coord) {
            await save(c.id, coord.lat, coord.lng);
            ok++;
          } else {
            fail++;
          }
        } catch {
          fail++;
        }
      }),
    );
    if ((i / BATCH) % 15 === 0 || i + BATCH >= targets.length) {
      console.log(
        `  진행 ${Math.min(i + BATCH, targets.length)}/${targets.length} — 성공 ${ok}, 실패 ${fail}`,
      );
    }
  }

  sdb?.close();
  console.log(`완료: 성공 ${ok.toLocaleString()}, 실패 ${fail.toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
