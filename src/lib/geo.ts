// 지리 계산 공통 유틸 — recommend 엔진과 commute mockProvider 가 각자 중복
// 구현하던 haversine 을 하나로 통일한다.

import type { LatLng } from "@/types/profile";

/** 두 좌표 사이 대권 직선거리 (km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
