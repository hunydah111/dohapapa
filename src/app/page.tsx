import { HomeExperience } from "@/components/HomeExperience";
import { Homi } from "@/components/Homi";

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4">
      {/* ── 히어로 ── */}
      <section className="relative pt-10 pb-8 text-center sm:pt-14 sm:pb-12">
        {/* 부드러운 색감 배경 — 코랄·웜옐로 라디얼 워시 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px]"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 10%, rgba(224,162,58,0.18) 0%, rgba(79,157,84,0.12) 42%, rgba(245,236,217,0) 75%)",
          }}
        />

        {/* 워드마크 — 비버 위 (텍스트만, 로고 마크 생략, 주아체) */}
        <h1
          className="font-jua text-center text-[3.4rem] leading-none tracking-wide sm:text-7xl"
          style={{ color: "#3a2c1d" }}
        >
          비집고
        </h1>

        {/* 마스코트 비지 — 워드마크 아래 */}
        <Homi mood="wave" size={230} className="mx-auto mt-2" />

        {/* 캐주얼 태그라인 — 호미가 말 거는 톤 */}
        <p
          className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed"
          style={{ color: "#6b6157" }}
        >
          내 통장으로 어디 살 수 있을까?
        </p>
      </section>

      {/* ── 메인 경험 ── */}
      <HomeExperience />

      {/* ── 면책 안내 ── */}
      <p
        className="py-10 text-center text-xs leading-relaxed"
        style={{ color: "#9a8f82" }}
      >
        본 서비스는 국토교통부 공개 실거래가를 바탕으로 한 정보 제공 도구이며,
        부동산 중개 또는 투자 자문이 아닙니다.
      </p>
    </div>
  );
}
