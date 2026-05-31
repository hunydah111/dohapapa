import type { Metadata } from "next";
import { LeagueExperience } from "@/components/LeagueExperience";

export const metadata: Metadata = {
  title: "동네 자존심 리그 — 우리 동네 이 달 몇 위? | 비집고",
  description:
    "상승 모멘텀·거래 활발·가성비 강세·꾸준왕 4개 부문. 국토부 공개 실거래로 줄 세운 수도권 시군구 순위 — 우리 동네는 뭐가 1위?",
};

export default function LeaguePage() {
  return <LeagueExperience />;
}
