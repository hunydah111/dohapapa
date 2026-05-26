// 정책대출 자격 판정 모듈.
//
// 컴플라이언스: 자격 가능성 안내까지만 — 특정 은행 상품 연결·비교 금지.
// 주택가 요건(예: 디딤돌 5억 이하, 보금자리론 6억 이하)은 예산 추정 시점에서
// 매수 희망 주택의 가격을 알 수 없으므로 이 모듈에서 판정하지 않는다.
// 판정 결과 reason 에 "주택가 요건 별도 적용" 을 명시해 사용자가 인지하도록 함.
//
// 2025~2026 현행 기준으로 작성. 제도 변경 시 상수를 갱신할 것.

import type { CoupleProfile } from "@/types/profile";
import type { PolicyLoanMatch } from "@/types/recommendation";

// ── 정책 기준일 메타 (단일 출처) ──────────────────────────────────────────
// 대출 정책·세제는 자주 바뀌므로(예: 2025.6.28 디딤돌 한도 축소), 아래 상수·로직이
// '어느 시점 정책'을 반영하는지 한 곳에 명시하고 UI 에 눈에 띄게 노출한다.
// ⚠️ 정책이 바뀌어 상수를 갱신할 때마다 effectiveLabel·lastVerified 를 함께 갱신할 것.
export const POLICY_META = {
  /** 한도·요건이 반영하는 최신 개정 시점 (사용자 표시용). */
  effectiveLabel: "2025.10.15 대책 + 2025.6.28 정책대출 개정 반영",
  /** 사람이 마지막으로 1차 출처와 대조 검증한 날 (YYYY-MM-DD). 신선도 판정 기준. */
  lastVerified: "2026-05-26",
  /** 1차 출처 (자격 안내 신뢰용). 특정 은행 상품 아님. */
  sources: ["주택도시기금", "한국주택금융공사", "국토부 주택시장 안정화 대책"],
} as const;

/** 검증일 경과로 신선도 판정. stale 이면 UI 에 "확인 필요" 표시. */
export function policyFreshness(now: Date = new Date()): {
  daysSinceVerified: number;
  stale: boolean;
} {
  const verified = new Date(`${POLICY_META.lastVerified}T00:00:00Z`);
  const daysSinceVerified = Math.max(
    0,
    Math.floor((now.getTime() - verified.getTime()) / 86_400_000),
  );
  // 정책대출·세제는 분기 단위로 자주 바뀌어 ~120일(약 4개월) 넘으면 재확인 권고.
  return { daysSinceVerified, stale: daysSinceVerified > 120 };
}

/** 하위호환 — 계산 가정 문구용 한 줄 라벨 (POLICY_META 파생). */
export const POLICY_BASIS = `${POLICY_META.effectiveLabel} · 최종 점검 ${POLICY_META.lastVerified}`;

// ── 소득·자산 기준 상수 (2025~2026 기준) ──────────────────────────────────

/** 신생아 특례 디딤돌: 부부합산 연소득 2억 이하 */
const SHINSEONA_INCOME_LIMIT = 200_000_000;

/** 디딤돌(신혼): 부부합산 연소득 8,500만 이하 */
const DIDIMDOL_NEWLYWED_INCOME_LIMIT = 85_000_000;

/** 디딤돌(일반): 생애최초·2자녀 이상 완화 기준 7,000만 이하 (현 모델은 항상 생애최초로 간주). 비생애최초 기본은 6,000만. */
const DIDIMDOL_GENERAL_INCOME_LIMIT_EXTENDED = 70_000_000;

/** 보금자리론: 기본 합산 7,000만 이하 */
const BOGEUMJARI_INCOME_LIMIT = 70_000_000;

/** 보금자리론: 신혼 완화 8,500만 이하 */
const BOGEUMJARI_NEWLYWED_INCOME_LIMIT = 85_000_000;

