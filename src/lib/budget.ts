// 예산 추정 — 공개된 DSR/LTV 공식만 적용. 특정 은행 상품 미참조.
// 모든 수치는 "추정(isEstimate: true)"으로 반환되며 실제 대출 심사 결과와 다를 수 있음.
//
// 변경 이력:
//   - opts 인자 제거: 항상 서울 규제지역으로 가정
//   - 스트레스 DSR 가산율 7% → 5.5% (수도권 1.5%p 가산 원칙 반영)
//   - acquisitionCost flat 3.5% → estimateAcquisitionCosts 정밀 모듈 연결
//   - 갈아타기 homeSaleNetKrw 음수 클램프 제거 + 경고 추가
//   - 기존 대출이 DSR 한도 초과 시 경고 추가
//   - 정책대출 자격 판정 후 일반 DSR 한도와 비교해 유리한 쪽 채택

import type { CoupleProfile } from "@/types/profile";
import type { BudgetEstimate } from "@/types/recommendation";
import { estimateCapitalGainsTax } from "@/lib/capitalGainsTax";
import { estimateAcquisitionCosts } from "@/lib/acquisitionCost";
import { evaluatePolicyLoans } from "@/lib/policyLoan";

const HUNDRED_MILLION = 100_000_000; // 1억

/**
 * 원리금균등(PMT) 역산: 월상환액으로 대출 원금을 계산.
 * P = PMT × (1 − (1+r)^−n) / r
 *
 * WHY r=0 가드: 무이자 정책(r=0)이면 PMT = principal/n 이므로 principal = PMT*n.
 */
