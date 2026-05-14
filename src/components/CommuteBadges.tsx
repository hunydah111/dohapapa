import type { CommuteLeg } from "@/types/recommendation";

export function CommuteBadges({ legs }: { legs: CommuteLeg[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {legs.map((leg) => {
        const label = leg.workplace === "A" ? "본인" : "배우자";
        const base =
          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium";
        const color = leg.withinLimit
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
        return (
          <span key={leg.workplace} className={`${base} ${color}`}>
            {label} {leg.minutes}분
          </span>
        );
      })}
    </div>
  );
}
