import type { ComplexCandidate } from "@/types/recommendation";
import type { HomeType } from "@/lib/homeType";
import { formatKrwHuman } from "@/lib/format";
import { budgetTier } from "@/lib/budgetPercentile";
import { SITE_URL, SITE_DOMAIN } from "@/lib/site";
import { BijiCard } from "./BijiCard";
import { classifyRegulation } from "@/lib/regulation";

// 발견의 의외성 카피 — "이 조건에 이 동네가?" (회의: 재미=발견). 컴플라이언스: 투자권유 아님.
// 톤: 시크하고 유머러스한 선배 모먼트 (v1.5) — "잡았어 = 발견, 추천 아님" 패턴.
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
  if (popular.includes(c.sigungu)) return `${c.sigungu}? 통장 좀 되네`;
  if (commute > 0 && commute <= 35) return `통근 ${commute}분 컷`;
  return `${c.sigungu} ${c.dongName} · 몰랐지?`;
}

// 결과 공개 히어로 카드 — BijiCard 등급 + 1순위 단지 (시크·유머러스 톤).
// 2026-05-27 v1.5: MBTI 클리셰(유형 칩·희귀도) 제거. homeType은 보조 공유 링크에서만.
export function HeroResultCard({
  candidate,
  homeType,
  onShare,
  budgetTopPercent,
  budgetNetKrw,
}: {
  candidate: ComplexCandidate;
  homeType: HomeType;
  onShare: (url?: string) => void;
  /** 추정 구매력이 닿는 상위 % (작을수록 강함). 유리할 때(≤50)만 표시. null = 숨김. */
  budgetTopPercent?: number | null;
  /** 추정 구매력(원) — 백분위 밴드 숫자 표시용. */
  budgetNetKrw?: number;
}) {
  // 유형 카드 공유 링크 — 프로필 없이 유형만(바이럴 안전). /s/{slug} 에 동적 OG 카드.
  const typeShareUrl = `${SITE_URL}/s/${homeType.slug}`;
  // 비버 등급 공유 링크 — 등급+시군구만(소득·자산·직장 X). /s/b/{grade}/{region} 동적 OG 카드.
  // 닿는 동네 = 1순위 후보 시군구("이 동네가 잡혔어요"의 그 동네). 백분위 데이터 있을 때만.
  const gradeShareUrl =
    budgetTopPercent != null
      ? `${SITE_URL}/s/b/${budgetTier(budgetTopPercent).slug}/${encodeURIComponent(
          candidate.sigungu,
        )}`
      : null;
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
      className="relative overflow-hidden rounded-3xl px-5 py-5 text-white"
      style={{ background: "linear-gradient(135deg, #fe7644 0%, #d24f24 100%)" }}
    >
      {/* 장식 글로우 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 70%)" }}
      />

      {/* MBTI 클리셰(유형 칩·방문자 N%·희귀) 제거 (2026-05-27 v1.5 — 사용자 "촌스럽다" 지적).
          정체성은 BijiCard 등급 하나로 일원화. homeType 시스템은 백엔드·보조 공유 링크에 보존. */}

      {/* ── 구매력 계급(BijiCard) — 전 구간 노출. 사용자 예산을 실거래가 분포에 줄 세움.
          최하위(isFlex=false)는 숫자 숨기고 응원 라벨만. ── */}
      {budgetTopPercent != null &&
        (() => {
          const t = budgetTier(budgetTopPercent);
          // 라이프스타일 칩 — 카드에 동행할 1~2개 (정신없음 차단). 우선순위: vibe > 초품아 > 짧은 통근.
          // "상위 N%"는 문맥 없이 뜬금 → 제거. 백분위는 카드 밖 보조 라인에서만.
          const chips: string[] = [];
          if (candidate.vibeBadge) chips.push(candidate.vibeBadge);
          if (candidate.isChopumah) chips.push("🏫 초품아");
          if (chips.length < 2 && totalCommute > 0 && totalCommute <= 35 && !transitPending) {
            chips.push(`${commuteIcon} ${totalCommute}분`);
          }
          return (
            <div className="mx-auto mt-3.5 flex w-full max-w-[280px] flex-col items-center">
              <BijiCard
                tier={t}
                sigungu={candidate.sigungu}
                dongName={candidate.dongName}
                areaM2={candidate.representativeArea}
                chips={chips}
                className="w-full"
              />
              {/* 카드 아래 단 한 줄 보조 — 구매력 + 백분위(있을 때) + 면책 한 줄 통합.
                  카드 안 drip("골라짓는 비버")은 BijiCard 내부 라벨로 충분 → 외부 quote 제거. */}
              {budgetNetKrw != null && budgetNetKrw > 0 && (
                <p className="mt-2 text-center text-[12px] text-white/80">
                  <span className="font-semibold text-amber-100">
                    추정 구매력 {formatKrwHuman(budgetNetKrw)}
                  </span>
                  {t.isFlex && budgetTopPercent <= 50 && (
                    <span className="text-white/65"> · 실거래 상위 {budgetTopPercent}%</span>
                  )}
                </p>
              )}
              <p className="mt-1 px-2 text-center text-[11px] leading-relaxed text-white/50">
                국토부 실거래가 기반 추정 · 미래가치 예측 아님
              </p>
            </div>
          );
        })()}

      {/* 구분선 */}
      <div className="my-4 h-px w-full bg-white/20" />

      {/* ── 1순위 매칭 단지 ── */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
        조건에 맞는 1순위 단지 잡았어
      </p>

      {/* 의외성 카피 — 발견의 재미 */}
      <p className="mt-1 text-[15px] font-extrabold leading-snug text-amber-100">
        {discoveryLine(candidate)}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
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
      {(() => {
        // 2025.10.15 대책 안내 — 토허제만 사실 라벨로 노출(사전허가·2년 실거주 필수 안내).
        // 비규제 라벨은 CandidateCard 단지 행에 동일 칩 있어 중복 → 히어로에선 생략.
        const reg = classifyRegulation(candidate.sigungu);
        if (reg.noticeLine) {
          return (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/18 px-2.5 py-1 text-[11.5px] font-semibold text-white/95 backdrop-blur-sm">
              <span aria-hidden="true">🛈</span>
              {reg.noticeLine}
            </p>
          );
        }
        return null;
      })()}

      {/* 공유 — 비버 등급 카드가 주(主), 유형 카드는 보조. 둘 다 소득·자산 미포함(바이럴 안전). */}
      {gradeShareUrl ? (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className="text-[13px] font-bold text-amber-100">
            친구는 무슨 비버? · 보내서 비교해보자~
          </p>
          <button
            type="button"
            onClick={() => onShare(gradeShareUrl)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-coral-700 shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            🦫 내 비버 등급 공유하기
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onShare(typeShareUrl)}
            className="text-[12px] font-semibold text-white/80 underline underline-offset-2 transition-colors hover:text-white focus:outline-none"
          >
            유형 카드로 공유하기
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onShare(typeShareUrl)}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-coral-700 shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-white/70"
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
      )}

      <p className="mt-2 text-[11px] leading-snug text-white/70">
        🦫 등급·동네만 공유됨 — 소득·자산·직장 정보는 안 담김.
      </p>

      {/* 브랜드 워터마크 — 이 카드를 캡쳐해 공유해도 출처가 따라가게(V4). */}
      <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-white/15 pt-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/biji/biji-face.png?v=2"
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px]"
          draggable={false}
        />
        <span className="text-[12px] font-extrabold tracking-tight text-white/90">
          비집고
        </span>
        <span className="text-[11px] font-semibold text-white/55">
          · {SITE_DOMAIN}
        </span>
      </div>
    </section>
  );
}
