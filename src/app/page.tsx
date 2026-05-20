import { HomeExperience } from "@/components/HomeExperience";
import { BrandMark } from "@/components/BrandMark";

/** 따뜻한 보금자리 손그림 — 외부 이미지 의존 없이 인라인 SVG(저작권 0). */
function HomeHeroArt() {
  return (
    <svg
      viewBox="0 0 320 170"
      role="img"
      aria-label="따뜻한 동네와 집 일러스트"
      className="mx-auto mb-1 h-28 w-auto sm:h-32"
    >
      {/* 해 + 부드러운 빛 */}
      <circle cx="258" cy="44" r="30" fill="#FFE1A8" opacity="0.55" />
      <circle cx="258" cy="44" r="20" fill="#FFC23C" />
      {/* 새 두 마리 */}
      <path
        d="M60 40q7-8 14 0q7-8 14 0"
        fill="none"
        stroke="#B98C5A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* 땅 */}
      <path d="M0 150q160-34 320 0v20H0z" fill="#EBD9C2" />
      <path d="M0 158q160-22 320 0v12H0z" fill="#DFC9AC" />
      {/* 나무 */}
      <rect x="56" y="112" width="9" height="32" rx="4" fill="#B98C5A" />
      <circle cx="60.5" cy="100" r="24" fill="#8FBF8A" />
      <circle cx="74" cy="110" r="15" fill="#A6D0A0" />
      {/* 집 */}
      <rect
        x="112"
        y="84"
        width="96"
        height="66"
        rx="9"
        fill="#FFFFFF"
        stroke="#EAD9C8"
        strokeWidth="2"
      />
      {/* 지붕 (코랄) */}
      <path
        d="M104 88l52-40 52 40z"
        fill="#FF7A59"
        stroke="#F2603C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 굴뚝 */}
      <rect x="186" y="56" width="11" height="22" rx="2" fill="#F2603C" />
      {/* 문 */}
      <rect x="146" y="112" width="26" height="38" rx="7" fill="#FFB088" />
      <circle cx="166" cy="132" r="2.4" fill="#F2603C" />
      {/* 창 + 하트 */}
      <rect x="121" y="100" width="22" height="22" rx="5" fill="#FFE6B0" />
      <path
        d="M132 118c-5-3.5-8-6-8-9a3.3 3.3 0 0 1 6-1.7A3.3 3.3 0 0 1 140 109c0 3-3 5.5-8 9z"
        fill="#FF7A59"
      />
    </svg>
  );
}

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

        {/* 따뜻한 일러스트 */}
        <HomeHeroArt />

        {/* 워드마크 — 로고 마크 + 텍스트 인라인 락업 (주아체) */}
        <h1
          className="font-jua flex items-center justify-center gap-2.5 text-4xl tracking-tight sm:text-5xl"
          style={{ color: "#3a322c" }}
        >
          <BrandMark
            size={48}
            className="h-9 w-9 text-coral-600 sm:h-12 sm:w-12"
          />
          홈앤나
        </h1>

        {/* 캐주얼 태그라인 — "재미로 한번 돌려본다" 톤 */}
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
