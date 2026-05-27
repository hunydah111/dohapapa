import Link from "next/link";
import type {
  ComplexCandidate,
  CandidateTier,
} from "@/types/recommendation";
import type { NeighborhoodData } from "@/lib/neighborhood";
import { Card } from "@/components/ui/Card";
import { CommuteDiagram } from "./CommuteDiagram";
import { NeighborhoodInline } from "./NeighborhoodSection";
import { formatKrwHuman, formatEok } from "@/lib/format";
import { classifyRegulation } from "@/lib/regulation";

const TIER_CONFIG: Record<
  CandidateTier,
  { bg: string; text: string; ring: string }
> = {
  안정형: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    ring: "ring-1 ring-emerald-200",
  },
  균형형: {
    bg: "bg-coral-50",
    text: "text-coral-800",
    ring: "ring-1 ring-coral-200",
  },
  도전형: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    ring: "ring-1 ring-amber-200",
  },
};

const RANK_LABELS: Record<number, string> = {
  1: "1위",
  2: "2위",
  3: "3위",
};

export function CandidateCard({
  candidate,
  rank,
  neighborhood,
}: {
  candidate: ComplexCandidate;
  rank: number;
  neighborhood?: NeighborhoodData | null;
}) {
  const tier = TIER_CONFIG[candidate.tier];

  // 가격 편차가 클 때(신축 입주장 등 같은 평형이 층·향 따라 크게 벌어짐)는 단일가가
  // 거짓 정밀이라 "31~36억" 범위로 정직하게 표시한다. ±12%↑ 벌어질 때만.
  const showPriceRange =
    candidate.priceLowKrw != null &&
    candidate.priceHighKrw != null &&
    candidate.priceLowKrw > 0 &&
    candidate.priceHighKrw >= candidate.priceLowKrw * 1.12;

  // 네이버 부동산(m.land)으로 직접 보낸다 — 일반 통합검색(search.naver)이 아니라 부동산 UI 가
  // 바로 뜬다. 단지명만 넘기면 고유 매칭 시 해당 단지 페이지로 직행하고, 흔한 이름이면 부동산
  // 검색목록이 뜬다. (과거 '단지명 동' 합친 쿼리는 매칭 실패가 잦아 이름만 넘긴다.)
  const naverSearchUrl = `https://m.land.naver.com/search/result/${encodeURIComponent(
    candidate.complexName,
  )}`;

  // 단지 매물이 0건일 때 폴백 — 동네(시군구+동)로 넓혀 네이버 부동산에서 보기.
  const naverAreaUrl = `https://m.land.naver.com/search/result/${encodeURIComponent(
    `${candidate.sigungu} ${candidate.dongName}`,
  )}`;

  // 카카오맵 — 단지명+동으로 검색해 해당 단지 위치를 띄운다.
  // (link/map/이름,위도,경도 형식은 레거시 좌표 URL로 리다이렉트돼 기본 화면이 떠서 사용 안 함)
  const kakaoMapUrl = `https://map.kakao.com/?q=${encodeURIComponent(
    `${candidate.complexName} ${candidate.dongName}`,
  )}`;

  // 선택 이유 — 줄줄이 한 문장 대신 "라벨 : 값" 행으로 정돈. 정보 없는 신호는 숨김.
  // (연식은 price-first 철학상 중립화돼 선정 사유가 아니므로 헤더 'N년식'으로만 노출.)
  // 평수 행은 단지 메타 줄에 이미 있어 중복 제거(2026-05-27 β).
  const reasonRows: { label: string; value: string }[] = [];
  if (candidate.commuteLegs.length > 0) {
    reasonRows.push({ label: "통근", value: candidate.reasoning.commute });
  }
  if (
    candidate.reasoning.budgetFit &&
    candidate.reasoning.budgetFit !== "구매력 정보 없음"
  ) {
    reasonRows.push({ label: "예산", value: candidate.reasoning.budgetFit });
  }
  if (
    candidate.reasoning.school &&
    candidate.reasoning.school !== "초등학교 거리 정보 없음"
  ) {
    reasonRows.push({ label: "초등학교", value: candidate.reasoning.school });
  }
  if (candidate.reasoning.largeComplex) {
    reasonRows.push({ label: "단지", value: candidate.reasoning.largeComplex });
  }

  return (
    <Card compact className="flex flex-col gap-2.5">
      {/* 상단 행: 티어 + 순위 + 신뢰 배지(추정·분양권·실거래적음) + 종합점수.
          재미 배지(초품아·vibe·인정받는)는 본문 정보와 중복이라 제거(2026-05-27 β). */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide ${tier.bg} ${tier.text} ${tier.ring}`}
        >
          {candidate.tier}
        </span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "#6b6157" }}
        >
          {RANK_LABELS[rank] ?? `${rank}위`}
        </span>
        {candidate.priceEstimated ? (
          <span
            className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200"
            title="이 평형의 직접 실거래가 아직 없어 인근 단지 시세로 환산한 추정값입니다 (등기 진행 중 신축 등)"
          >
            추정 시세 · 실거래 미확정
          </span>
        ) : candidate.priceFromPresale ? (
          <span
            className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600 ring-1 ring-stone-300"
            title="등기 전 신축이라 분양권/입주권 실거래가 기준입니다 (소유권 이전 매매와 권리 상태가 다름)"
          >
            분양권·입주권
          </span>
        ) : (
          candidate.lowDataConfidence && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
              실거래 데이터 적음
            </span>
          )
        )}
        <span
          className="ml-auto rounded-full bg-[#f3ece4] px-3 py-1 text-xs font-semibold tabular-nums"
          style={{ color: "#6b6157" }}
        >
          종합 {candidate.totalScore}점
        </span>
      </div>

      {/* 비교 근거 — 왜 이 순위인지 (다른 두 후보 대비) */}
      {candidate.rankReason && (
        <p
          className="text-xs leading-relaxed -mt-2"
          style={{ color: "#6b6157" }}
        >
          {candidate.rankReason}
        </p>
      )}

      {/* 단지명 + 위치 + 시세 */}
      <div>
        <div className="flex flex-wrap items-start gap-2">
          <h3
            className="text-lg font-extrabold leading-tight tracking-tight"
            style={{ color: "#3a322c" }}
          >
            {candidate.complexName}
            {candidate.buildYear !== null && (
              <span
                className="ml-1.5 text-xs font-semibold tabular-nums"
                style={{ color: "#9a8f82" }}
              >
                ({candidate.buildYear}년식)
              </span>
            )}
          </h3>
          <a
            href={kakaoMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${candidate.complexName} 지도에서 위치 보기`}
            className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-coral-200 bg-coral-50 px-2.5 py-1 text-xs font-semibold text-coral-700 transition-colors hover:bg-coral-100 focus:outline-none focus:ring-2 focus:ring-coral-500"
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
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm" style={{ color: "#6b6157" }}>
            {candidate.sigungu}
          </span>
          {(() => {
            // 2025.10.15 대책 라벨 — 규제(토허제·사전허가·2년 실거주) vs 비규제(LTV 70%·DSR 완화).
            // 비규제는 LTV 우대 +5점 페널티가 추천 점수에 동반(수요 압력·인프라 상대적 약함).
            // 카피톤: 사실만, 평가·추천 아님.
            const reg = classifyRegulation(candidate.sigungu);
            if (reg.landUseRestricted) {
              return (
                <span
                  className="inline-flex items-center rounded-full bg-[#fff4ef] px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ color: "#c4521f" }}
                  title="2025.10.20~ 매수 시 사전허가 + 2년 실거주 의무"
                >
                  토허제
                </span>
              );
            }
            // 비규제 — 자치구 코드가 알려진 수도권일 때만 표시(미상 시군구엔 라벨 안 함).
            if (candidate.sigungu) {
              return (
                <span
                  className="inline-flex items-center rounded-full bg-[#f3ece4] px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ color: "#6e5b46" }}
                  title="규제지역 미지정 — LTV 70% 적용, 단지 점수 −5(인기는 미만)"
                >
                  비규제
                </span>
              );
            }
            return null;
          })()}
          <span style={{ color: "#c7c7cc" }}>·</span>
          <span className="text-sm" style={{ color: "#6b6157" }}>
            {candidate.dongName}
          </span>
          <span style={{ color: "#c7c7cc" }}>·</span>
          <span className="text-sm" style={{ color: "#6b6157" }}>
            전용 {candidate.representativeArea}㎡
          </span>
          <span style={{ color: "#c7c7cc" }}>·</span>
          <span
            className="font-jua text-[20px] tabular-nums tracking-tight"
            style={{ color: "#b87914" }}
          >
            {showPriceRange
              ? `${formatEok(candidate.priceLowKrw!)}~${formatEok(candidate.priceHighKrw!)}`
              : formatKrwHuman(candidate.medianPriceKrw)}
          </span>
          <span
            className="text-[11px] font-medium -ml-1"
            style={{ color: "#9a8f82" }}
          >
            {showPriceRange ? "추정" : "실거래 중위가"}
          </span>
          {/* 근거 배지 — 추정가가 무엇에 근거하는지 스캔 가능하게(거래건수·기간). */}
          <span
            className="inline-flex items-center rounded-full bg-[#f3ece4] px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: "#9a8f82" }}
            title="추정가 산정 근거 — 국토교통부 공개 실거래 기준"
          >
            {candidate.priceEstimated
              ? "주변시세 환산"
              : candidate.priceFromPresale
                ? `분양권 ${candidate.transactionCount}건`
                : `실거래 ${candidate.transactionCount}건·${candidate.lowDataConfidence ? "최근1년" : "최근6개월"}`}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug" style={{ color: "#9a8f82" }}>
          {candidate.priceEstimated
            ? `${candidate.estimateBasis ?? "주변 시세"} 환산 추정 · 실거래 미확정`
            : candidate.priceFromPresale
              ? `분양권/입주권 ${candidate.transactionCount}건 기준`
              : showPriceRange
                ? `실거래 ${candidate.transactionCount}건 · 층·향 편차 큼(중앙 ${formatKrwHuman(candidate.medianPriceKrw)})`
                : candidate.lowDataConfidence
                  ? `최근 1년 ${candidate.transactionCount}건 · 거래 적음(참고용)`
                  : `최근 6개월 실거래 ${candidate.transactionCount}건 중위값`}
          {" · 국토부 공개데이터(실거래와 다를 수 있음)"}
        </p>
      </div>

      {/* 리포트 — 왜 뽑혔는지 (따뜻한 코랄·골드 톤) */}
      <div
        className="rounded-2xl px-3.5 py-2.5"
        style={{
          background: "linear-gradient(135deg, #fff4ef 0%, #f7ead0 100%)",
        }}
      >
        <p className="text-[11px] font-bold mb-1.5" style={{ color: "#e8662f" }}>
          골라낸 이유
        </p>
        <dl className="flex flex-col gap-1">
          {reasonRows.map((r) => (
            <div key={r.label} className="flex gap-2 text-[13px] leading-snug">
              <dt
                className="w-12 flex-shrink-0 font-semibold"
                style={{ color: "#9a8f82" }}
              >
                {r.label}
              </dt>
              <dd className="flex-1" style={{ color: "#3a322c" }}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 통근 도식 */}
      <CommuteDiagram
        legs={candidate.commuteLegs}
        complex={{
          name: candidate.complexName,
          lat: candidate.latitude,
          lng: candidate.longitude,
        }}
      />

      {/* 항목별 점수 5종(통근·예산·학군·연식·대단지)은 종합점수와 중복이고
          buildingAge가 항상 60 고정(price-first 중립화)이라 노이즈만 줘서 제거(2026-05-27 β). */}

      {/* 동네 (반경 1km) — 시설 사실 + 5축 레이더. fetch 후 fade-in, 데이터 없으면 숨김. */}
      {neighborhood && (
        <div className="fade-in-up">
          <NeighborhoodInline data={neighborhood} />
        </div>
      )}

      {/* 네이버 부동산 매물 링크 CTA */}
      <a
        href={naverSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.08] bg-[#f3ece4] px-5 py-3 text-sm font-semibold transition-colors hover:bg-white hover:border-coral-300 hover:text-coral-700 focus:outline-none focus:ring-2 focus:ring-coral-500"
        style={{ color: "#3a322c" }}
      >
        네이버 부동산에서 매물 보기
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 flex-shrink-0 opacity-60"
        >
          <path
            fillRule="evenodd"
            d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
            clipRule="evenodd"
          />
          <path
            fillRule="evenodd"
            d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
            clipRule="evenodd"
          />
        </svg>
      </a>

      {/* 매물 0건 폴백 — 단지에 매물이 없을 때 동네 전체로 넓혀 보기. */}
      <a
        href={naverAreaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="-mt-1.5 block text-center text-xs font-medium underline decoration-dotted underline-offset-2 transition-colors hover:text-coral-700"
        style={{ color: "#9a8f82" }}
      >
        매물 없으면 → {candidate.dongName} 동네로 한번 봐보자~
      </a>

      {/* 이 집 기준으로 플랜 — 추천 → 플랜 크로스링크 */}
      <Link
        href={{
          pathname: "/plan",
          query: {
            price: candidate.medianPriceKrw,
            name: candidate.complexName,
            sgg: candidate.sigungu,
            dong: candidate.dongName,
            area: candidate.representativeArea,
          },
        }}
        className="mt-1 block text-center text-xs font-semibold underline underline-offset-2 transition-colors hover:text-coral-700"
        style={{ color: "#9a5a1e" }}
      >
        이 집 기준 D−몇 년? 잡아보자 →
      </Link>
    </Card>
  );
}
