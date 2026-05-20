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
const COIN = "#FFD24D"; // 굴뚝에서 폴폴 나오는 동전(₩)
const COIN_EDGE = "#E0A21E";
const COIN_SHINE = "#FFF1C2";

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

      {/* 굴뚝 (지붕 뒤로 — 지붕이 아랫부분을 덮어 자연스럽게) */}
      <rect x="73" y="18" width="13" height="26" rx="6" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      {/* 삼각 지붕 (네모 벽 위에) — 양옆 처마 살짝 */}
      <path
        d="M60 12 L102 50 L18 50 Z"
        fill={ROOF}
        stroke={ROOF_EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* 굴뚝에서 폴폴 나오는 동전(₩) — 통통 금화 + 반짝 */}
      <g transform="rotate(-6 81 9)">
        <circle cx="81" cy="9" r="9.5" fill={COIN} stroke={COIN_EDGE} strokeWidth="2" />
        <circle cx="81" cy="9" r="6" fill="none" stroke={COIN_EDGE} strokeWidth="1.2" />
        <text x="81" y="12.3" fontSize="9" fontWeight="800" fontFamily="sans-serif" textAnchor="middle" fill={COIN_EDGE}>₩</text>
        <ellipse cx="77.3" cy="5.6" rx="1.7" ry="1" fill={COIN_SHINE} transform="rotate(-35 77.3 5.6)" />
      </g>

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
