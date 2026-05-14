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

    // ※ 주의: 아래는 실제 대중교통 API 호출이 아닌 근사값입니다.
    // Kakao Mobility 는 자차 길찾기(Directions) API 만 제공하며,
    // 대중교통 소요 시간 API 는 별도 계약이 필요해 현재 미연동 상태입니다.
    // 대중교통 시간을 "자차 소요 시간 × 1.3" 으로 추정하는 것은 단순 근사일 뿐이며,
    // 실제 환승 대기·배차 간격·도보 구간을 반영하지 않습니다.
    // KAKAO_MOBILITY_KEY 미설정 시에는 mockProvider 가 대신 쓰이므로 운영 환경에서
    // 대중교통 값이 노출될 경우 이 추정 방식을 사용자에게 반드시 고지해야 합니다.
    return Math.round(carMinutes * 1.3);
  },
};
