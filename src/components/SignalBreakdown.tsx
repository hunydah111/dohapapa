import { ScoreResult, SignalKey, SIGNAL_WEIGHTS, SIGNAL_LABELS_KO } from "@/types/listing";

// Canonical display order matching the spec.
const SIGNAL_ORDER: SignalKey[] = [
  "price",
  "brokerConcentration",
  "stale",
  "refresh",
  "photoReuse",
  "info",
  "keywords",
  "brokerHistory",
];

function dotColor(points: number, weight: number): string {
  if (points === 0) return "bg-gray-300";
  // Points below the midpoint are a mild concern; at or above are serious.
  if (points < weight / 2) return "bg-amber-400";
  return "bg-rose-500";
}

export function SignalBreakdown({ score }: { score: ScoreResult }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">신호별 상세 분석</h2>
      </div>

      <ul className="divide-y divide-gray-100">
        {SIGNAL_ORDER.map((key) => {
          const weight = SIGNAL_WEIGHTS[key];
          const points = score.signals[key];
          const reason = score.reasoning[key];

          return (
            <li key={key} className="flex items-start gap-3 px-5 py-3.5">
              {/* Colored indicator dot */}
              <span
                className={`mt-1 shrink-0 w-2.5 h-2.5 rounded-full ${dotColor(points, weight)}`}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">
                    {SIGNAL_LABELS_KO[key]}
                  </span>
                  {/* Points display: actual / max */}
                  <span className="text-xs font-mono text-gray-500 shrink-0">
                    {points}
                    <span className="text-gray-300"> / </span>
                    {weight}점
                  </span>
                </div>

                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                  {reason.length > 0 ? reason : (
                    <span className="text-gray-300">이상 없음</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
