// 예산 추정 — 공개된 DSR/LTV 공식만 적용. 특정 은행 상품 미참조.
// 모든 수치는 "추정(isEstimate: true)"으로 반환되며 실제 대출 심사 결과와 다를 수 있음.
//
// 변경 이력:
//   - opts 인자 제거: 항상 서울 규제지역으로 가정 → **2026-05-26 재도입**:
//     2025.10.15 대책으로 규제지역이 서울25+경기12로 확장되고, 비규제지역은 LTV/DSR
//     다른 트랙이 됨. opts.sigungu 받아 regulation 분류로 분기.
//   - 스트레스 DSR 가산율 7% → 5.5% → 7%(2025.10.16~) → **2026-05-26 분기 도입**:
//     규제 +3.0%p(=7.0% 실효) / 비규제 +1.5%p(=5.5% 실효).
//   - LTV: 70/50/0 일괄 → **2026-05-26 분기**: 규제 40/0/0 · 비규제 70/60/0.
//     (2025.10.15 대책 — 무주택 40% 통합, 유주택 0%; 비규제는 유주택 60%.)
//   - acquisitionCost flat 3.5% → estimateAcquisitionCosts 정밀 모듈 연결
//   - 갈아타기 homeSaleNetKrw 음수 클램프 제거 + 경고 추가
//   - 기존 대출이 DSR 한도 초과 시 경고 추가
//   - 정책대출 자격 판정 후 일반 DSR 한도와 비교해 유리한 쪽 채택

import type { CoupleProfile } from "@/types/profile";
import type { BudgetEstimate, PolicyLoanMatch } from "@/types/recommendation";
import { estimateCapitalGainsTax } from "@/lib/capitalGainsTax";
import { estimateAcquisitionCosts } from "@/lib/acquisitionCost";
import { evaluatePolicyLoans, POLICY_BASIS } from "@/lib/policyLoan";
import { isRegulated } from "@/lib/regulation";

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
 * opts.sigungu 로 규제지역(서울25+경기12) / 비규제지역(나머지 수도권) 분기.
 *   - 규제: LTV 무주택 40% · 유주택 0% · 스트레스 DSR +3.0%p · 가격대캡 6/4/2억
 *   - 비규제: LTV 무주택 70% · 1주택 60% · 2주택+ 0% · 스트레스 DSR +1.5%p · 캡 없음
 *
 * sigungu 미지정 시 보수적으로 **규제지역으로 가정** — 사용자가 예산 과대 추정에
 * 의존해 못 살 집을 고르는 위험보다, 안전한 추정으로 과소가 낫다.
 *
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

