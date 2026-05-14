import type { CommuteLeg } from "@/types/recommendation";

interface ComplexInfo {
  name: string;
  lat: number;
  lng: number;
}

export function CommuteDiagram({
  legs,
  complex,
}: {
  legs: CommuteLeg[];
  complex?: ComplexInfo;
}) {
  if (legs.length === 0) {
    return (
      <p className="text-xs text-[#86868b]">통근 조건 없음</p>
    );
  }

  const kakaoMapUrl = complex
    ? `https://map.kakao.com/link/map/${encodeURIComponent(complex.name)},${complex.lat},${complex.lng}`
    : null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#f5f5f7] px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-[#6e6e73] uppercase">통근 추정</p>
        {kakaoMapUrl && (
          <a
            href={kakaoMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors underline underline-offset-2"
          >
            카카오맵에서 보기
          </a>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {legs.map((leg) => {
          const ok = leg.withinLimit;
          const accentColor = ok ? "#059669" : "#d97706";
          const bgColor = ok ? "bg-emerald-50" : "bg-amber-50";
          const dotEnd = ok ? "bg-emerald-500" : "bg-amber-500";
          const lineColor = ok ? "bg-emerald-300" : "bg-amber-300";
          const fallbackLabel = leg.workplace === "A" ? "본인 직장" : "배우자 직장";
          const modeLabel = leg.mode === "transit" ? "대중교통" : "자차";

          return (
            <div key={leg.workplace} className={`rounded-xl ${bgColor} px-3 py-3 flex flex-col gap-2`}>
              {/* 도식: 직장 ●──거리──● 단지 */}
              <div className="flex items-center gap-2">
                {/* 직장 노드 */}
                <div className="flex flex-col items-center gap-1" style={{ width: 60 }}>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#6e6e73] flex-shrink-0" />
                  <span
                    className="text-center text-[10px] font-medium leading-tight line-clamp-2"
                    style={{ color: "#6e6e73" }}
                  >
                    {leg.workplaceLabel || fallbackLabel}
                  </span>
                </div>

                {/* 연결선 + 거리 */}
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span className={`h-0.5 w-full rounded-full ${lineColor}`} />
                  <span className="text-[10px]" style={{ color: "#86868b" }}>
                    직선 {leg.distanceKm.toFixed(1)}km
                  </span>
                </div>

                {/* 단지 노드 */}
                <div className="flex flex-col items-center gap-1" style={{ width: 40 }}>
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${dotEnd}`} />
                  <span
                    className="text-center text-[10px] font-medium"
                    style={{ color: "#6e6e73" }}
                  >
                    단지
                  </span>
                </div>
              </div>

              {/* 시간 + 수단 */}
              <div className="flex items-center justify-center gap-2">
                <span
                  className="text-base font-bold tabular-nums"
                  style={{ color: accentColor }}
                >
                  {leg.minutes}분
                </span>
                <span className="text-[11px]" style={{ color: "#86868b" }}>
                  {modeLabel} 추정{!ok && " · 허용 시간 초과"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "#86868b" }}>
        직선거리 · 평균 속도 기반 추정값입니다. 실제 경로 · 소요 시간은 다를 수 있습니다.
      </p>
    </div>
  );
}
