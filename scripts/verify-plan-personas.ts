// 내 집 마련 플랜(무주택) — 40 페르소나 검증 시뮬레이션.
// estimateBudget + computePlan 을 다양한 (소득·현금·저축·부업·목표·플래그)에 돌려
// 불변식·엣지·"끝은 희망" 위반을 수집한다. 순수함수라 DB/네트워크 불필요.
// 실행: npx tsx scripts/verify-plan-personas.ts
import { estimateBudget } from "@/lib/budget";
import { computePlan, type PlanResult } from "@/lib/plan";
import type { CoupleProfile } from "@/types/profile";
import regionPrices from "@/data/regionPrices.json";

const R = regionPrices.regions as Record<string, Record<string, { medianKrw: number }>>;
const tp = (sgg: string, band: string) => R[sgg]?.[band]?.medianKrw ?? 0;

const 만 = 10_000;
const 억 = 1e8;

function base(over: Partial<CoupleProfile>): CoupleProfile {
  return {
    householdType: "single",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    budgetMode: "detailed",
    householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0,
    existingLoanMonthlyKrw: 0, hasOwnedHomeBefore: false, isNewlywed: false,
    ownedHomeCount: 0,
    ...over,
  };
}

interface Persona {
  name: string;
  profile: CoupleProfile;
  target: number;
  saveM: number; // 만원
  sideM: number; // 만원
  sigungu?: string; // 2025.10.15 대책 LTV·DSR 분기용
}

function personas(): Persona[] {
  const out: Persona[] = [];
  const incomes = [0, 3000, 5000, 7000, 10000, 15000, 20000]; // 만원
  const cashes = [0, 5000, 10000, 20000, 30000, 50000]; // 만원
  const saves = [0, 50, 150, 300, 500];
  const sides = [0, 100, 300];
  const targets: { label: string; krw: number; sigungu?: string }[] = [
    { label: "구리under18", krw: tp("구리시", "under18"), sigungu: "구리시" },
    { label: "구리32평", krw: tp("구리시", "p32_35"), sigungu: "구리시" },
    { label: "마포32평", krw: tp("마포구", "p32_35"), sigungu: "마포구" },
    { label: "강남over45", krw: tp("강남구", "over45"), sigungu: "강남구" },
    { label: "수동0", krw: 0 },
    { label: "수동1억", krw: 1 * 억 },
    { label: "수동50억", krw: 50 * 억 },
  ];
  const flagSets = [
    { label: "무주택", over: { hasOwnedHomeBefore: false } },
    { label: "신혼", over: { isNewlywed: true } },
    { label: "출산", over: { hasInfant: true } },
    { label: "유주택", over: { hasOwnedHomeBefore: true, ownedHomeCount: 1 } },
  ];

  // 40 조합 — 배열들을 서로소 인덱스로 회전.
  for (let i = 0; i < 40; i++) {
    const inc = incomes[i % incomes.length];
    const cash = cashes[(i * 3) % cashes.length];
    const save = saves[i % saves.length];
    const side = sides[i % sides.length];
    const t = targets[i % targets.length];
    const fs = flagSets[i % flagSets.length];
    out.push({
      name: `#${i + 1} 소득${inc}/현금${cash}/저축${save}/부업${side}/${t.label}/${fs.label}`,
      profile: base({
        householdIncomeKrwYear: inc * 만,
        seedMoneyKrw: cash * 만,
        netAssetsKrw: cash * 만,
        existingLoanMonthlyKrw: i % 4 === 0 ? 300_000 : 0,
        ...fs.over,
      }),
      target: t.krw,
      saveM: save,
      sideM: side,
      sigungu: t.sigungu,
    });
  }
  return out;
}

const finite = (n: number) => Number.isFinite(n);

