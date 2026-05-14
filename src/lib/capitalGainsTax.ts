// 양도소득세 개략 추정.
//
// 단순화 명시: 취득가를 알 수 없으므로 실제 양도차익 계산은 불가능.
// 보유기간·거주기간·장기보유특별공제 등 세부 요인을 반영하지 못하며,
// 실제 세액과 크게 다를 수 있음. 사용자에게 반드시 경고를 노출할 것.

import type { ExistingHome } from "@/types/profile";

export interface CapitalGainsTaxEstimate {
  taxKrw: number;
  /** 사용자에게 보일 설명 */
  note: string;
}

const TWELVE_BILLION = 12 * 100_000_000; // 12억 비과세 기준선

/**
 * 기존 주택의 양도소득세를 개략 추정한다.
 *
 * WHY 6% 개략율: 실제 양도세는 과세표준·보유기간·장기보유특별공제에 따라
 * 수십%까지 달라지지만, 취득가를 모르는 MVP 단계에서는 단순 도구로써
 * "최소한의 세 부담이 있다"는 신호를 주기 위한 보수적 최소 추정치다.
 *
 * WHY 입력 검증: 매도가·잔금이 음수면 계산이 왜곡되므로 0으로 처리.
 * taxKrw 는 항상 0 이상을 보장한다.
 */
export function estimateCapitalGainsTax(
  home: ExistingHome,
): CapitalGainsTaxEstimate {
  // WHY 음수 가드: 잘못된 입력으로 세금이 음수가 되는 것을 방지.
  const expectedSalePriceKrw = Math.max(0, home.expectedSalePriceKrw);
  const { qualifiesForTaxExemption } = home;

  if (qualifiesForTaxExemption && expectedSalePriceKrw <= TWELVE_BILLION) {
    // 1세대 1주택 비과세: 2년 이상 보유+거주, 매도가 12억 이하 요건 충족
    return {
      taxKrw: 0,
      note: "1세대 1주택 비과세 요건 충족 가정 (양도가 12억 이하)",
    };
  }

  if (qualifiesForTaxExemption && expectedSalePriceKrw > TWELVE_BILLION) {
    // 12억 초과분에만 과세되나 취득가 미상 → 초과분의 약 6%를 개략 추정
    const excessKrw = expectedSalePriceKrw - TWELVE_BILLION;
    const taxKrw = Math.max(0, Math.round(excessKrw * 0.06));
    return {
      taxKrw,
      note: "12억 초과분 개략 추정, 실제는 보유기간·취득가에 따라 다름",
    };
  }

  // 비과세 요건 미충족 → 매도가의 약 6% 개략 추정
  const taxKrw = Math.max(0, Math.round(expectedSalePriceKrw * 0.06));
  return {
    taxKrw,
    note: "비과세 요건 미충족 — 보유·거주기간 확인 필요, 개략 추정",
  };
}
