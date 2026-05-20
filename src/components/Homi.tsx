// 홈앤나 마스코트 "호미(Homi)" — 말랑 클레이풍 집 친구.
// 디자인: 통통 카와이(말랑호미) 베이스 + 팔/돋보기(이웃호미) 소품을 mood 로 켠다.
// 핵심 인간미: 큰 눈+하이라이트 + 발그레한 볼(#F4B8C1) + 둥근 코랄 지붕.
// 외부 이미지 의존 없이 인라인 SVG(저작권 0). 표정을 UX 상태에 연결해 쓴다(장식 아님).

export type HomiMood =
  | "wave" // 첫 화면 — 손 흔들며 방긋
  | "searching" // 분석 중 — 돋보기 들고 두리번 + 땀방울 (애니메이션)
  | "happy" // 결과 좋음 — 활짝 + 반짝이 + 두 손
  | "sheepish" // 결과 빈약 — 머쓱하게 뒤통수 긁기
  | "calm"; // 면책/주의 — 차분

const CORAL = "#FF7A59";
const INK = "#4A3B30"; // 따뜻한 갈색 외곽선·눈
const CREAM = "#FFFFFF";
const BLUSH = "#F4B8C1";
const GLASS = "#FFE6B0";

export function Homi({
  mood = "wave",
  size = 128,
  className = "",
}: {
  mood?: HomiMood;
  size?: number;
  className?: string;
}) {
  const showArms = mood !== "calm";
  return (
    <svg
      viewBox="0 0 150 150"
      width={size}
      height={size}
      role="img"
      aria-label="홈앤나 마스코트 호미"
      className={`${mood === "searching" ? "homi-search" : "homi-bob"} ${className}`}
    >
      {/* 바닥 그림자 */}
      <ellipse cx="75" cy="139" rx="38" ry="6" fill="#000000" opacity="0.06" />

      {/* 발 두 개 */}
      <rect x="57" y="120" width="15" height="17" rx="7.5" fill={CORAL} stroke={INK} strokeWidth="2.5" />
      <rect x="78" y="120" width="15" height="17" rx="7.5" fill={CORAL} stroke={INK} strokeWidth="2.5" />

      {/* 왼팔 (mood별) */}
      {showArms &&
        (mood === "sheepish" ? (
          // 뒤통수 긁기 — 지붕 위로
          <path d="M40 80 Q24 54 48 44" fill="none" stroke={CORAL} strokeWidth="8" strokeLinecap="round" />
        ) : mood === "happy" ? (
          <path d="M34 96 Q20 80 26 64" fill="none" stroke={CORAL} strokeWidth="8" strokeLinecap="round" />
        ) : (
          <path d="M34 98 Q24 104 22 114" fill="none" stroke={CORAL} strokeWidth="8" strokeLinecap="round" />
        ))}

      {/* 몸통 (말랑) */}
      <rect x="30" y="50" width="90" height="78" rx="32" fill={CREAM} stroke={INK} strokeWidth="2.5" />
      {/* 굴뚝 (지붕 뒤로 살짝) */}
      <rect x="99" y="26" width="11" height="20" rx="3" fill={CORAL} stroke={INK} strokeWidth="2.5" />
      {/* 코랄 지붕(둥근 돔) */}
      <path d="M30 64 Q30 24 75 24 Q120 24 120 64 Z" fill={CORAL} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />

      {/* 볼터치 */}
      <ellipse cx="49" cy="96" rx="8.5" ry="5" fill={BLUSH} opacity="0.9" />
      <ellipse cx="101" cy="96" rx="8.5" ry="5" fill={BLUSH} opacity="0.9" />

      {/* 눈 */}
      {mood === "happy" ? (
        <>
          <path d="M53 86 q7 -8 14 0" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M83 86 q7 -8 14 0" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </>
      ) : mood === "calm" ? (
        <>
          <path d="M54 86 h12" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M84 86 h12" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="61" cy="86" r="6.5" fill={INK} />
          <circle cx="89" cy="86" r="6.5" fill={INK} />
          <circle cx="58.6" cy="83.4" r="2.2" fill="#fff" />
          <circle cx="86.6" cy="83.4" r="2.2" fill="#fff" />
        </>
      )}

      {/* 입 */}
      {mood === "happy" ? (
        <path d="M64 101 Q75 115 86 101 Z" fill={INK} />
      ) : mood === "sheepish" ? (
        <path d="M64 104 q6 4 11 0 q5 -3 10 1" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      ) : mood === "calm" ? (
        <path d="M65 103 q10 5 20 0" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      ) : (
        <path d="M63 101 q12 10 24 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      )}

      {/* 오른팔 + 소품 (mood별) */}
      {mood === "searching" ? (
        <>
          {/* 돋보기 든 팔 */}
          <path d="M116 98 Q126 96 124 108" fill="none" stroke={CORAL} strokeWidth="8" strokeLinecap="round" />
          <g className="homi-glass">
            <circle cx="120" cy="116" r="11" fill={GLASS} stroke={INK} strokeWidth="3" />
            <line x1="128" y1="124" x2="135" y2="131" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          </g>
          {/* 땀방울 */}
          <path d="M41 70 q3 6 0 9 a3 3 0 1 1 0 -9 z" fill="#7FC8E8" />
        </>
      ) : mood === "wave" || mood === "happy" ? (
        <>
          {/* 흔드는 오른팔 */}
          <path d="M116 96 Q128 84 124 66" fill="none" stroke={CORAL} strokeWidth="8" strokeLinecap="round" />
          <circle cx="123" cy="62" r="7" fill={CORAL} stroke={INK} strokeWidth="2.5" />
        </>
      ) : mood === "sheepish" ? (
        <path d="M116 98 Q126 104 128 114" fill="none" stroke={CORAL} strokeWidth="8" strokeLinecap="round" />
      ) : null}

      {/* 반짝이 (happy) */}
      {mood === "happy" && (
        <>
          <path d="M128 40 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#FFC23C" />
          <path d="M20 58 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8z" fill="#FFC23C" />
        </>
      )}
    </svg>
  );
}
