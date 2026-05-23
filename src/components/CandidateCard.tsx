import type {
  ComplexCandidate,
  CandidateSignalKey,
  CandidateTier,
} from "@/types/recommendation";
import { CANDIDATE_SIGNAL_LABELS } from "@/types/recommendation";
import type { NeighborhoodData } from "@/lib/neighborhood";
import { Card } from "@/components/ui/Card";
import { CommuteDiagram } from "./CommuteDiagram";
import { NeighborhoodInline } from "./NeighborhoodSection";
import { formatKrwHuman, formatEok } from "@/lib/format";

const SIGNAL_ORDER: CandidateSignalKey[] = [
  "commute",
  "budgetFit",
  "school",
  "buildingAge",
  "largeComplex",
];

const TIER_CONFIG: Record<
  CandidateTier,
  { bg: string; text: string; ring: string; bar: string }
> = {
  안정형: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    ring: "ring-1 ring-emerald-200",
    bar: "bg-emerald-400",
  },
  균형형: {
    bg: "bg-coral-50",
    text: "text-coral-800",
    ring: "ring-1 ring-coral-200",
    bar: "bg-coral-400",
  },
  도전형: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    ring: "ring-1 ring-amber-200",
    bar: "bg-amber-400",
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

  // 네이버 통합검색으로 보낸다 — 단지명+구+동으로 검색하면 상단에 해당 단지의
  // 부동산 단지 카드(매물 링크 포함)가 안정적으로 노출된다.
  // (m.land 직접 검색은 "단지명 동" 조합을 한 덩어리로 인식해 매칭 실패가 잦았음)
  const naverSearchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(
    `${candidate.complexName} ${candidate.sigungu} ${candidate.dongName}`
  )}`;

  // 단지 매물이 0건일 때 폴백 — 동네(동/구) 전체 매매 매물로 넓혀 검색.
  const naverAreaUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(
    `${candidate.sigungu} ${candidate.dongName} 아파트 매매`
  )}`;

  // 카카오맵 — 단지명+동으로 검색해 해당 단지 위치를 띄운다.
  // (link/map/이름,위도,경도 형식은 레거시 좌표 URL로 리다이렉트돼 기본 화면이 떠서 사용 안 함)
  const kakaoMapUrl = `https://map.kakao.com/?q=${encodeURIComponent(
    `${candidate.complexName} ${candidate.dongName}`,
  )}`;

  // 선택 이유 — 줄줄이 한 문장 대신 "라벨 : 값" 행으로 정돈. 정보 없는 신호는 숨김.
  // (연식은 price-first 철학상 중립화돼 선정 사유가 아니므로 헤더 'N년식'으로만 노출.)
  const reasonRows: { label: string; value: string }[] = [
    { label: "평수", value: `전용 ${candidate.representativeArea}㎡` },
  ];
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
    <Card className="flex flex-col gap-4">
      {/* 상단 행: 티어 배지 + 순위 + 초품아 + 종합점수 */}
      <div className="flex items-center gap-2.5 flex-wrap">
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
        {candidate.isChopumah && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
            초품아
          </span>
        )}
        {candidate.vibeBadge && (
          <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200">
            {candidate.vibeBadge}
          </span>
        )}
        {candidate.pricierThanPeers && (
          <span
            className="inline-flex items-center rounded-full bg-coral-50 px-3 py-1 text-xs font-bold text-coral-700 ring-1 ring-coral-200"
            title="같은 동·비슷한 연식 단지보다 ㎡당 단가가 높아요 — 시장이 더 높게 평가한 단지예요"
          >
            ✨ 동네에서 인정받는 단지
          </span>
        )}
        {candidate.overBudget && (
          <span
            className="inline-flex items-center rounded-full bg-coral-100 px-3 py-1 text-xs font-bold text-coral-800 ring-1 ring-coral-300"
            title="딱 맞는 단지가 적어 예산을 조금 넘는 가까운 후보까지 보여드려요"
          >
            예산 초과
          </span>
        )}
        {candidate.commuteLegs.some((l) => !l.withinLimit) && (
          <span
            className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-300"
            title="설정한 통근 시간을 조금 넘는 후보예요"
          >
            통근 초과
          </span>
        )}
        {candidate.priceEstimated ? (
          <span
            className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 ring-1 ring-orange-200"
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
            className="text-2xl font-extrabold leading-tight tracking-tight"
            style={{ color: "#3a322c" }}
          >
            {candidate.complexName}
            {candidate.buildYear !== null && (
              <span
                className="ml-2 text-base font-semibold tabular-nums"
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
            className="text-sm font-semibold"
            style={{ color: "#3a322c" }}
          >
            {showPriceRange
              ? `추정 ${formatEok(candidate.priceLowKrw!)}~${formatEok(candidate.priceHighKrw!)}`
              : `실거래 중위가 ${formatKrwHuman(candidate.medianPriceKrw)}`}
          </span>
          {/* 근거 배지 — 추정가가 무엇에 근거하는지 스캔 가능하게(거래건수·기간). */}
          <span
            className="inline-flex items-center rounded-full bg-[#f3ece4] px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: "#9a8f82" }}
            title="추정가 산정 근거 — 국토교통부 공개 실거래 기준"
          >
            {candidate.priceEstimated
              ? "📊 주변시세 환산"
              : candidate.priceFromPresale
                ? `📊 분양권 ${candidate.transactionCount}건`
                : `📊 실거래 ${candidate.transactionCount}건·${candidate.lowDataConfidence ? "최근1년" : "최근6개월"}`}
          </span>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "#9a8f82" }}>
          {candidate.priceEstimated
            ? `아직 실거래가 등재되기 전이라 ${candidate.estimateBasis ?? "주변 시세 연동"}으로 추정한 값이에요 (등기 진행 중 신축 등). 실제 등재 시 조망·층·향 따라 차이 날 수 있어요. `
            : candidate.priceFromPresale
              ? `분양권/입주권 실거래 ${candidate.transactionCount}건 기준이에요 (등기 전 권리 거래라 이후 소유권 매매가와 차이 날 수 있음). `
              : showPriceRange
              ? `최근 실거래 ${candidate.transactionCount}건이 층·향 따라 ${formatEok(candidate.priceLowKrw!)}~${formatEok(candidate.priceHighKrw!)}로 편차가 큰 단지예요 (신축 입주장 등). 중앙 추정 ${formatKrwHuman(candidate.medianPriceKrw)} — `
              : candidate.lowDataConfidence
                ? `최근 1년 실거래 ${candidate.transactionCount}건 (거래 적어 12개월로 추정 — 참고용) `
                : `최근 6개월 실거래 ${candidate.transactionCount}건의 중위값 `}
          (국토교통부 공개 데이터, 실제 거래가와 다를 수 있음)
        </p>
      </div>

      {/* 리포트 — 왜 뽑혔는지 */}
      <div
        className="rounded-2xl px-4 py-3"
        style={{
          background: "linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)",
        }}
      >
        <p
          className="text-xs font-semibold mb-2"
          style={{ color: "#f2603c" }}
        >
          선택 이유
        </p>
        <dl className="flex flex-col gap-2">
          {reasonRows.map((r) => (
            <div key={r.label} className="flex gap-2.5 text-sm leading-relaxed">
              <dt
                className="w-16 flex-shrink-0 font-semibold"
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

      {/* 신호 바 — 항목별 점수 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold" style={{ color: "#9a8f82" }}>
          항목별 점수
        </p>
        {SIGNAL_ORDER.map((key) => {
          const score = candidate.scores[key];
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{ color: "#6b6157" }}
                >
                  {CANDIDATE_SIGNAL_LABELS[key]}
                </span>
                <span
                  className="text-xs tabular-nums font-semibold"
                  style={{ color: "#3a322c" }}
                >
                  {score}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className={`h-full rounded-full ${tier.bar} transition-all duration-500`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

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
        매물이 안 보이면 → {candidate.dongName} 동네 매물 둘러보기
      </a>
    </Card>
  );
}
