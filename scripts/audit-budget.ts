// 대출/예산 엔진 전수 감사 — estimateBudget + 정책대출 + 부대비용을 100+ 페르소나에 돌려
// 불변식 위반(비유한·음수·경계초과), 단조성 역전(소득·현금·기존대출·보유수), 정책 자격
// 일관성을 점검한다. LTV 역전 버그(고소득→2억)처럼 "구멍"을 빠짐없이 잡는 게 목적.
// 실행: npx tsx scripts/audit-budget.ts
import { estimateBudget } from "@/lib/budget";
import { evaluatePolicyLoans } from "@/lib/policyLoan";
import type { CoupleProfile } from "@/types/profile";

const 만 = 10_000, 억 = 1e8;
const e = (n: number) => (n / 억).toFixed(2) + "억";

function base(o: Partial<CoupleProfile> = {}): CoupleProfile {
  return {
    householdType: "single",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    hasSchoolAgedChild: false, hasInfant: false, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    budgetMode: "detailed",
    householdIncomeKrwYear: 0, seedMoneyKrw: 0, netAssetsKrw: 0,
    existingLoanMonthlyKrw: 0, hasOwnedHomeBefore: false, isNewlywed: false, ownedHomeCount: 0,
    ...o,
  };
}

const POLICY_CEILINGS = [6000, 7000, 8500, 20000].map((m) => m * 만); // 정책 소득요건 경계(원)
const NET_ASSET_CEIL = 511_000_000; // 디딤돌 신혼 순자산
const nearCeil = (a: number, b: number) =>
  POLICY_CEILINGS.some((c) => (a <= c && b > c) || (b <= c && a > c));

const hard: string[] = [];
const mono: string[] = [];

// ── 1) 프로필별 불변식 ──────────────────────────────────────────────
const incomes = [0, 2000, 3000, 4000, 5000, 6000, 7000, 8500, 10000, 13000, 15000, 20000, 30000];
const cashes = [0, 3000, 5000, 10000, 20000, 30000, 50000, 80000, 100000];
const flagSets: { label: string; o: Partial<CoupleProfile> }[] = [
  { label: "무주택", o: {} },
  { label: "신혼", o: { isNewlywed: true } },
  { label: "신생아", o: { hasInfant: true } },
  { label: "1주택", o: { hasOwnedHomeBefore: true, ownedHomeCount: 1 } },
  { label: "2주택", o: { hasOwnedHomeBefore: true, ownedHomeCount: 2 } },
  { label: "기존대출50만", o: { existingLoanMonthlyKrw: 500_000 } },
  { label: "은퇴", o: { householdType: "retired" } },
];

