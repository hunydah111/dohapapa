// 동네 객관 분석 — 카카오 로컬 '카테고리 검색'으로 단지 반경 내 시설을 사실로 집계한다.
// 컴플라이언스/가격우선: 주관·예측 없이 '주변 시설 수·거리' 사실만. 표시 단지(상위 후보)에만
// 호출하고 좌표(소수3자리≈100m)로 메모리 캐시해 카카오 쿼터를 아낀다. 키 없으면 null.

const RADIUS = 1000; // 도보권 약 12분
const SUBWAY_RADIUS = 2500; // 가장 가까운 역 탐색 반경

// 카카오 카테고리 그룹 코드
const CAT = {
  subway: "SW8",
  mart: "MT1",
  conv: "CS2",
  cafe: "CE7",
  hospital: "HP8",
  pharmacy: "PM9",
  school: "SC4",
  academy: "AC5",
  kinder: "PS3",
  culture: "CT1",
} as const;

export type CountKey = keyof typeof CAT;

export interface NeighborhoodCounts {
  subway: number;
  mart: number;
  conv: number;
  cafe: number;
  hospital: number;
  pharmacy: number;
  school: number;
  academy: number;
  kinder: number;
  culture: number;
}

export interface NeighborhoodScores {
  transit: number; // 교통
  convenience: number; // 생활편의
  education: number; // 교육(학군)
  culture: number; // 문화·여가
  liquidity: number; // 환금성(거래량)
}

export interface NeighborhoodData {
  counts: NeighborhoodCounts;
  nearestSubwayM: number | null;
  scores: NeighborhoodScores;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 시설 수·거리·거래량 → 0~100 점수(휴리스틱, '주변 시설 수 기반' 상대지표). 순수 함수. */
export function deriveScores(
  c: NeighborhoodCounts,
  nearestSubwayM: number | null,
  transactionCount: number,
): NeighborhoodScores {
  const transitDist =
    nearestSubwayM == null
      ? 0
      : nearestSubwayM <= 250
        ? 60
        : Math.max(0, 60 * (1 - (nearestSubwayM - 250) / 1250));
  // 카테고리별 기여를 캡 — 도심(병원 800+·카페 600+)이 전부 100으로 포화되는 걸 막아
  // 한적한 동네와 변별되게 한다.
  const cap = (n: number, mult: number, max: number) => Math.min(max, n * mult);
  const transit = clamp(transitDist + Math.min(40, c.subway * 13));
  const convenience = clamp(
    cap(c.mart, 10, 30) +
      cap(c.conv, 1, 20) +
      cap(c.cafe, 0.5, 20) +
      cap(c.hospital, 0.5, 15) +
      cap(c.pharmacy, 2, 15),
  );
  const education = clamp(
    cap(c.school, 15, 45) + cap(c.academy, 1, 30) + cap(c.kinder, 3, 25),
  );
  const culture = clamp(cap(c.culture, 5, 70) + cap(c.cafe, 0.3, 30));
  const liquidity = clamp((transactionCount - 8) * 2.4);
  return { transit, convenience, education, culture, liquidity };
}

// 좌표 기반 메모리 캐시 (counts·nearest 만 — 거래량은 단지별이라 점수는 매번 계산)
const cache = new Map<string, { counts: NeighborhoodCounts; nearestSubwayM: number | null }>();

function key() {
  return process.env.KAKAO_REST_KEY;
}

async function catCount(code: string, lat: number, lng: number, radius: number): Promise<number> {
  const k = key();
  if (!k) return 0;
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${code}&x=${lng}&y=${lat}&radius=${radius}&size=1`;
  try {
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${k}` } });
    if (!r.ok) return 0;
    const j = (await r.json()) as { meta?: { total_count?: number } };
    return j.meta?.total_count ?? 0;
  } catch {
    return 0;
  }
}

async function nearestSubway(lat: number, lng: number): Promise<number | null> {
  const k = key();
  if (!k) return null;
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${lng}&y=${lat}&radius=${SUBWAY_RADIUS}&size=1&sort=distance`;
  try {
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${k}` } });
    if (!r.ok) return null;
    const j = (await r.json()) as { documents?: { distance?: string }[] };
    const d = j.documents?.[0]?.distance;
    return d != null ? parseInt(d, 10) : null;
  } catch {
    return null;
  }
}

export async function getNeighborhood(
  lat: number,
  lng: number,
  transactionCount: number,
): Promise<NeighborhoodData | null> {
  if (!key()) return null;
  const ck = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  let geo = cache.get(ck);
  if (!geo) {
    const [subway, mart, conv, cafe, hospital, pharmacy, school, academy, kinder, culture, near] =
      await Promise.all([
        catCount(CAT.subway, lat, lng, RADIUS),
        catCount(CAT.mart, lat, lng, RADIUS),
        catCount(CAT.conv, lat, lng, RADIUS),
        catCount(CAT.cafe, lat, lng, RADIUS),
        catCount(CAT.hospital, lat, lng, RADIUS),
        catCount(CAT.pharmacy, lat, lng, RADIUS),
        catCount(CAT.school, lat, lng, RADIUS),
        catCount(CAT.academy, lat, lng, RADIUS),
        catCount(CAT.kinder, lat, lng, RADIUS),
        catCount(CAT.culture, lat, lng, RADIUS),
        nearestSubway(lat, lng),
      ]);
    geo = {
      counts: { subway, mart, conv, cafe, hospital, pharmacy, school, academy, kinder, culture },
      nearestSubwayM: near,
    };
    cache.set(ck, geo);
  }
  return {
    counts: geo.counts,
    nearestSubwayM: geo.nearestSubwayM,
    scores: deriveScores(geo.counts, geo.nearestSubwayM, transactionCount),
  };
}
