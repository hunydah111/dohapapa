import type { Metadata } from "next";
import { HomeExperience } from "@/components/HomeExperience";

// apex(homenasia.kr)·www 둘 다 200으로 서빙하므로, 검색엔진엔 www를 정본으로 알린다.
// 상대경로는 layout의 metadataBase(https://www.homenasia.kr)로 합성됨.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 pt-4">
      {/* ── 메인 경험 (랜딩 히어로 → 폼 → 결과) ── */}
      <HomeExperience />

      {/* ── 면책 안내 ── */}
      <p
        className="py-10 text-center text-xs leading-relaxed"
        style={{ color: "#9a8f82" }}
      >
        본 서비스는 정보 제공 도구이며, 부동산 중개·투자 자문이 아닙니다.
      </p>
    </div>
  );
}
