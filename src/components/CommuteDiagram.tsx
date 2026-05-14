import type { CommuteLeg } from "@/types/recommendation";

/**
 * 통근 시간이 "어떻게 나왔는지" 보여주는 도식.
 * 직장 ●──직선거리──● 단지 + 추정 분 + 산출 근거.
 * (실제 턴바턴 경로가 아니라 직선거리·평균속도 기반 추정임을 명시.)
 */
export function CommuteDiagram({ legs }: { legs: CommuteLeg[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200">
      <p className="text-xs font-semibold text-gray-500">통근 추정</p>

      {legs.map((leg) => {
        const within = leg.withinLimit;
        const endDot = within ? "bg-emerald-500" : "bg-amber-500";
        const line = within ? "bg-emerald-400" : "bg-amber-400";
        const timeText = within ? "text-emerald-700" : "text-amber-700";
        const fallbackLabel = leg.workplace === "A" ? "본인 직장" : "배우자 직장";

        return (
          <div key={leg.workplace} className="flex flex-col gap-1.5">
            {/* 도식: 직장 ●──거리──● 단지 */}
            <div className="flex items-center gap-2">
              <div className="flex w-16 flex-col items-center">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                <span className="mt-1 line-clamp-1 text-center text-[11px] text-gray-500">
                  {leg.workplaceLabel || fallbackLabel}
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center">
                <span className={`h-0.5 w-full rounded-full ${line}`} />
                <span className="mt-1 text-[11px] text-gray-400">
                  직선 {leg.distanceKm}km
                </span>
              </div>
              <div className="flex w-16 flex-col items-center">
                <span className={`h-2.5 w-2.5 rounded-full ${endDot}`} />
                <span className="mt-1 text-[11px] text-gray-500">단지</span>
              </div>
            </div>

            {/* 추정 시간 */}
            <div className="flex items-center justify-center gap-1.5">
              <span className={`text-sm font-bold ${timeText}`}>
                {leg.minutes}분
              </span>
              <span className="text-[11px] text-gray-400">
                {leg.mode === "transit" ? "대중교통" : "자동차"} 추정
                {within ? "" : " · 허용시간 초과"}
              </span>
            </div>
          </div>
        );
      })}

      <p className="text-[11px] leading-snug text-gray-400">
        직선거리에 대중교통 평균 속도(약 22km/h)와 환승·도보 시간을 더한 추정값입니다.
        실제 경로·소요시간은 다를 수 있습니다.
      </p>
    </div>
  );
}
