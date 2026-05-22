import type { ReactNode } from "react";
import type { ComplexCandidate } from "@/types/recommendation";
import type { HomeType } from "@/lib/homeType";
import { formatKrwHuman } from "@/lib/format";

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
      {children}
    </span>
  );
}

// 발견의 의외성 카피 — "이 조건에 이 동네가?" (회의: 재미=발견). 컴플라이언스: 투자권유 아님, 가벼운 톤.
function discoveryLine(c: ComplexCandidate): string {
  const popular = [
    "강남구",
    "서초구",
    "송파구",
    "용산구",
    "성동구",
    "마포구",
    "성남시 분당구",
    "과천시",
  ];
  const commute = c.commuteLegs.reduce((s, l) => s + l.minutes, 0);
  if (popular.includes(c.sigungu)) return `🤯 ${c.sigungu}가 내 조건에 잡혔어요!`;
  if (commute > 0 && commute <= 35) return `🚀 통근 ${commute}분, 생각보다 가깝죠?`;
  return `🔍 ${c.sigungu} ${c.dongName}, 이런 단지 있는 거 아셨어요?`;
}

// 결과 공개 히어로 카드 — "집 찾기 유형"(유형 비지 캐릭터) + 1순위 단지를 MBTI 결과 카드 톤으로.
export function HeroResultCard({
  candidate,
  homeType,
  onShare,
}: {
  candidate: ComplexCandidate;
  homeType: HomeType;
  onShare: () => void;
}) {
  const totalCommute = candidate.commuteLegs.reduce(
    (sum, leg) => sum + leg.minutes,
    0,
  );
  const hasCar = candidate.commuteLegs.some((l) => l.mode === "car");
  const hasTransit = candidate.commuteLegs.some((l) => l.mode === "transit");
  const commuteIcon = hasCar && hasTransit ? "🚗🚌" : hasTransit ? "🚌" : "🚗";
  const transitPending = candidate.commuteLegs.some(
    (l) => l.mode === "transit" && l.realTransit === undefined,
  );

  const kakaoMapUrl = `https://map.kakao.com/?q=${encodeURIComponent(
    `${candidate.complexName} ${candidate.dongName}`,
  )}`;

  return (
    <section
      className="relative overflow-hidden rounded-3xl px-6 py-8 text-white"
      style={{ background: "linear-gradient(135deg, #ff7a59 0%, #7c3aed 100%)" }}
    >
      {/* 장식 글로우 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 70%)" }}
      />

      {/* ── 유형 공개 (MBTI 카드 톤) ── */}
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-white/75">
        당신의 집 찾기 유형
      </p>

      {/* 유형 비지 캐릭터 — 흰 원 배경 위에 pop-in */}
      <div className="biji-pop-in mt-3 flex justify-center">
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/18 shadow-inner ring-1 ring-white/25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${homeType.image}?v=1`}
            alt={`${homeType.name} 비지`}
            width={112}
            height={112}
            className="h-28 w-auto drop-shadow-md"
            draggable={false}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-center text-[2rem] font-extrabold leading-tight tracking-tight sm:text-4xl">
        <span aria-hidden="true">{homeType.emoji}</span>
        <span>{homeType.name}</span>
      </div>
      <p className="mx-auto mt-2 max-w-xs text-center text-[15px] leading-relaxed text-white/90">
        {homeType.tagline}
      </p>

      {/* 구분선 */}
      <div className="my-6 h-px w-full bg-white/20" />

      {/* ── 1순위 매칭 단지 ── */}
      <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
        이 유형에 맞는 1순위 내 집
      </p>

      {/* 의외성 카피 — 발견의 재미 */}
      <p className="mt-1.5 text-[17px] font-extrabold leading-snug text-amber-100">
        {discoveryLine(candidate)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
          {candidate.complexName}
        </h2>
        <a
          href={kakaoMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${candidate.complexName} 지도에서 위치 보기`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/70"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003z"
              clipRule="evenodd"
            />
          </svg>
          지도
        </a>
      </div>
      <p className="mt-1 text-sm text-white/85">
        {candidate.sigungu} · {candidate.dongName} · 전용{" "}
        {candidate.representativeArea}㎡
      </p>

      {/* 핵심 스탯 뱃지 */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge>💰 {formatKrwHuman(candidate.medianPriceKrw)}</Badge>
        {totalCommute > 0 && (
          <Badge>
            {commuteIcon} {transitPending ? "계산 중…" : `${totalCommute}분`}
          </Badge>
        )}
        <Badge>⭐ 종합 {candidate.totalScore}점</Badge>
        {candidate.isChopumah && <Badge>🏫 초품아</Badge>}
        {candidate.vibeBadge && <Badge>{candidate.vibeBadge}</Badge>}
      </div>

      {/* 공유 */}
      <button
        type="button"
        onClick={onShare}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-coral-700 shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        내 유형 카드 공유하기
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
        </svg>
      </button>

      <p className="mt-3 text-[11px] leading-relaxed text-white/70">
        ⚠️ 공유 링크엔 입력한 소득·자산·직장 정보가 담겨요. 믿는 사람에게만 보내세요.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-white/60">
        실거래가 기반 추정 정보 · 부동산 중개·투자자문이 아닙니다
      </p>
    </section>
  );
}