/** 보금자리론: 자녀가산 소득 — 1자녀 8,000만 · 2자녀 9,000만 · 3자녀+ 1억. */
const BOGEUMJARI_1CHILD_INCOME_LIMIT = 80_000_000;
const BOGEUMJARI_2CHILD_INCOME_LIMIT = 90_000_000;
const BOGEUMJARI_3CHILD_INCOME_LIMIT = 100_000_000;

/** 보금자리론: 다자녀(2자녀+) 한도 — 4억(생애최초 4.2억과 별개, 유주택 다자녀 우대용). */
const BOGEUMJARI_MULTICHILD_LOAN_LIMIT = 400_000_000;

/** 디딤돌(신혼) 순자산 요건: 5.11억 이하 */
const DIDIMDOL_NEWLYWED_NET_ASSET_LIMIT = 511_000_000;

/** 신생아 특례 디딤돌 최대 대출 한도 (원) */
const SHINSEONA_LOAN_LIMIT = 400_000_000;

/** 디딤돌(신혼) 최대 대출 한도 (원) */
const DIDIMDOL_NEWLYWED_LOAN_LIMIT = 320_000_000;

/** 디딤돌(일반) 생애최초 한도 (원). 비생애최초 기본 한도는 2억. */
const DIDIMDOL_GENERAL_FIRST_LOAN_LIMIT = 240_000_000;

/** 보금자리론 기본 한도 (원) */
const BOGEUMJARI_LOAN_LIMIT = 360_000_000;

/** 보금자리론 생애최초 한도 (원) */
const BOGEUMJARI_FIRST_LOAN_LIMIT = 420_000_000;

// ── 판정 함수 ─────────────────────────────────────────────────────────────

/**
 * 신생아 특례 디딤돌 자격 판정.
 *
 * WHY hasInfant 프록시: 신생아 특례는 "대출 신청일 기준 2년 이내 출산"이 원칙이며,
 * 폼은 이 의미 그대로 "출산 2년 이내(만 2세 이하)" 로 묻는다. 실제 자격은
 * 출생일 기준 최종 판정되므로 reason 에 출생일 확인 안내를 포함한다.
 */
function evaluateShinseona(profile: CoupleProfile): PolicyLoanMatch {
  const { householdIncomeKrwYear, hasOwnedHomeBefore, hasInfant } = profile;

  // WHY 무주택 요건 확인: 신생아 특례 디딤돌은 무주택 세대주만 신청 가능
  if (hasOwnedHomeBefore) {
    return {
      productName: "신생아 특례 디딤돌",
      eligible: false,
      reason: "유주택(주택 보유 이력 있음) — 무주택 세대주만 신청 가능",
    };
  }

  if (!hasInfant) {
    return {
      productName: "신생아 특례 디딤돌",
      eligible: false,
      reason: "출산 2년 이내(만 2세 이하) 자녀 없음 — 신생아 특례 자격 미해당",
    };
  }

  if (householdIncomeKrwYear > SHINSEONA_INCOME_LIMIT) {
    return {
      productName: "신생아 특례 디딤돌",
      eligible: false,
      reason: `부부합산 소득 ${(householdIncomeKrwYear / 10_000).toLocaleString("ko-KR")}만원 초과 (기준: 2억 이하)`,
    };
  }

  return {
    productName: "신생아 특례 디딤돌",
    eligible: true,
    reason:
      "출산 2년 이내 자녀 + 무주택 + 합산 소득 2억 이하 — 정확한 출생일 기준 자격은 주택금융공사 확인 (주택가 9억 이하 요건 별도)",
    loanLimitKrw: SHINSEONA_LOAN_LIMIT,
    rateMin: 1.8,
    rateMax: 4.5,
  };
}

/**
 * 디딤돌(신혼) 자격 판정.
 *
 * WHY 신혼 요건 명시: isNewlywed 필드는 혼인 7년 이내 기준으로 사용자가 직접 입력.
 */
