import type { LatLng } from "@/types/profile";
import type { CommuteMode } from "@/types/recommendation";
import type { CommuteProvider, CommuteResult } from "./types";
import { mockProvider } from "./mockProvider";
import { kakaoProvider } from "./kakaoProvider";
import { db } from "@/lib/db";

export type { CommuteProvider, CommuteResult };
export { mockProvider };

// 간이 서킷브레이커 — 캐시 DB 가 한 번 실패하면 짧은 동안 조회를 통째로 건너뛴다.
// 쿼터 소진·다운 시 한 요청에서 단지 수십 곳을 매번 실패 조회하면 십수 초가 새기 때문.
// 회복되면 TTL 경과 후 한 번 재시도해 자동으로 닫힌다(정상 운영 땐 절대 안 열림).
let cacheDownUntil = 0;
const CACHE_DOWN_TTL_MS = 30_000;

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
): Promise<CommuteResult> {
  // 대중교통(ODsay)은 URI(웹) 키라 브라우저에서만 호출 가능 — 서버에선 못 부른다.
  // 따라서 서버 랭킹용 대중교통 시간은 mock(직선거리)로 잡고, 실측은 결과 화면에서
  // 클라이언트가 ODsay 로 채운다. mock 값은 캐시하지 않는다(실측이 아니므로).
  const effectiveProvider = mode === "transit" ? mockProvider : provider;

  // mock provider 는 순수 계산(haversine)이라 DB 캐시가 오히려 오버헤드다.
  // 캐시는 비싼 외부 호출(Kakao 길찾기)에만 의미가 있으므로 mock 은 바로 계산.
  // (단지 1만 개 추천 시 캐시 upsert 폭주로 SQLite 가 socket timeout 나던 문제.)
  if (effectiveProvider.name === "mock") {
    return effectiveProvider.travelMinutes(origin, complexCoord, mode);
  }

  // 서킷 오픈(최근 캐시 DB 실패) — 조회·Kakao 모두 건너뛰고 mock 으로 즉시 degrade.
  if (Date.now() < cacheDownUntil) {
    return mockProvider.travelMinutes(origin, complexCoord, mode);
  }

  const originKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;

  // 캐시 조회. DB 다운·쿼터 소진 시엔 "미스"가 아니라 "캐시 불가"로 구분한다.
  let cached: Awaited<ReturnType<typeof db.commuteCache.findUnique>> = null;
  let cacheAvailable = true;
  try {
    cached = await db.commuteCache.findUnique({
      where: {
        originKey_complexId_mode: { originKey, complexId, mode },
      },
    });
  } catch {
    cacheAvailable = false;
    cacheDownUntil = Date.now() + CACHE_DOWN_TTL_MS; // 서킷 오픈
  }

  // 캐시 자체가 불가(DB 다운)면 실 길찾기(Kakao)를 호출하지 않는다 — 캐시 없이 매 요청
  // 단지 수십 곳을 라이브 호출하면 응답이 수십 초로 늘고(서버리스 타임아웃) Kakao 쿼터도
  // 태운다. 이 요청 한정으로 mock(직선거리 추정)으로 degrade — 빠르고 무료, 결과는 계속 나온다.
  if (!cacheAvailable) {
    return mockProvider.travelMinutes(origin, complexCoord, mode);
  }

  if (cached !== null) {
    // 운전 거리는 캐시에 같이 저장(distanceMeters) — 없으면(구 캐시 레코드) 생략.
    return {
      minutes: cached.minutes,
      roadDistanceKm:
        cached.distanceMeters != null
          ? Math.round((cached.distanceMeters / 1000) * 10) / 10
          : undefined,
    };
  }

  let result: CommuteResult;
  try {
    result = await provider.travelMinutes(origin, complexCoord, mode);
  } catch {
    // 실 길찾기 실패(쿼터 소진·네트워크·rate limit) — 거리 기반 추정으로 폴백한다.
    // 일시적 실패가 캐시에 영구히 박히지 않도록 폴백값은 캐시하지 않는다.
    return mockProvider.travelMinutes(origin, complexCoord, mode);
  }

  const distanceMeters =
    result.roadDistanceKm != null ? Math.round(result.roadDistanceKm * 1000) : null;

  // 캐시 저장 실패(DB 다운·쿼터 소진)는 무시 — 캐시는 비용 절감용 부가기능이라 응답을 깨지 않는다.
  try {
    await db.commuteCache.upsert({
      where: {
        originKey_complexId_mode: { originKey, complexId, mode },
      },
      update: { minutes: result.minutes, distanceMeters },
      create: { originKey, complexId, mode, minutes: result.minutes, distanceMeters },
    });
  } catch {
    cacheDownUntil = Date.now() + CACHE_DOWN_TTL_MS; // 쓰기도 실패하면 서킷 오픈
  }

  return result;
}
