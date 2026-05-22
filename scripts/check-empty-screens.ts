// 빈 화면 영구 가드 — 배포 전 실행. 다양한 입력 조합에서 recommendComplexes 가
// "아파트도 완화 제안도 전혀 없는 막다른 화면"을 절대 내지 않는지 검사한다.
// 막다른 화면이 하나라도 있으면 exit 1.
//   npx tsx --env-file=.env.local scripts/check-empty-screens.ts
//
// mock 통근 강제(카카오 키 제거)로 빠르고 결정적으로 돈다.
delete process.env.KAKAO_REST_KEY;

import { recommendComplexes } from "@/lib/recommend";
import { db } from "@/lib/db";
import type { RecommendationResult } from "@/types/recommendation";
import type {
  CoupleProfile,
  Workplace,
  AreaRangeKey,
  HouseholdType,
} from "@/types/profile";

const WP: Record<string, { lat: number; lng: number }> = {
  강남역: { lat: 37.498086, lng: 127.028001 },
  성수역: { lat: 37.544588, lng: 127.056066 },
};
function wp(name: keyof typeof WP, mode: "car" | "transit", min: number): Workplace {
  return { label: name, lat: WP[name].lat, lng: WP[name].lng, commuteMode: mode, maxCommuteMinutes: min };
}
function base(): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 5, school: 5, buildingAge: 5, largeComplex: 5 },
    preferredAreaRanges: ["p32_35"],
    hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0,
    existingLoanMonthlyKrw: 0, hasOwnedHomeBefore: false, isNewlywed: false,
  };
}

// 막다른 화면 = 아파트(후보/근접/예산초과/통근초과) 0 AND 완화 제안 0
function isDeadEnd(r: RecommendationResult): boolean {
  const apt =
    r.candidates.length > 0 ||
    r.closestCandidates.length > 0 ||
    r.overBudgetCandidates.length > 0 ||
    r.overLimitCandidates.length > 0;
  return !apt && r.relaxationSuggestions.length === 0;
}

function profiles(): { name: string; p: CoupleProfile }[] {
  const out: { name: string; p: CoupleProfile }[] = [];
  // 데이터 희박·먼 지역 등 막다름 유발 조합 위주
  const regions = ["강남구", "송파구", "노원구", "은평구", "가평군", "과천시", "성남시 분당구", "화성시 동탄구", "연천군"];
  const areas: AreaRangeKey[] = ["under18", "p26_31", "over45"];
  const avails = [3e8, 13e8];
  for (const reg of regions)
    for (const a of areas)
      for (const av of avails)
        out.push({
          name: `simple/${reg}/${a}/${av / 1e8}억/지하철30`,
          p: { ...base(), preferredAreaRanges: [a], requiredRegions: [reg], budgetMode: "simple", availableBudgetKrw: av, budgetFlex: "normal", workplaceA: wp("강남역", "transit", 30), workplaceB: wp("성수역", "transit", 30) },
        });
  // 은퇴(직장 0) + 희박 지역
  for (const reg of ["가평군", "연천군", "강남구"])
    for (const a of ["under18", "over45"] as AreaRangeKey[])
      out.push({
        name: `retired/${reg}/${a}/8억`,
        p: { ...base(), householdType: "retired" as HouseholdType, priorities: { commute: 0, school: 3, buildingAge: 3, largeComplex: 3 }, preferredAreaRanges: [a], requiredRegions: [reg], budgetMode: "simple", availableBudgetKrw: 8e8 },
      });
  return out;
}

async function main() {
  const list = profiles();
  let dead = 0;
  const fails: string[] = [];
  for (const { name, p } of list) {
    try {
      const r = await recommendComplexes(p);
      if (isDeadEnd(r)) {
        dead++;
        fails.push(name);
        console.log(`‼ 막다름: ${name}`);
      }
    } catch (e) {
      dead++;
      fails.push(`${name} (ERROR: ${(e as Error).message})`);
      console.log(`✗ ERROR: ${name} — ${(e as Error).message}`);
    }
  }
  console.log(`\n검사 ${list.length}개 · 막다름 ${dead}개`);
  await db.$disconnect();
  if (dead > 0) {
    console.log("실패 — 위 조합에서 빈 화면이 발생합니다.");
    process.exit(1);
  }
  console.log("✅ 모든 조합에서 최소 1개 이상 노출(아파트 또는 완화 제안). 빈 화면 없음.");
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