function evaluateDidimdolNewlywed(profile: CoupleProfile): PolicyLoanMatch {
  const { householdIncomeKrwYear, hasOwnedHomeBefore, isNewlywed, netAssetsKrw } = profile;

  if (!isNewlywed) {
    return {
      productName: "디딤돌(신혼)",
      eligible: false,
      reason: "신혼 요건 미충족 (혼인 7년 이내 해당 없음)",
    };
  }

  if (hasOwnedHomeBefore) {
    return {
      productName: "디딤돌(신혼)",
      eligible: false,
      reason: "유주택(주택 보유 이력 있음) — 무주택 세대주만 신청 가능",
    };
  }

  if (householdIncomeKrwYear > DIDIMDOL_NEWLYWED_INCOME_LIMIT) {
    return {
      productName: "디딤돌(신혼)",
      eligible: false,
      reason: `부부합산 소득 ${(householdIncomeKrwYear / 10_000).toLocaleString("ko-KR")}만원 초과 (기준: 8,500만원 이하)`,
    };
  }

  if (netAssetsKrw > DIDIMDOL_NEWLYWED_NET_ASSET_LIMIT) {
    return {
      productName: "디딤돌(신혼)",
      eligible: false,
      reason: `순자산 ${(netAssetsKrw / 100_000_000).toFixed(2)}억원 초과 (기준: 5.11억 이하)`,
    };
  }

  return {
    productName: "디딤돌(신혼)",
    eligible: true,
    reason:
      "신혼 + 무주택 + 합산 소득 8,500만원 이하 + 순자산 5.11억 이하 — 주택가 요건 별도 적용 (6억 이하)",
    loanLimitKrw: DIDIMDOL_NEWLYWED_LOAN_LIMIT,
    rateMin: 2.85,
    rateMax: 4.15,
  };
}

/**
 * 디딤돌(일반) 자격 판정.
 *
 * WHY 생애최초·2자녀 완화: 두 조건 중 하나라도 해당하면 소득 기준 7,000만으로 완화.
 */
function evaluateDidimdolGeneral(profile: CoupleProfile): PolicyLoanMatch {
  const { householdIncomeKrwYear, hasOwnedHomeBefore } = profile;

  if (hasOwnedHomeBefore) {
    return {
      productName: "디딤돌(일반)",
      eligible: false,
      reason: "유주택(주택 보유 이력 있음) — 무주택 세대주만 신청 가능",
    };
  }

  // WHY 항상 생애최초 기준: 현재 입력은 hasOwnedHomeBefore 불리언뿐이라, 여기
  // 도달한 사람은 모두 '보유 이력 없음'=생애최초로 간주한다(평생 무주택). 무주택이나
  // 과거 보유 이력자는 구분 불가 → 위에서 보수적으로 차단됨. 따라서 소득 완화
  // 7,000만 + 생애최초 한도 2.4억을 적용. (비생애최초 무주택 기준 6,000만/2억은
  // 입력에 '현재 무주택 vs 생애최초' 구분이 생기면 추가)
  if (householdIncomeKrwYear > DIDIMDOL_GENERAL_INCOME_LIMIT_EXTENDED) {
    return {
      productName: "디딤돌(일반)",
      eligible: false,
      reason: `부부합산 소득 ${(householdIncomeKrwYear / 10_000).toLocaleString("ko-KR")}만원 초과 (기준: 7,000만원 이하)`,
    };
  }

  return {
    productName: "디딤돌(일반)",
    eligible: true,
    reason:
      "생애최초 + 무주택 + 합산 소득 기준 충족 — 주택가 요건 별도 적용 (5억 이하), 한도 생애최초 2.4억",
    loanLimitKrw: DIDIMDOL_GENERAL_FIRST_LOAN_LIMIT,
    rateMin: 2.85,
    rateMax: 4.15,
  };
}

/**
 * 보금자리론 자격 판정.
 *
 * WHY 자녀수 가산 미적용: 자녀수별 소득 가산(1자녀 +100만, 2자녀 +200만 등)은
 * 소득 경계값 근처에서 유불리를 크게 바꿀 수 있으나, 제도 변경이 잦아
 * MVP에서는 기본·신혼 2단계만 적용하고 reason 에 안내를 포함.
 */
