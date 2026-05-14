import type { CoupleProfile } from "@/types/profile";

export interface AcquisitionCost {
  acquisitionTaxKrw: number; // 취득세 + 농특세 + 지방교육세
  brokerFeeKrw: number;      // 중개수수료
  miscKrw: number;           // 법무사·등기·이사·초기수리 개략
  totalKrw: number;
  breakdown: string[];       // 사용자에게 보일 항목별 한국어 설명
}

const BILLION = 100_000_000; // 1억

/** 원화 값을 "X,XXX만원" 형태의 한국어 문자열로 변환. */
function formatManwon(krw: number): string {
  const manwon = Math.round(krw / 10_000);
  return manwon.toLocaleString("ko-KR") + "만원";
}

/**
 * 취득세 실효율 계산 (취득세 + 농특세 + 지방교육세 통합).
 *
 * 6억 이하 → 1.1%
 * 6억 초과 ~ 9억 → 1.1% ~ 3.3% 선형 보간
 * 9억 초과 → 3.3%
 *
 * 국토교통부 기준: 공시가격 기반이 아닌 실거래가 기준 단순화 모델 (MVP).
 */
function calcEffectiveTaxRate(purchasePriceKrw: number): number {
  const SIX_BILLION = 6 * BILLION;
  const NINE_BILLION = 9 * BILLION;
  const RATE_LOW = 0.011;  // 1.1%
  const RATE_HIGH = 0.033; // 3.3%

  if (purchasePriceKrw <= SIX_BILLION) {
    return RATE_LOW;
  }
  if (purchasePriceKrw >= NINE_BILLION) {
    return RATE_HIGH;
  }
  // 6억 초과 ~ 9억 미만: 선형 보간
  const ratio = (purchasePriceKrw - SIX_BILLION) / (NINE_BILLION - SIX_BILLION);
  return RATE_LOW + ratio * (RATE_HIGH - RATE_LOW);
}

/**
 * 중개수수료 상한요율 반환.
 *
 * 공인중개사법 시행규칙 별표 1 기준 (주거용 매매):
 * 6억 미만 → 0.4%, 6억~9억 미만 → 0.5%, 9억 이상 → 0.7%
 */
function calcBrokerRate(purchasePriceKrw: number): number {
  if (purchasePriceKrw < 6 * BILLION) return 0.004;
  if (purchasePriceKrw < 9 * BILLION) return 0.005;
  return 0.007;
}

export function estimateAcquisitionCosts(
  purchasePriceKrw: number,
  profile: CoupleProfile,
): AcquisitionCost {
  const breakdown: string[] = [];

  // ── 취득세 ────────────────────────────────────────────────────────────────
  const effectiveRate = calcEffectiveTaxRate(purchasePriceKrw);
  let acquisitionTaxKrw = Math.round(purchasePriceKrw * effectiveRate);
  const effectivePct = (effectiveRate * 100).toFixed(1);

  if (!profile.hasOwnedHomeBefore && purchasePriceKrw <= 12 * BILLION) {
    // 생애최초 주택 취득세 감면: 최대 200만원 (지방세법 제36조의3)
    const FIRST_HOME_DISCOUNT = 2_000_000;
    acquisitionTaxKrw = Math.max(0, acquisitionTaxKrw - FIRST_HOME_DISCOUNT);
    breakdown.push(
      `취득세·지방세: 약 ${formatManwon(acquisitionTaxKrw)} (실효 ${effectivePct}%)`,
    );
    breakdown.push("생애최초 취득세 감면 -200만원 적용됨");
  } else {
    breakdown.push(
      `취득세·지방세: 약 ${formatManwon(acquisitionTaxKrw)} (실효 ${effectivePct}%)`,
    );
  }

  if (profile.hasOwnedHomeBefore) {
    // 계산은 기본율 유지하되, MVP 단순화임을 사용자에게 명시
    breakdown.push(
      "기존 주택 보유 이력 — 세대 합산 시 취득세 중과(최대 12%) 대상일 수 있어 별도 확인 필요",
    );
  }

  // ── 중개수수료 ────────────────────────────────────────────────────────────
  const brokerRate = calcBrokerRate(purchasePriceKrw);
  const brokerFeeKrw = Math.round(purchasePriceKrw * brokerRate);
  const brokerPct = (brokerRate * 100).toFixed(1);
  breakdown.push(
    `중개수수료: 약 ${formatManwon(brokerFeeKrw)} (상한 ${brokerPct}%)`,
  );

  // ── 부대비용 (법무사·등기·이사·초기수리) ──────────────────────────────────
  // 0.4%는 이사·초기수리 개략, 60만원은 법무사·소유권이전등기 정액 추정치
  const LEGAL_FIXED = 600_000;
  const miscKrw = Math.round(purchasePriceKrw * 0.004) + LEGAL_FIXED;
  breakdown.push(
    `법무사·등기·이사·초기수리: 약 ${formatManwon(miscKrw)} (개략)`,
  );

  // ── 면책 안내 ─────────────────────────────────────────────────────────────
  breakdown.push(
    "※ 위 금액은 모두 추정값이며, 실제 비용은 거래 조건·지역·시기에 따라 달라질 수 있습니다.",
  );

  const totalKrw = acquisitionTaxKrw + brokerFeeKrw + miscKrw;

  return {
    acquisitionTaxKrw,
    brokerFeeKrw,
    miscKrw,
    totalKrw,
    breakdown,
  };
}
