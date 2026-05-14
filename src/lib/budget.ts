// 예산 추정 — 공개된 DSR/LTV 공식만 적용. 특정 은행 상품 미참조.
// 모든 수치는 "추정(isEstimate: true)"으로 반환되며 실제 대출 심사 결과와 다를 수 있음.

import type { CoupleProfile } from "@/types/profile";
import type { BudgetEstimate } from "@/types/recommendation";

const HUNDRED_MILLION = 100_000_000;

interface EstimateOpts {
  regulatedArea?: boolean;
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
  } = profile;

  // ── 1. DSR 기반 대출 한도 ────────────────────────────────────
  const annualDsrAllowance = householdIncomeKrwYear * 0.4;
  const monthlyDsrAllowance = annualDsrAllowance / 12;
  const availableMonthly = monthlyDsrAllowance - existingLoanMonthlyKrw;

  let dsrLoanCapacity = 0;
  if (availableMonthly > 0) {
    // 수도권 변동금리 기준 스트레스 DSR: 기준금리 4.0% + 가산 3.0%p = 실효 7.0%.
    // 보수적 산정을 위해 스트레스 금리를 대출 원리금 계산에 그대로 적용함.
    const annualRate = 0.07;
    const r = annualRate / 12; // 월 이율
    const n = 360; // 30년 원리금균등

    // 원리금균등(PMT) 역산 공식: P = PMT * (1 - (1+r)^-n) / r
    dsrLoanCapacity = availableMonthly * (1 - Math.pow(1 + r, -n)) / r;
  }

  // ── 2. LTV 한도 ─────────────────────────────────────────────
  // 가격-대출의 순환 참조(chicken-and-egg) 문제를 1회 패스로 해결:
  // 추정 매매가 = seed + DSR 한도로 가정한 뒤 LTV 상한을 역산함.
  // 실제 매매가 확정 후에는 복잡계 단위에서 정밀 재계산이 필요함.
  const assumedPrice = seedMoneyKrw + dsrLoanCapacity;

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

  // ── 3. 최종 대출 추정액 ──────────────────────────────────────
  const loanEstimateKrw = Math.round(Math.min(dsrLoanCapacity, ltvCeiling));
  const grossBudgetKrw = seedMoneyKrw + loanEstimateKrw;

  // 취득세 + 중개수수료 + 부대비용: 약 3.5% 일괄 적용.
  // (단지별 취득세 정밀 계산은 별도 모듈에서 수행.)
  const acquisitionCostsKrw = Math.round(grossBudgetKrw * 0.035);
  const netPurchasePowerKrw = grossBudgetKrw - acquisitionCostsKrw;

  // ── 4. 가정 문구 ────────────────────────────────────────────
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

  // ── 5. 경고 문구 ────────────────────────────────────────────
  const warnings: string[] = [
    "실제 대출 한도는 신용점수·은행 정책·소득 인정 방식에 따라 달라집니다.",
  ];

  if (existingLoanMonthlyKrw === 0) {
    warnings.push(
      "기존 대출을 0으로 입력하셨습니다 — 신용대출·자동차할부·학자금 등이 있으면 한도가 줄어듭니다.",
    );
  }

  if (householdIncomeKrwYear > 85_000_000 && !hasOwnedHomeBefore) {
    warnings.push(
      "맞벌이 합산 소득이 높아 디딤돌·보금자리론 등 정책대출 자격에서 제외될 수 있습니다.",
    );
  }

  return {
    seedMoneyKrw,
    loanEstimateKrw,
    grossBudgetKrw,
    acquisitionCostsKrw,
    netPurchasePowerKrw,
    isEstimate: true,
    assumptions,
    warnings,
  };
}
