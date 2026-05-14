import type {
  ComplexCandidate,
  CandidateSignalKey,
  CandidateTier,
} from "@/types/recommendation";
import { CANDIDATE_SIGNAL_LABELS } from "@/types/recommendation";
import { CommuteDiagram } from "./CommuteDiagram";

function formatEok(krw: number): string {
  return `${(krw / 1_0000_0000).toFixed(1)}억`;
}

const SIGNAL_ORDER: CandidateSignalKey[] = [
  "commute",
  "budgetFit",
  "school",
  "buildingAge",
];

const TIER_STYLE: Record<CandidateTier, string> = {
  안정형: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300",
  균형형: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300",
  도전형: "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
};

export function CandidateCard({
  candidate,
  rank,
}: {
  candidate: ComplexCandidate;
  rank: number;
}) {
  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* 상단: 티어 배지 + 순위 */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TIER_STYLE[candidate.tier]}`}
        >
          {candidate.tier}
        </span>
        <span className="text-sm font-medium text-gray-400">#{rank}</span>
        <span className="ml-auto text-sm font-semibold text-gray-500">
          종합 {candidate.totalScore}점
        </span>
      </div>

      {/* 단지명 + 위치 + 시세 */}
      <div>
        <h3 className="text-xl font-bold leading-tight text-gray-900">
          {candidate.complexName}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {candidate.sigungu} · {candidate.dongName} · 전용{" "}
          {candidate.representativeArea}㎡ ·{" "}
          <span className="font-semibold text-gray-700">
            중위 {formatEok(candidate.medianPriceKrw)}
          </span>
        </p>
      </div>

      {/* 리포트 — 왜 이 단지가 뽑혔는지 */}
      <div className="rounded-xl bg-indigo-50/60 px-4 py-3 ring-1 ring-indigo-100">
        <p className="text-sm leading-relaxed text-gray-700">
          {candidate.report}
        </p>
      </div>

      {/* 통근 도식 — 어떻게 그 시간이 나왔는지 */}
      <CommuteDiagram legs={candidate.commuteLegs} />

      {/* 신호 바 — 보조 근거 */}
      <div className="flex flex-col gap-3">
        {SIGNAL_ORDER.map((key) => {
          const score = candidate.scores[key];
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  {CANDIDATE_SIGNAL_LABELS[key]}
                </span>
                <span className="text-xs tabular-nums text-gray-400">
                  {score}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
