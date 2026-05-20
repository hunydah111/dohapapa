import { haversineKm } from "@/lib/geo";
import type { LatLng, LocationVibe } from "@/types/profile";

// 상권 중심 좌표
const HONGDAE: LatLng = { lat: 37.5572, lng: 126.9245 };
const SEONGSU: LatLng = { lat: 37.5447, lng: 127.0557 };
const GANGNAM: LatLng = { lat: 37.4979, lng: 127.0276 };

// 한강변 앵커 — 강을 따라 분포한 지점들. 가장 가까운 곳까지 거리로 근접 판정.
const RIVERSIDE: LatLng[] = [
  { lat: 37.5556, lng: 126.901 }, // 망원
  { lat: 37.5271, lng: 126.9325 }, // 여의나루
  { lat: 37.5404, lng: 127.0177 }, // 옥수
  { lat: 37.5273, lng: 127.0286 }, // 압구정
  { lat: 37.5447, lng: 127.0557 }, // 성수
  { lat: 37.5474, lng: 127.0473 }, // 뚝섬
  { lat: 37.5133, lng: 127.1001 }, // 잠실
];

// 번화가 허브 — '새소리·나뭇잎소리'(조용함)는 이들과 멀수록 가점.
const BUSY_HUBS: LatLng[] = [
  HONGDAE,
  GANGNAM,
  SEONGSU,
  { lat: 37.5403, lng: 127.0703 }, // 건대입구
  { lat: 37.5551, lng: 126.9368 }, // 신촌
  { lat: 37.5703, lng: 126.9829 }, // 종각
  { lat: 37.5133, lng: 127.1001 }, // 잠실
];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const minDist = (p: LatLng, anchors: LatLng[]) =>
  Math.min(...anchors.map((a) => haversineKm(p, a)));

/** 입지 분위기에 단지가 얼마나 맞는지 0~1. */
export function scoreLocationVibe(vibe: LocationVibe, coord: LatLng): number {
  switch (vibe) {
    case "riverside":
      return clamp01(1 - minDist(coord, RIVERSIDE) / 1.5);
    case "quiet":
      return clamp01((minDist(coord, BUSY_HUBS) - 1.5) / 3);
  }
}

// 강도별 가점(조금/꽤/많이) — '많이'일수록 가점이 커진다.
export const VIBE_LEVEL_BONUS: Record<number, number> = { 1: 3, 2: 6, 3: 11 };
// 여러 입지를 골랐을 때 합산 가점 상한.
export const VIBE_BONUS_CAP = 16;

const VIBE_EMOJI: Record<LocationVibe, string> = {
  riverside: "🌊",
  quiet: "🍃",
};

// 배지·문구용 짧은 이름
const VIBE_SHORT: Record<LocationVibe, string> = {
  riverside: "한강",
  quiet: "한적",
};

/** 단지에서 해당 입지 기준점까지 거리(km). 최단 앵커 기준. */
export function vibeDistanceKm(vibe: LocationVibe, coord: LatLng): number {
  switch (vibe) {
    case "riverside":
      return minDist(coord, RIVERSIDE);
    case "quiet":
      return minDist(coord, BUSY_HUBS);
  }
}

/** 매칭 단지 배지 — 이모지+짧은이름+거리 (예: "🎨 홍대 1.2km"). */
export function vibeBadgeLabel(vibe: LocationVibe, coord: LatLng): string {
  return `${VIBE_EMOJI[vibe]} ${VIBE_SHORT[vibe]} ${vibeDistanceKm(vibe, coord).toFixed(1)}km`;
}
