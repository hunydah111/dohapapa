import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";

export interface CommuteProvider {
  readonly name: string;
  travelMinutes(origin: LatLng, dest: LatLng, mode: CommuteMode): Promise<number>;
}
