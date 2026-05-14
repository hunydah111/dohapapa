// 예산 추정 — 공개된 DSR/LTV 공식만 적용. 특정 은행 상품 미참조.
// 모든 수치는 "추정(isEstimate: true)"으로 반환되며 실제 대출 심사 결과와 다를 수 있음.

import type { CoupleProfile } from "@/types/profile";
import type { BudgetEstimate } from "@/types/recommendation";
import { estimateCapitalGainsTax } from "@/lib/capitalGainsTax";

const HUNDRED_MILLION = 100_000_000; // 1억

interface EstimateOpts {
  regulatedArea?: boolean;
}

/**
 * 원리금균등(PMT) 역산 공식으로 대출 원금을 계산한다.
 * P = PMT * (1 - (1+r)^-n) / r
 *
 * WHY 별도 함수: 대출한도 계산과 월상환액 계산 양쪽에서 동일 로직을 재사용.
 */
function loanPrincipalFromMonthlyPayment(
  monthlyPayment: number,
  annualRate: number,
  months: number,
): number {
  const r = annualRate / 12;
  return monthlyPayment * (1 - Math.pow(1 + r, -months)) / r;
}

/**
 * 원리금균등 월상환액(PMT) 계산.
 * PMT = P * r / (1 - (1+r)^-n)
 */
function monthlyPaymentFromPrincipal(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  return principal * r / (1 - Math.pow(1 + r, -months));
}

