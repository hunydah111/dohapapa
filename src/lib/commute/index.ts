import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import type { CommuteProvider } from "./types";
import { mockProvider } from "./mockProvider";
import { kakaoProvider } from "./kakaoProvider";
import { db } from "@/lib/db";

export type { CommuteProvider };
export { mockProvider };

export function getCommuteProvider(): CommuteProvider {
  // 카카오 길찾기(Navi) API 는 지오코딩과 동일한 developers.kakao.com REST 키를 쓴다.
  // (별도 Mobility 키가 필요하다는 종전 가정은 오류였다 — REST 키로 실호출 200 확인.)
  // 키가 없으면 mock(거리·평균속도 기반 추정) provider 로 폴백한다.
  const key = process.env.KAKAO_REST_KEY;
  return key && key.length > 0 ? kakaoProvider : mockProvider;
}

export async function getCommuteMinutes(
  origin: LatLng,
  complexId: string,
  complexCoord: LatLng,
  mode: CommuteMode,
  provider: CommuteProvider = getCommuteProvider(),
): Promise<number> {
  // mock provider 는 순수 계산(haversine)이라 DB 캐시가 오히려 오버헤드다.
  // 캐시는 비싼 외부 호출(Kakao 길찾기)에만 의미가 있으므로 mock 은 바로 계산.
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

  let minutes: number;
  try {
    minutes = await provider.travelMinutes(origin, complexCoord, mode);
  } catch {
    // 실 길찾기 실패(쿼터 소진·네트워크·rate limit) — 거리 기반 추정으로 폴백한다.
    // 일시적 실패가 캐시에 영구히 박히지 않도록 폴백값은 캐시하지 않는다.
    return mockProvider.travelMinutes(origin, complexCoord, mode);
  }

  await db.commuteCache.upsert({
    where: {
      originKey_complexId_mode: { originKey, complexId, mode },
    },
    update: { minutes },
    create: { originKey, complexId, mode, minutes },
  });

  return minutes;
}
