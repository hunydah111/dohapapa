import type { CoupleProfile } from "@/types/profile";

// "집 찾기 유형" — 입력한 우선순위(통근·학군·신축)로 결정하는 재미용 유형.
// MBTI 결과 카드 톤. 투자/추천이 아닌 "성향 라벨"이므로 컴플라이언스상 안전.
export interface HomeType {
  emoji: string;
  name: string;
  tagline: string;
}

const BALANCED: HomeType = {
  emoji: "⚖️",
  name: "균형 추구형",
  tagline: "어느 하나도 포기 못 하는 밸런스파",
};

const TYPE_BY_KEY: Record<"commute" | "school" | "buildingAge", HomeType> = {
  commute: {
    emoji: "🚗",
    name: "통근 사수형",
    tagline: "출퇴근 시간을 1순위로 두는 현실파",
  },
  school: {
    emoji: "🏫",
    name: "학군 올인형",
    tagline: "아이 교육 환경이 무엇보다 우선",
  },
  buildingAge: {
    emoji: "✨",
    name: "신축 선호형",
    tagline: "새 아파트의 쾌적함을 중시하는 타입",
  },
};

export function getHomeType(profile: CoupleProfile): HomeType {
  const { priorities, householdType } = profile;
  // 은퇴 가구는 통근 가중치가 0 이므로 통근은 후보에서 제외
  const commute = householdType === "retired" ? -1 : priorities.commute ?? 0;
  const school = priorities.school ?? 0;
  const buildingAge = priorities.buildingAge ?? 0;

  const entries: Array<[keyof typeof TYPE_BY_KEY, number]> = [
    ["commute", commute],
    ["school", school],
    ["buildingAge", buildingAge],
  ];
  entries.sort((a, b) => b[1] - a[1]);

  const [topKey, topVal] = entries[0];
  const secondVal = entries[1][1];

  // 최고 우선순위가 없거나(모두 0) 2등과 동률이면 균형형
  if (topVal <= 0 || topVal === secondVal) return BALANCED;
  return TYPE_BY_KEY[topKey];
}