export function estimateBudget(
  profile: CoupleProfile,
  opts?: EstimateOpts,
): BudgetEstimate {
  // 서울 전역은 규제지역으로 가정 (기본값 true).
  const regulated = opts?.regulatedArea ?? true;

  const {
    householdIncomeKrwYear,
    seedMoneyKrw,
    existingLoanMonthlyKrw,
    hasOwnedHomeBefore,
    existingHome,
    householdType,
  } = profile;

  // ── 1. 기존 집 매도 순수령액 계산 (갈아타기) ─────────────────
  // WHY 매도 대금을 자기자본에 합산: P0#3 — 갈아타기 사용자의 예산 반영 누락 수정.
  let homeSaleNetKrw = 0;
  let capitalGainsTaxKrw = 0;

  if (existingHome !== undefined) {
    const cgt = estimateCapitalGainsTax(existingHome);
    capitalGainsTaxKrw = cgt.taxKrw;
    homeSaleNetKrw = Math.max(
      0,
      existingHome.expectedSalePriceKrw
        - existingHome.remainingLoanKrw
        - capitalGainsTaxKrw,
    );
  }

  // ── 2. 가용 자기자본 ─────────────────────────────────────────
  const totalEquityKrw = seedMoneyKrw + homeSaleNetKrw;

  // ── 3. DSR 기반 대출 한도 ────────────────────────────────────
  const annualDsrAllowance = householdIncomeKrwYear * 0.4;
  const monthlyDsrAllowance = annualDsrAllowance / 12;
  const availableMonthly = monthlyDsrAllowance - existingLoanMonthlyKrw;

  // 수도권 변동금리 기준 스트레스 DSR: 기준금리 4.0% + 가산 3.0%p = 실효 7.0%.
  // 보수적 산정을 위해 스트레스 금리를 대출 원리금 계산에 그대로 적용함.
  const STRESS_RATE = 0.07;
  const LOAN_MONTHS = 360; // 30년 원리금균등

  let dsrLoanCapacity = 0;
  if (availableMonthly > 0) {
    dsrLoanCapacity = loanPrincipalFromMonthlyPayment(
      availableMonthly,
      STRESS_RATE,
      LOAN_MONTHS,
    );
  }

  // ── 4. LTV 한도 ─────────────────────────────────────────────
  // 가격-대출의 순환 참조(chicken-and-egg) 문제를 1회 패스로 해결:
  // 추정 매매가 = totalEquity + DSR 한도로 가정한 뒤 LTV 상한을 역산함.
  // 실제 매매가 확정 후에는 복잡계 단위에서 정밀 재계산이 필요함.
  const assumedPrice = totalEquityKrw + dsrLoanCapacity;

  let ltvRate: number;
  if (!regulated) {
    ltvRate = 0.7; // 비규제 지역
  } else if (!hasOwnedHomeBefore) {
    ltvRate = 0.7; // 생애최초, 규제지역
  } else {
    ltvRate = 0.4; // 유주택(무주택 가정 적용 불가), 규제지역
  }

  // 가격 구간별 LTV 절대 한도 (2025–2026 기준).
  let bracketCap: number;
  if (assumedPrice <= 15 * HUNDRED_MILLION) {
    bracketCap = 6 * HUNDRED_MILLION;
  } else if (assumedPrice <= 25 * HUNDRED_MILLION) {
    bracketCap = 4 * HUNDRED_MILLION;
  } else {
    bracketCap = 2 * HUNDRED_MILLION;
  }

  const ltvCeiling = Math.min(assumedPrice * ltvRate, bracketCap);

  // ── 5. 최종 대출 추정액 ──────────────────────────────────────
  const loanEstimateKrw = Math.round(Math.min(dsrLoanCapacity, ltvCeiling));

  // ── 6. 월 원리금 상환액 (P1#8 — 사용자에게 노출) ─────────────
  // WHY: 사용자가 실제 상환 부담을 체감할 수 있도록 월 상환액을 명시.
  const monthlyPaymentKrw = Math.round(
    monthlyPaymentFromPrincipal(loanEstimateKrw, STRESS_RATE, LOAN_MONTHS),
  );

  // ── 7. 총 예산 및 실매수 가능가 ──────────────────────────────
  const grossBudgetKrw = totalEquityKrw + loanEstimateKrw;

  // 취득세 + 중개수수료 + 부대비용: 약 3.5% 일괄 적용.
  // (단지별 취득세 정밀 계산은 별도 모듈에서 수행.)
  const acquisitionCostsKrw = Math.round(grossBudgetKrw * 0.035);
  const netPurchasePowerKrw = grossBudgetKrw - acquisitionCostsKrw;

  // ── 8. 가정 문구 ────────────────────────────────────────────
  const assumptions: string[] = [
    regulated ? "서울 전역 규제지역으로 가정" : "비규제지역으로 계산",
    "스트레스 DSR +3.0%p 반영 (수도권 변동금리 기준, 실효 7.0%)",
    "30년 원리금균등 상환 가정",
    !hasOwnedHomeBefore && regulated
      ? "생애최초 LTV 70% 적용"
      : regulated
        ? "LTV 40% 적용"
        : "LTV 70% 적용 (비규제지역)",
    "취득·부대비용은 총예산의 약 3.5%로 개략 반영",
  ];

  if (existingHome !== undefined) {
    assumptions.push(
      "기존 집 매도 순수령액을 자기자본에 합산 — 매도가·잔금·양도세는 추정",
    );
  }

  // ── 9. 경고 문구 ────────────────────────────────────────────
  const warnings: string[] = [
    "실제 한도·세액은 신용·은행·세무 상담 결과에 따릅니다.",
  ];

  if (existingLoanMonthlyKrw === 0) {
    warnings.push(
      "기존 대출을 0으로 입력하셨습니다 — 신용대출·자동차할부·학자금 등이 있으면 한도가 줄어듭니다.",
    );
  }

  // WHY 은퇴 경고: 은퇴 가구는 소득이 낮아 DSR 한도가 크게 제한될 수 있음.
  if (householdType === "retired" && householdIncomeKrwYear < 40_000_000) {
    warnings.push(
      "은퇴·저소득 — 대출 한도가 매우 낮게 추정될 수 있습니다.",
    );
  }

  if (existingHome !== undefined) {
    const cgt = estimateCapitalGainsTax(existingHome);
    warnings.push(cgt.note);
  }

  return {
    seedMoneyKrw,
    homeSaleNetKrw,
    capitalGainsTaxKrw,
    totalEquityKrw,
    loanEstimateKrw,
    monthlyPaymentKrw,
    grossBudgetKrw,
    acquisitionCostsKrw,
    netPurchasePowerKrw,
    isEstimate: true,
    assumptions,
    warnings,
  };
}
