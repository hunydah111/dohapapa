import Link from "next/link";
import type { ComplexCandidate, PolicyLoanMatch } from "@/types/recommendation";
import { PolicyLoanCta } from "@/components/PolicyLoanCta";
import type { DdayResult, Conquest } from "@/lib/plan/dday";
import { verdictLine } from "@/lib/verdict";
import { formatKrwHuman } from "@/lib/format";
import { budgetTier } from "@/lib/budgetPercentile";
import { SITE_DOMAIN } from "@/lib/site";
import { BijiCard } from "./BijiCard";
import { composeBijiName } from "@/lib/bijiName";
import { pickTierImage } from "@/lib/budgetPercentile";
import type { FriendTag } from "@/lib/friendShare";
import { classifyRegulation } from "@/lib/regulation";
import dataMeta from "@/data/dataMeta.json";

// 추정가 출처일 — "2026-05-29" → "2026.5.29" (국토부 실거래 반영 기준일).
const PRICE_AS_OF: string = (() => {
  const d = dataMeta.latestDealDate;
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${y}.${Number(m)}.${Number(day)}`;
})();

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
// 2026-06-11: 공유 동선 일원화 — 등급/유형 공유 버튼 제거, 친구 비교 보내기 하나만.
export function HeroResultCard({
  candidate,
  dday,
  conquest,
  policyMatches,
  onShareFriend,
  friendTag,
  budgetTopPercent,
  budgetNetKrw,
}: {
  candidate: ComplexCandidate;
  /** D-day(1순위 시군구 중위 입성) — null/undefined면 카드에서 생략. */
  dday?: DdayResult | null;
  /** vs 지도 정복 게이지 — "수도권 N곳 중 입성 가능 M곳". null이면 생략. */
  conquest?: Conquest | null;
  /** 정책대출 자격 판정(budget.policyLoanMatches) — eligible 있으면 톨게이트 CTA 노출. */
  policyMatches?: PolicyLoanMatch[] | null;
  /** 친구한테 보내기 — 자기 결과를 친구 비교 링크로 인코딩해 공유. */
  onShareFriend?: () => void;
  /** 친구가 비교용으로 보낸 비지 (URL ?f=). 있으면 결과 위에 비교 카드 노출. */
  friendTag?: FriendTag | null;
  /** 추정 구매력이 닿는 상위 % (작을수록 강함). 유리할 때(≤50)만 표시. null = 숨김. */
  budgetTopPercent?: number | null;
  /** 추정 구매력(원) — 백분위 밴드 숫자 표시용. */
  budgetNetKrw?: number;
}) {
  const friendName = friendTag ? composeBijiName(friendTag.sigungu, friendTag.tier) : null;
  const friendImage = friendTag ? pickTierImage(friendTag.tier.image, friendTag.sigungu) : null;

  // D-day 표시 변환 — 지금 가능(긍정) / D-숫자 / D-아득(박탈감 캡) + 자조 verdict 한 줄.
  const ddayDisplay = dday
    ? {
        ...(dday.months === 0
          ? { caption: `${dday.sigungu} 중위 단지`, headline: "지금 입성 가능" }
          : dday.capped
            ? { caption: `${dday.sigungu} 중위 입성까지`, headline: "D-아득" }
            : {
                caption: `${dday.sigungu} 중위 입성까지`,
                headline: `D-${dday.days!.toLocaleString()}`,
              }),
        verdict: verdictLine(dday),
      }
    : undefined;
  // /plan 프리필 — 결과카드가 유일한 plan 진입점 (한 방 스펙).
  const planHref = dday
    ? `/plan?price=${dday.targetKrw}&name=${encodeURIComponent(
        `${dday.sigungu} ${dday.bandLabel} 중위`,
      )}&sgg=${encodeURIComponent(dday.sigungu)}&area=${candidate.representativeArea}`
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
      style={{ background: "#fe7644" }}
    >

      {/* 친구 비교 — URL ?f= 친구 비지 있을 때만. 자기 카드 위에 친구 비지 미니로 노출. */}
      {friendTag && friendName && friendImage && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${friendImage}?v=4`}
            alt={`친구의 비지: ${friendName}`}
            className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain ring-1 ring-white/40"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-100">👬 친구 비지</p>
            <p className="mt-0.5 truncate text-[14px] font-extrabold text-white" title={friendName}>
              {friendName}
            </p>
          </div>
          <p className="shrink-0 rounded-full bg-amber-200/30 px-2 py-0.5 text-[10.5px] font-bold text-amber-100">
            VS
          </p>
        </div>
      )}

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
                dday={ddayDisplay}
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
                국토부 실거래가 기반 추정{PRICE_AS_OF ? ` · ${PRICE_AS_OF} 반영` : ""} · 미래가치 예측 아님
                {dday && dday.months !== 0 && (
                  <>
                    <br />
                    D-day: 현재가 고정 · 월 저축 {formatKrwHuman(dday.monthlySavingKrw)} 가정
                  </>
                )}
              </p>
              {/* plan 진입 — 결과카드가 유일한 입구. 숫자에 절망 말고 레버로. */}
              {planHref && dday && dday.months !== 0 && (
                <Link
                  href={planHref}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  ⏳ D-day 줄이는 법 보기 →
                </Link>
              )}

              {/* vs 지도 정복 게이지 — 비교 대상은 사람이 아니라 지도. "나는 몇 곳?" 호기심 훅. */}
              {conquest && (
                <div className="mt-3 w-full max-w-[260px]">
                  <p className="text-center text-[12px] font-bold text-white/90">
                    수도권 {conquest.total}곳 중 지금 입성 가능{" "}
                    <span className="text-amber-200">{conquest.affordableNow}곳</span>
                  </p>
                  <div
                    className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/20"
                    role="img"
                    aria-label={`수도권 ${conquest.total}곳 중 ${conquest.affordableNow}곳 입성 가능`}
                  >
                    <div
                      className="h-full rounded-full bg-amber-200"
                      style={{
                        width: `${Math.min(100, Math.round((conquest.affordableNow / conquest.total) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-center text-[10px] text-white/50">
                    {conquest.bandLabel} 중위가 기준 추정
                  </p>
                </div>
              )}
            </div>
          );
        })()}

      {/* 💰 돈 구석 — 판정 직후 정책대출 톨게이트 (Phase 0: 공식 링크 + 계측만). */}
      <div className="mt-4">
        <PolicyLoanCta matches={policyMatches} context="result" tone="hero" />
      </div>

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

      {/* 공유 — 자연스러운 결과 공유. 소득·자산 미포함(바이럴 안전). */}
      {onShareFriend && (
        <div className="mt-4 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={onShareFriend}
            className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-5 py-2.5 text-sm font-bold text-coral-800 shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
            </svg>
            내 결과 공유하기
          </button>
          <p className="text-[11px] leading-snug text-white/70">
            등급·동네·D-day만 공유돼요 — 소득·자산·직장 정보는 안 담겨요.
          </p>
        </div>
      )}

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
