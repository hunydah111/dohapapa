// [오늘의 거래 지도] 타일 격자 — 수도권 82개 시군구의 근사 지리 배치 (2026-07-06 시안 B 확정).
//
// 좌표계: CSS grid (col 1~12, row 1~14). 시안 B의 근사 배치를 기반으로 지리 정밀화 —
//   북부 경기(연천·포천·가평) 위 / 인천·강화 좌측 열 / 서울 25구 중앙 블록(cols 4~9)
//   / 부천 3구는 인천 부평과 서울 강서 사이 / 남부 경기(수원·화성·평택) 아래.
//   실제 인접 관계를 존중하되 완전한 지도는 아니다 — 지면 각주에 "위치 근사" 병기.
//
// 불변 계약(테스트가 전수 검증):
//   - 키 = LAWD_CODES(@/lib/molit)의 시군구 풀네임과 1:1 (82개 전부, 초과·누락 0).
//   - 타일 좌표 충돌 0 · col ∈ [1, TILE_GRID_COLS] · row ∈ [1, TILE_GRID_ROWS].
//   - label = 지면 축약(2~4자): "고양시 일산동구"→"일산동", "수원시 팔달구"→"팔달",
//     "인천 중구"→"인천중"(서울 중구와 구분). 서울 25구는 "구" 접미만 뗀다(중구 예외).
//
// 순수 상수 모듈 — 렌더(DailyFront)와 테스트가 같은 소스를 쓴다.

export interface Tile {
  /** CSS grid column (1-based). */
  col: number;
  /** CSS grid row (1-based). */
  row: number;
  /** 지면 축약 라벨 (2~4자). */
  label: string;
}

/** 격자 폭 — 시안 B와 동일 12열(동쪽 여백 포함). */
export const TILE_GRID_COLS = 12;
/** 격자 높이 — 북부 경기(1)부터 평택·안성(14)까지. */
export const TILE_GRID_ROWS = 14;

/** 타일 농도 문턱 — 시안 B 범례: 0건=바탕 · 1~2 · 3~6 · 7건+(먹·흰글자). */
export const TILE_LEVEL_MID = 3;
export const TILE_LEVEL_HIGH = 7;

/** 오늘 공개 건수 → 농도 레벨(0~3). */
export function tileLevel(count: number): 0 | 1 | 2 | 3 {
  if (count >= TILE_LEVEL_HIGH) return 3;
  if (count >= TILE_LEVEL_MID) return 2;
  if (count >= 1) return 1;
  return 0;
}

