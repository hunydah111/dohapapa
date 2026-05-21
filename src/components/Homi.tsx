// 비집고 마스코트 "비지(Biji)" — 비버. 시안 일러스트(public/biji/*.png)를 그대로 쓰되
// 정적이지 않게 부드러운 모션(숨쉬기 bob / 분석 중 통통)을 입혔다. 손코딩 SVG로는 이 그림체
// 퀄리티가 안 나와서, 예쁜 원본을 살리고 움직임만 코드로 더했다. (정밀 캐릭터 모션은 추후 Lottie)
// 호출부(<Homi mood=... size=... />)는 그대로 동작.

export type HomiMood =
  | "wave" // 첫 화면 — 그루터기에 앉아 반김
  | "searching" // 분석 중 — 나뭇가지 짊어지고 통통
  | "happy" // 결과 좋음 — 만세
  | "sheepish" // 결과 빈약 — 시무룩
  | "calm"; // 면책/주의 — 차분

const BIJI_ASPECT = 0.9; // 트림 후 약 0.8~1.0 (w/h) — 레이아웃 시프트 방지용 힌트

// ?v= 캐시버스트 — 배경 투명 처리된 새 이미지를 브라우저가 다시 받게.
const V = "?v=7";
const SRC: Record<HomiMood, string> = {
  wave: `/biji/biji-input.png${V}`,
  calm: `/biji/biji-input.png${V}`,
  searching: `/biji/biji-loading.png${V}`,
  happy: `/biji/biji-happy.png${V}`,
  sheepish: `/biji/biji-sad.png${V}`,
};

export function Homi({
  mood = "wave",
  size = 120,
  className = "",
}: {
  mood?: HomiMood;
  size?: number;
  className?: string;
}) {
  const src = SRC[mood] ?? SRC.wave;
  const anim = mood === "searching" ? "biji-hop" : "biji-breathe";
  // 반응형 높이 — 좁은 화면에선 약 78%까지 줄고, 넓은 화면에선 size 까지. 폭은 화면을 안 넘게.
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
