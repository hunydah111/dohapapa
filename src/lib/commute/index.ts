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
  const provider = getCommuteProvider();

  // mock provider 는 순수 계산(haversine)이라 DB 캐시가 오히려 오버헤드다.
  // 캐시는 비싼 외부 호출(Kakao Mobility)에만 의미가 있으므로 mock 은 바로 계산.
  // (단지 1만 개 추천 시 캐시 upsert 폭주로 SQLite 가 socket timeout 나던 문제.)
  if (provider.name === "mock") {
    return provider.travelMinutes(origin, complexCoord, mode);
  }

  const originKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;

  const cached = await db.commuteCache.findUnique({
    where: {
      originKey_complexId_mode: { originKey, complexId, mode },
    },
  });

  if (cached !== null) {
    return cached.minutes;
  }

  const minutes = await provider.travelMinutes(origin, complexCoord, mode);

  await db.commuteCache.upsert({
    where: {
      originKey_complexId_mode: { originKey, complexId, mode },
    },
    update: { minutes },
    create: { originKey, complexId, mode, minutes },
  });

  return minutes;
}
