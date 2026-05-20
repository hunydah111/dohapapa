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
const MONEY = "#A7DBA9"; // 굴뚝에서 폴폴 나오는 통장 표지
const MONEY_LT = "#EAF7EA"; // 통장 속지
const MONEY_EDGE = "#5FA968";

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
      {/* 굴뚝에서 폴폴 나오는 통장 한 권 — 책등+표지 라벨로 '통장'임을 확실히 */}
      <g transform="rotate(-8 80 9)">
        {/* 페이지 (뒤로 살짝 삐져나옴) */}
        <rect x="72" y="3" width="20" height="15" rx="2.5" fill="#FFFDF6" stroke={MONEY_EDGE} strokeWidth="1" />
        {/* 표지 */}
        <rect x="69" y="1.5" width="19" height="15" rx="2.5" fill={MONEY} stroke={MONEY_EDGE} strokeWidth="1.6" />
        {/* 책등 (binding) + 하이라이트 */}
        <rect x="69" y="1.5" width="5" height="15" rx="2" fill={MONEY_EDGE} />
        <line x1="71.5" y1="3.6" x2="71.5" y2="14.4" stroke={MONEY_LT} strokeWidth="0.8" strokeLinecap="round" />
        {/* 표지 라벨 + 글자 줄 */}
        <rect x="77.5" y="4.8" width="8.5" height="3.6" rx="1" fill="#FFFDF6" />
        <line x1="78" y1="11" x2="85.5" y2="11" stroke="#FFFDF6" strokeWidth="1.1" strokeLinecap="round" />
        <line x1="78" y1="13.2" x2="83.5" y2="13.2" stroke="#FFFDF6" strokeWidth="1.1" strokeLinecap="round" />
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