function check(name: string, plan: PlanResult, target: number): string[] {
  const errs: string[] = [];
  const E = (m: string) => errs.push(`[${name}] ${m}`);

  // 1. 유한성
  for (const [k, v] of Object.entries({
    purchaseNow: plan.purchaseNowKrw,
    gap: plan.gapKrw,
    accum: plan.monthlyAccumKrw,
    loan: plan.loanKrw,
    acq: plan.acqCostKrw,
  })) {
    if (!finite(v)) E(`${k} 비유한값 ${v}`);
  }
  // 2. 음수 금지
  if (plan.gapKrw < 0) E(`gap 음수 ${plan.gapKrw}`);
  if (plan.monthlyAccumKrw < 0) E(`accum 음수`);
  // 3. 시나리오 값
  const byKey = Object.fromEntries(plan.scenarios.map((s) => [s.key, s.months]));
  for (const s of plan.scenarios) {
    if (s.months !== null && (!Number.isInteger(s.months) || s.months < 0))
      E(`시나리오 ${s.key} months 이상 ${s.months}`);
  }
  // 4. 순서 down<=flat<=up (null=∞)
  const ord = (m: number | null) => (m === null ? Infinity : m);
  if (ord(byKey.down) > ord(byKey.flat)) E(`순서위반 down>flat (${byKey.down}>${byKey.flat})`);
  if (ord(byKey.flat) > ord(byKey.up)) E(`순서위반 flat>up (${byKey.flat}>${byKey.up})`);
  // 5. 이미 가능 → 전부 0
  if (plan.gapKrw === 0 && target > 0) {
    for (const s of plan.scenarios) if (s.months !== 0) E(`gap0인데 ${s.key}!=0`);
  }
  // 6. 저축0+갭>0 → 보합 null
  if (plan.monthlyAccumKrw === 0 && plan.gapKrw > 0 && byKey.flat !== null)
    E(`저축0·갭>0인데 보합 ${byKey.flat}(null이어야)`);
  // 7. 곡선
  const { years, affordable, price } = plan.curve;
  if (affordable.length !== years.length || price.up.length !== years.length)
    E(`곡선 길이 불일치`);
  for (let j = 1; j < years.length; j++) {
    if (affordable[j] < affordable[j - 1] - 1) E(`구매가능가 감소 @${j}`);
    if (price.up[j] < price.up[j - 1] - 1) E(`상승가 감소 @${j}`);
  }
  if ([...affordable, ...price.up, ...price.down].some((v) => !finite(v)))
    E(`곡선 비유한값`);
  return errs;
}

const list = personas();
let hard = 0;
const hopeless: string[] = [];
const allErrs: string[] = [];

for (const p of list) {
  let plan: PlanResult;
  try {
    const budget = estimateBudget(p.profile, {
      targetPriceKrw: p.target > 0 ? p.target : undefined,
      sigungu: p.sigungu,
    });
    plan = computePlan(budget, p.profile, {
      targetPriceKrw: p.target,
      monthlySavingKrw: p.saveM * 만,
      monthlySideKrw: p.sideM * 만,
    });
  } catch (e) {
    hard++;
    allErrs.push(`[${p.name}] 💥 throw: ${(e as Error).message}`);
    continue;
  }
  const errs = check(p.name, plan, p.target);
  if (errs.length) {
    hard += errs.length;
    allErrs.push(...errs);
  }
  // 소프트: 전부 40년+ (희망 없음)
  if (p.target > 0 && plan.scenarios.every((s) => s.months === null)) {
    hopeless.push(`[${p.name}] 전 시나리오 40년+ (gap ${(plan.gapKrw / 억).toFixed(1)}억·월순증 ${(plan.monthlyAccumKrw / 만).toFixed(0)}만)`);
  }
}

console.log(`\n=== 플랜 40 페르소나 검증 ===`);
console.log(`실행 ${list.length} · 하드이슈 ${hard} · 희망없음(40년+) ${hopeless.length}`);
console.log(`\n[하드 이슈]`);
console.log(allErrs.length ? allErrs.join("\n") : "  (없음 — 불변식 전부 통과)");
console.log(`\n[희망없음 케이스 (UX 점검)]`);
console.log(hopeless.length ? hopeless.join("\n") : "  (없음)");
process.exit(hard > 0 ? 1 : 0);
