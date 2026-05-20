import { haversineKm } from "@/lib/geo";
import type { LatLng, LocationVibe } from "@/types/profile";
import { LOCATION_VIBE_LABELS } from "@/types/profile";

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

// 번화가 허브 — '조용한 동네'는 이들과 멀수록 가점.
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

/** 선택한 입지 분위기에 단지가 얼마나 맞는지 0~1. none 이면 0. */
export function scoreLocationVibe(vibe: LocationVibe, coord: LatLng): number {
  switch (vibe) {
    case "hongdae":
      return clamp01(1 - haversineKm(coord, HONGDAE) / 4);
    case "seongsu":
      return clamp01(1 - haversineKm(coord, SEONGSU) / 4);
    case "gangnam":
      return clamp01(1 - haversineKm(coord, GANGNAM) / 4);
    case "riverside":
      return clamp01(1 - minDist(coord, RIVERSIDE) / 1.5);
    case "quiet":
      return clamp01((minDist(coord, BUSY_HUBS) - 1.5) / 3);
    case "none":
    default:
      return 0;
  }
}

const VIBE_EMOJI: Record<LocationVibe, string> = {
  none: "",
  riverside: "🌊",
  hongdae: "🎨",
  seongsu: "☕",
  gangnam: "🏙️",
  quiet: "🍃",
};

/** 매칭된 단지에 붙일 배지 라벨(이모지+이름). */
export function vibeBadgeLabel(vibe: LocationVibe): string {
  return `${VIBE_EMOJI[vibe]} ${LOCATION_VIBE_LABELS[vibe]}`.trim();
}
