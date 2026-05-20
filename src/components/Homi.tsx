// 홈앤나 마스코트 "호미(Homi)" — 네모 집 몸통 + 삼각지붕 + 통통 굴뚝.
// 베이지 네모 벽(모서리만 살짝 둥근) 위에 주황 삼각지붕, 얼굴: 점 두 개 눈 + 발그레한
// 볼. '입 = 문' — 윗부분 둥근 작은 문 하나가 곧 입. 통통 팔다리. 인라인 SVG(저작권 0).

export type HomiMood =
  | "wave" // 첫 화면 — 방긋
  | "searching" // 분석 중 — 작은 돋보기 + 가벼운 두리번
  | "happy" // 결과 좋음 — 눈 ^ ^ + 작은 반짝
  | "sheepish" // 결과 빈약 — 살짝 머쓱
  | "calm"; // 면책/주의 — 차분

const ROOF = "#FF7A59"; // 주황 지붕
const ROOF_EDGE = "#EC5E3B";
const BODY = "#F2E3C0"; // 베이지 벽 (춘식이 톤)
const BODY_EDGE = "#E0C99B";
const DOOR = "#FF9B72"; // 문 = 입
const INK = "#4A3B30";
const BLUSH = "#F4B8C1";
const GLASS = "#FFE6B0";
const SMOKE = "#E2D8C8";

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
      viewBox="0 0 120 134"
      width={size}
      height={size}
      role="img"
      aria-label="홈앤나 마스코트 호미"
      className={`${mood === "searching" ? "homi-search" : "homi-bob"} ${className}`}
    >
      {/* 바닥 그림자 */}
      <ellipse cx="60" cy="127" rx="33" ry="5" fill="#000000" opacity="0.06" />

      {/* 발 두 개 */}
      <ellipse cx="46" cy="121" rx="9" ry="6.5" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      <ellipse cx="74" cy="121" rx="9" ry="6.5" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />

      {/* 양팔 (몸에 붙은 통통 stub) */}
      <ellipse cx="16" cy="90" rx="8" ry="11" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      <ellipse cx="104" cy="90" rx="8" ry="11" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />

      {/* 몸통 (네모 벽 — 모서리만 살짝 둥근) */}
      <rect x="22" y="48" width="76" height="70" rx="13" fill={BODY} stroke={BODY_EDGE} strokeWidth="2.5" />

      {/* 삼각 지붕 (네모 벽 위에) — 양옆 처마 살짝 */}
      <path
        d="M60 12 L102 50 L18 50 Z"
        fill={ROOF}
        stroke={ROOF_EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* 통통 굴뚝 + 연기 */}
      <rect x="74" y="24" width="13" height="18" rx="6" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      <circle cx="80.5" cy="18" r="3.2" fill={SMOKE} />
      <circle cx="85.5" cy="13" r="2.2" fill={SMOKE} />

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

      {/* 입 = 문 — 윗부분 둥근 작은 문 하나가 곧 입(+손잡이) */}
      <path d="M51 107 L51 97 Q51 88 60 88 Q69 88 69 97 L69 107 Z" fill={DOOR} />
      <circle cx="65.5" cy="99" r="1.6" fill={ROOF_EDGE} />

      {/* 돋보기 (searching) */}
      {mood === "searching" && (
        <g className="homi-glass">
          <circle cx="98" cy="104" r="9" fill={GLASS} stroke={INK} strokeWidth="3" />
          <line x1="105" y1="111" x2="112" y2="118" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* 반짝 (happy) */}
      {mood === "happy" && (
        <path d="M104 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFC23C" />
      )}
    </svg>
  );
}
