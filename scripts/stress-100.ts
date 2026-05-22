// 100 페르소나 스트레스 — 오늘 대규모 수정(계급도·백분위·동네 인라인·레이더·톤) 회귀 점검.
// 다양한 가구·우선순위·지역·예산·평수·입지 조합을 recommendComplexes 에 돌려,
//  (1) 하드 버그(크래시·막다른 빈화면·예산이상·좌표/데이터 깨짐·점수범위)
//  (2) "시원찮은 결과"(정상 3티어 0건·안전망 폴백·후보<3·예산0·입지미스)
// 를 분리 집계한다. mock 통근(빠르고 결정적). 탐색용이라 exit code 0.
//
//   npx tsx --env-file=.env.local scripts/stress-100.ts

delete process.env.KAKAO_REST_KEY;

import { recommendComplexes } from "@/lib/recommend";
import { db } from "@/lib/db";
import { budgetTopPercent, budgetTier } from "@/lib/budgetPercentile";
import type { RecommendationResult } from "@/types/recommendation";
import type {
  CoupleProfile,
  Workplace,
  AreaRangeKey,
  CommuteMode,
} from "@/types/profile";
import { SEOUL_GU } from "@/types/profile";

const WP: Record<string, { lat: number; lng: number }> = {
  강남역: { lat: 37.498086, lng: 127.028001 },
  성수역: { lat: 37.544588, lng: 127.056066 },
  판교역: { lat: 37.394776, lng: 127.111209 },
  광화문: { lat: 37.571648, lng: 126.976872 },
  여의도: { lat: 37.521624, lng: 126.924191 },
};
const wp = (n: keyof typeof WP, m: CommuteMode, min: number): Workplace => ({
  label: n, lat: WP[n].lat, lng: WP[n].lng, commuteMode: m, maxCommuteMinutes: min,
});

const AREAS: AreaRangeKey[] = ["under18", "p19_25", "p26_31", "p32_35", "p36_40", "p41_45", "over45"];
const REGIONS: (string[] | undefined)[] = [
  undefined, ["강남구"], ["서초구", "송파구"], ["노원구"], ["관악구"], ["은평구"],
  ["양천구"], ["동작구"], ["성남시 분당구"], ["수원시 영통구"], ["고양시 일산동구"],
  ["용인시 수지구"], ["화성시 동탄구"], ["부천시 원미구"], ["가평군"], ["연천군"],
  ["양평군"], ["과천시"], ["광명시"], SEOUL_GU,
];
const PRIOS = [
  { commute: 5, school: 1, buildingAge: 2, largeComplex: 2 },
  { commute: 1, school: 5, buildingAge: 2, largeComplex: 2 },
  { commute: 2, school: 1, buildingAge: 5, largeComplex: 2 },
  { commute: 2, school: 2, buildingAge: 2, largeComplex: 5 },
  { commute: 3, school: 3, buildingAge: 3, largeComplex: 3 },
  { commute: 1, school: 1, buildingAge: 1, largeComplex: 1 },
  { commute: 5, school: 5, buildingAge: 5, largeComplex: 5 },
];
const SIMPLE_BUD = [1e8, 3e8, 5e8, 8e8, 13e8, 20e8, 35e8, 60e8];
const VIBES: (CoupleProfile["locationVibes"] | undefined)[] = [
  undefined, { riverside: 1 }, { riverside: 3 }, { riverside: 2 },
];

function base(): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0,
    existingLoanMonthlyKrw: 0, hasOwnedHomeBefore: false, isNewlywed: false,
  };
}

