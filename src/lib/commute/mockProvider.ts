import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import { haversineKm } from "@/lib/geo";
import type { CommuteProvider, CommuteResult } from "./types";

export const mockProvider: CommuteProvider = {
  name: "mock",

  async travelMinutes(
    origin: LatLng,
    dest: LatLng,
    mode: CommuteMode,
  ): Promise<CommuteResult> {
    const distKm = haversineKm(origin, dest);
    // 직선거리 기반 추정. calcCutoffKm 의 가정과 동일하게 맞춘다:
    //  - car: 28 km/h(서울 첨두 혼잡) + 5분 오버헤드
    //  - transit: 22 km/h(환승·정차로 더 느림) + 12분(도보·대기) 오버헤드
    const speedKmh = mode === "transit" ? 22 : 28;
    const overhead = mode === "transit" ? 12 : 5;
    const minutes = Math.round((distKm / speedKmh) * 60) + overhead;
    // mock 은 도로거리를 모른다 — roadDistanceKm 생략(UI 는 직선거리로 폴백).
    return { minutes: Math.max(5, minutes) };
  },
};
