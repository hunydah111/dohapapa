import type { Metadata } from "next";
import { PersonaExperience } from "@/components/PersonaExperience";

export const metadata: Metadata = {
  title: "내 부동산 성향 비지 — 10문항 테스트 | 비집고",
  description:
    "10문항이면 끝. 영끌 호랑이 / 가성비 여우 / 똘똘한 부엉이 / 실속 거북이 — 너는 어떤 부동산 성향 비지? 위험·가치 2축으로 가른다.",
};

export default function PersonaPage() {
  return <PersonaExperience />;
}