function personas(): { name: string; p: CoupleProfile }[] {
  const out: { name: string; p: CoupleProfile }[] = [];
  const add = (name: string, p: CoupleProfile) => out.push({ name, p });

  // 1) 맞벌이 simple 스윕 — 지역×평수×우선순위×예산×입지 (28)
  for (let i = 0; i < 28; i++) {
    const reg = REGIONS[i % REGIONS.length];
    add(`duo-simple/${reg ? (reg.length > 5 ? "서울전체" : reg.join("+")) : "전국"}/${AREAS[i % AREAS.length]}/${SIMPLE_BUD[i % SIMPLE_BUD.length] / 1e8}억`, {
      ...base(), householdType: "dualIncome",
      priorities: PRIOS[i % PRIOS.length],
      preferredAreaRanges: [AREAS[i % AREAS.length]],
      requiredRegions: reg,
      budgetMode: "simple", availableBudgetKrw: SIMPLE_BUD[i % SIMPLE_BUD.length],
      budgetFlex: (["tight", "normal", "relaxed"] as const)[i % 3],
      locationVibes: VIBES[i % VIBES.length],
      hasSchoolAgedChild: i % 2 === 0,
      workplaceA: wp("강남역", i % 2 ? "transit" : "car", 25 + (i % 4) * 10),
      workplaceB: wp(i % 2 ? "여의도" : "판교역", "car", 30 + (i % 3) * 10),
    });
  }
  // 2) 맞벌이 detailed — 소득·현금·자산 (16)
  const inc = [4e7, 6e7, 9e7, 1.3e8, 2e8, 3e8];
  const seed = [2e7, 8e7, 2e8, 4e8, 7e8, 12e8];
  for (let j = 0; j < 16; j++) {
    add(`duo-detail/소득${inc[j % 6] / 1e4}만/현금${seed[j % 6] / 1e4}만/${AREAS[j % AREAS.length]}`, {
      ...base(), householdType: "dualIncome",
      priorities: PRIOS[j % PRIOS.length], preferredAreaRanges: [AREAS[j % AREAS.length]],
      requiredRegions: REGIONS[(j + 3) % REGIONS.length],
      householdIncomeKrwYear: inc[j % 6], seedMoneyKrw: seed[j % 6], netAssetsKrw: seed[j % 6] * 2,
      existingLoanMonthlyKrw: j % 3 ? 400000 : 0, ownedHomeCount: j % 5 === 4 ? 1 : 0,
      isNewlywed: j % 2 === 0, hasInfant: j % 4 === 0, hasTwoOrMoreChildren: j % 6 === 0,
      budgetFlex: "relaxed", locationVibes: VIBES[j % VIBES.length],
      workplaceA: wp("강남역", "car", 45), workplaceB: wp("판교역", "car", 45),
    });
  }
  // 3) 1인 (single) — 직장1 (16)
  for (let j = 0; j < 16; j++) {
    const simple = j % 2 === 0;
    add(`single/${simple ? "simple" : "detail"}/${AREAS[j % AREAS.length]}/${REGIONS[(j + 1) % REGIONS.length]?.[0] ?? "전국"}`, {
      ...base(), householdType: "single",
      priorities: PRIOS[j % PRIOS.length], preferredAreaRanges: [AREAS[j % AREAS.length]],
      requiredRegions: REGIONS[(j + 1) % REGIONS.length],
      budgetMode: simple ? "simple" : "detailed",
      availableBudgetKrw: simple ? [3e8, 5e8, 8e8, 13e8][j % 4] : undefined,
      householdIncomeKrwYear: simple ? 0 : inc[j % 6], seedMoneyKrw: simple ? 0 : seed[j % 6], netAssetsKrw: simple ? 0 : seed[j % 6] * 2,
      locationVibes: VIBES[j % VIBES.length],
      workplaceA: wp(j % 2 ? "광화문" : "여의도", j % 2 ? "transit" : "car", 20 + (j % 4) * 12),
    });
  }
  // 4) 외벌이 (singleIncome) — 직장1 (12)
  for (let j = 0; j < 12; j++) {
    add(`singleIncome/소득${inc[j % 6] / 1e4}만/${AREAS[j % AREAS.length]}`, {
      ...base(), householdType: "singleIncome",
      priorities: PRIOS[(j + 1) % PRIOS.length], preferredAreaRanges: [AREAS[j % AREAS.length]],
      requiredRegions: REGIONS[(j + 5) % REGIONS.length],
      householdIncomeKrwYear: inc[j % 6], seedMoneyKrw: seed[j % 6], netAssetsKrw: seed[j % 6] * 2,
      isNewlywed: j % 2 === 0, hasSchoolAgedChild: j % 2 === 1, hasTwoOrMoreChildren: j % 4 === 0,
      workplaceA: wp("강남역", "car", 30 + (j % 4) * 10),
    });
  }
  // 5) 은퇴 (retired) — 직장0 (12)
  for (let j = 0; j < 12; j++) {
    add(`retired/${REGIONS[(j + 8) % REGIONS.length]?.[0] ?? "전국"}/${AREAS[j % AREAS.length]}/${SIMPLE_BUD[j % SIMPLE_BUD.length] / 1e8}억`, {
      ...base(), householdType: "retired",
      priorities: { commute: 0, school: 2, buildingAge: 3, largeComplex: 3 },
      preferredAreaRanges: [AREAS[j % AREAS.length]],
      requiredRegions: REGIONS[(j + 8) % REGIONS.length],
      budgetMode: "simple", availableBudgetKrw: SIMPLE_BUD[j % SIMPLE_BUD.length],
      locationVibes: VIBES[j % VIBES.length],
    });
  }
  // 6) 극단 엣지 (16)
  add(`edge/갈아타기 음수`, { ...base(), householdType: "dualIncome", householdIncomeKrwYear: 7e7, seedMoneyKrw: 5e7, netAssetsKrw: 2e8, existingHome: { expectedSalePriceKrw: 5e8, remainingLoanKrw: 6e8, qualifiesForTaxExemption: false }, workplaceA: wp("강남역", "car", 50), workplaceB: wp("판교역", "car", 50) });
  add(`edge/초저예산 0.5억 강남`, { ...base(), householdType: "single", budgetMode: "simple", availableBudgetKrw: 5e7, requiredRegions: ["강남구"], workplaceA: wp("강남역", "transit", 30) });
  add(`edge/초저예산 1억 전국`, { ...base(), householdType: "single", budgetMode: "simple", availableBudgetKrw: 1e8, workplaceA: wp("광화문", "transit", 40) });
  add(`edge/초고예산 80억 강남`, { ...base(), householdType: "dualIncome", budgetMode: "simple", availableBudgetKrw: 80e8, requiredRegions: ["강남구"], workplaceA: wp("강남역", "car", 40), workplaceB: wp("성수역", "car", 40) });
  add(`edge/소득0 현금0 detailed`, { ...base(), householdType: "single", householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0, workplaceA: wp("여의도", "car", 30) });
  add(`edge/통근10분 초빡빡`, { ...base(), householdType: "dualIncome", budgetMode: "simple", availableBudgetKrw: 10e8, workplaceA: wp("강남역", "car", 10), workplaceB: wp("판교역", "car", 10) });
  add(`edge/초소형 under18 강남`, { ...base(), householdType: "single", preferredAreaRanges: ["under18"], budgetMode: "simple", availableBudgetKrw: 6e8, requiredRegions: ["강남구"], workplaceA: wp("강남역", "transit", 30) });
  add(`edge/대형 over45 가평`, { ...base(), householdType: "retired", priorities: { commute: 0, school: 1, buildingAge: 2, largeComplex: 4 }, preferredAreaRanges: ["over45"], budgetMode: "simple", availableBudgetKrw: 5e8, requiredRegions: ["가평군"] });
  add(`edge/연천 저예산`, { ...base(), householdType: "singleIncome", budgetMode: "simple", availableBudgetKrw: 3e8, requiredRegions: ["연천군"], householdIncomeKrwYear: 5e7, seedMoneyKrw: 1e8, netAssetsKrw: 2e8, workplaceA: wp("광화문", "car", 90) });
  add(`edge/다주택 LTV0`, { ...base(), householdType: "dualIncome", householdIncomeKrwYear: 1.5e8, seedMoneyKrw: 5e8, netAssetsKrw: 15e8, ownedHomeCount: 2, hasOwnedHomeBefore: true, requiredRegions: ["송파구"], workplaceA: wp("강남역", "car", 40), workplaceB: wp("성수역", "car", 40) });
  add(`edge/기존대출 과다`, { ...base(), householdType: "singleIncome", householdIncomeKrwYear: 6e7, seedMoneyKrw: 1e8, netAssetsKrw: 2e8, existingLoanMonthlyKrw: 2500000, workplaceA: wp("강남역", "car", 50) });
  add(`edge/한강변 듬뿍 저예산`, { ...base(), householdType: "single", budgetMode: "simple", availableBudgetKrw: 4e8, locationVibes: { riverside: 3 }, workplaceA: wp("여의도", "transit", 40) });
  add(`edge/all-low priority`, { ...base(), householdType: "dualIncome", priorities: { commute: 1, school: 1, buildingAge: 1, largeComplex: 1 }, budgetMode: "simple", availableBudgetKrw: 9e8, workplaceA: wp("강남역", "car", 60), workplaceB: wp("판교역", "car", 60) });
  add(`edge/신생아 특례 후보`, { ...base(), householdType: "dualIncome", householdIncomeKrwYear: 1.1e8, seedMoneyKrw: 1.5e8, netAssetsKrw: 3e8, hasInfant: true, isNewlywed: true, workplaceA: wp("강남역", "car", 45), workplaceB: wp("판교역", "car", 45) });
  add(`edge/3자녀 다자녀`, { ...base(), householdType: "singleIncome", householdIncomeKrwYear: 8e7, seedMoneyKrw: 2e8, netAssetsKrw: 4e8, hasThreeOrMoreChildren: true, hasSchoolAgedChild: true, preferredAreaRanges: ["p41_45"], workplaceA: wp("광화문", "car", 50) });
  add(`edge/임신중 + 갈아타기`, { ...base(), householdType: "dualIncome", isExpectingChild: true, householdIncomeKrwYear: 1.3e8, seedMoneyKrw: 3e8, netAssetsKrw: 6e8, existingHome: { expectedSalePriceKrw: 9e8, remainingLoanKrw: 3e8, qualifiesForTaxExemption: true }, workplaceA: wp("강남역", "car", 40), workplaceB: wp("여의도", "car", 40) });

  return out;
}

