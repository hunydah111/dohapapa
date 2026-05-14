import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import { haversineKm } from "@/lib/geo";
import type { CommuteProvider } from "./types";

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
