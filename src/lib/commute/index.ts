import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import type { CommuteProvider } from "./types";
import { mockProvider } from "./mockProvider";
import { kakaoProvider } from "./kakaoProvider";
import { db } from "@/lib/db";

export type { CommuteProvider };

export function getCommuteProvider(): CommuteProvider {
  const key = process.env.KAKAO_REST_KEY;
  return key && key.length > 0 ? kakaoProvider : mockProvider;
}

export async function getCommuteMinutes(
  origin: LatLng,
  complexId: string,
  complexCoord: LatLng,
  mode: CommuteMode,
): Promise<number> {
  const originKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;

  const cached = await db.commuteCache.findUnique({
    where: {
      originKey_complexId_mode: { originKey, complexId, mode },
    },
  });

  if (cached !== null) {
    return cached.minutes;
  }

  const minutes = await getCommuteProvider().travelMinutes(origin, complexCoord, mode);

  await db.commuteCache.upsert({
    where: {
      originKey_complexId_mode: { originKey, complexId, mode },
    },
    update: { minutes },
    create: { originKey, complexId, mode, minutes },
  });

  return minutes;
}