export function estimateBudget(
  profile: CoupleProfile,
  opts?: { targetPriceKrw?: number; sigungu?: string | null },
): BudgetEstimate {
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

  // ── 2-1. 지역 분류 (2025.10.15 대책) ─────────────────────────────────────
  // 규제지역(서울25+경기12) → 스트레스 DSR +3.0%p, LTV 매트릭스 40/0/0.
  // 비규제(인천·동탄·구리·남양주 등) → +1.5%p, 70/60/0.
  // sigungu 미지정 시 보수적 규제 가정 (예산 과대 추정 회피).
  const sigunguGiven = opts?.sigungu ?? null;
  const inRegulated = sigunguGiven === null ? true : isRegulated(sigunguGiven);

  // ── 3. DSR 기반 대출 한도 ─────────────────────────────────────────────────
  const annualDsrAllowance = householdIncomeKrwYear * 0.4;
  const monthlyDsrAllowance = annualDsrAllowance / 12;
  const availableMonthly = monthlyDsrAllowance - existingLoanMonthlyKrw;

  // 스트레스 DSR (3단계, 2025.10.16~): 규제지역 +3.0%p(=실효 7.0%), 비규제 +1.5%p(=5.5%).
  // 4.0% 기준금리에 가산. 지방 0.75%p 유예는 수도권 전용 앱이라 미적용.
  const STRESS_RATE = inRegulated ? 0.07 : 0.055;
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
  // D2: 매수 희망가를 알면 정책대출 주택가 요건을 자격 게이트로 적용(모르면 reason 안내만).
  const policyLoanMatches = evaluatePolicyLoans(profile, {
    targetPriceKrw: opts?.targetPriceKrw,
  });

  const eligiblePolicies = policyLoanMatches.filter(
    (m) => m.eligible && m.loanLimitKrw !== undefined,
  );

  // 적격 정책 중 '실효 한도'가 가장 큰 것을 선택.
  // 실효 한도 = min(정책 한도, 해당 금리로 DSR 역산한 대출가능액).
  // WHY 한도 숫자가 아니라 금리 반영: 금리가 낮을수록 같은 월상환액으로 더 많은
  //   원금이 가능하다. 저소득(DSR이 한도보다 작은 경우) 저금리 디딤돌이 고금리
  //   보금자리보다 실제로 더 많이 빌릴 수 있는데, '한도 숫자'로만 고르면 손해.
  //   동률이면 금리가 낮은 상품을 택한다.
  const monthlyForPolicy = availableMonthly > 0 ? availableMonthly : 0;
  let bestPolicy: PolicyLoanMatch | undefined;
  let bestPolicyCapacity = 0;
  let bestPolicyRate = STRESS_RATE;
  for (const m of eligiblePolicies) {
    const rate = ((m.rateMin ?? 0) + (m.rateMax ?? 0)) / 2 / 100;
    const cap = Math.min(
      m.loanLimitKrw ?? 0,
      loanPrincipalFromMonthlyPayment(monthlyForPolicy, rate, LOAN_MONTHS),
    );
    if (
      cap > bestPolicyCapacity ||
      (cap === bestPolicyCapacity && rate < bestPolicyRate)
    ) {
      bestPolicy = m;
      bestPolicyCapacity = cap;
      bestPolicyRate = rate;
    }
  }

  let appliedLoanType: "policy" | "general" = "general";
  let appliedPolicyName: string | undefined = undefined;
  let finalLoanCapacity = dsrLoanCapacity;
  let appliedRate = STRESS_RATE; // 월상환액 계산용 금리

  // 정책 실효 한도가 일반 DSR보다 크거나, 같더라도 금리가 낮으면 정책 채택.
  if (
    bestPolicy !== undefined &&
    bestPolicyCapacity > 0 &&
    (bestPolicyCapacity > dsrLoanCapacity ||
      (bestPolicyCapacity >= dsrLoanCapacity && bestPolicyRate < STRESS_RATE))
  ) {
    appliedLoanType = "policy";
    appliedPolicyName = bestPolicy.productName;
    finalLoanCapacity = bestPolicyCapacity;
    appliedRate = bestPolicyRate;
  }

  // ── 5. LTV 한도 ──────────────────────────────────────────────────────────
  // 가격-대출 순환 참조를 1회 패스로 해결:
  // 추정 매매가 = max(0, totalEquity) + 대출 후보로 가정한 뒤 LTV 상한 역산.
  // WHY max(0, totalEquity): LTV 기준가 산정에서 음수 자기자본은 0으로 취급.
  const equityForLtv = Math.max(0, totalEquityKrw);
  const assumedPrice = equityForLtv + finalLoanCapacity;

  // LTV — 2025.10.15 대책 매트릭스 (보유 × 규제/비규제).
  //   규제(서울25+경기12):  0채 40%(처분조건부 1주택 포함) · 1채 0%(유주택 일괄) · 2채+ 0%
  //   비규제(인천·동탄·구리 등): 0채 70% · 1채 60% · 2채+ 0%
  // 종전 "70/50/0 서울 전역 규제" 일괄 가정 폐기. 무주택 LTV가 70%→40%로 떨어진 게
  // 가장 큰 변화 — 사용자가 못 살 가격을 살 수 있다고 보던 과대 추정을 차단.
  // WHY ownedHomeCount 우선: 자세히 모드 폼이 0/1/2+ 를 받음. 없으면 보유이력 불리언으로 근사.
  const ownedHomeCount =
    profile.ownedHomeCount ?? (hasOwnedHomeBefore ? 1 : 0);
  let ltvRate: number;
  let ltvLabel: string;
  if (ownedHomeCount >= 2) {
    ltvRate = 0;
    ltvLabel = "0% (다주택자 주담대 제한)";
    warnings.push(
      "2주택 이상 보유 — 추가 주택담보대출이 사실상 제한(LTV 0)됩니다. 기존 주택 처분 등 별도 검토가 필요해요.",
    );
  } else if (ownedHomeCount === 1) {
    if (inRegulated) {
      // 규제지역 유주택 — 처분조건부도 무주택과 동등 40% 트랙이지만, "계속 보유 1주택"은 0%.
      // 폼이 "처분조건부" 플래그를 따로 받지 않으므로 보수적으로 유주택 0%로 가정.
      // 정확 처분조건부 입력 추가 시 무주택 트랙으로 흐르게 분기 가능.
      ltvRate = 0;
      ltvLabel = "0% (규제지역 유주택 — 추가 주담대 제한)";
      warnings.push(
        "규제지역(서울25+경기12)에서 유주택자는 추가 주택담보대출이 0% — 처분조건부 매수는 무주택 트랙(40%)로 별도 신청.",
      );
    } else {
      ltvRate = 0.6;
      ltvLabel = "60% (비규제·1주택)";
    }
  } else {
    if (inRegulated) {
      ltvRate = 0.4;
      ltvLabel = "40% (규제·무주택·생애최초 통합)";
    } else {
      ltvRate = 0.7;
      ltvLabel = "70% (비규제·무주택)";
    }
  }

  // 규제지역 가격대별 절대 상한 (15억↓ 6억 / 15~25억 4억 / 25억↑ 2억). 비규제 캡 없음.
  // 타깃가 미상이면 보수적 단일 6억으로 폴백 — assumedPrice 기반 역전 버그(고소득→2억) 회피.
  const targetPrice = opts?.targetPriceKrw;
  const knownPrice = targetPrice !== undefined && targetPrice > 0;
  let bracketCap: number;
  if (!inRegulated) {
    // 비규제: 가격대 절대 상한 없음 → Infinity 로 두면 LTV%만 작용.
    bracketCap = Number.POSITIVE_INFINITY;
  } else if (knownPrice) {
    if (targetPrice <= 15 * HUNDRED_MILLION) bracketCap = 6 * HUNDRED_MILLION;
    else if (targetPrice <= 25 * HUNDRED_MILLION) bracketCap = 4 * HUNDRED_MILLION;
    else bracketCap = 2 * HUNDRED_MILLION;
  } else {
    bracketCap = 6 * HUNDRED_MILLION;
  }

  // LTV 비율 적용 기준가도 타깃가 우선(정확) / 없으면 assumedPrice(보수).
  const priceForLtv = knownPrice ? targetPrice : assumedPrice;
  const ltvCeiling = Math.min(priceForLtv * ltvRate, bracketCap);

  // ── 6. 최종 대출 추정액 ──────────────────────────────────────────────────
  const loanEstimateKrw = Math.round(Math.min(finalLoanCapacity, ltvCeiling));

  // ── 7. 월 원리금 상환액 ───────────────────────────────────────────────────
  // WHY 채택된 금리 사용: 정책대출이면 그 상품 금리, 일반이면 스트레스 금리 적용.
  const monthlyPaymentKrw = Math.round(
    monthlyPaymentFromPrincipal(loanEstimateKrw, appliedRate, LOAN_MONTHS),
  );

  // ── 7-1. 월부담 신호등 (#2) ───────────────────────────────────────────────
  // 월 원리금 ÷ 월 가구소득. 부담 경계는 단정 금지 — UI 에서 "30% 안팎(참고)"로 완화.
  const monthlyIncomeKrw = householdIncomeKrwYear / 12;
  const paymentToIncomeRatio =
    monthlyIncomeKrw > 0 && monthlyPaymentKrw > 0
      ? monthlyPaymentKrw / monthlyIncomeKrw
      : undefined;

  // ── 7-2. 금리 스트레스 (#3) ───────────────────────────────────────────────
  // 적용 금리에서 +1%p / +2%p 오르면 월 원리금이 얼마가 되는지(금리 불안 대응).
  const stressTest =
    loanEstimateKrw > 0
      ? [1, 2].map((deltaRatePct) => ({
          deltaRatePct,
          monthlyPaymentKrw: Math.round(
            monthlyPaymentFromPrincipal(
              loanEstimateKrw,
              appliedRate + deltaRatePct / 100,
              LOAN_MONTHS,
            ),
          ),
        }))
      : undefined;

  // ── 7-3. 안전선 (#6) — 월 상환을 소득의 ~30% 이내로 맞춘 보수적 한도 ──────────
  // '은행 최대(DSR)'와 분리 제시. 안전 대출 = min(은행 최대, 월상환 30% 역산).
  // 은행 최대가 이미 30% 이내면 동일값(토글 의미 없음 → UI 가 숨김).
  const SAFE_PAYMENT_RATIO = 0.3;
  let safeLine: BudgetEstimate["safeLine"];
  if (paymentToIncomeRatio !== undefined && loanEstimateKrw > 0) {
    const safeMonthlyMax = monthlyIncomeKrw * SAFE_PAYMENT_RATIO;
    const safeLoanByPayment = loanPrincipalFromMonthlyPayment(
      safeMonthlyMax,
      appliedRate,
      LOAN_MONTHS,
    );
    const safeLoanKrw = Math.round(Math.min(loanEstimateKrw, safeLoanByPayment));
    const safeMonthly = Math.round(
      monthlyPaymentFromPrincipal(safeLoanKrw, appliedRate, LOAN_MONTHS),
    );
    const safeGross = totalEquityKrw + safeLoanKrw;
    const safeAcq = estimateAcquisitionCosts(
      Math.max(0, safeGross),
      profile,
    ).totalKrw;
    safeLine = {
      loanEstimateKrw: safeLoanKrw,
      monthlyPaymentKrw: safeMonthly,
      netPurchasePowerKrw: Math.max(0, safeGross - safeAcq),
      paymentToIncomeRatio:
        monthlyIncomeKrw > 0 && safeMonthly > 0
          ? safeMonthly / monthlyIncomeKrw
          : undefined,
      stressTest:
        safeLoanKrw > 0
          ? [1, 2].map((deltaRatePct) => ({
              deltaRatePct,
              monthlyPaymentKrw: Math.round(
                monthlyPaymentFromPrincipal(
                  safeLoanKrw,
                  appliedRate + deltaRatePct / 100,
                  LOAN_MONTHS,
                ),
              ),
            }))
          : undefined,
    };
  }

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
  const regionLabel = sigunguGiven
    ? `${sigunguGiven} (${inRegulated ? "규제지역" : "비규제지역"})`
    : "동네 미지정 — 보수적으로 규제지역 가정";
  const stressLabel = inRegulated
    ? "스트레스 DSR +3.0%p (규제지역, 실효 7.0%)"
    : "스트레스 DSR +1.5%p (비규제지역, 실효 5.5%)";
  const assumptions: string[] = [
    `${regionLabel} · 2025.10.15 대책 반영`,
    stressLabel,
    "30년 원리금균등 상환 가정",
    `LTV ${ltvLabel} 적용`,
    "취득·부대비용 정밀 산출 (취득세 구간·중개수수료·법무사 등)",
    `정책대출 기준: ${POLICY_BASIS}`,
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
    const bp = bestPolicy;
    const policyLimit = bp.loanLimitKrw ?? 0;
    loanReasonLines.push(
      `${bp.productName} 채택 — 금리 약 ${(bestPolicyRate * 100).toFixed(2)}%, 정책 한도 ${eok(policyLimit)}억`,
    );
    loanReasonLines.push(`자격 사유: ${bp.reason}`);

    if (eligiblePolicies.length > 1) {
      const others = eligiblePolicies
        .filter((p) => p.productName !== bp.productName)
        .map((p) => `${p.productName} ${eok(p.loanLimitKrw ?? 0)}억`)
        .join(", ");
      loanReasonLines.push(
        `적격 정책 ${eligiblePolicies.length}종 중 금리까지 반영해 실제 빌릴 수 있는 금액이 가장 큼 (그 외: ${others})`,
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
      `30년 원리금균등 + 스트레스 ${(STRESS_RATE * 100).toFixed(1)}% 환산 → DSR 한도 약 ${eok(
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
    paymentToIncomeRatio,
    stressTest,
    safeLine,
    grossBudgetKrw,
    acquisitionCostsKrw,
    netPurchasePowerKrw,
    isEstimate: true,
    assumptions,
    warnings,
    loanReasonLines,
  };
}
