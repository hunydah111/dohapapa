// ODsay 대중교통 길찾기 — 브라우저 전용 호출.
//
// WHY 브라우저: ODsay 서버키는 호출 IP 화이트리스트 방식이라 Vercel 동적 IP에선
// 못 쓴다. URI(웹) 키는 등록 도메인(Referer)으로 잠기므로 브라우저에서 호출해야
// 정상 인증된다. 따라서 이 함수는 클라이언트 컴포넌트에서만 호출한다.
//
// 키는 NEXT_PUBLIC_ODSAY_KEY (URI 키). 도메인 잠금이라 노출돼도 안전.

import type { LatLng } from "@/types/profile";

interface OdsayResponse {
  error?: unknown;
  result?: {
    path?: Array<{ info?: { totalTime?: number } }>;
  };
}

/**
 * 출발지→도착지 대중교통 편도 소요시간(분). 실패 시 null (호출부는 mock 추정 유지).
 * 좌표는 WGS84 — ODsay 는 X=경도(lng), Y=위도(lat).
 *
 * 경로 선택: ODsay 가 돌려준 여러 경로 중 totalTime(총 소요시간)이 **최소**인 것을
 * 고른다. (path[0]은 ODsay 기본 정렬이라 최소 환승일 수 있어 최단 시간 보장 안 됨.)
 * 출발시각 파라미터는 보내지 않으므로 표준(평균) 소요이며 러시아워 기준이 아니다.
 */
export async function odsayTransitMinutes(
  origin: LatLng,
  dest: LatLng,
): Promise<number | null> {
  const key = process.env.NEXT_PUBLIC_ODSAY_KEY;
  if (!key) return null;

  const url =
    `https://api.odsay.com/v1/api/searchPubTransPathT` +
    `?apiKey=${encodeURIComponent(key)}` +
    `&SX=${origin.lng}&SY=${origin.lat}` +
    `&EX=${dest.lng}&EY=${dest.lat}` +
    `&output=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as OdsayResponse;
    // ODsay 는 HTTP 200 + error 필드로 실패를 알리기도 한다(인증·반경 밖·너무 가까움 등).
    if (data.error) return null;
    const paths = data.result?.path;
    if (!Array.isArray(paths) || paths.length === 0) return null;
    let best: number | null = null;
    for (const p of paths) {
      const t = p?.info?.totalTime;
      if (typeof t === "number" && (best === null || t < best)) best = t;
    }
    return best;
  } catch {
    return null;
  }
}
