import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import type { CommuteProvider } from "./types";
import { mockProvider } from "./mockProvider";
import { kakaoProvider } from "./kakaoProvider";
import { db } from "@/lib/db";

export type { CommuteProvider };

export function getCommuteProvider(): CommuteProvider {
  // 통근 시간 계산은 Kakao Mobility(길찾기) API 가 필요하다. 이는 지오코딩용
  // KAKAO_REST_KEY 와 다른, developers.kakaomobility.com 의 별도 키다.
  // 전용 키가 없으면 mock(거리·평균속도 기반 추정) provider 를 쓴다.
  const key = process.env.KAKAO_MOBILITY_KEY;
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
