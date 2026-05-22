// 집 찾기 유형 분포 시드 — 콜드스타트용. "아무 숫자"가 아니라 실제 분류기(getHomeType)를
// 현실적인 우선순위 prior 에 수만 번 시뮬레이션해 얻은 분포를 시드로 깐다(베이지안 prior).
// 이후 /api/recommend 의 실제 집계가 이 위에 누적되어 시간이 지날수록 진짜 방문자 데이터로
// 수렴한다. 시드는 모데스트(총 ~360)라 실트래픽이 빠르게 영향을 준다.
//
//   npx tsx --env-file=.env.local scripts/seed-type-distribution.ts
//
// 안전장치: 이미 카운트가 있는 유형(실트래픽 누적분)은 건드리지 않는다 — 0인 유형만 시드.
// 그래서 실서비스 후 재실행해도 실데이터를 덮어쓰지 않는다. (런치 1회 실행 의도.)

import { db } from "@/lib/db";
import { getHomeType, HOME_TYPE_SLUGS, type HomeTypeSlug } from "@/lib/homeType";
import type { CoupleProfile, HouseholdType } from "@/types/profile";

const SAMPLES = 40000; // 분포 안정용 시뮬레이션 수
const SEED_TOTAL = 360; // 시드 총량(모데스트 — 실트래픽이 곧 수렴시킴)

// 가중 무작위 선택 헬퍼.
function pick<T>(items: T[], weights: number[]): T {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// 현실 prior(투명·튜닝 가능):
// - 가구형: 맞벌이·1인이 다수, 은퇴 소수(은퇴는 통근 가중치 0이라 분포에 영향).
// - 우선순위 1~5: 통근이 가장 흔한 최우선, 학군 그다음, 신축은 다소 낮음.
const HH_TYPES: HouseholdType[] = ["dualIncome", "single", "singleIncome", "retired"];
const HH_WEIGHTS = [0.4, 0.3, 0.2, 0.1];
const LEVELS = [1, 2, 3, 4, 5];
const W_COMMUTE = [0.08, 0.15, 0.22, 0.3, 0.25]; // mean ~3.5
const W_SCHOOL = [0.18, 0.18, 0.22, 0.24, 0.18]; // mean ~3.1
const W_BUILD = [0.15, 0.25, 0.3, 0.2, 0.1]; // mean ~2.85

async function main() {
  // 1) 분류기를 prior 에 시뮬레이션해 분포(fraction) 산출.
  const tally: Record<HomeTypeSlug, number> = Object.fromEntries(
    HOME_TYPE_SLUGS.map((s) => [s, 0]),
  ) as Record<HomeTypeSlug, number>;

  for (let i = 0; i < SAMPLES; i++) {
    const profile = {
      householdType: pick(HH_TYPES, HH_WEIGHTS),
      priorities: {
        commute: pick(LEVELS, W_COMMUTE),
        school: pick(LEVELS, W_SCHOOL),
        buildingAge: pick(LEVELS, W_BUILD),
        largeComplex: 2,
      },
    } as CoupleProfile;
    tally[getHomeType(profile).slug]++;
  }

  // 2) fraction → 시드 카운트(총합 ≈ SEED_TOTAL).
  const seed: Record<HomeTypeSlug, number> = Object.fromEntries(
    HOME_TYPE_SLUGS.map((s) => [s, Math.round((tally[s] / SAMPLES) * SEED_TOTAL)]),
  ) as Record<HomeTypeSlug, number>;

  console.log("시뮬레이션 분포(%):");
  for (const s of HOME_TYPE_SLUGS) {
    console.log(`  ${s}: ${((tally[s] / SAMPLES) * 100).toFixed(1)}% → 시드 ${seed[s]}`);
  }

  // 3) 0인 유형만 시드(실트래픽 누적분 보호).
  let seeded = 0;
  for (const s of HOME_TYPE_SLUGS) {
    const key = `type:${s}`;
    const existing = await db.aggCounter.findUnique({ where: { key } });
    if (existing && existing.count > 0) {
      console.log(`  skip ${key} (이미 ${existing.count}건 — 실데이터 보호)`);
      continue;
    }
    await db.aggCounter.upsert({
      where: { key },
      create: { key, count: seed[s] },
      update: { count: seed[s] },
    });
    seeded++;
  }
  const total = HOME_TYPE_SLUGS.reduce((a, s) => a + seed[s], 0);
  console.log(`시드 완료: ${seeded}개 유형, 총 ${total}건`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
