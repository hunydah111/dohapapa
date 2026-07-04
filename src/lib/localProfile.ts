// 개인 조건 로컬 저장 — 문턱 게이지(옵트인)용. 기기 localStorage 에만 둔다(서버 전송 X).
//
// searchPrefs(비민감 취향)와 달리 이건 프로필 전체(소득·자산 포함)라 **명시 옵트인**일 때만
// 저장한다. UI 는 반드시 "이 폰에만 저장 · 서버 미전송" 을 함께 표기. 체크 해제 시 즉시 삭제.
// 무저장 원칙(서버 stateless)은 그대로 — 이 파일은 브라우저 밖으로 아무것도 보내지 않는다.

import type { CoupleProfile, HouseholdType } from "@/types/profile";

const KEY = "biji-local-profile";

const HOUSEHOLDS: HouseholdType[] = [
  "single",
  "dualIncome",
  "singleIncome",
  "retired",
];

export interface LocalProfile {
  profile: CoupleProfile;
  /** 저장 당시 판정 1순위 시군구 — 게이지 대상 지역. 없으면 requiredRegions[0] 폴백. */
  lastSigungu?: string;
  savedAt: string; // ISO 날짜 — 디버깅용
}

/** 옵트인 시 프로필 전체 + 1순위 시군구를 기기에 저장. 실패는 무시(부가기능). */
export function saveLocalProfile(
  profile: CoupleProfile,
  lastSigungu?: string,
): void {
  try {
    const data: LocalProfile = {
      profile,
      lastSigungu,
      savedAt: new Date().toISOString().slice(0, 10),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장 실패 무시 */
  }
}

/** 저장된 프로필 로드(+가벼운 스키마 검증). 없거나 깨졌으면 null. */
export function loadLocalProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<LocalProfile>;
    const p = d?.profile as Partial<CoupleProfile> | undefined;
    if (
      !p ||
      !HOUSEHOLDS.includes(p.householdType as HouseholdType) ||
      typeof p.householdIncomeKrwYear !== "number" ||
      typeof p.seedMoneyKrw !== "number" ||
      !Array.isArray(p.preferredAreaRanges) ||
      p.preferredAreaRanges.length === 0
    ) {
      return null;
    }
    return {
      profile: p as CoupleProfile,
      lastSigungu:
        typeof d.lastSigungu === "string" ? d.lastSigungu : undefined,
      savedAt: typeof d.savedAt === "string" ? d.savedAt : "",
    };
  } catch {
    return null;
  }
}

/** 저장된 프로필 삭제 — 옵트인 해제 시 즉시 호출. */
export function clearLocalProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
