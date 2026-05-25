// 검색 "취향" 로컬 저장 — 재방문 이어보기(R2)용. 기기 localStorage 에만 둔다(서버 전송 X).
//
// 프라이버시: 민감정보(소득·자산·직장·예산·가족)는 절대 저장하지 않는다. 가구유형·평수·
// 우선순위·지역·분위기·예산밴드 등 "어떻게 찾을지"만 담아, 이어보기 시 폼을 그만큼만
// 미리 채운다(민감 항목은 사용자가 다시 입력). 첫화면의 "민감정보 저장 안 함" 약속과 일치.

import type {
  CoupleProfile,
  HouseholdType,
  AreaRangeKey,
  PriorityKey,
  LocationVibes,
  BudgetFlex,
} from "@/types/profile";

const KEY = "biji-search-prefs";

export interface SearchPrefs {
  householdType: HouseholdType;
  preferredAreaRanges: AreaRangeKey[];
  priorities: Record<PriorityKey, number>;
  requiredRegions: string[];
  locationVibes: LocationVibes;
  budgetFlex: BudgetFlex;
}

const HOUSEHOLDS: HouseholdType[] = [
  "single",
  "dualIncome",
  "singleIncome",
  "retired",
];

const HOUSEHOLD_LABEL: Record<HouseholdType, string> = {
  single: "1인 가구",
  dualIncome: "맞벌이",
  singleIncome: "외벌이",
  retired: "은퇴",
};

/** 결과가 나온 프로필에서 비민감 검색 취향만 추려 기기에 저장. 실패는 무시. */
export function saveSearchPrefs(profile: CoupleProfile): void {
  try {
    const prefs: SearchPrefs = {
      householdType: profile.householdType,
      preferredAreaRanges: profile.preferredAreaRanges,
      priorities: profile.priorities,
      requiredRegions: profile.requiredRegions ?? [],
      locationVibes: profile.locationVibes ?? {},
      budgetFlex: profile.budgetFlex ?? "normal",
    };
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* 저장 실패 무시 — 부가기능 */
  }
}

/** 저장된 검색 취향 로드(+가벼운 스키마 검증). 없거나 깨졌으면 null. */
export function loadSearchPrefs(): SearchPrefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SearchPrefs>;
    if (
      !p ||
      !HOUSEHOLDS.includes(p.householdType as HouseholdType) ||
      !Array.isArray(p.preferredAreaRanges) ||
      p.preferredAreaRanges.length === 0 ||
      typeof p.priorities !== "object" ||
      p.priorities === null
    ) {
      return null;
    }
    return {
      householdType: p.householdType as HouseholdType,
      preferredAreaRanges: p.preferredAreaRanges as AreaRangeKey[],
      priorities: p.priorities as Record<PriorityKey, number>,
      requiredRegions: Array.isArray(p.requiredRegions) ? p.requiredRegions : [],
      locationVibes:
        p.locationVibes && typeof p.locationVibes === "object"
          ? (p.locationVibes as LocationVibes)
          : {},
      budgetFlex: (p.budgetFlex as BudgetFlex) ?? "normal",
    };
  } catch {
    return null;
  }
}

/** 저장된 검색 취향 삭제. */
export function clearSearchPrefs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

/** 이어보기 배너용 짧은 라벨 — 예 "맞벌이 · 강남구" / "1인 가구". */
export function resumeLabel(prefs: SearchPrefs): string {
  const parts: string[] = [HOUSEHOLD_LABEL[prefs.householdType]];
  if (prefs.requiredRegions.length > 0) {
    parts.push(
      prefs.requiredRegions.length === 1
        ? prefs.requiredRegions[0]
        : `${prefs.requiredRegions[0]} 외 ${prefs.requiredRegions.length - 1}곳`,
    );
  }
  return parts.join(" · ");
}