let count = 0;
for (const inc of incomes) for (const cash of cashes) for (const fs of flagSets) {
  const p = base({ householdIncomeKrwYear: inc * 만, seedMoneyKrw: cash * 만, netAssetsKrw: cash * 만, ...fs.o });
  let b;
  try { b = estimateBudget(p); } catch (err) { hard.push(`💥 throw [소득${inc}/현금${cash}/${fs.label}]: ${(err as Error).message}`); continue; }
  count++;
  const tag = `[소득${inc}/현금${cash}/${fs.label}]`;
  const nums: [string, number][] = [
    ["loan", b.loanEstimateKrw], ["equity", b.totalEquityKrw], ["gross", b.grossBudgetKrw],
    ["acq", b.acquisitionCostsKrw], ["netBuy", b.netPurchasePowerKrw], ["monthly", b.monthlyPaymentKrw],
  ];
  for (const [k, v] of nums) if (!Number.isFinite(v)) hard.push(`${tag} ${k} 비유한 ${v}`);
  if (b.loanEstimateKrw < 0) hard.push(`${tag} loan 음수 ${e(b.loanEstimateKrw)}`);
  if (b.loanEstimateKrw > 6 * 억 + 만) hard.push(`${tag} loan 6억 상한 초과 ${e(b.loanEstimateKrw)}`);
  if (b.netPurchasePowerKrw < 0) hard.push(`${tag} netBuy 음수`);
  if (b.monthlyPaymentKrw < 0) hard.push(`${tag} monthly 음수`);
  if (Math.abs(b.grossBudgetKrw - (b.totalEquityKrw + b.loanEstimateKrw)) > 1) hard.push(`${tag} gross≠equity+loan`);
  if (b.safeLine && b.safeLine.loanEstimateKrw > b.loanEstimateKrw + 1) hard.push(`${tag} safeLine.loan > loan`);
  if (b.paymentToIncomeRatio !== undefined && (!Number.isFinite(b.paymentToIncomeRatio) || b.paymentToIncomeRatio < 0)) hard.push(`${tag} P/I 이상 ${b.paymentToIncomeRatio}`);
  // 소득 있는데 대출 0 (자기자본 충분·정책 적격인데) — 의심
  if (inc >= 5000 && cash >= 5000 && fs.label === "무주택" && b.loanEstimateKrw < 1 * 억)
    hard.push(`${tag} 무주택·소득5천↑·현금5천↑인데 대출<1억 (${e(b.loanEstimateKrw)})`);
  // DSR 준수: 신규 대출 월상환 ≤ 가용분(소득×40%/12 − 기존대출). 가용분이 음수면 신규 0이어야.
  const existMonthly = (fs.o.existingLoanMonthlyKrw as number) ?? 0;
  const availMonthly = Math.max(0, (inc * 만 * 0.4) / 12 - existMonthly);
  if (b.monthlyPaymentKrw > availMonthly + 만)
    hard.push(`${tag} DSR 초과: 신규 월상환 ${Math.round(b.monthlyPaymentKrw / 만)}만 > 가용 ${Math.round(availMonthly / 만)}만`);
}

// ── 2) 소득 단조성: 소득↑ → 대출·netBuy 비감소 (정책 경계 제외) ──────────
for (const cash of cashes) for (const fs of flagSets) {
  let prevLoan = -1, prevNet = -1, prevInc = -1;
  for (const inc of incomes) {
    const p = base({ householdIncomeKrwYear: inc * 만, seedMoneyKrw: cash * 만, netAssetsKrw: cash * 만, ...fs.o });
    const b = estimateBudget(p);
    if (prevLoan >= 0) {
      const ceil = nearCeil(prevInc * 만, inc * 만);
      if (b.loanEstimateKrw < prevLoan - 만 && !ceil)
        mono.push(`소득↑인데 대출↓ [현금${cash}/${fs.label}] ${prevInc}→${inc}만: ${e(prevLoan)}→${e(b.loanEstimateKrw)}`);
      if (b.netPurchasePowerKrw < prevNet - 만 && !ceil)
        mono.push(`소득↑인데 netBuy↓ [현금${cash}/${fs.label}] ${prevInc}→${inc}만: ${e(prevNet)}→${e(b.netPurchasePowerKrw)}`);
    }
    prevLoan = b.loanEstimateKrw; prevNet = b.netPurchasePowerKrw; prevInc = inc;
  }
}

// ── 3) 현금 단조성: 현금↑ → equity·netBuy 비감소 (순자산 경계 제외) ──────
for (const inc of incomes) for (const fs of flagSets) {
  let prevEq = -Infinity, prevNet = -1, prevCash = -1;
  for (const cash of cashes) {
    const p = base({ householdIncomeKrwYear: inc * 만, seedMoneyKrw: cash * 만, netAssetsKrw: cash * 만, ...fs.o });
    const b = estimateBudget(p);
    const naCeil = prevCash >= 0 && ((prevCash * 만 <= NET_ASSET_CEIL && cash * 만 > NET_ASSET_CEIL));
    if (prevCash >= 0) {
      if (b.totalEquityKrw < prevEq - 만) mono.push(`현금↑인데 equity↓ [소득${inc}/${fs.label}] ${prevCash}→${cash}만`);
      if (b.netPurchasePowerKrw < prevNet - 만 && !naCeil)
        mono.push(`현금↑인데 netBuy↓ [소득${inc}/${fs.label}] ${prevCash}→${cash}만: ${e(prevNet)}→${e(b.netPurchasePowerKrw)}`);
    }
    prevEq = b.totalEquityKrw; prevNet = b.netPurchasePowerKrw; prevCash = cash;
  }
}

