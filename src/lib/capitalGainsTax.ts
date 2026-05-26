// 양도소득세 추정 — 갈아타기 자기자본 산정의 핵심.
//
// 정확도 단계:
//  ① 비과세 + 매도가 ≤12억 → 0(완전 정확).
//  ② 비과세 + 매도가 >12억 + 취득가 known → 12억 초과분 과세양도차익 × 누진세율 − 장특공제 + 지방세.
//  ③ 비과세 미충족 + 취득가 known → 양도차익 × 누진세율 − 장특공제 + 지방세.
//  ④ 취득가 미상 → 보수적 폴백(비과세 미충족 매도가×6%, 비과세 12억초과분×6%).
//
// 컴플라이언스: 모든 결과 '추정' — 실 세액은 세무사·국세청 상담 필수. 다주택 중과(20·30%p)는
//   1주택 갈아타기 시나리오엔 미적용(처분조건부 1주택 가정).

import type { ExistingHome } from "@/types/profile";

export interface CapitalGainsTaxEstimate {
  taxKrw: number;
  /** 사용자에게 보일 한 줄 설명(추정 근거). */
  note: string;
}

const 억 = 100_000_000;
const TWELVE_BILLION = 12 * 억;
const BASIC_DEDUCTION = 2_500_000; // 양도소득 기본공제 250만

// 2025 양도세 누진세율 (단위: 원). 누진공제 적용 후 = base×rate − deduct.
const BRACKETS: { upTo: number; rate: number; deduct: number }[] = [
  { upTo: 14_000_000, rate: 0.06, deduct: 0 },
  { upTo: 50_000_000, rate: 0.15, deduct: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduct: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduct: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduct: 19_940_000 },
  { upTo: 500_000_000, rate: 0.40, deduct: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduct: 35_940_000 },
  { upTo: Infinity, rate: 0.45, deduct: 65_940_000 },
];

const LOCAL_TAX = 1.1; // 지방소득세 10% 가산

function progressiveTax(base: number): number {
  if (base <= 0) return 0;
  for (const b of BRACKETS) {
    if (base <= b.upTo) return Math.max(0, base * b.rate - b.deduct);
  }
  return 0;
}

/** 장기보유특별공제율 (1주택 거주 우대 vs 일반). 보유=거주연수 가정(단순화). */
function ltvDeductionRate(years: number, oneHomeBenefit: boolean): number {
  if (years < 3) return 0; // 3년 미만 공제 없음
  if (oneHomeBenefit) {
    // 표2(1주택+거주): 보유 4%/년 + 거주 4%/년, 합산 최대 80% (10년 이상)
    return Math.min(0.8, years * 0.08);
  }
  // 표1(일반): 연 2%, 최대 30% (15년 이상)
  return Math.min(0.3, years * 0.02);
}

export function estimateCapitalGainsTax(home: ExistingHome): CapitalGainsTaxEstimate {
  const sale = Math.max(0, home.expectedSalePriceKrw);
  const exempt = home.qualifiesForTaxExemption;
  const acq = home.acquisitionPriceKrw;
  const years = home.holdingYears ?? 5; // 미지정 시 5년 가정

  // ① 비과세 + ≤12억
  if (exempt && sale <= TWELVE_BILLION) {
    return {
      taxKrw: 0,
      note: "1세대 1주택 비과세 (2년+ 보유·거주, 매도가 12억 이하) — 양도세 0",
    };
  }

  // ④ 취득가 미상 → 보수적 폴백
  if (acq === undefined || acq < 0) {
    if (exempt) {
      const excess = Math.max(0, sale - TWELVE_BILLION);
      return {
        taxKrw: Math.round(excess * 0.06),
        note: "12억 초과분 약 6% 개략(취득가 미상). 취득가 입력 시 정밀 계산.",
      };
    }
    return {
      taxKrw: Math.round(sale * 0.06),
      note: "취득가 미상 — 매도가 약 6% 개략. 취득가·보유연수 입력 시 정밀 계산.",
    };
  }

  const gain = Math.max(0, sale - acq);

  // ② 비과세 + 12억 초과 → 초과분만 과세 (1주택 우대 장특공제)
  if (exempt) {
    if (sale === 0 || gain === 0) return { taxKrw: 0, note: "양도차익 없음" };
    const taxableGain = (gain * (sale - TWELVE_BILLION)) / sale;
    const deductRate = ltvDeductionRate(years, true);
    const afterDeduct = taxableGain * (1 - deductRate);
    const base = Math.max(0, afterDeduct - BASIC_DEDUCTION);
    const tax = Math.round(progressiveTax(base) * LOCAL_TAX);
    return {
      taxKrw: tax,
      note: `12억 초과분 과세양도차익 ${(taxableGain / 억).toFixed(2)}억 × 누진 − 장특 ${Math.round(deductRate * 100)}%(보유·거주 ${years}년) − 기본공제 250만 · 지방세 포함 추정`,
    };
  }

  // ③ 비과세 미충족 + 취득가 known
  const deductRate = ltvDeductionRate(years, false);
  const afterDeduct = gain * (1 - deductRate);
  const base = Math.max(0, afterDeduct - BASIC_DEDUCTION);
  const tax = Math.round(progressiveTax(base) * LOCAL_TAX);
  return {
    taxKrw: tax,
    note: `양도차익 ${(gain / 억).toFixed(2)}억 × 누진 − 장특 ${Math.round(deductRate * 100)}%(보유 ${years}년·일반표) − 기본공제 250만 · 지방세 포함 추정`,
  };
}
