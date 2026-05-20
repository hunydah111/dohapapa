import { HomeExperience } from "@/components/HomeExperience";
import { BrandMark } from "@/components/BrandMark";
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
              "radial-gradient(60% 70% at 50% 10%, rgba(255,194,60,0.16) 0%, rgba(255,122,89,0.12) 40%, rgba(255,255,255,0) 75%)",
          }}
        />

        {/* 마스코트 호미 — 손 흔들며 방긋 */}
        <Homi mood="wave" size={140} className="mx-auto h-32 w-auto sm:h-36" />

        {/* 워드마크 — 로고 마크 + 텍스트 인라인 락업 (주아체) */}
        <h1
          className="font-jua mt-1 flex items-center justify-center gap-2.5 text-4xl tracking-tight sm:text-5xl"
          style={{ color: "#3a322c" }}
        >
          <BrandMark
            size={48}
            className="h-9 w-9 text-coral-600 sm:h-12 sm:w-12"
          />
          홈앤나
        </h1>

        {/* 캐주얼 태그라인 — 호미가 말 거는 톤 */}
        <p
          className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed"
          style={{ color: "#6b6157" }}
        >
          내 월급으로 어디 살 수 있을까?
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
