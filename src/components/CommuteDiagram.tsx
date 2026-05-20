import type { CommuteLeg } from "@/types/recommendation";

interface ComplexInfo {
  name: string;
  lat: number;
  lng: number;
}

/**
 * 카카오맵 길찾기 deep-link (출발지·도착지 좌표 지정).
 *
 * WHY 비공식 URL: 카카오 공식 웹 URL scheme(/link/to/)은 도착지만 지원해
 * "직장→단지" 경로를 보여줄 수 없다. sX/sY/eX/eY 쿼리 파라미터 방식은
 * 비공식이라 예고 없이 깨질 수 있으나, 출발지+도착지를 모두 넘기는 유일한
 * 웹 호환 방법이라 채택했다. 깨질 경우 이 함수 한 곳만 고치면 된다.
 * 좌표는 WGS84 경위도 — X=경도, Y=위도.
 */
function kakaoDirectionsUrl(
  origin: { name: string; lat: number; lng: number },
  dest: { name: string; lat: number; lng: number },
): string {
  const params = new URLSearchParams({
    sX: String(origin.lng),
    sY: String(origin.lat),
    sName: origin.name,
    eX: String(dest.lng),
    eY: String(dest.lat),
    eName: dest.name,
  });
  return `https://map.kakao.com/?${params.toString()}`;
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
      <p className="text-xs" style={{ color: "#9a8f82" }}>
        통근 조건 없음
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#f3ece4] px-4 py-4">
      <p
        className="text-xs font-semibold tracking-wide uppercase"
        style={{ color: "#6b6157" }}
      >
        통근 추정
      </p>

      <div className="flex flex-col gap-5">
        {legs.map((leg) => {
          const ok = leg.withinLimit;
          const accentColor = ok ? "#059669" : "#d97706";
          const bgColor = ok ? "bg-emerald-50" : "bg-amber-50";
          const dotEnd = ok ? "bg-emerald-500" : "bg-amber-500";
          const lineColor = ok ? "bg-emerald-300" : "bg-amber-300";
          const fallbackLabel =
            leg.workplace === "A" ? "본인 직장" : "배우자 직장";
          const workplaceName = leg.workplaceLabel || fallbackLabel;
          const modeLabel = "자차";

          const directionsUrl = complex
            ? kakaoDirectionsUrl(
                {
                  name: workplaceName,
                  lat: leg.workplaceLat,
                  lng: leg.workplaceLng,
                },
                { name: complex.name, lat: complex.lat, lng: complex.lng },
              )
            : null;

          return (
            <div
              key={leg.workplace}
              className={`rounded-xl ${bgColor} px-3 py-3 flex flex-col gap-2`}
            >
              {/* 도식: 직장 ●──거리──● 단지 */}
              <div className="flex items-center gap-2">
                {/* 직장 노드 */}
                <div
                  className="flex flex-col items-center gap-1"
                  style={{ width: 60 }}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#6b6157] flex-shrink-0" />
                  <span
                    className="text-center text-[10px] font-medium leading-tight line-clamp-2"
                    style={{ color: "#6b6157" }}
                  >
                    {workplaceName}
                  </span>
                </div>

                {/* 연결선 + 거리 */}
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`h-0.5 w-full rounded-full ${lineColor}`}
                  />
                  <span
                    className="text-[10px]"
                    style={{ color: "#9a8f82" }}
                  >
                    직선 {leg.distanceKm.toFixed(1)}km
                  </span>
                </div>

                {/* 단지 노드 */}
                <div
                  className="flex flex-col items-center gap-1"
                  style={{ width: 40 }}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${dotEnd}`}
                  />
                  <span
                    className="text-center text-[10px] font-medium"
                    style={{ color: "#6b6157" }}
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
                <span className="text-[11px]" style={{ color: "#9a8f82" }}>
                  {modeLabel} · 카카오 길찾기 기준{!ok && " · 허용 시간 초과"}
                </span>
              </div>

              {/* 카카오맵 길찾기 — 직장→단지 실제 소요시간 확인 */}
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-lg bg-white/70 py-1.5 text-[11px] font-semibold text-coral-600 transition-colors hover:bg-white hover:text-coral-800"
                >
                  카카오맵에서 실제 길찾기
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3 w-3 flex-shrink-0 opacity-70"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              )}
            </div>
          );
        })}
      </div>

      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "#9a8f82" }}
      >
        통근 시간은 카카오 길찾기(자차) 표준 트래픽 기준 추정이에요. 실제
        시간은 시간대·교통 상황에 따라 달라지니 정확한 값은 본인 직장의
        카카오맵 길찾기로 확인하세요.
      </p>
    </div>
  );
}