const inSudogwon = (lat: number, lng: number) => lat > 36.8 && lat < 38.4 && lng > 126.2 && lng < 127.9;

async function main() {
  const list = personas();
  console.log(`▶ ${list.length} 페르소나 스트레스 (mock 통근)\n`);

  const hard: string[] = [];
  const warn: Record<string, string[]> = {
    "정상 3티어 0건(다른 섹션으로 회복)": [],
    "안전망 폴백 발동(모든 정상섹션 0)": [],
    "후보 1~2건뿐": [],
    "예산 0원(격려 카피 경로)": [],
    "백분위 null인데 예산>0(데이터 미스)": [],
    "입지 미스 vibeNote": [],
    "예산초과 후보만 나옴": [],
  };
  const tierDist: Record<string, number> = {};

  for (const { name, p } of list) {
    let r: RecommendationResult;
    try {
      r = await recommendComplexes(p);
    } catch (e) {
      hard.push(`CRASH ${name}: ${(e as Error).message}`);
      continue;
    }

    // ── 하드 버그 ──
    const apt = r.candidates.length + r.closestCandidates.length + r.overBudgetCandidates.length + r.overLimitCandidates.length;
    if (apt === 0 && r.relaxationSuggestions.length === 0) hard.push(`막다른 빈화면 ${name}`);
    const b = r.budget;
    for (const [k, v] of Object.entries({ net: b.netPurchasePowerKrw, gross: b.grossBudgetKrw, equity: b.totalEquityKrw, loan: b.loanEstimateKrw }))
      if (!Number.isFinite(v as number)) hard.push(`예산 ${k} 비유한(${v}) ${name}`);
    if (b.netPurchasePowerKrw < 0) hard.push(`예산 net 음수 ${name}`);
    r.candidates.forEach((c, i) => {
      if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || !inSudogwon(c.latitude, c.longitude)) hard.push(`좌표이상 ${name} #${i + 1} (${c.latitude},${c.longitude})`);
      if (!c.complexName) hard.push(`단지명 빔 ${name} #${i + 1}`);
      if (!(c.medianPriceKrw > 0)) hard.push(`가격이상 ${name} #${i + 1} ${c.medianPriceKrw}`);
      if (c.totalScore < 0 || c.totalScore > 100) hard.push(`점수범위 ${name} #${i + 1} ${c.totalScore}`);
    });

    // ── 시원찮은 결과(소프트) ──
    if (r.candidates.length === 0) warn["정상 3티어 0건(다른 섹션으로 회복)"].push(name);
    if (r.closestCandidates.length > 0) warn["안전망 폴백 발동(모든 정상섹션 0)"].push(name);
    if (r.candidates.length > 0 && r.candidates.length < 3) warn["후보 1~2건뿐"].push(`${name}(${r.candidates.length})`);
    if (b.netPurchasePowerKrw === 0) warn["예산 0원(격려 카피 경로)"].push(name);
    const bp = budgetTopPercent(b.netPurchasePowerKrw);
    if (bp === null && b.netPurchasePowerKrw > 0) warn["백분위 null인데 예산>0(데이터 미스)"].push(name);
    if (r.vibeNote) warn["입지 미스 vibeNote"].push(name);
    if (r.candidates.length === 0 && r.overBudgetCandidates.length > 0) warn["예산초과 후보만 나옴"].push(name);

    // 계급 분포
    if (bp !== null) {
      const t = budgetTier(bp);
      tierDist[t.label] = (tierDist[t.label] ?? 0) + 1;
    } else {
      tierDist["(예산0·계급없음)"] = (tierDist["(예산0·계급없음)"] ?? 0) + 1;
    }
  }

  console.log(`──────── 하드 버그 ────────`);
  if (hard.length === 0) console.log("✅ 없음 (크래시·빈화면·예산이상·좌표/데이터·점수범위)");
  else { console.log(`❌ ${hard.length}건`); hard.slice(0, 40).forEach((f) => console.log("  " + f)); }

  console.log(`\n──────── 시원찮은 결과(살펴볼 것) ────────`);
  for (const [cat, names] of Object.entries(warn)) {
    if (names.length === 0) continue;
    console.log(`▷ ${cat}: ${names.length}건`);
    names.slice(0, 12).forEach((n) => console.log("    - " + n));
    if (names.length > 12) console.log(`    ...외 ${names.length - 12}건`);
  }
  if (Object.values(warn).every((v) => v.length === 0)) console.log("✅ 없음");

  console.log(`\n──────── 구매력 계급 분포 (${list.length}명) ────────`);
  for (const [label, n] of Object.entries(tierDist).sort((a, b) => b[1] - a[1])) console.log(`  ${label}: ${n}`);

  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
