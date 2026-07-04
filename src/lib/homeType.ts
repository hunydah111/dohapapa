import type { CoupleProfile } from "@/types/profile";

// "집 찾기 유형" — 입력한 우선순위(통근·학군·신축)로 결정하는 재미용 유형.
// MBTI 결과 카드 톤. 투자/추천이 아닌 "성향 라벨"이므로 컴플라이언스상 안전.
export interface HomeType {
  /** URL 식별 슬러그 (commute|school|newbuild|balanced). */
  slug: HomeTypeSlug;
  emoji: string;
  name: string;
  tagline: string;
}

export type HomeTypeSlug = "commute" | "school" | "newbuild" | "balanced";

export const HOME_TYPES: Record<HomeTypeSlug, HomeType> = {
  commute: {
    slug: "commute",
    emoji: "🚗",
    name: "통근 사수형",
    tagline: "출퇴근 시간을 1순위로 두는 현실파",
  },
  school: {
    slug: "school",
    emoji: "🏫",
    name: "학군 올인형",
    tagline: "아이 교육 환경이 무엇보다 우선",
  },
  newbuild: {
    slug: "newbuild",
    emoji: "✨",
    name: "신축 선호형",
    tagline: "새 아파트의 쾌적함을 중시하는 타입",
  },
  balanced: {
    slug: "balanced",
    emoji: "⚖️",
    name: "균형 추구형",
    tagline: "어느 하나도 포기 못 하는 밸런스파",
  },
};

export const HOME_TYPE_SLUGS = Object.keys(HOME_TYPES) as HomeTypeSlug[];

/** 슬러그로 유형 조회 (공유 OG·페이지용). 없으면 null. */
export function getHomeTypeBySlug(slug: string): HomeType | null {
  return (HOME_TYPES as Record<string, HomeType>)[slug] ?? null;
}

// 우선순위 키 → 유형 슬러그
const KEY_TO_SLUG: Record<"commute" | "school" | "buildingAge", HomeTypeSlug> = {
  commute: "commute",
  school: "school",
  buildingAge: "newbuild",
};

export function getHomeType(profile: CoupleProfile): HomeType {
  const { priorities, householdType } = profile;
  // 은퇴 가구는 통근 가중치가 0 이므로 통근은 후보에서 제외
  const commute = householdType === "retired" ? -1 : priorities.commute ?? 0;
  const school = priorities.school ?? 0;
  const buildingAge = priorities.buildingAge ?? 0;

  const entries: Array<[keyof typeof KEY_TO_SLUG, number]> = [
    ["commute", commute],
    ["school", school],
    ["buildingAge", buildingAge],
  ];
  entries.sort((a, b) => b[1] - a[1]);

  const [topKey, topVal] = entries[0];
  const secondVal = entries[1][1];

  // 최고 우선순위가 없거나(모두 0) 2등과 동률이면 균형형
  if (topVal <= 0 || topVal === secondVal) return HOME_TYPES.balanced;
  return HOME_TYPES[KEY_TO_SLUG[topKey]];
}