function loanPrincipalFromMonthlyPayment(
  monthlyPayment: number,
  annualRate: number,
  months: number,
): number {
  if (monthlyPayment <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return monthlyPayment * months;
  return (monthlyPayment * (1 - Math.pow(1 + r, -months))) / r;
}

/**
 * 원리금균등 월상환액(PMT) 계산.
 * PMT = P × r / (1 − (1+r)^−n)
 *
 * WHY r=0 가드: 무이자이면 PMT = principal/n.
 */
function monthlyPaymentFromPrincipal(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/**
 * 가구 프로필로부터 구매 예산을 추정한다.
 *
 * 항상 서울 규제지역을 가정 (opts 인자 제거).
 * 정책대출 자격 판정을 수행해 일반 DSR 한도와 비교, 유리한 쪽을 채택한다.
 */
/**
 * 간단 모드 — 사용자가 "가용 예산(총 동원 가능 자금)"을 직접 입력한 경우.
 * 대출 한도·정책대출 자격을 계산하지 않고, 취득·부대비용만 차감한다.
 */
function estimateSimpleBudget(profile: CoupleProfile): BudgetEstimate {
  const gross = Math.max(0, profile.availableBudgetKrw ?? 0);
  const acResult = estimateAcquisitionCosts(gross, profile);
  const acquisitionCostsKrw = acResult.totalKrw;
  const warnings: string[] = [
    "가용 예산을 직접 입력하셨습니다 — 대출 한도·정책대출 자격은 계산하지 않았어요.",
    "실제 한도·세액은 금융기관·세무 상담 결과에 따릅니다.",
  ];
  let netPurchasePowerKrw = gross - acquisitionCostsKrw;
  if (netPurchasePowerKrw < 0) {
    warnings.push("입력 예산이 취득·부대비용보다 적어 실매수 가능가 0 처리");
    netPurchasePowerKrw = 0;
  }
  return {
    seedMoneyKrw: gross,
    homeSaleNetKrw: 0,
    capitalGainsTaxKrw: 0,
    totalEquityKrw: gross,
    loanEstimateKrw: 0,
    appliedLoanType: "general",
    appliedPolicyName: undefined,
    policyLoanMatches: [],
    monthlyPaymentKrw: 0,
    grossBudgetKrw: gross,
    acquisitionCostsKrw,
    netPurchasePowerKrw,
    isEstimate: true,
    assumptions: [
      "가용 예산 직접 입력 — 대출/정책 계산 생략",
      "취득·부대비용만 차감해 실매수 가능가 산출",
    ],
    warnings,
    loanReasonLines: [
      "대출까지 포함해 계산받으려면 '자세히'를 펼쳐 소득·대출을 입력하세요.",
    ],
  };
}

export function estimateBudget(profile: CoupleProfile): BudgetEstimate {
  // 간단 모드 — 가용 예산 직접 입력 시 대출 계산을 건너뛴다.
  if (profile.budgetMode === "simple") {
    return estimateSimpleBudget(profile);
  }

  const {
    householdIncomeKrwYear,
    seedMoneyKrw,
    existingLoanMonthlyKrw,
    hasOwnedHomeBefore,
    existingHome,
    householdType,
  } = profile;
  const additionalFundsKrw = Math.max(0, profile.additionalFundsKrw ?? 0);

  const warnings: string[] = [];

  // ── 1. 기존 집 매도 순수령액 계산 (갈아타기) ──────────────────────────────
  // WHY 음수 클램프 금지: 잔금·세금이 매도가를 초과하면 자기자본이 감소한다.
  // 0으로 클램프하면 실제 재정 상태를 왜곡해 예산 과다 추정이 발생하는 가장 위험한 버그.
  let homeSaleNetKrw = 0;
  let capitalGainsTaxKrw = 0;

  if (existingHome !== undefined) {
    const cgt = estimateCapitalGainsTax(existingHome);
    capitalGainsTaxKrw = cgt.taxKrw;
    homeSaleNetKrw =
      existingHome.expectedSalePriceKrw -
      existingHome.remainingLoanKrw -
      capitalGainsTaxKrw;

    // 음수면 경고 — 클램프하지 않고 음수 그대로 totalEquity 를 줄임
    if (homeSaleNetKrw < 0) {
      warnings.push(
        "기존 집 매도 시 잔금·세금이 매도가를 초과 — 추가 자금 필요",
      );
    }
  }

  // ── 2. 가용 자기자본 (음수 가능) ──────────────────────────────────────────
  // 추가 동원자금(전세보증금 회수·부모지원 등)도 자기자본에 합산.
  const totalEquityKrw = seedMoneyKrw + homeSaleNetKrw + additionalFundsKrw;

  // ── 3. DSR 기반 대출 한도 ─────────────────────────────────────────────────
  const annualDsrAllowance = householdIncomeKrwYear * 0.4;
  const monthlyDsrAllowance = annualDsrAllowance / 12;
  const availableMonthly = monthlyDsrAllowance - existingLoanMonthlyKrw;

  // WHY 스트레스 금리 5.5%: 기준 4.0% + 수도권 스트레스 가산 1.5%p = 5.5% 실효.
  // 이전 코드는 3.0%p 가산(= 7%)을 적용해 한도를 10~20% 과소추정했음.
  // 금융위원회 스트레스 DSR 2단계(2024.09 시행): 수도권 변동금리 가산 1.5%p.
  const STRESS_RATE = 0.055; // 4.0% 기준 + 1.5%p = 5.5%
  const LOAN_MONTHS = 360; // 30년 원리금균등

  let dsrLoanCapacity = 0;

  if (availableMonthly <= 0) {
    // WHY 명시적 경고: 소득이 0이거나 기존 대출이 DSR 한도를 이미 초과하면
    // 추가 대출이 불가능한데 조용히 0 처리하면 사용자가 이유를 알 수 없음.
    warnings.push(
      "기존 대출 상환액이 DSR 한도를 초과 — 추가 대출 불가",
    );
    dsrLoanCapacity = 0;
  } else {
    dsrLoanCapacity = loanPrincipalFromMonthlyPayment(
      availableMonthly,
      STRESS_RATE,
      LOAN_MONTHS,
    );
  }

  // ── 4. 정책대출 자격 판정 ────────────────────────────────────────────────
  // WHY 정책대출 우선 검토: 디딤돌·신생아 특례는 일반 대출보다 금리가 낮고
  // 한도가 크기 때문에, 적격이면 일반 DSR 한도와 비교해 유리한 쪽을 채택.
  const policyLoanMatches = evaluatePolicyLoans(profile);

  // 적격 상품 중 한도가 가장 큰 것을 선택
  const eligiblePolicies = policyLoanMatches.filter(
    (m) => m.eligible && m.loanLimitKrw !== undefined,
  );
  const bestPolicy =
    eligiblePolicies.length > 0
      ? eligiblePolicies.reduce((best, cur) =>
          (cur.loanLimitKrw ?? 0) > (best.loanLimitKrw ?? 0) ? cur : best,
        )
      : undefined;

  // 정책대출 한도와 DSR 한도 비교: 한도가 크고 금리가 낮은 쪽 채택.
  // WHY 금리 낮은 쪽 선호: 대출 가능액이 같다면 금리가 낮을수록 유리.
  let appliedLoanType: "policy" | "general" = "general";
  let appliedPolicyName: string | undefined = undefined;
  let finalLoanCapacity = dsrLoanCapacity;
  let appliedRate = STRESS_RATE; // 월상환액 계산용 금리

  if (bestPolicy !== undefined && bestPolicy.loanLimitKrw !== undefined) {
    const policyLimit = bestPolicy.loanLimitKrw;
    // 정책대출 금리 중간값을 대출 가능액 계산에 사용
    const policyRate = ((bestPolicy.rateMin ?? 0) + (bestPolicy.rateMax ?? 0)) / 2 / 100;
    const policyCapacity = loanPrincipalFromMonthlyPayment(
      availableMonthly > 0 ? availableMonthly : 0,
      policyRate,
      LOAN_MONTHS,
    );
    // 정책대출 한도와 DSR로 역산된 정책대출 가능액 중 작은 값
    const effectivePolicyCapacity = Math.min(policyLimit, policyCapacity);

    // WHY 비교 기준: 정책대출이 일반 DSR 한도 초과 또는 금리 낮으면 정책 채택.
    // 같은 한도라면 금리가 낮은 정책대출을 선택.
    if (
      effectivePolicyCapacity > 0 &&
      (effectivePolicyCapacity > dsrLoanCapacity ||
        (effectivePolicyCapacity >= dsrLoanCapacity &&
          policyRate < STRESS_RATE))
    ) {
      appliedLoanType = "policy";
      appliedPolicyName = bestPolicy.productName;
      finalLoanCapacity = effectivePolicyCapacity;
      appliedRate = policyRate;
    }
  }

  // ── 5. LTV 한도 ──────────────────────────────────────────────────────────
  // 가격-대출 순환 참조를 1회 패스로 해결:
  // 추정 매매가 = max(0, totalEquity) + 대출 후보로 가정한 뒤 LTV 상한 역산.
  // WHY max(0, totalEquity): LTV 기준가 산정에서 음수 자기자본은 0으로 취급.
  const equityForLtv = Math.max(0, totalEquityKrw);
  const assumedPrice = equityForLtv + finalLoanCapacity;

  // 생애최초: 70%, 무주택(기보유 없음): 50%.
  // WHY 서울 규제지역 항상 가정: opts 제거로 단순화.
  const ltvRate = !hasOwnedHomeBefore ? 0.7 : 0.5;

  // 가격 구간별 LTV 절대 한도 (2025~2026 기준)
  let bracketCap: number;
  if (assumedPrice <= 15 * HUNDRED_MILLION) {
    bracketCap = 6 * HUNDRED_MILLION;
  } else if (assumedPrice <= 25 * HUNDRED_MILLION) {
    bracketCap = 4 * HUNDRED_MILLION;
  } else {
    bracketCap = 2 * HUNDRED_MILLION;
  }

  const ltvCeiling = Math.min(assumedPrice * ltvRate, bracketCap);

  // ── 6. 최종 대출 추정액 ──────────────────────────────────────────────────
  const loanEstimateKrw = Math.round(Math.min(finalLoanCapacity, ltvCeiling));

  // ── 7. 월 원리금 상환액 ───────────────────────────────────────────────────
  // WHY 채택된 금리 사용: 정책대출이면 그 상품 금리, 일반이면 스트레스 금리 적용.
  const monthlyPaymentKrw = Math.round(
    monthlyPaymentFromPrincipal(loanEstimateKrw, appliedRate, LOAN_MONTHS),
  );

  // ── 8. 총 예산 ────────────────────────────────────────────────────────────
  const grossBudgetKrw = totalEquityKrw + loanEstimateKrw;

  // ── 9. 취득·부대비용 (정밀 모듈 연결) ────────────────────────────────────
  // WHY flat 3.5% 대신 정밀 모듈: acquisitionCost.ts 는 취득세 구간, 중개수수료,
  // 법무사·등기·이사 비용을 구간별로 정밀 산출하는데 기존 budget 에서 죽은 코드였음.
  const acResult = estimateAcquisitionCosts(Math.max(0, grossBudgetKrw), profile);
  const acquisitionCostsKrw = acResult.totalKrw;

  // ── 10. 실매수 가능가 ─────────────────────────────────────────────────────
  // WHY 음수 clamp 후 경고: 취득비용이 총예산을 초과하면 실물 매수 불가 상태.
  // 예: totalEquity 가 크게 음수이거나 자기자본이 극히 적을 때 발생.
  let netPurchasePowerKrw = grossBudgetKrw - acquisitionCostsKrw;
  if (netPurchasePowerKrw < 0) {
    warnings.push(
      "총예산이 취득·부대비용을 충당하지 못함 — 실매수 가능가 0 처리",
    );
    netPurchasePowerKrw = 0;
  }

  // ── 11. 가정 문구 ─────────────────────────────────────────────────────────
  const ltvLabel = !hasOwnedHomeBefore ? "70% (생애최초)" : "50% (무주택)";
  const assumptions: string[] = [
    "서울 전역 규제지역으로 가정",
    "스트레스 DSR +1.5%p 반영 (수도권 가산 원칙, 실효 5.5%)",
    "30년 원리금균등 상환 가정",
    `LTV ${ltvLabel} 적용`,
    "취득·부대비용 정밀 산출 (취득세 구간·중개수수료·법무사 등)",
  ];

  if (appliedLoanType === "policy" && appliedPolicyName !== undefined) {
    assumptions.push(`정책대출 채택: ${appliedPolicyName}`);
  }

  if (existingHome !== undefined) {
    assumptions.push(
      "기존 집 매도 순수령액을 자기자본에 합산 — 매도가·잔금·양도세는 추정",
    );
  }

  if (additionalFundsKrw > 0) {
    assumptions.push(
      `추가 동원자금 ${(additionalFundsKrw / 1e8).toFixed(1)}억을 자기자본에 합산`,
    );
  }

  // ── 12. 경고 문구 보완 ────────────────────────────────────────────────────
  warnings.push("실제 한도·세액은 금융기관·세무 상담 결과에 따릅니다.");

  if (existingLoanMonthlyKrw === 0) {
    warnings.push(
      "기존 대출을 0으로 입력하셨습니다 — 신용대출·자동차할부·학자금 등이 있으면 한도가 줄어듭니다.",
    );
  }

  // WHY 은퇴 경고: 은퇴 가구는 소득이 낮아 DSR 한도가 크게 제한될 수 있음.
  if (householdType === "retired" && householdIncomeKrwYear < 40_000_000) {
    warnings.push("은퇴·저소득 — 대출 한도가 매우 낮게 추정될 수 있습니다.");
  }

  if (existingHome !== undefined) {
    const cgt = estimateCapitalGainsTax(existingHome);
    warnings.push(cgt.note);
  }

  // 정책대출 적격 상품 reason 중 주목할 항목 안내 (최초 적격 상품만)
  if (bestPolicy !== undefined && bestPolicy.eligible) {
    warnings.push(
      `정책대출 자격 가능: ${bestPolicy.productName} — ${bestPolicy.reason}`,
    );
  }

  // ── 13. 대출 산출 근거 ────────────────────────────────────────────────────
  // 사용자가 "왜 이 금액인지" 한 눈에 보도록 단계별 설명을 채운다.
  const eok = (krw: number) => (krw / 1e8).toFixed(1);
  const manwon = (krw: number) =>
    Math.round(krw / 10000).toLocaleString("ko-KR");
  const loanReasonLines: string[] = [];

  if (appliedLoanType === "policy" && bestPolicy !== undefined) {
    const policyLimit = bestPolicy.loanLimitKrw ?? 0;
    loanReasonLines.push(
      `${bestPolicy.productName} 채택 — 정책 한도 ${eok(policyLimit)}억`,
    );
    loanReasonLines.push(`자격 사유: ${bestPolicy.reason}`);

    if (eligiblePolicies.length > 1) {
      const others = eligiblePolicies
        .filter((p) => p.productName !== bestPolicy.productName)
        .map((p) => `${p.productName} ${eok(p.loanLimitKrw ?? 0)}억`)
        .join(", ");
      loanReasonLines.push(
        `적격 정책 ${eligiblePolicies.length}종 중 한도가 가장 큼 (그 외: ${others})`,
      );
    }
    loanReasonLines.push(
      `일반 DSR 한도(약 ${eok(dsrLoanCapacity)}억)와 비교해 정책이 더 유리`,
    );
  } else if (availableMonthly <= 0) {
    // 가용 월상환액 0 — 추가 대출 불가. 정책/일반 비교 문구는 오해를 주므로 생략.
    loanReasonLines.push(
      "기존 대출이 DSR 한도를 이미 차지해 가용 월상환액 0 — 추가 대출 불가",
    );
  } else {
    if (eligiblePolicies.length > 0 && bestPolicy !== undefined) {
      loanReasonLines.push(
        `일반 DSR 대출 채택 — 적격 정책(${bestPolicy.productName} 한도 ${eok(
          bestPolicy.loanLimitKrw ?? 0,
        )}억)보다 DSR 한도가 큼`,
      );
    } else if (policyLoanMatches.every((m) => !m.eligible)) {
      loanReasonLines.push("적격 정책대출 없음 — 일반 DSR 한도로 산출");
    } else {
      loanReasonLines.push("일반 DSR 한도 기준 산출");
    }
    loanReasonLines.push(
      `DSR 40% × 연소득 ${eok(
        householdIncomeKrwYear,
      )}억 ÷ 12 − 기존상환 = 월 가용 ${manwon(availableMonthly)}만원`,
    );
    loanReasonLines.push(
      `30년 원리금균등 + 스트레스 5.5% 환산 → DSR 한도 약 ${eok(
        dsrLoanCapacity,
      )}억`,
    );
  }

  loanReasonLines.push(
    `LTV ${ltvLabel} 상한 ${eok(ltvCeiling)}억과 비교해 작은 값 적용`,
  );

  return {
    seedMoneyKrw,
    homeSaleNetKrw,
    capitalGainsTaxKrw,
    totalEquityKrw,
    loanEstimateKrw,
    appliedLoanType,
    appliedPolicyName,
    policyLoanMatches,
    monthlyPaymentKrw,
    grossBudgetKrw,
    acquisitionCostsKrw,
    netPurchasePowerKrw,
    isEstimate: true,
    assumptions,
    warnings,
    loanReasonLines,
  };
}
