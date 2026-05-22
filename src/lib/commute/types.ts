import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";

export interface CommuteResult {
  /** 편도 통근 시간 (분). */
  minutes: number;
  /** 실제 도로 기준 운전 거리(km). 실 길찾기(kakao car)만 채운다. mock·대중교통은 없음. */
  roadDistanceKm?: number;
}

export interface CommuteProvider {
  readonly name: string;
  travelMinutes(
    origin: LatLng,
    dest: LatLng,
    mode: CommuteMode,
  ): Promise<CommuteResult>;
}
