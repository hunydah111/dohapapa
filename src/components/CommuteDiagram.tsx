import type { CommuteLeg, CommuteMode } from "@/types/recommendation";

interface ComplexInfo {
  name: string;
  lat: number;
  lng: number;
}

/**
 * 카카오맵 길찾기 deep-link (출발지·도착지 좌표 지정).
 *
 * 공식 스킴은 모바일웹 route 스킴 하나뿐:
 *   `m.map.kakao.com/scheme/route?sp={위도},{경도}&ep={위도},{경도}&by={수단}`
 * (이름은 안 받고 좌표만. by 는 car/publictransit/foot/bicycle.)
 * 이전 `/link/from/.../to/...` 는 실존하지 않는 스킴이라 카카오가 무시하고
 * 기본 지도만 떠서 출발지·도착지가 안 찍혔다. `map.kakao.com/?sX=...` 비공식
 * 쿼리도 좌표계 오해석으로 출발지가 엉뚱하게 찍혀 폐기.
 * 좌표 순서 주의: 위도(lat),경도(lng) 순.
 */
function kakaoDirectionsUrl(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  mode: CommuteMode,
): string {
  const by = mode === "transit" ? "publictransit" : "car";
  return `https://m.map.kakao.com/scheme/route?sp=${origin.lat},${origin.lng}&ep=${dest.lat},${dest.lng}&by=${by}`;
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

  const hasCar = legs.some((l) => l.mode === "car");
  const hasTransit = legs.some((l) => l.mode === "transit");
  // 대중교통 실측을 못 받아 직선거리로 추정한 leg 가 있는지 (푸터 안내용)
  const anyTransitFallback = legs.some(
    (l) => l.mode === "transit" && l.realTransit === false,
  );
  const footerBasis =
    hasCar && hasTransit
      ? "통근 시간은 자동차는 카카오 길찾기, 대중교통은 ODsay 길찾기(표준 소요) 추정이에요."
      : hasTransit
        ? "대중교통 통근 시간은 ODsay 길찾기(표준 소요) 추정이에요."
        : "통근 시간은 카카오 길찾기 표준 트래픽 기준 추정이에요.";

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#f3ece4] px-4 py-3">
      <p
        className="text-xs font-semibold tracking-wide uppercase"
        style={{ color: "#6b6157" }}
      >
        통근 추정
      </p>

      <div className="flex flex-col gap-3">
        {legs.map((leg) => {
          const isTransit = leg.mode === "transit";
          // 대중교통 실측 대기 중(ODsay 호출 전)이면 mock 분·색을 보이지 않는다 — 숫자 점프 방지.
          const pending = isTransit && leg.realTransit === undefined;
          const ok = leg.withinLimit;
          const accentColor = pending ? "#9a8f82" : ok ? "#059669" : "#d97706";
          const bgColor = pending ? "bg-[#efe8df]" : ok ? "bg-emerald-50" : "bg-amber-50";
          const dotEnd = pending ? "bg-[#c9bfb2]" : ok ? "bg-emerald-500" : "bg-amber-500";
          const lineColor = pending ? "bg-[#d8cfc2]" : ok ? "bg-emerald-300" : "bg-amber-300";
          const fallbackLabel =
            leg.workplace === "A" ? "본인 직장" : "배우자 직장";
          const workplaceName = leg.workplaceLabel || fallbackLabel;
          const modeLabel = isTransit ? "대중교통" : "자차";
          const sourceText = isTransit
            ? leg.realTransit
              ? "ODsay 대중교통 기준"
              : "대중교통 추정(직선거리)"
            : "카카오 길찾기 기준";
          // 색상에만 의존하지 않도록 허용여부를 텍스트로도 표기 (접근성).
          const limitText = ok ? " · 허용 범위 내" : " · 허용 시간 초과";

          const directionsUrl = complex
            ? kakaoDirectionsUrl(
                { lat: leg.workplaceLat, lng: leg.workplaceLng },
                { lat: complex.lat, lng: complex.lng },
                leg.mode,
              )
            : null;

          return (
            <div
              key={leg.workplace}
              className={`rounded-xl ${bgColor} px-3 py-2.5 flex flex-col gap-1.5`}
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

                {/* 연결선 + 거리 — 자차 실측이면 운전거리, 아니면 직선거리 */}
                <div className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`h-0.5 w-full rounded-full ${lineColor}`}
                  />
                  <span
                    className="text-[10px]"
                    style={{ color: "#9a8f82" }}
                  >
                    {leg.roadDistanceKm != null
                      ? `운전 ${leg.roadDistanceKm.toFixed(1)}km`
                      : `직선 ${leg.distanceKm.toFixed(1)}km`}
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
              <div
                className="flex items-center justify-center gap-2"
                aria-live="polite"
              >
                {/* 통근 수단 — 자차/대중교통 */}
                <span aria-hidden="true" className="shrink-0 text-xl">
                  {isTransit ? "🚌" : "🚗"}
                </span>
                {pending ? (
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: "#9a8f82" }}
                  >
                    대중교통 계산 중…
                  </span>
                ) : (
                  <>
                    <span
                      className="text-base font-bold tabular-nums"
                      style={{ color: accentColor }}
                    >
                      {leg.minutes}분
                    </span>
                    <span className="text-[11px]" style={{ color: "#9a8f82" }}>
                      {modeLabel} · {sourceText}
                      {limitText}
                    </span>
                  </>
                )}
              </div>

              {/* 카카오맵 길찾기 — 직장→단지 실제 소요시간 확인 */}
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-lg bg-white/70 py-1.5 text-[11px] font-semibold text-coral-600 transition-colors hover:bg-white hover:text-coral-800"
                >
                  {isTransit
                    ? "카카오맵에서 길찾기 (대중교통 탭)"
                    : "카카오맵에서 실제 길찾기"}
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
        {footerBasis}
        {anyTransitFallback &&
          " '직선거리' 표시는 대중교통 실측 못 받아 거리로 추정한 값임."}{" "}
        실제 시간은 시간대·교통 상황·환승에 따라 달라질 수 있음.
      </p>
    </div>
  );
}