// ── 4) 기존대출↑ → 대출 비증가 / 보유수↑ → 대출 비증가 ──────────────────
for (const inc of [4000, 7000, 10000, 15000]) for (const cash of [10000, 30000]) {
  const loanByExisting = [0, 300_000, 600_000, 1_000_000].map((ex) =>
    estimateBudget(base({ householdIncomeKrwYear: inc * 만, seedMoneyKrw: cash * 만, netAssetsKrw: cash * 만, existingLoanMonthlyKrw: ex })).loanEstimateKrw);
  for (let i = 1; i < loanByExisting.length; i++)
    if (loanByExisting[i] > loanByExisting[i - 1] + 만) mono.push(`기존대출↑인데 대출↑ [소득${inc}/현금${cash}] ${e(loanByExisting[i - 1])}→${e(loanByExisting[i])}`);

  const loanByOwn = [0, 1, 2].map((oc) =>
    estimateBudget(base({ householdIncomeKrwYear: inc * 만, seedMoneyKrw: cash * 만, netAssetsKrw: cash * 만, hasOwnedHomeBefore: oc > 0, ownedHomeCount: oc })).loanEstimateKrw);
  for (let i = 1; i < loanByOwn.length; i++)
    if (loanByOwn[i] > loanByOwn[i - 1] + 만) mono.push(`보유수↑인데 대출↑ [소득${inc}/현금${cash}] ${i - 1}→${i}채: ${e(loanByOwn[i - 1])}→${e(loanByOwn[i])}`);
}

// ── 5) 정책 자격 단조성: 소득↑ → 적격 정책 집합은 축소만 ──────────────────
for (const fs of flagSets) {
  let prevSet: Set<string> | null = null, prevInc = -1;
  for (const inc of incomes) {
    const p = base({ householdIncomeKrwYear: inc * 만, seedMoneyKrw: 10000 * 만, netAssetsKrw: 10000 * 만, ...fs.o });
    const set = new Set(evaluatePolicyLoans(p).filter((m) => m.eligible).map((m) => m.productName));
    if (prevSet) for (const prod of set) if (!prevSet.has(prod)) mono.push(`소득↑인데 정책자격 새로 생김 [${fs.label}] ${prevInc}→${inc}만: +${prod}`);
    prevSet = set; prevInc = inc;
  }
}

// ── 6) 갈아타기(existingHome) — 언더워터 포함 ────────────────────────────
let gcount = 0;
for (const inc of [4000, 7000, 12000]) for (const sale of [30000, 50000, 80000]) for (const rem of [0, 30000, 60000, 90000]) for (const exempt of [true, false]) {
  const p = base({ householdIncomeKrwYear: inc * 만, seedMoneyKrw: 5000 * 만, netAssetsKrw: 5000 * 만, hasOwnedHomeBefore: true, ownedHomeCount: 1, existingHome: { expectedSalePriceKrw: sale * 만, remainingLoanKrw: rem * 만, qualifiesForTaxExemption: exempt } });
  let b; try { b = estimateBudget(p); } catch (err) { hard.push(`💥 갈아타기 throw [소득${inc}/매도${sale}/잔금${rem}/면세${exempt}]: ${(err as Error).message}`); continue; }
  gcount++;
  const t = `[갈아타기 소득${inc}/매도${sale}/잔금${rem}/면세${exempt}]`;
  for (const [k, v] of [["loan", b.loanEstimateKrw], ["equity", b.totalEquityKrw], ["netBuy", b.netPurchasePowerKrw], ["monthly", b.monthlyPaymentKrw]] as [string, number][]) if (!Number.isFinite(v)) hard.push(`${t} ${k} 비유한 ${v}`);
  if (b.loanEstimateKrw < 0) hard.push(`${t} loan 음수`);
  if (b.loanEstimateKrw > 6 * 억 + 만) hard.push(`${t} loan 6억 초과 ${e(b.loanEstimateKrw)}`);
  if (b.netPurchasePowerKrw < 0) hard.push(`${t} netBuy 음수`);
}

