// 홈앤나 마스코트 "호미(Homi)" — 춘식이式 둥근 몸통 + 집 요소.
// 큰 베이지 통몸통(=춘식이 실루엣) 위에 작은 주황 지붕 + 굴뚝, 몸통에 문·작은 얼굴
// (점 두 개 눈·작은 입·발그레한 볼). 통통 팔다리. 절제된 표정. 인라인 SVG(저작권 0).

export type HomiMood =
  | "wave" // 첫 화면 — 한 손 들고 방긋
  | "searching" // 분석 중 — 작은 돋보기 + 가벼운 두리번
  | "happy" // 결과 좋음 — 눈 ^ ^ + 작은 반짝
  | "sheepish" // 결과 빈약 — 살짝 머쓱
  | "calm"; // 면책/주의 — 차분

const ROOF = "#FF7A59"; // 주황 지붕
const ROOF_EDGE = "#EC5E3B";
const BODY = "#F2E3C0"; // 베이지 통몸통 (춘식이 톤)
const BODY_EDGE = "#E0C99B";
const DOOR = "#FF9B72";
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
  const raisedHand = mood === "wave" || mood === "happy";
  return (
    <svg
      viewBox="0 0 120 134"
      width={size}
      height={size}
      role="img"
      aria-label="홈앤나 마스코트 호미"
      className={`${mood === "searching" ? "homi-search" : "homi-bob"} ${className}`}
    >
      {/* 바닥 그림자 */}
      <ellipse cx="60" cy="127" rx="33" ry="5" fill="#000000" opacity="0.06" />

      {/* 발 두 개 (통통) */}
      <ellipse cx="48" cy="123" rx="9" ry="6.5" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      <ellipse cx="72" cy="123" rx="9" ry="6.5" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />

      {/* 왼팔 (통통 stub) */}
      <ellipse cx="20" cy="92" rx="8.5" ry="11" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      {/* 오른팔 — 들지 않을 때 stub */}
      {!raisedHand && (
        <ellipse cx="100" cy="92" rx="8.5" ry="11" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      )}

      {/* 몸통 (큰 베이지 통감자) */}
      <ellipse cx="60" cy="84" rx="40" ry="42" fill={BODY} stroke={BODY_EDGE} strokeWidth="2.5" />

      {/* 굴뚝 (지붕 뒤로 살짝) */}
      <rect x="73" y="22" width="9" height="18" rx="2.5" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      {/* 작은 삼각 지붕 (머리 위) */}
      <path
        d="M60 12 L93 46 L27 46 Z"
        fill={ROOF}
        stroke={ROOF_EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 오른팔 — 들 때 (지붕 옆으로 인사) */}
      {raisedHand && (
        <ellipse cx="103" cy="64" rx="8.5" ry="10" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      )}

      {/* 볼터치 */}
      <ellipse cx="37" cy="80" rx="6.2" ry="3.7" fill={BLUSH} />
      <ellipse cx="83" cy="80" rx="6.2" ry="3.7" fill={BLUSH} />

      {/* 눈 — 점 두 개 (happy 만 ^ ^) */}
      {mood === "happy" ? (
        <>
          <path d="M42 72 q5 -5 10 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M68 72 q5 -5 10 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="47" cy="72" r="4.8" fill={INK} />
          <circle cx="73" cy="72" r="4.8" fill={INK} />
        </>
      )}

      {/* 입 — 작게, 절제 */}
      {mood === "searching" ? (
        <circle cx="60" cy="82" r="2.5" fill={INK} />
      ) : mood === "sheepish" ? (
        <path d="M55 82 q3 3 5 0 q2 -2 5 1" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "calm" ? (
        <path d="M56 82 h8" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path d="M55 81 q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.7" strokeLinecap="round" />
      )}

      {/* 문 (몸통 하단 — 집임을 확정) */}
      <rect x="50" y="98" width="20" height="26" rx="9" fill={DOOR} />
      <circle cx="65" cy="112" r="1.8" fill={ROOF_EDGE} />

      {/* 돋보기 (searching) */}
      {mood === "searching" && (
        <g className="homi-glass">
          <circle cx="96" cy="100" r="9" fill={GLASS} stroke={INK} strokeWidth="3" />
          <line x1="103" y1="107" x2="110" y2="114" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* 반짝 (happy) */}
      {mood === "happy" && (
        <path d="M104 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFC23C" />
      )}
    </svg>
  );
}
