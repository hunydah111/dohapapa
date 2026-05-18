import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import type { CommuteProvider } from "./types";

interface KakaoDirectionsResponse {
  routes: Array<{
    summary: {
      duration: number; // seconds
    };
  }>;
}

async function fetchCarMinutes(key: string, origin: LatLng, dest: LatLng): Promise<number> {
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
  const durationSec = data.routes[0]?.summary?.duration;

  if (typeof durationSec !== "number") {
    throw new Error("Kakao Directions API returned an unexpected response shape");
  }

  return Math.round(durationSec / 60);
}

export const kakaoProvider: CommuteProvider = {
  name: "kakao",

  async travelMinutes(origin: LatLng, dest: LatLng, _mode: CommuteMode): Promise<number> {
    const key = process.env.KAKAO_REST_KEY;
    if (!key) {
      throw new Error("KAKAO_REST_KEY not configured");
    }
    return fetchCarMinutes(key, origin, dest);
  },
};
