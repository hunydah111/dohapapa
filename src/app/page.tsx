import { HomeExperience } from "@/components/HomeExperience";
import { BrandMark } from "@/components/BrandMark";

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4">
      {/* ── 히어로 ── */}
      <section className="relative pt-14 pb-8 text-center sm:pt-20 sm:pb-12">
        {/* 부드러운 색감 배경 — indigo·amber 라디얼 워시 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px]"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 12%, rgba(245,158,11,0.10) 0%, rgba(79,70,229,0.07) 38%, rgba(255,255,255,0) 75%)",
          }}
        />

        {/* 브랜드 마크 — 히어로 사이즈 */}
        <div className="mb-6 flex justify-center text-indigo-600">
          <BrandMark size={72} />
        </div>

        {/* 워드마크 — 큰 사이즈 */}
        <h1
          className="text-4xl font-extrabold tracking-tight sm:text-5xl"
          style={{ color: "#1d1d1f" }}
        >
          홈앤나사이
        </h1>

        {/* 캐주얼 태그라인 — "재미로 한번 돌려본다" 톤 */}
        <p
          className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed"
          style={{ color: "#6e6e73" }}
        >
          재미로 한번 돌려보는 우리 부부 집 찾기
        </p>
      </section>

      {/* ── 메인 경험 ── */}
      <HomeExperience />

      {/* ── 면책 안내 ── */}
      <p
        className="py-10 text-center text-xs leading-relaxed"
        style={{ color: "#86868b" }}
      >
        본 서비스는 국토교통부 공개 실거래가를 바탕으로 한 정보 제공 도구이며,
        부동산 중개 또는 투자 자문이 아닙니다.
      </p>
    </div>
  );
}
