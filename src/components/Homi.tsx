// 비집고 마스코트 "비지(Biji)" — 비버. 시안 일러스트(public/biji/*.png)를 그대로 쓰되
// 정적이지 않게 부드러운 모션(숨쉬기 bob / 분석 중 통통)을 입혔다. 표정 9종.
// 호출부(<Homi mood=... size=... />)는 그대로 동작.

export type HomiMood =
  | "smile" // 웃는 — 첫 화면 인사·입력
  | "flustered" // 당황 — 결과 빈약·경계
  | "angry" // 화난 — 오류
  | "running" // 달리는 — 분석 중·재검색
  | "crying" // 우는 — 0건
  | "think" // 통장 보며 고민 — 예산·"내 통장"
  | "cheer" // 만세 — 결과 좋음·히어로
  | "thumbsup" // 따봉 — 성공 마이크로
  | "face" // 얼굴만 — 소형 인라인
  // ── 신규 14종 ──
  | "car" // 운전 — 자차 통근
  | "transit" // 버스 탑승(씬배경) — 대중교통 통근
  | "clock" // 시계 — 통근 시간
  | "money" // 지폐 — 예산 충분·구매력
  | "calc" // 계산기·영수증 — 예산 계산
  | "walletEmpty" // 빈 지갑 — 예산 빠듯
  | "map" // 지도 — 안전망·가장 가까운 후보
  | "search" // 돋보기 — 검토·탐색
  | "shrug" // 어깨 으쓱 — 완화 제안
  | "share" // 휴대폰 — 공유
  | "river" // 한강변(씬배경) — 한강변 입지
  | "tree" // 나무옆(씬배경) — 조용한 동네
  | "wave" // 손 흔들며 인사 — 랜딩 환영
  | "key"; // 집 열쇠 — 단지·가능성

const BIJI_ASPECT = 0.9; // 레이아웃 시프트 방지용 힌트(실제 렌더는 width:auto)

// ?v= 캐시버스트 — 새 표정 이미지 반영.
const V = "?v=10";
const SRC: Record<HomiMood, string> = {
  smile: `/biji/biji-smile.png${V}`,
  flustered: `/biji/biji-flustered.png${V}`,
  angry: `/biji/biji-angry.png${V}`,
  running: `/biji/biji-running.png${V}`,
  crying: `/biji/biji-crying.png${V}`,
  think: `/biji/biji-think.png${V}`,
  cheer: `/biji/biji-cheer.png${V}`,
  thumbsup: `/biji/biji-thumbsup.png${V}`,
  face: `/biji/biji-face.png${V}`,
  car: `/biji/biji-car.png${V}`,
  transit: `/biji/biji-transit.png${V}`,
  clock: `/biji/biji-clock.png${V}`,
  money: `/biji/biji-money.png${V}`,
  calc: `/biji/biji-calc.png${V}`,
  walletEmpty: `/biji/biji-wallet-empty.png${V}`,
  map: `/biji/biji-map.png${V}`,
  search: `/biji/biji-search.png${V}`,
  shrug: `/biji/biji-shrug.png${V}`,
  share: `/biji/biji-share.png${V}`,
  river: `/biji/biji-river.png${V}`,
  tree: `/biji/biji-tree.png${V}`,
  wave: `/biji/biji-wave.png${V}`,
  key: `/biji/biji-key.png${V}`,
};

export function Homi({
  mood = "smile",
  size = 120,
  className = "",
}: {
  mood?: HomiMood;
  size?: number;
  className?: string;
}) {
  const src = SRC[mood] ?? SRC.smile;
  // 달리기·만세는 통통 튀고, 나머지는 숨쉬기.
  const anim = mood === "running" || mood === "cheer" ? "biji-hop" : "biji-breathe";
  // 반응형 높이 — 좁은 화면에선 약 78%까지 줄고, 넓은 화면에선 size 까지.
  const minH = Math.round(size * 0.78);
  const height = `clamp(${minH}px, ${Math.round(size * 0.55)}px + 9vw, ${size}px)`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="비지 마스코트"
      width={Math.round(size * BIJI_ASPECT)}
      height={size}
      style={{ height, width: "auto", maxWidth: "100%" }}
      draggable={false}
      className={`${anim} ${className}`}
    />
  );
}
