// 홈앤나 마스코트 "호미(Homi)" — 춘식이式 극단 미니멀 집.
// 원칙(레퍼런스: 카카오 춘식이·라인 브라운): 점 두 개 눈 + 작은 입, 큰 머리 비율,
// 둥근 모서리(각진 데 0), 발그레한 볼(#F4B8C1), 절제된 표정. 디테일 ❌.
// 색: 주황 지붕(#FF7A59) + 파스텔 파란 본체(#BBDDF0). 외부 이미지 의존 0(인라인 SVG).

export type HomiMood =
  | "wave" // 첫 화면 — 살짝 든 손 + 방긋
  | "searching" // 분석 중 — 작은 돋보기 + 가벼운 두리번(애니메이션)
  | "happy" // 결과 좋음 — 눈 ^ ^ + 작은 반짝
  | "sheepish" // 결과 빈약 — 살짝 머쓱
  | "calm"; // 면책/주의 — 차분

const ROOF = "#FF7A59";
const BODY = "#BBDDF0";
const INK = "#4A3B30";
const BLUSH = "#F4B8C1";
const GLASS = "#FFE6B0";

export function Homi({
  mood = "wave",
  size = 120,
  className = "",
}: {
  mood?: HomiMood;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 122"
      width={size}
      height={size}
      role="img"
      aria-label="홈앤나 마스코트 호미"
      className={`${mood === "searching" ? "homi-search" : "homi-bob"} ${className}`}
    >
      {/* 바닥 그림자 */}
      <ellipse cx="60" cy="115" rx="33" ry="5" fill="#000000" opacity="0.06" />

      {/* 손 흔들기 (wave/happy 만, 작은 동그라미 하나) */}
      {(mood === "wave" || mood === "happy") && (
        <circle cx="100" cy="60" r="7" fill={ROOF} />
      )}

      {/* 본체 (둥근 파스텔 블루) */}
      <rect x="20" y="46" width="80" height="66" rx="28" fill={BODY} />
      {/* 지붕 (둥근 돔, 주황) */}
      <path d="M16 60 Q16 24 60 24 Q104 24 104 60 Z" fill={ROOF} />

      {/* 볼터치 */}
      <ellipse cx="40" cy="90" rx="6.5" ry="3.8" fill={BLUSH} />
      <ellipse cx="80" cy="90" rx="6.5" ry="3.8" fill={BLUSH} />

      {/* 눈 — 점 두 개 (happy 만 ^ ^) */}
      {mood === "happy" ? (
        <>
          <path d="M41 81 q5 -5 10 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M69 81 q5 -5 10 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="46" cy="81" r="4.6" fill={INK} />
          <circle cx="74" cy="81" r="4.6" fill={INK} />
        </>
      )}

      {/* 입 — 작게, 절제 */}
      {mood === "searching" ? (
        <circle cx="60" cy="95" r="2.6" fill={INK} />
      ) : mood === "sheepish" ? (
        <path d="M54 95 q4 3 7 0 q3 -2 6 1" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      ) : mood === "calm" ? (
        <path d="M55 95 h10" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <path d="M54 94 q6 5 12 0" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      )}

      {/* 돋보기 (searching) */}
      {mood === "searching" && (
        <g className="homi-glass">
          <circle cx="94" cy="98" r="9" fill={GLASS} stroke={INK} strokeWidth="3" />
          <line x1="101" y1="105" x2="108" y2="112" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* 반짝 (happy, 하나만) */}
      {mood === "happy" && (
        <path d="M104 36 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFC23C" />
      )}
    </svg>
  );
}
