import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import type { CommuteProvider, CommuteResult } from "./types";

interface KakaoDirectionsResponse {
  routes: Array<{
    summary: {
      duration: number; // seconds
      distance: number; // meters (도로 기준 운전 거리)
    };
  }>;
}

async function fetchCarRoute(
  key: string,
  origin: LatLng,
  dest: LatLng,
): Promise<CommuteResult> {
  const url =
    `https://apis-navi.kakaomobility.com/v1/directions` +
    `?origin=${origin.lng},${origin.lat}` +
    `&destination=${dest.lng},${dest.lat}`;

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Kakao Directions API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as KakaoDirectionsResponse;
  const summary = data.routes[0]?.summary;
  const durationSec = summary?.duration;

  if (typeof durationSec !== "number") {
    throw new Error("Kakao Directions API returned an unexpected response shape");
  }

  // distance 는 같은 응답에 함께 오므로 추가 호출 비용 없이 운전 거리를 얻는다.
  const distanceM = summary?.distance;
  const roadDistanceKm =
    typeof distanceM === "number"
      ? Math.round((distanceM / 1000) * 10) / 10
      : undefined;

  return { minutes: Math.round(durationSec / 60), roadDistanceKm };
}

export const kakaoProvider: CommuteProvider = {
  name: "kakao",

  async travelMinutes(
    origin: LatLng,
    dest: LatLng,
    _mode: CommuteMode,
  ): Promise<CommuteResult> {
    const key = process.env.KAKAO_REST_KEY;
    if (!key) {
      throw new Error("KAKAO_REST_KEY not configured");
    }
    return fetchCarRoute(key, origin, dest);
  },
};
