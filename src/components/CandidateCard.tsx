import type {
  ComplexCandidate,
  CandidateSignalKey,
  CandidateTier,
} from "@/types/recommendation";
import { CANDIDATE_SIGNAL_LABELS } from "@/types/recommendation";
import { CommuteBadges } from "./CommuteBadges";

function formatEok(krw: number): string {
  const eok = krw / 1_0000_0000;
  return `${eok.toFixed(1)}억`;
}

const SIGNAL_ORDER: CandidateSignalKey[] = [
  "commute",
  "budgetFit",
  "school",
  "buildingAge",
];

const TIER_STYLE: Record<CandidateTier, string> = {
  안정형:
    "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300",
  균형형:
    "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300",
  도전형:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
};

export function CandidateCard({
  candidate,
  rank,
}: {
  candidate: ComplexCandidate;
  rank: number;
}) {
  return (
    <article className="rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-5">
      {/* 상단: 티어 배지 + 순위 */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TIER_STYLE[candidate.tier]}`}
        >
          {candidate.tier}
        </span>
        <span className="text-sm font-medium text-zinc-400">#{rank}</span>
      </div>

      {/* 단지명 + 위치 */}
      <div>
        <h3 className="text-xl font-bold text-zinc-900 leading-tight">
          {candidate.complexName}
        </h3>
        <p className="mt-0.5 text-sm text-zinc-500">
          {candidate.sigungu} · {candidate.dongName}
        </p>
      </div>

      {/* 평형 + 중위 실거래가 */}
      <div className="flex items-baseline gap-3">
        <span className="text-sm text-zinc-500">
          {candidate.representativeArea}㎡
        </span>
        <span className="text-lg font-semibold text-zinc-900">
          {formatEok(candidate.medianPriceKrw)}
        </span>
        <span className="text-xs text-zinc-400">중위 실거래가</span>
      </div>

      {/* 통근 배지 */}
      <CommuteBadges legs={candidate.commuteLegs} />

      {/* 한 줄 요약 */}
      <p className="text-base font-medium text-zinc-800 leading-snug">
        {candidate.oneLineReason}
      </p>

      {/* 신호 바 4개 */}
      <div className="flex flex-col gap-4">
        {SIGNAL_ORDER.map((key) => {
          const score = candidate.scores[key];
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-600">
                  {CANDIDATE_SIGNAL_LABELS[key]}
                </span>
                <span className="text-xs tabular-nums text-zinc-500">
                  {score}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400 leading-snug">
                {candidate.reasoning[key]}
              </p>
            </div>
          );
        })}
      </div>

      {/* 종합 점수 */}
      <div className="flex justify-end">
        <span className="text-sm font-semibold text-zinc-600">
          종합 {candidate.totalScore}점
        </span>
      </div>
    </article>
  );
}
