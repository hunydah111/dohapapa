import { HomeExperience } from "@/components/HomeExperience";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      {/* ── 히어로 ── */}
      <section className="pt-14 pb-8 text-center sm:pt-20 sm:pb-10">
        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "#1d1d1f" }}
        >
          우리 가족, 어디 살 수 있을까
        </h1>
        <p
          className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed"
          style={{ color: "#6e6e73" }}
        >
          통근 거리·예산·학군 조건을 입력하면 국토부 실거래가로 살 만한 단지를
          찾아드립니다.
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
