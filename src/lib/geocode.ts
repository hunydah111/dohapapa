export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
  address?: string;
}

// Approximate coordinates for well-known Seoul/수도권 지하철역·업무지구·지역명.
// Keyless fallback dictionary — covers most "어디서 일하세요" inputs by station
// or district name. For arbitrary company-name search, configure KAKAO_REST_KEY.
const MOCK_PLACES: Array<{ name: string; lat: number; lng: number; address: string }> = [
  // ── 강남·서초 업무지구 ──
  { name: "강남역", lat: 37.4979, lng: 127.0276, address: "서울 강남구 강남대로" },
  { name: "역삼역", lat: 37.5006, lng: 127.0364, address: "서울 강남구 역삼동" },
  { name: "선릉역", lat: 37.5045, lng: 127.0489, address: "서울 강남구 테헤란로" },
  { name: "삼성역", lat: 37.5088, lng: 127.0631, address: "서울 강남구 삼성동" },
  { name: "코엑스", lat: 37.5125, lng: 127.0590, address: "서울 강남구 영동대로 513" },
  { name: "양재역", lat: 37.4844, lng: 127.0343, address: "서울 서초구 양재동" },
  { name: "교대역", lat: 37.4934, lng: 127.0145, address: "서울 서초구 서초동" },
  { name: "서초역", lat: 37.4837, lng: 127.0078, address: "서울 서초구 서초동" },
  { name: "고속터미널", lat: 37.5048, lng: 127.0049, address: "서울 서초구 신반포로" },
  { name: "압구정", lat: 37.5273, lng: 127.0286, address: "서울 강남구 압구정동" },
  { name: "신사역", lat: 37.5163, lng: 127.0203, address: "서울 강남구 신사동" },
  { name: "논현역", lat: 37.5110, lng: 127.0217, address: "서울 강남구 논현동" },
  { name: "청담", lat: 37.5193, lng: 127.0533, address: "서울 강남구 청담동" },
  { name: "대치", lat: 37.4943, lng: 127.0633, address: "서울 강남구 대치동" },
  { name: "도곡", lat: 37.4910, lng: 127.0553, address: "서울 강남구 도곡동" },
  { name: "수서역", lat: 37.4873, lng: 127.1015, address: "서울 강남구 수서동" },
  // ── 여의도·영등포 ──
  { name: "여의도", lat: 37.5215, lng: 126.9242, address: "서울 영등포구 여의도동" },
  { name: "여의나루", lat: 37.5271, lng: 126.9325, address: "서울 영등포구 여의도동" },
  { name: "영등포역", lat: 37.5156, lng: 126.9075, address: "서울 영등포구 경인로" },
  { name: "당산역", lat: 37.5346, lng: 126.9026, address: "서울 영등포구 당산동" },
  { name: "노량진", lat: 37.5141, lng: 126.9425, address: "서울 동작구 노량진동" },
  // ── 도심 (시청·종로·을지로) ──
  { name: "광화문", lat: 37.5717, lng: 126.9766, address: "서울 종로구 세종대로" },
  { name: "시청", lat: 37.5645, lng: 126.9776, address: "서울 중구 세종대로" },
  { name: "을지로입구", lat: 37.5660, lng: 126.9826, address: "서울 중구 을지로" },
  { name: "종각", lat: 37.5703, lng: 126.9829, address: "서울 종로구 종로" },
  { name: "종로3가", lat: 37.5704, lng: 126.9920, address: "서울 종로구 종로" },
  { name: "충무로", lat: 37.5613, lng: 126.9943, address: "서울 중구 충무로" },
  { name: "동대문역사문화공원", lat: 37.5655, lng: 127.0090, address: "서울 중구 을지로" },
  { name: "서울역", lat: 37.5547, lng: 126.9707, address: "서울 중구 한강대로" },
  { name: "혜화", lat: 37.5822, lng: 127.0019, address: "서울 종로구 명륜동" },
  // ── 마포·서대문 ──
  { name: "공덕", lat: 37.5443, lng: 126.9515, address: "서울 마포구 공덕동" },
  { name: "마포", lat: 37.5391, lng: 126.9456, address: "서울 마포구 마포대로" },
  { name: "홍대입구", lat: 37.5572, lng: 126.9245, address: "서울 마포구 동교동" },
  { name: "합정", lat: 37.5495, lng: 126.9136, address: "서울 마포구 합정동" },
  { name: "상암DMC", lat: 37.5765, lng: 126.8996, address: "서울 마포구 상암동" },
  { name: "신촌", lat: 37.5551, lng: 126.9368, address: "서울 서대문구 창천동" },
  { name: "디지털미디어시티", lat: 37.5765, lng: 126.8996, address: "서울 마포구 상암동" },
  // ── 구로·금천·강서 ──
  { name: "구로디지털단지", lat: 37.4851, lng: 126.9014, address: "서울 구로구 디지털로" },
  { name: "가산디지털단지", lat: 37.4817, lng: 126.8826, address: "서울 금천구 가산동" },
  { name: "신도림", lat: 37.5089, lng: 126.8913, address: "서울 구로구 신도림동" },
  { name: "구로역", lat: 37.5031, lng: 126.8819, address: "서울 구로구 구로동" },
  { name: "마곡", lat: 37.5601, lng: 126.8308, address: "서울 강서구 마곡동" },
  { name: "마곡나루", lat: 37.5675, lng: 126.8295, address: "서울 강서구 마곡동" },
  { name: "발산", lat: 37.5585, lng: 126.8376, address: "서울 강서구 내발산동" },
  { name: "김포공항", lat: 37.5629, lng: 126.8014, address: "서울 강서구 공항동" },
  { name: "화곡", lat: 37.5417, lng: 126.8403, address: "서울 강서구 화곡동" },
  // ── 양천·동작·관악 ──
  { name: "목동", lat: 37.5260, lng: 126.8615, address: "서울 양천구 목동" },
  { name: "오목교", lat: 37.5243, lng: 126.8753, address: "서울 양천구 목동" },
  { name: "사당", lat: 37.4765, lng: 126.9816, address: "서울 동작구 사당동" },
  { name: "이수", lat: 37.4866, lng: 126.9818, address: "서울 동작구 사당동" },
  { name: "흑석", lat: 37.5087, lng: 126.9636, address: "서울 동작구 흑석동" },
  { name: "신림", lat: 37.4842, lng: 126.9298, address: "서울 관악구 신림동" },
  { name: "서울대입구", lat: 37.4812, lng: 126.9527, address: "서울 관악구 봉천동" },
  // ── 용산·성동·광진 ──
  { name: "용산역", lat: 37.5299, lng: 126.9648, address: "서울 용산구 한강대로" },
  { name: "삼각지", lat: 37.5347, lng: 126.9732, address: "서울 용산구 한강로" },
  { name: "이태원", lat: 37.5345, lng: 126.9944, address: "서울 용산구 이태원동" },
  { name: "한남", lat: 37.5398, lng: 127.0017, address: "서울 용산구 한남동" },
  { name: "성수", lat: 37.5447, lng: 127.0557, address: "서울 성동구 성수동" },
  { name: "왕십리", lat: 37.5613, lng: 127.0374, address: "서울 성동구 행당동" },
  { name: "뚝섬", lat: 37.5474, lng: 127.0473, address: "서울 성동구 성수동" },
  { name: "건대입구", lat: 37.5403, lng: 127.0703, address: "서울 광진구 화양동" },
  { name: "강변", lat: 37.5350, lng: 127.0947, address: "서울 광진구 구의동" },
  { name: "군자", lat: 37.5572, lng: 127.0794, address: "서울 광진구 군자동" },
  // ── 송파·강동 ──
  { name: "잠실", lat: 37.5133, lng: 127.1001, address: "서울 송파구 잠실동" },
  { name: "잠실새내", lat: 37.5115, lng: 127.0863, address: "서울 송파구 잠실동" },
  { name: "송파", lat: 37.4985, lng: 127.1120, address: "서울 송파구 송파동" },
  { name: "문정", lat: 37.4858, lng: 127.1226, address: "서울 송파구 문정동" },
  { name: "가락시장", lat: 37.4925, lng: 127.1180, address: "서울 송파구 가락동" },
  { name: "올림픽공원", lat: 37.5163, lng: 127.1305, address: "서울 송파구 방이동" },
  { name: "천호", lat: 37.5385, lng: 127.1237, address: "서울 강동구 천호동" },
  { name: "강동", lat: 37.5350, lng: 127.1324, address: "서울 강동구 천호동" },
  { name: "고덕", lat: 37.5550, lng: 127.1542, address: "서울 강동구 고덕동" },
  { name: "둔촌동", lat: 37.5278, lng: 127.1364, address: "서울 강동구 둔촌동" },
  // ── 노원·도봉·강북·성북 ──
  { name: "노원", lat: 37.6554, lng: 127.0613, address: "서울 노원구 상계동" },
  { name: "상계", lat: 37.6601, lng: 127.0735, address: "서울 노원구 상계동" },
  { name: "창동", lat: 37.6533, lng: 127.0477, address: "서울 도봉구 창동" },
  { name: "수유", lat: 37.6378, lng: 127.0254, address: "서울 강북구 수유동" },
  { name: "미아사거리", lat: 37.6133, lng: 127.0301, address: "서울 강북구 미아동" },
  { name: "성신여대입구", lat: 37.5926, lng: 127.0166, address: "서울 성북구 동선동" },
  { name: "청량리", lat: 37.5800, lng: 127.0468, address: "서울 동대문구 전농동" },
  { name: "회기", lat: 37.5896, lng: 127.0577, address: "서울 동대문구 휘경동" },
  // ── 경기·인천 주요 거점 ──
  { name: "판교", lat: 37.3947, lng: 127.1112, address: "경기 성남시 분당구 판교역로" },
  { name: "정자", lat: 37.3671, lng: 127.1080, address: "경기 성남시 분당구 정자동" },
  { name: "서현", lat: 37.3850, lng: 127.1234, address: "경기 성남시 분당구 서현동" },
  { name: "야탑", lat: 37.4114, lng: 127.1287, address: "경기 성남시 분당구 야탑동" },
  { name: "광교", lat: 37.2997, lng: 127.0463, address: "경기 수원시 영통구 광교" },
  { name: "수원", lat: 37.2659, lng: 127.0001, address: "경기 수원시 팔달구" },
  { name: "일산", lat: 37.6818, lng: 126.7689, address: "경기 고양시 일산동구" },
  { name: "평촌", lat: 37.3942, lng: 126.9637, address: "경기 안양시 동안구 평촌동" },
  { name: "광명", lat: 37.4161, lng: 126.8845, address: "경기 광명시 광명동" },
  { name: "부천", lat: 37.4842, lng: 126.7825, address: "경기 부천시 원미구" },
  { name: "송도", lat: 37.3826, lng: 126.6435, address: "인천 연수구 송도동" },
  { name: "동탄", lat: 37.2010, lng: 127.0976, address: "경기 화성시 동탄" },
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
