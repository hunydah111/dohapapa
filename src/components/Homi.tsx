// 홈앤나 마스코트 "호미(Homi)" — 얼굴 달린 말랑 클레이풍 집.
// 핵심 인간미: 발그레한 볼터치(#F4B8C1). 표정을 UX 상태에 연결해 쓴다(장식 아님).
//
// 외부 이미지 의존 없이 인라인 SVG (저작권 0). mood 로 표정/손/소품이 바뀐다.

export type HomiMood =
  | "wave" // 첫 화면 — 손 흔들며 방긋
  | "searching" // 분석 중 — 돋보기 들고 두리번 + 땀방울 (애니메이션)
  | "happy" // 결과 좋음 — 활짝 + 반짝이
  | "sheepish" // 결과 빈약 — 머쓱하게 뒤통수 긁기
  | "calm"; // 면책/주의 — 차분

const ROOF = "#FF7A59";
const ROOF_EDGE = "#F2603C";
const BODY = "#FFFFFF";
const BODY_EDGE = "#EAD9C8";
const DOOR = "#FFB088";
const FACE = "#3A322C";
const BLUSH = "#F4B8C1";
const WIN = "#FFE6B0";

export function Homi({
  mood = "wave",
  size = 128,
  className = "",
}: {
  mood?: HomiMood;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      role="img"
      aria-label="홈앤나 마스코트 호미"
      className={`${mood === "searching" ? "homi-search" : "homi-bob"} ${className}`}
    >
      {/* 바닥 그림자 */}
      <ellipse cx="70" cy="128" rx="40" ry="6" fill="#000000" opacity="0.06" />

      {/* 왼손 — sheepish 면 뒤통수(지붕 옆) 긁기, 아니면 몸 옆 */}
      {mood === "sheepish" ? (
        <circle cx="36" cy="40" r="9" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      ) : (
        <circle cx="28" cy="92" r="9" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      )}

      {/* 오른손 — wave/happy 면 위로(흔들기), 그 외 몸 옆 */}
      {mood === "wave" || mood === "happy" ? (
        <circle cx="116" cy="58" r="9" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      ) : (
        <circle cx="112" cy="92" r="9" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="2" />
      )}

      {/* 몸체 (집) */}
      <rect
        x="34"
        y="58"
        width="72"
        height="62"
        rx="16"
        fill={BODY}
        stroke={BODY_EDGE}
        strokeWidth="2"
      />
      {/* 지붕 */}
      <path
        d="M26 62 Q70 18 114 62 Z"
        fill={ROOF}
        stroke={ROOF_EDGE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 굴뚝 */}
      <rect x="92" y="34" width="10" height="18" rx="3" fill={ROOF_EDGE} />

      {/* 볼터치 — 인간미의 90% */}
      <ellipse cx="50" cy="92" rx="7.5" ry="4.5" fill={BLUSH} opacity="0.9" />
      <ellipse cx="90" cy="92" rx="7.5" ry="4.5" fill={BLUSH} opacity="0.9" />

      {/* 눈 */}
      {mood === "happy" ? (
        <>
          {/* ^ ^ 활짝 */}
          <path d="M52 84 q4 -5 8 0" fill="none" stroke={FACE} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M80 84 q4 -5 8 0" fill="none" stroke={FACE} strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : mood === "calm" ? (
        <>
          {/* 반쯤 감은 차분한 눈 */}
          <path d="M52 84 h7" stroke={FACE} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M81 84 h7" stroke={FACE} strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="56" cy="84" r="3.4" fill={FACE} />
          <circle cx="84" cy="84" r="3.4" fill={FACE} />
        </>
      )}

      {/* 입 */}
      {mood === "sheepish" ? (
        <path d="M60 102 q6 4 12 -1 q4 3 8 0" fill="none" stroke={FACE} strokeWidth="2.6" strokeLinecap="round" />
      ) : mood === "calm" ? (
        <path d="M62 102 q8 4 16 0" fill="none" stroke={FACE} strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <path d="M60 100 q10 8 20 0" fill="none" stroke={FACE} strokeWidth="2.8" strokeLinecap="round" />
      )}

      {/* 문(배처럼 보이는 작은 문) */}
      <rect x="62" y="108" width="16" height="12" rx="5" fill={DOOR} />

      {/* mood 소품 */}
      {mood === "searching" && (
        <>
          {/* 돋보기 */}
          <g className="homi-glass">
            <circle cx="108" cy="78" r="11" fill={WIN} stroke={ROOF_EDGE} strokeWidth="3" opacity="0.95" />
            <rect x="116" y="86" width="4" height="13" rx="2" transform="rotate(45 118 92)" fill={ROOF_EDGE} />
          </g>
          {/* 땀방울 */}
          <path d="M40 70 q3 5 0 8 a3 3 0 1 1 0 -8 z" fill="#7FC8E8" />
        </>
      )}
      {mood === "happy" && (
        <>
          {/* 반짝이 */}
          <path d="M118 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFC23C" />
          <path d="M24 64 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill="#FFC23C" />
        </>
      )}
    </svg>
  );
}
