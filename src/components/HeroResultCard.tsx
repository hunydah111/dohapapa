import type { ReactNode } from "react";
import type { ComplexCandidate } from "@/types/recommendation";
import type { HomeType } from "@/lib/homeType";
import { formatKrwHuman } from "@/lib/format";

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white">
      {children}
    </span>
  );
}

// 결과 공개 히어로 카드 — "집 찾기 유형" + 1순위 단지를 MBTI 결과 카드 톤으로.
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

  return (
    <section
      className="relative overflow-hidden rounded-3xl px-6 py-8 text-white"
      style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
    >
      {/* 유형 공개 */}
      <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
        당신의 집 찾기 유형
      </p>
      <div className="mt-1.5 flex items-center gap-2.5 text-4xl font-extrabold tracking-tight">
        <span aria-hidden="true">{homeType.emoji}</span>
        <span>{homeType.name}</span>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-white/90">
        {homeType.tagline}
      </p>

      {/* 구분선 */}
      <div className="my-6 h-px w-full bg-white/20" />

      {/* 1순위 매칭 단지 */}
      <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
        이 유형에 맞는 1순위 내 집
      </p>
      <h2 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">
        {candidate.complexName}
      </h2>
      <p className="mt-1 text-sm text-white/85">
        {candidate.sigungu} · {candidate.dongName} · 전용{" "}
        {candidate.representativeArea}㎡
      </p>

      {/* 핵심 스탯 뱃지 */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Badge>💰 {formatKrwHuman(candidate.medianPriceKrw)}</Badge>
        {totalCommute > 0 && <Badge>🚗 {totalCommute}분</Badge>}
        <Badge>⭐ 종합 {candidate.totalScore}점</Badge>
        {candidate.isChopumah && <Badge>🏫 초품아</Badge>}
      </div>

      {/* 공유 */}
      <button
        type="button"
        onClick={onShare}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        결과 공유하기
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
        </svg>
      </button>

      <p className="mt-4 text-[11px] leading-relaxed text-white/60">
        실거래가 기반 추정 정보 · 부동산 중개·투자자문이 아닙니다
      </p>
    </section>
  );
}
