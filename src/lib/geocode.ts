export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
  address?: string;
}

// Approximate coordinates for well-known Seoul-area office hubs / landmarks.
// Used as fallback when no Kakao REST key is configured.
const MOCK_PLACES: Array<{ name: string; lat: number; lng: number; address: string }> = [
  { name: "강남역", lat: 37.4979, lng: 127.0276, address: "서울 강남구 강남대로 지하 396" },
  { name: "삼성역", lat: 37.5088, lng: 127.0632, address: "서울 강남구 테헤란로 212" },
  { name: "코엑스", lat: 37.5125, lng: 127.0590, address: "서울 강남구 영동대로 513" },
  { name: "여의도", lat: 37.5219, lng: 126.9245, address: "서울 영등포구 여의도동" },
  { name: "광화문", lat: 37.5759, lng: 126.9769, address: "서울 종로구 사직로 161" },
  { name: "시청", lat: 37.5662, lng: 126.9784, address: "서울 중구 세종대로 110" },
  { name: "판교", lat: 37.3943, lng: 127.1108, address: "경기 성남시 분당구 판교역로 235" },
  { name: "구로디지털단지", lat: 37.4851, lng: 126.9014, address: "서울 구로구 디지털로 300" },
  { name: "가산디지털단지", lat: 37.4778, lng: 126.8892, address: "서울 금천구 가산디지털1로" },
  { name: "상암DMC", lat: 37.5794, lng: 126.8897, address: "서울 마포구 상암동 월드컵북로" },
  { name: "잠실", lat: 37.5132, lng: 127.1001, address: "서울 송파구 올림픽로 240" },
  { name: "마곡", lat: 37.5601, lng: 126.8308, address: "서울 강서구 마곡동" },
  { name: "을지로", lat: 37.5662, lng: 126.9910, address: "서울 중구 을지로" },
  { name: "종로", lat: 37.5729, lng: 126.9794, address: "서울 종로구 종로" },
  { name: "서울역", lat: 37.5547, lng: 126.9707, address: "서울 중구 통일로 1" },
  { name: "용산", lat: 37.5296, lng: 126.9648, address: "서울 용산구 한강대로 23길 55" },
  { name: "성수", lat: 37.5446, lng: 127.0558, address: "서울 성동구 성수동" },
  { name: "왕십리", lat: 37.5613, lng: 127.0374, address: "서울 성동구 왕십리로 215" },
  { name: "영등포", lat: 37.5158, lng: 126.9067, address: "서울 영등포구 경인로 846" },
  { name: "목동", lat: 37.5269, lng: 126.8748, address: "서울 양천구 목동" },
  { name: "마포", lat: 37.5508, lng: 126.9493, address: "서울 마포구 마포대로 144" },
  { name: "공덕", lat: 37.5441, lng: 126.9515, address: "서울 마포구 백범로 180" },
  { name: "양재", lat: 37.4845, lng: 127.0341, address: "서울 서초구 강남대로 213" },
  { name: "사당", lat: 37.4765, lng: 126.9816, address: "서울 동작구 사당로 지하 124" },
  { name: "수서", lat: 37.4875, lng: 127.1008, address: "서울 강남구 밤고개로 지하 190" },
  { name: "분당 정자", lat: 37.3595, lng: 127.1089, address: "경기 성남시 분당구 정자일로 45" },
  { name: "일산", lat: 37.6597, lng: 126.7718, address: "경기 고양시 일산동구 중앙로" },
  { name: "선릉", lat: 37.5046, lng: 127.0490, address: "서울 강남구 테헤란로 326" },
  { name: "역삼", lat: 37.5004, lng: 127.0364, address: "서울 강남구 역삼동" },
  { name: "홍대", lat: 37.5571, lng: 126.9245, address: "서울 마포구 양화로 160" },
];

async function searchKakao(query: string, key: string): Promise<PlaceResult[]> {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kakao API error: ${res.status}`);

  const data = (await res.json()) as {
    documents: Array<{
      place_name: string;
      y: string;
      x: string;
      road_address_name: string;
      address_name: string;
    }>;
  };

  return data.documents.slice(0, 6).map((doc) => ({
    label: doc.place_name,
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    address: doc.road_address_name || doc.address_name || undefined,
  }));
}

function searchMock(query: string): PlaceResult[] {
  const q = query.toLowerCase();
  return MOCK_PLACES.filter(
    (p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()),
  )
    .slice(0, 6)
    .map((p) => ({ label: p.name, lat: p.lat, lng: p.lng, address: p.address }));
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const key = process.env.KAKAO_REST_KEY;
  if (key && key.length > 0) {
    try {
      return await searchKakao(trimmed, key);
    } catch {
      // Fall through to mock dictionary on any network / API error
    }
  }

  return searchMock(trimmed);
}
