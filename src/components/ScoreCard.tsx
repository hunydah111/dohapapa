import { ScoreResult } from "@/types/listing";

const BAND_CONFIG = {
  green: {
    label: "정상 매물 가능성 높음",
    barColor: "bg-emerald-500",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200",
    bgColor: "bg-emerald-50",
  },
  yellow: {
    label: "주의 신호 일부 감지",
    barColor: "bg-amber-500",
    textColor: "text-amber-600",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
  },
  red: {
    label: "강한 미끼매물 의심",
    barColor: "bg-rose-500",
    textColor: "text-rose-600",
    borderColor: "border-rose-200",
    bgColor: "bg-rose-50",
  },
} as const;

export function ScoreCard({ score }: { score: ScoreResult }) {
  const config = BAND_CONFIG[score.band];

  return (
    <div
      className={`rounded-2xl border-2 ${config.borderColor} ${config.bgColor} p-6 shadow-sm`}
    >
      {/* Score number */}
      <div className="flex items-end gap-2 mb-2">
        <span className={`text-7xl font-extrabold leading-none ${config.textColor}`}>
          {score.total}
        </span>
        <span className="text-2xl font-semibold text-gray-400 mb-1">/ 100</span>
      </div>

      {/* Band label */}
      <p className={`text-lg font-semibold mb-4 ${config.textColor}`}>
        {config.label}
      </p>

      {/* Progress bar — fill width is clamped between 0 and 100 */}
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${config.barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, score.total))}%` }}
        />
      </div>

      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>0</span>
        <span>의심도</span>
        <span>100</span>
      </div>
    </div>
  );
}
