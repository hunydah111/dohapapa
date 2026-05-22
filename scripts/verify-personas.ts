// 40 페르소나 종합 검증 — 최근 변경(빈화면 가드·미니맵·폼 기본 펼침·예산) 회귀 점검.
// recommendComplexes + estimateBudget 를 다양한 입력에 돌려 불변식을 검사한다.
// 하나라도 깨지면 exit 1. mock 통근 강제(빠르고 결정적).
delete process.env.KAKAO_REST_KEY;

import { recommendComplexes } from "@/lib/recommend";
import { db } from "@/lib/db";
import type { RecommendationResult, MoreCandidate, RelaxationAction } from "@/types/recommendation";
import type { CoupleProfile, Workplace, AreaRangeKey, HouseholdType, CommuteMode } from "@/types/profile";

const WP: Record<string, { lat: number; lng: number }> = {
  강남역: { lat: 37.498086, lng: 127.028001 },
  성수역: { lat: 37.544588, lng: 127.056066 },
  판교역: { lat: 37.394776, lng: 127.111209 },
  광화문: { lat: 37.571648, lng: 126.976872 },
  여의도: { lat: 37.521624, lng: 126.924191 },
};
const wp = (n: keyof typeof WP, m: CommuteMode, min: number): Workplace => ({ label: n, lat: WP[n].lat, lng: WP[n].lng, commuteMode: m, maxCommuteMinutes: min });

function base(): CoupleProfile {
  return {
    householdType: "dualIncome",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRange: "p32_35",
    hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0,
    existingLoanMonthlyKrw: 0, hasOwnedHomeBefore: false, isNewlywed: false,
  };
}