function evaluateBogeumjari(profile: CoupleProfile): PolicyLoanMatch {
  const {
    householdIncomeKrwYear, isNewlywed, hasOwnedHomeBefore,
    hasInfant, hasSchoolAgedChild, hasTwoOrMoreChildren, hasThreeOrMoreChildren,
  } = profile;

  // WHY 보금자리론은 유주택자도 신청 가능(1주택자 대환 등) — 무주택 요건 없음.
  // 자녀 수 추정 (정확 카운트 없으면 보수적으로): 3+ > 2 > 1(영아·학령기 있으면) > 0.
  const inferredChildren = hasThreeOrMoreChildren
    ? 3
    : hasTwoOrMoreChildren
      ? 2
      : hasInfant || hasSchoolAgedChild
        ? 1
        : 0;

  // 소득요건 — 신혼·자녀가산 중 가장 높은 것 적용.
  let incomeLimit = BOGEUMJARI_INCOME_LIMIT;
  let limitLabel = "7,000만원";
  const apply = (cap: number, label: string) => {
    if (cap > incomeLimit) { incomeLimit = cap; limitLabel = label; }
  };
  if (isNewlywed) apply(BOGEUMJARI_NEWLYWED_INCOME_LIMIT, "8,500만원 (신혼)");
  if (inferredChildren >= 3) apply(BOGEUMJARI_3CHILD_INCOME_LIMIT, "1억 (3자녀+)");
  else if (inferredChildren === 2) apply(BOGEUMJARI_2CHILD_INCOME_LIMIT, "9,000만원 (2자녀)");
  else if (inferredChildren === 1) apply(BOGEUMJARI_1CHILD_INCOME_LIMIT, "8,000만원 (1자녀)");

  if (householdIncomeKrwYear > incomeLimit) {
    return {
      productName: "보금자리론",
      eligible: false,
      reason: `부부합산 소득 ${(householdIncomeKrwYear / 10_000).toLocaleString("ko-KR")}만원 초과 (기준: ${limitLabel} 이하)`,
    };
  }

  // 대출 한도 — 생애최초 4.2억 > 다자녀 4억 > 일반 3.6억.
  let loanLimit: number;
  let limitNote: string;
  if (!hasOwnedHomeBefore) {
    loanLimit = BOGEUMJARI_FIRST_LOAN_LIMIT;
    limitNote = "생애최초 한도 4.2억";
  } else if (inferredChildren >= 2) {
    loanLimit = BOGEUMJARI_MULTICHILD_LOAN_LIMIT;
    limitNote = "다자녀 한도 4억";
  } else {
    loanLimit = BOGEUMJARI_LOAN_LIMIT;
    limitNote = "일반 한도 3.6억";
  }

  const conditionParts: string[] = [limitNote];
  if (isNewlywed) conditionParts.push("신혼 소득 완화 적용");
  if (inferredChildren > 0) conditionParts.push(`${inferredChildren}자녀 가산 소득 ${limitLabel}`);
  conditionParts.push("주택가 요건 별도 적용 (6억 이하)");

  return {
    productName: "보금자리론",
    eligible: true,
    reason: conditionParts.join(" — "),
    loanLimitKrw: loanLimit,
    rateMin: 3.9,
    rateMax: 4.2,
  };
}

// ── 공개 API ──────────────────────────────────────────────────────────────

/**
 * 프로필을 받아 4개 정책대출 상품의 자격 판정 결과를 반환한다.
 *
 * WHY 판정 순서: 한도 큰 순(신생아 특례 → 신혼 → 일반 → 보금자리론)으로 정렬해
 * budget.ts 에서 "한도 최대" 상품을 쉽게 고를 수 있도록 한다.
 */
export function evaluatePolicyLoans(profile: CoupleProfile): PolicyLoanMatch[] {
  return [
    evaluateShinseona(profile),
    evaluateDidimdolNewlywed(profile),
    evaluateDidimdolGeneral(profile),
    evaluateBogeumjari(profile),
  ];
}