/** 시군구 풀네임(LAWD_CODES 키) → 타일. 82개 전부. */
export const TILE_MAP: Record<string, Tile> = {
  // ── 북부 경기 (rows 1~3) ──
  연천군: { col: 7, row: 1, label: "연천" },
  동두천시: { col: 8, row: 1, label: "동두천" },
  포천시: { col: 9, row: 1, label: "포천" },
  가평군: { col: 10, row: 1, label: "가평" },
  파주시: { col: 3, row: 2, label: "파주" },
  양주시: { col: 8, row: 2, label: "양주" },
  김포시: { col: 2, row: 3, label: "김포" },
  "고양시 일산서구": { col: 3, row: 3, label: "일산서" },
  "고양시 일산동구": { col: 4, row: 3, label: "일산동" },
  "고양시 덕양구": { col: 5, row: 3, label: "덕양" },
  의정부시: { col: 8, row: 3, label: "의정부" },
  남양주시: { col: 10, row: 4, label: "남양주" },
  구리시: { col: 10, row: 5, label: "구리" },
  양평군: { col: 11, row: 5, label: "양평" },
  // ── 인천 (cols 1~2) + 강화·옹진 ──
  강화군: { col: 1, row: 2, label: "강화" },
  "인천 서구": { col: 1, row: 4, label: "인천서" },
  계양구: { col: 2, row: 4, label: "계양" },
  "인천 동구": { col: 1, row: 5, label: "인천동" },
  부평구: { col: 2, row: 5, label: "부평" },
  "인천 중구": { col: 1, row: 6, label: "인천중" },
  미추홀구: { col: 2, row: 6, label: "미추홀" },
  연수구: { col: 1, row: 7, label: "연수" },
  남동구: { col: 2, row: 7, label: "남동" },
  옹진군: { col: 1, row: 9, label: "옹진" },
  // ── 부천 3구 — 인천 부평 동쪽·서울 강서 서쪽 (col 3, rows 5~7) ──
  "부천시 오정구": { col: 3, row: 5, label: "오정" },
  "부천시 원미구": { col: 3, row: 6, label: "원미" },
  "부천시 소사구": { col: 3, row: 7, label: "소사" },
  // ── 서울 25구 — 중앙 블록 (cols 4~9, rows 4~9) ──
  은평구: { col: 5, row: 4, label: "은평" },
  강북구: { col: 7, row: 4, label: "강북" },
  도봉구: { col: 8, row: 4, label: "도봉" },
  노원구: { col: 9, row: 4, label: "노원" },
  서대문구: { col: 5, row: 5, label: "서대문" },
  종로구: { col: 6, row: 5, label: "종로" },
  성북구: { col: 7, row: 5, label: "성북" },
  동대문구: { col: 8, row: 5, label: "동대문" },
  중랑구: { col: 9, row: 5, label: "중랑" },
  강서구: { col: 4, row: 6, label: "강서" },
  마포구: { col: 5, row: 6, label: "마포" },
  중구: { col: 6, row: 6, label: "중구" },
  성동구: { col: 7, row: 6, label: "성동" },
  광진구: { col: 8, row: 6, label: "광진" },
  강동구: { col: 9, row: 6, label: "강동" },
  양천구: { col: 4, row: 7, label: "양천" },
  영등포구: { col: 5, row: 7, label: "영등포" },
  용산구: { col: 6, row: 7, label: "용산" },
  송파구: { col: 8, row: 7, label: "송파" },
  구로구: { col: 4, row: 8, label: "구로" },
  동작구: { col: 5, row: 8, label: "동작" },
  서초구: { col: 6, row: 8, label: "서초" },
  강남구: { col: 7, row: 8, label: "강남" },
  금천구: { col: 4, row: 9, label: "금천" },
  관악구: { col: 5, row: 9, label: "관악" },
  // ── 동부 경기 ──
  하남시: { col: 9, row: 7, label: "하남" },
  광주시: { col: 10, row: 8, label: "광주" },
  이천시: { col: 10, row: 9, label: "이천" },
  여주시: { col: 11, row: 9, label: "여주" },
  // ── 서남 경기 ──
  광명시: { col: 3, row: 8, label: "광명" },
  시흥시: { col: 3, row: 9, label: "시흥" },
  "안산시 단원구": { col: 2, row: 10, label: "단원" },
  "안산시 상록구": { col: 3, row: 10, label: "상록" },
  "안양시 만안구": { col: 4, row: 10, label: "만안" },
  "안양시 동안구": { col: 5, row: 10, label: "동안" },
  의왕시: { col: 6, row: 10, label: "의왕" },
  군포시: { col: 5, row: 11, label: "군포" },
  // ── 동남 경기 — 성남·용인 ──
  과천시: { col: 6, row: 9, label: "과천" },
  "성남시 수정구": { col: 8, row: 8, label: "수정" },
  "성남시 중원구": { col: 9, row: 8, label: "중원" },
  "성남시 분당구": { col: 8, row: 9, label: "분당" },
  "용인시 수지구": { col: 8, row: 10, label: "수지" },
  "용인시 기흥구": { col: 8, row: 11, label: "기흥" },
  "용인시 처인구": { col: 9, row: 11, label: "처인" },
  // ── 수원 4구 ──
  "수원시 장안구": { col: 6, row: 11, label: "장안" },
  "수원시 권선구": { col: 5, row: 12, label: "권선" },
  "수원시 팔달구": { col: 6, row: 12, label: "팔달" },
  "수원시 영통구": { col: 7, row: 12, label: "영통" },
  // ── 화성 4구 + 남부 ──
  "화성시 남양구": { col: 3, row: 12, label: "남양" },
  "화성시 향남구": { col: 4, row: 13, label: "향남" },
  "화성시 병점구": { col: 6, row: 13, label: "병점" },
  "화성시 동탄구": { col: 8, row: 13, label: "동탄" },
  오산시: { col: 7, row: 13, label: "오산" },
  평택시: { col: 5, row: 14, label: "평택" },
  안성시: { col: 8, row: 14, label: "안성" },
};