// ── 40개 페르소나 ───────────────────────────────────────────────
function personas(): { name: string; p: CoupleProfile }[] {
  const out: { name: string; p: CoupleProfile }[] = [];
  const add = (name: string, p: CoupleProfile) => out.push({ name, p });
  const areas: AreaRangeKey[] = ["under18", "p19_25", "p26_31", "p32_35", "p36_40", "over45"];
  const regionsSet: (string[] | undefined)[] = [undefined, ["강남구"], ["송파구"], ["노원구"], ["은평구"], ["성남시 분당구"], ["화성시 동탄구"], ["가평군"], ["과천시"], ["강남구", "서초구"]];

  // 1) 맞벌이 지하철 — 지역×예산 다양 (simple)
  const duoBudgets = [3e8, 8e8, 13e8, 25e8];
  let i = 0;
  for (const reg of regionsSet) {
    const area = areas[i % areas.length];
    const av = duoBudgets[i % duoBudgets.length];
    add(`duo/지하철30/${reg?.join("+") ?? "전국"}/${area}/${av / 1e8}억(simple)`, {
      ...base(), householdType: "dualIncome", preferredAreaRange: area, requiredRegions: reg,
      budgetMode: "simple", availableBudgetKrw: av, budgetFlex: i % 2 ? "tight" : "normal",
      workplaceA: wp("강남역", "transit", 30), workplaceB: wp("성수역", "transit", 30),
      hasSchoolAgedChild: i % 2 === 0,
    });
    i++;
  }
  // 2) 맞벌이 자차 — detailed (소득·대출, 폼 기본 펼침 경로)
  const incomes = [5e7, 8e7, 1.2e8, 2e8];
  const seeds = [3e7, 1e8, 3e8, 6e8];
  for (let j = 0; j < 8; j++) {
    add(`duo/자차50/detailed/소득${incomes[j % 4] / 1e4}만/현금${seeds[j % 4] / 1e4}만`, {
      ...base(), householdType: "dualIncome", preferredAreaRange: areas[j % areas.length],
      requiredRegions: j % 3 === 0 ? ["송파구"] : undefined, budgetFlex: "relaxed",
      householdIncomeKrwYear: incomes[j % 4], seedMoneyKrw: seeds[j % 4], netAssetsKrw: seeds[j % 4] * 2,
      existingLoanMonthlyKrw: j % 2 ? 500000 : 0, ownedHomeCount: j % 4 === 3 ? 1 : 0,
      isNewlywed: j % 2 === 0, hasInfant: j % 3 === 0, hasTwoOrMoreChildren: j % 5 === 0,
      workplaceA: wp("강남역", "car", 50), workplaceB: wp("판교역", "car", 50),
    });
  }
  // 3) 1인 가구 (single) — 직장 1, 자차/지하철 혼합
  for (let j = 0; j < 8; j++) {
    add(`single/${j % 2 ? "지하철" : "자차"}${20 + (j % 4) * 15}분/${areas[j % areas.length]}`, {
      ...base(), householdType: "single", preferredAreaRange: areas[j % areas.length],
      budgetMode: j % 2 ? "simple" : "detailed",
      availableBudgetKrw: j % 2 ? [4e8, 6e8, 9e8, 15e8][j % 4] : undefined,
      householdIncomeKrwYear: j % 2 ? 0 : 6e7, seedMoneyKrw: j % 2 ? 0 : 1.5e8, netAssetsKrw: j % 2 ? 0 : 3e8,
      requiredRegions: j % 4 === 0 ? ["마포구"] : undefined,
      workplaceA: wp(j % 2 ? "광화문" : "여의도", j % 2 ? "transit" : "car", 20 + (j % 4) * 15),
    });
  }
  // 4) 외벌이 (singleIncome) — 직장 1
  for (let j = 0; j < 6; j++) {
    add(`singleIncome/자차${30 + j * 10}/${areas[j % areas.length]}`, {
      ...base(), householdType: "singleIncome", preferredAreaRange: areas[j % areas.length],
      householdIncomeKrwYear: [6e7, 9e7, 1.3e8][j % 3], seedMoneyKrw: [5e7, 2e8, 5e8][j % 3], netAssetsKrw: [1e8, 4e8, 8e8][j % 3],
      isNewlywed: j % 2 === 0, hasSchoolAgedChild: j % 2 === 1,
      workplaceA: wp("강남역", "car", 30 + j * 10),
    });
  }
  // 5) 은퇴 (retired) — 직장 0, 지역·평수 다양
  for (let j = 0; j < 6; j++) {
    add(`retired/${["강남구", "송파구", "분당구나우", "가평군", "은평구", "노원구"][j]}/${areas[j % areas.length]}`, {
      ...base(), householdType: "retired", priorities: { commute: 0, school: 2, buildingAge: 3, largeComplex: 3 },
      preferredAreaRange: areas[j % areas.length],
      requiredRegions: [["강남구"], ["송파구"], ["성남시 분당구"], ["가평군"], ["은평구"], ["노원구"]][j],
      budgetMode: "simple", availableBudgetKrw: [30e8, 15e8, 9e8, 6e8, 8e8, 5e8][j],
    });
  }
  // 6) 극단 엣지 — 갈아타기·초저예산·초고예산·소득0 detailed
  add(`edge/갈아타기 음수`, { ...base(), householdType: "dualIncome", householdIncomeKrwYear: 7e7, seedMoneyKrw: 5e7, netAssetsKrw: 2e8, existingHome: { expectedSalePriceKrw: 5e8, remainingLoanKrw: 6e8, qualifiesForTaxExemption: false }, workplaceA: wp("강남역", "car", 50), workplaceB: wp("판교역", "car", 50) });
  add(`edge/초저예산 1억(simple)`, { ...base(), householdType: "single", budgetMode: "simple", availableBudgetKrw: 1e8, workplaceA: wp("광화문", "transit", 40) });
  add(`edge/초고예산 50억(simple)`, { ...base(), householdType: "dualIncome", budgetMode: "simple", availableBudgetKrw: 50e8, requiredRegions: ["강남구"], workplaceA: wp("강남역", "car", 40), workplaceB: wp("성수역", "car", 40) });
  add(`edge/detailed 소득0 현금0`, { ...base(), householdType: "single", householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0, workplaceA: wp("여의도", "car", 30) });

  return out.slice(0, 44);
}

// 클라이언트(수정본) 완화 적용 로직 — broken-promise 검증용
function applyRelax(p: CoupleProfile, a: RelaxationAction): CoupleProfile {
  if (a.kind === "budget") return p.budgetMode === "simple" ? { ...p, availableBudgetKrw: (p.availableBudgetKrw ?? 0) + a.addKrw } : { ...p, seedMoneyKrw: p.seedMoneyKrw + a.addKrw };
  if (a.kind === "area") return { ...p, preferredAreaRange: a.areaRange };
  if (a.kind === "commute" && a.workplace === "A" && p.workplaceA) return { ...p, workplaceA: { ...p.workplaceA, maxCommuteMinutes: p.workplaceA.maxCommuteMinutes + a.addMinutes } };
  if (a.kind === "commute" && a.workplace === "B" && p.workplaceB) return { ...p, workplaceB: { ...p.workplaceB, maxCommuteMinutes: p.workplaceB.maxCommuteMinutes + a.addMinutes } };
  return p;
}

const inSudogwon = (lat: number, lng: number) => lat > 36.8 && lat < 38.4 && lng > 126.2 && lng < 127.9;

