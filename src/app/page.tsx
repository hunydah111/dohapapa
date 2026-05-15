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

        {/* 콤파스 마크 — 히어로 사이즈 */}
        <div className="mb-5 flex justify-center text-indigo-600">
          <div className="rounded-3xl bg-white/60 p-3 shadow-[0_8px_28px_-12px_rgba(79,70,229,0.35)] ring-1 ring-indigo-100 backdrop-blur">
            <BrandMark size={56} />
          </div>
        </div>

        {/* 브랜드 supertitle */}
        <p
          className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "#9a3412" /* warm amber-800 */ }}
        >
          홈앤나사이
        </p>

        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "#1d1d1f" }}
        >
          우리, 어디 살 수 있을까
        </h1>
        <p
          className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed"
          style={{ color: "#6e6e73" }}
        >
          통근 거리·예산·학군 조건을 입력하면 국토부 실거래가로 살 만한 단지를
          좁혀 드립니다.
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
