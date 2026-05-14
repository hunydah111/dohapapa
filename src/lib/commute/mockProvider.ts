import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import type { CommuteProvider } from "./types";

/** Haversine formula — returns great-circle distance in km. */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export const mockProvider: CommuteProvider = {
  name: "mock",

  async travelMinutes(origin: LatLng, dest: LatLng, mode: CommuteMode): Promise<number> {
    const distKm = haversineKm(origin, dest);

    let minutes: number;
    if (mode === "transit") {
      // 22 km/h effective speed accounts for station waits and transfers; +12 min walk/wait overhead.
      minutes = Math.round((distKm / 22) * 60) + 12;
    } else {
      // 28 km/h reflects Seoul peak-hour congestion on a straight-line basis; +5 min overhead.
      minutes = Math.round((distKm / 28) * 60) + 5;
    }

    return Math.max(5, minutes);
  },
};
