// 홈앤나 마스코트 "호미(Homi)" — '집'으로 확실히 읽히는 미니멀 캐릭터.
// 삼각 지붕 + 굴뚝 + 문 + 크림색 벽(=얼굴 아님). 얼굴은 작게: 점 두 개 눈 + 작은 입
// + 발그레한 볼(#F4B8C1). 절제된 표정(춘식이·브라운 톤). 인라인 SVG(저작권 0).

export type HomiMood =
  | "wave" // 첫 화면 — 살짝 든 손 + 방긋
  | "searching" // 분석 중 — 작은 돋보기 + 가벼운 두리번
  | "happy" // 결과 좋음 — 눈 ^ ^ + 작은 반짝
  | "sheepish" // 결과 빈약 — 살짝 머쓱
  | "calm"; // 면책/주의 — 차분

const ROOF = "#FF7A59"; // 주황 지붕
const ROOF_EDGE = "#EC5E3B";
const WALL = "#FFF6EC"; // 크림색 벽
const WALL_EDGE = "#E7D2B6";
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
      <ellipse cx="60" cy="115" rx="32" ry="5" fill="#000000" opacity="0.06" />

      {/* 손 흔들기 (wave/happy) */}
      {(mood === "wave" || mood === "happy") && (
        <circle cx="99" cy="60" r="7" fill={ROOF} />
      )}

      {/* 굴뚝 */}
      <rect x="80" y="26" width="11" height="22" rx="2.5" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />

      {/* 벽 (크림색, 살짝만 둥근 사각) */}
      <rect x="26" y="54" width="68" height="58" rx="7" fill={WALL} stroke={WALL_EDGE} strokeWidth="2" />

      {/* 삼각 지붕 (주황) — 양옆으로 처마 살짝 */}
      <path
        d="M60 16 L107 56 L13 56 Z"
        fill={ROOF}
        stroke={ROOF_EDGE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 문 (집임을 확실히) */}
      <rect x="50" y="86" width="20" height="26" rx="9" fill={DOOR} />
      <circle cx="65" cy="100" r="1.8" fill={ROOF_EDGE} />

      {/* 볼터치 */}
      <ellipse cx="39" cy="78" rx="6" ry="3.6" fill={BLUSH} />
      <ellipse cx="81" cy="78" rx="6" ry="3.6" fill={BLUSH} />

      {/* 눈 — 점 두 개 (happy 만 ^ ^) */}
      {mood === "happy" ? (
        <>
          <path d="M41 70 q5 -5 10 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M69 70 q5 -5 10 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="46" cy="70" r="4.6" fill={INK} />
          <circle cx="74" cy="70" r="4.6" fill={INK} />
        </>
      )}

      {/* 입 — 작게, 절제 */}
      {mood === "searching" ? (
        <circle cx="60" cy="80" r="2.5" fill={INK} />
      ) : mood === "sheepish" ? (
        <path d="M55 80 q3 3 5 0 q2 -2 5 1" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "calm" ? (
        <path d="M56 80 h8" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path d="M55 79 q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.7" strokeLinecap="round" />
      )}

      {/* 돋보기 (searching) */}
      {mood === "searching" && (
        <g className="homi-glass">
          <circle cx="93" cy="98" r="9" fill={GLASS} stroke={INK} strokeWidth="3" />
          <line x1="100" y1="105" x2="107" y2="112" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {/* 반짝 (happy) */}
      {mood === "happy" && (
        <path d="M103 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFC23C" />
      )}
    </svg>
  );
}
