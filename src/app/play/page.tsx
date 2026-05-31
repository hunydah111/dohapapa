import type { Metadata } from "next";
import { PlayExperience } from "@/components/PlayExperience";

export const metadata: Metadata = {
  title: "부동산 촉 — 동네가 시장 이길까? | 비집고",
  description:
    "이 동네(가격대)가 같은 가격대 평균(시장)보다 더 오를지 맞히는 시세 감각 테스트. 돈이 아니라 촉으로 줄 세운다. 국토부 공개 실거래 기반.",
};

export default function PlayPage() {
  return <PlayExperience />;
}
