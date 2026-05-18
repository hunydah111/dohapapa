import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import { haversineKm } from "@/lib/geo";
import type { CommuteProvider } from "./types";

export const mockProvider: CommuteProvider = {
  name: "mock",

  async travelMinutes(origin: LatLng, dest: LatLng, _mode: CommuteMode): Promise<number> {
    const distKm = haversineKm(origin, dest);
    // 28 km/h reflects Seoul peak-hour congestion on a straight-line basis; +5 min overhead.
    const minutes = Math.round((distKm / 28) * 60) + 5;
    return Math.max(5, minutes);
  },
};