function checkCandidateData(c: MoreCandidate, ctx: string, fails: string[]) {
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || !inSudogwon(c.latitude, c.longitude))
    fails.push(`${ctx}: 좌표 이상 (${c.latitude},${c.longitude}) [미니맵 깨짐]`);
  if (!c.complexName) fails.push(`${ctx}: 단지명 빔`);
  if (!(c.medianPriceKrw > 0)) fails.push(`${ctx}: 가격 ${c.medianPriceKrw}`);
  if (!(c.representativeArea > 0)) fails.push(`${ctx}: 평형 ${c.representativeArea}`);
}

async function main() {
  const list = personas();
  console.log(`▶ ${list.length} 페르소나 검증 시작 (mock 통근)\n`);
  let pass = 0;
  const allFails: string[] = [];

  for (const { name, p } of list) {
    const fails: string[] = [];
    let r: RecommendationResult | null = null;
    try {
      r = await recommendComplexes(p);
    } catch (e) {
      allFails.push(`✗ CRASH ${name}: ${(e as Error).message}`);
      console.log(`✗ CRASH ${name}`);
      continue;
    }
    // 구조
    for (const k of ["candidates", "moreCandidates", "overLimitCandidates", "overBudgetCandidates", "closestCandidates", "relaxationSuggestions"] as const)
      if (!Array.isArray(r[k])) fails.push(`구조: ${k} 배열 아님`);
    if (!r.disclaimer) fails.push("disclaimer 누락");
    // 빈 화면
    const apt = r.candidates.length + r.closestCandidates.length + r.overBudgetCandidates.length + r.overLimitCandidates.length;
    if (apt === 0 && r.relaxationSuggestions.length === 0) fails.push("막다른 빈 화면(아파트0+제안0)");
    // 예산
    const b = r.budget;
    for (const [k, v] of Object.entries({ net: b.netPurchasePowerKrw, gross: b.grossBudgetKrw, equity: b.totalEquityKrw, loan: b.loanEstimateKrw, acq: b.acquisitionCostsKrw, monthly: b.monthlyPaymentKrw }))
      if (!Number.isFinite(v as number)) fails.push(`예산 ${k} 비유한 ${v}`);
    if (b.netPurchasePowerKrw < 0) fails.push(`예산 net 음수 ${b.netPurchasePowerKrw}`);
    if (b.isEstimate !== true) fails.push("isEstimate!=true");
    // 후보 데이터(미니맵·카드 입력)
    r.candidates.forEach((c, idx) => {
      checkCandidateData({ ...c } as unknown as MoreCandidate, `candidate#${idx + 1}`, fails);
      if (c.totalScore < 0 || c.totalScore > 100) fails.push(`candidate#${idx + 1} 점수 ${c.totalScore}`);
      if (!Array.isArray(c.commuteLegs)) fails.push(`candidate#${idx + 1} commuteLegs 아님`);
      c.commuteLegs.forEach((l) => { if (!(l.mode === "car" || l.mode === "transit")) fails.push(`leg mode ${l.mode}`); if (!Number.isFinite(l.minutes) || l.minutes < 0) fails.push(`leg minutes ${l.minutes}`); });
    });
    r.moreCandidates.forEach((c, idx) => checkCandidateData(c, `more#${idx}`, fails));
    r.closestCandidates.forEach((c, idx) => checkCandidateData(c, `closest#${idx}`, fails));
    // broken-promise: 완화 제안 클릭 후 candidates>0 (성공 헤드라인)
    for (const s of r.relaxationSuggestions) {
      if (s.resultCount <= 0) continue;
      try {
        const r2 = await recommendComplexes(applyRelax(p, s.action));
        if (r2.candidates.length === 0) fails.push(`broken-promise: "${s.message}"(약속 ${s.resultCount}) → 클릭후 candidates=0`);
      } catch (e) {
        fails.push(`완화 재검색 CRASH: ${(e as Error).message}`);
      }
    }

    if (fails.length === 0) { pass++; }
    else { for (const f of fails) allFails.push(`✗ ${name} — ${f}`); console.log(`✗ ${name} (${fails.length} 실패)`); }
  }

  console.log(`\n──────── 결과 ────────`);
  console.log(`페르소나 ${list.length} · 통과 ${pass} · 실패 ${list.length - pass}`);
  if (allFails.length) {
    console.log(`\n실패 상세:`);
    for (const f of allFails.slice(0, 60)) console.log("  " + f);
    if (allFails.length > 60) console.log(`  ...외 ${allFails.length - 60}건`);
  } else {
    console.log("✅ 전원 통과 — 크래시·빈화면·broken-promise·예산이상·미니맵좌표·데이터무결성 모두 OK");
  }
  await db.$disconnect();
  if (allFails.length) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
