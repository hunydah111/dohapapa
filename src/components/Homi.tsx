// 홈앤나 마스코트 "호미(Homi)" — 춘식이式 둥근 베이지 몸통 + 집 요소.
// 큰 통몸통 + 머리 위 작은 주황 지붕 + 통통 굴뚝(연기). 얼굴: 점 두 개 눈 + 발그레한 볼.
// '문 = 입' — 가로로 긴 둥근 문이 곧 귀여운 입. 통통 팔다리. 인라인 SVG(저작권 0).

export type HomiMood =
  | "wave" // 첫 화면 — 방긋
  | "searching" // 분석 중 — 작은 돋보기 + 가벼운 두리번
  | "happy" // 결과 좋음 — 눈 ^ ^ + 작은 반짝
  | "sheepish" // 결과 빈약 — 살짝 머쓱
  | "calm"; // 면책/주의 — 차분

const ROOF = "#FF7A59"; // 주황 지붕
const ROOF_EDGE = "#EC5E3B";
const BODY = "#F2E3C0"; // 베이지 통몸통 (춘식이 톤)
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
      <ellipse cx="48" cy="123" rx="9" ry="6.5" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      <ellipse cx="72" cy="123" rx="9" ry="6.5" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />

      {/* 양팔 (몸에 붙은 통통 stub) */}
      <ellipse cx="18" cy="96" rx="8" ry="10" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />
      <ellipse cx="102" cy="96" rx="8" ry="10" fill={BODY} stroke={BODY_EDGE} strokeWidth="2" />

      {/* 몸통 (큰 베이지 통감자) */}
      <ellipse cx="60" cy="84" rx="40" ry="42" fill={BODY} stroke={BODY_EDGE} strokeWidth="2.5" />

      {/* 통통 굴뚝 + 연기 (지붕 뒤로 살짝) */}
      <circle cx="83" cy="14" r="3.4" fill={SMOKE} />
      <circle cx="88" cy="9" r="2.4" fill={SMOKE} />
      <rect x="70" y="20" width="14" height="18" rx="6" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      {/* 작은 삼각 지붕 (머리 위) */}
      <path
        d="M60 12 L93 46 L27 46 Z"
        fill={ROOF}
        stroke={ROOF_EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

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

      {/* 문 = 입 (가로로 긴 둥근 문 → 귀여운 입) */}
      <rect x="44" y="86" width="32" height="16" rx="8" fill={DOOR} />

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
