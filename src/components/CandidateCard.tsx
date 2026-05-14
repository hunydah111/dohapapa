import type {
  ComplexCandidate,
  CandidateSignalKey,
  CandidateTier,
} from "@/types/recommendation";
import { CANDIDATE_SIGNAL_LABELS } from "@/types/recommendation";
import { Card } from "@/components/ui/Card";
import { CommuteDiagram } from "./CommuteDiagram";

function formatEok(krw: number): string {
  const val = krw / 100_000_000;
  return `${val.toFixed(1)}억`;
}

const SIGNAL_ORDER: CandidateSignalKey[] = [
  "commute",
  "budgetFit",
  "school",
  "buildingAge",
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
    bg: "bg-indigo-50",
    text: "text-indigo-800",
    ring: "ring-1 ring-indigo-200",
    bar: "bg-indigo-400",
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
}: {
  candidate: ComplexCandidate;
  rank: number;
}) {
  const tier = TIER_CONFIG[candidate.tier];

  return (
    <Card className="flex flex-col gap-5">
      {/* 상단 행: 티어 배지 + 순위 + 종합점수 */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide ${tier.bg} ${tier.text} ${tier.ring}`}
        >
          {candidate.tier}
        </span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "#6e6e73" }}
        >
          {RANK_LABELS[rank] ?? `${rank}위`}
        </span>
        <span
          className="ml-auto rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold tabular-nums"
          style={{ color: "#6e6e73" }}
        >
          종합 {candidate.totalScore}점
        </span>
      </div>

      {/* 단지명 + 위치 + 시세 */}
      <div>
        <h3
          className="text-2xl font-extrabold leading-tight tracking-tight"
          style={{ color: "#1d1d1f" }}
        >
          {candidate.complexName}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm" style={{ color: "#6e6e73" }}>
            {candidate.sigungu}
          </span>
          <span style={{ color: "#c7c7cc" }}>·</span>
          <span className="text-sm" style={{ color: "#6e6e73" }}>
            {candidate.dongName}
          </span>
          <span style={{ color: "#c7c7cc" }}>·</span>
          <span className="text-sm" style={{ color: "#6e6e73" }}>
            전용 {candidate.representativeArea}㎡
          </span>
          <span style={{ color: "#c7c7cc" }}>·</span>
          <span className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>
            중위 {formatEok(candidate.medianPriceKrw)}
          </span>
        </div>
      </div>

      {/* 리포트 — 왜 뽑혔는지 */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{
          background: "linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)",
        }}
      >
        <p className="text-xs font-semibold mb-1.5" style={{ color: "#4338ca" }}>
          선택 이유
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "#1d1d1f" }}>
          {candidate.report}
        </p>
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

      {/* 신호 바 — 보조 근거 */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold" style={{ color: "#86868b" }}>
          항목별 점수
        </p>
        {SIGNAL_ORDER.map((key) => {
          const score = candidate.scores[key];
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "#6e6e73" }}>
                  {CANDIDATE_SIGNAL_LABELS[key]}
                </span>
                <span
                  className="text-xs tabular-nums font-semibold"
                  style={{ color: "#1d1d1f" }}
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
    </Card>
  );
}
