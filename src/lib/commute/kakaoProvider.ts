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

  async travelMinutes(origin: LatLng, dest: LatLng, mode: CommuteMode): Promise<number> {
    const key = process.env.KAKAO_MOBILITY_KEY;
    if (!key) {
      throw new Error("KAKAO_MOBILITY_KEY not configured");
    }

    const carMinutes = await fetchCarMinutes(key, origin, dest);

    if (mode === "car") {
      return carMinutes;
    }

    // Kakao does not provide a public transit directions API equivalent to the car directions API.
    // Using car time × 1.3 as a documented approximation until a proper transit API is integrated.
    return Math.round(carMinutes * 1.3);
  },
};
