// 좌표 있는 단지에 "가장 가까운 초등학교 거리(m)" 를 채운다 — 초품아 판별용.
// Kakao Local 카테고리 검색(SC4=학교)으로 초등학교만 추려 거리순 1순위를 쓴다.
// MOLIT 단지엔 학교 거리 데이터가 없으므로 fetch/geocode 후 이 스크립트를 돌린다.
//
// 실행: npx tsx --env-file=.env.local scripts/enrich-schools.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface KakaoDoc {
  category_name: string;
  /** x,y 를 함께 넘기면 m 단위 거리 문자열이 온다. */
  distance: string;
  place_name: string;
}

/** 단지 좌표 기준 가장 가까운 초등학교까지 거리(m). 없으면 null. */
async function nearestElemSchoolM(
  lat: number,
  lng: number,
): Promise<number | null> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) throw new Error("KAKAO_REST_KEY 가 설정되지 않았습니다.");

  const url =
    "https://dapi.kakao.com/v2/local/search/category.json" +
    `?category_group_code=SC4&x=${lng}&y=${lat}&radius=1500&sort=distance&size=15`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { documents?: KakaoDoc[] };
  const docs = data.documents ?? [];
  // category_name 예: "교육,학문 > 학교 > 초등학교"
  const elem = docs.find((d) => d.category_name.includes("초등학교"));
  if (!elem) return null;

  const dist = parseInt(elem.distance, 10);
  return Number.isFinite(dist) ? dist : null;
}

async function main(): Promise<void> {
  const targets = await prisma.complex.findMany({
    where: {
      nearestElemSchoolM: null,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true, latitude: true, longitude: true },
  });
  console.log(
    `초등학교 거리 산출 대상: ${targets.length.toLocaleString()}개 단지`,
  );

  let ok = 0;
  let fail = 0;
  const BATCH = 6;

  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (c) => {
        try {
          const dist = await nearestElemSchoolM(
            c.latitude as number,
            c.longitude as number,
          );
          if (dist !== null) {
            await prisma.complex.update({
              where: { id: c.id },
              data: { nearestElemSchoolM: dist },
            });
            ok++;
          } else {
            fail++;
          }
        } catch {
          fail++;
        }
      }),
    );
    if ((i / BATCH) % 20 === 0 || i + BATCH >= targets.length) {
      console.log(
        `  진행 ${Math.min(i + BATCH, targets.length)}/${targets.length} — 성공 ${ok}, 실패 ${fail}`,
      );
    }
  }

  console.log(
    `완료: 성공 ${ok.toLocaleString()}, 실패 ${fail.toLocaleString()}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