// ── 7) 간단모드 + 추가자금 ───────────────────────────────────────────────
let scount = 0;
for (const avail of [0, 10000, 30000, 50000, 100000]) {
  let b; try { b = estimateBudget(base({ budgetMode: "simple", availableBudgetKrw: avail * 만 })); } catch (err) { hard.push(`💥 간단모드 throw [가용${avail}]: ${(err as Error).message}`); continue; }
  scount++;
  if (!Number.isFinite(b.netPurchasePowerKrw) || b.netPurchasePowerKrw < 0) hard.push(`[간단모드 가용${avail}] netBuy 이상 ${b.netPurchasePowerKrw}`);
}
for (const add of [3000, 10000, 30000]) {
  const b0 = estimateBudget(base({ householdIncomeKrwYear: 6000 * 만, seedMoneyKrw: 10000 * 만, netAssetsKrw: 10000 * 만 }));
  const b1 = estimateBudget(base({ householdIncomeKrwYear: 6000 * 만, seedMoneyKrw: 10000 * 만, netAssetsKrw: 10000 * 만, additionalFundsKrw: add * 만 }));
  if (b1.netPurchasePowerKrw < b0.netPurchasePowerKrw - 만) hard.push(`추가자금↑인데 netBuy↓ (+${add}만): ${e(b0.netPurchasePowerKrw)}→${e(b1.netPurchasePowerKrw)}`);
}

// ── 8) 정책 소득요건 경계 정확성 (천장 이하 적격 / 초과 부적격) ──────────
const boundaryTests: [string, Partial<CoupleProfile>, number, string][] = [
  ["디딤돌(일반) 7천", {}, 70_000_000, "디딤돌(일반)"],
  ["디딤돌(신혼) 8,500", { isNewlywed: true }, 85_000_000, "디딤돌(신혼)"],
  ["보금자리 7천", {}, 70_000_000, "보금자리론"],
  ["신생아 2억", { hasInfant: true }, 200_000_000, "신생아 특례 디딤돌"],
];
for (const [label, o, ceil, prod] of boundaryTests) {
  const atCeil = evaluatePolicyLoans(base({ householdIncomeKrwYear: ceil, seedMoneyKrw: 10000 * 만, netAssetsKrw: 10000 * 만, ...o }));
  const overCeil = evaluatePolicyLoans(base({ householdIncomeKrwYear: ceil + 1, seedMoneyKrw: 10000 * 만, netAssetsKrw: 10000 * 만, ...o }));
  const atOk = atCeil.find((m) => m.productName === prod)?.eligible;
  const overOk = overCeil.find((m) => m.productName === prod)?.eligible;
  if (atOk !== true) hard.push(`경계: ${label} 천장에서 ${prod} 부적격 (적격이어야)`);
  if (overOk !== false) hard.push(`경계: ${label} 천장+1원에서 ${prod} 적격 (부적격이어야)`);
}

console.log(`\n=== 대출/예산 엔진 전수 감사 (프로필 ${count} + 갈아타기 ${gcount} + 간단 ${scount} + 경계 ${boundaryTests.length}) ===`);
console.log(`\n[하드 이슈 ${hard.length}]`);
console.log(hard.length ? hard.join("\n") : "  (없음)");
console.log(`\n[단조성/정책 역전 ${mono.length}]`);
console.log(mono.length ? mono.join("\n") : "  (없음)");
process.exit(hard.length + mono.length > 0 ? 1 : 0);
