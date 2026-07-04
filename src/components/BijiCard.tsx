import type { BudgetTier, BijiOrnament } from "@/lib/budgetPercentile";
import { composeReachName } from "@/lib/bijiName";
import { SITE_DOMAIN } from "@/lib/site";

// 판정 트레이딩 카드 — 숫자·표·타이포 중심 (2026-07 캐릭터 강등: 그림→말투).
// 2026-07-04 비버 완전 퇴장: 히어로 타이포는 사정권 라벨("마포구 사정권").
// tier는 배경/장식 색 테마로만 잔존(budgetPercentile.ts가 진실) — 등급명 노출 금지.
//
// 박스 비율: 5:7 (포커 카드). 상단 = 무드 영역(히어로 이름 초대형), 하단 = D-day·칩·워터마크.
// 이미지가 없어도 타이포 위계(히어로 이름 > D-day 숫자)로 카드 밀도를 채운다.

// 카드 코너에 등급별 미세 장식(추상 SVG — 별·하트·점). pointer-events none.
function Ornament({ kind, accent }: { kind: BijiOrnament; accent: string }) {
  const common = "pointer-events-none absolute inset-0 h-full w-full";
  switch (kind) {
    case "gold-stars":
      // queen — 무대 스포트라이트 큰 별 + 작은 반짝
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <path d="M44 30 l4 9 l9 2 l-6.5 6.5 l2 9 l-8.5 -4.5 l-8.5 4.5 l2 -9 l-6.5 -6.5 l9 -2 z" opacity="0.85" />
            <path d="M286 24 l3 7 l7 1.5 l-5 5 l1.5 7 l-6.5 -3.5 l-6.5 3.5 l1.5 -7 l-5 -5 l7 -1.5 z" opacity="0.8" />
            <circle cx="266" cy="92" r="2.4" opacity="0.7" />
            <circle cx="58" cy="120" r="2" opacity="0.55" />
            <circle cx="298" cy="170" r="1.8" opacity="0.6" />
          </g>
        </svg>
      );
    case "stars":
      // (legacy/예비) — 골드 별 흩뿌림
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <path d="M48 38 l2.5 5.5 l6 1 l-4.5 4 l1 6 l-5 -2.5 l-5 2.5 l1 -6 l-4.5 -4 l6 -1 z" opacity="0.7" />
            <path d="M276 32 l2 4.5 l5 0.8 l-3.5 3.2 l0.8 5 l-4.3 -2.2 l-4.3 2.2 l0.8 -5 l-3.5 -3.2 l5 -0.8 z" opacity="0.65" />
            <circle cx="290" cy="110" r="1.8" opacity="0.55" />
            <circle cx="42" cy="155" r="2" opacity="0.5" />
          </g>
        </svg>
      );
    case "flames":
      // rain — noir 점 (따뜻한 골드 점)
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <circle cx="40" cy="40" r="3" opacity="0.5" />
            <circle cx="290" cy="32" r="2.5" opacity="0.55" />
            <circle cx="60" cy="170" r="2" opacity="0.45" />
            <circle cx="280" cy="180" r="3" opacity="0.5" />
            <circle cx="306" cy="100" r="2" opacity="0.4" />
          </g>
        </svg>
      );
    case "notes":
      // (legacy/예비) — 음표
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent} opacity="0.85">
            <g transform="translate(34 28)">
              <ellipse cx="0" cy="14" rx="7" ry="5.5" transform="rotate(-18 0 14)" />
              <rect x="5.5" y="-18" width="2.5" height="30" />
              <path d="M8 -18 q14 4 10 18" stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
            <g transform="translate(282 50)" opacity="0.75">
              <ellipse cx="0" cy="10" rx="5" ry="4" transform="rotate(-18 0 10)" />
              <rect x="3.5" y="-14" width="2" height="24" />
              <path d="M5.5 -14 q10 2 8 12" stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
            <circle cx="64" cy="170" r="2.5" opacity="0.5" />
            <circle cx="296" cy="180" r="2.5" opacity="0.5" />
          </g>
        </svg>
      );
    case "confetti":
      // gukmin — 따뜻한 점 흩뿌림
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent}>
            <circle cx="42" cy="46" r="2.5" opacity="0.45" />
            <circle cx="286" cy="38" r="2" opacity="0.5" />
            <circle cx="60" cy="180" r="2" opacity="0.4" />
            <circle cx="288" cy="172" r="2.5" opacity="0.45" />
            <rect x="262" y="100" width="4" height="4" transform="rotate(20 264 102)" opacity="0.4" />
            <rect x="48" y="118" width="4" height="4" transform="rotate(-15 50 120)" opacity="0.4" />
          </g>
        </svg>
      );
    case "hearts":
      // bieber/baby — 작은 하트
      return (
        <svg aria-hidden="true" viewBox="0 0 320 224" preserveAspectRatio="xMidYMid slice" className={common}>
          <g fill={accent} opacity="0.55">
            <path d="M48 38 c-2 -3 -7 -3 -7 1 c0 4 7 8 7 8 s7 -4 7 -8 c0 -4 -5 -4 -7 -1 z" />
            <path d="M284 30 c-1.6 -2.4 -5.6 -2.4 -5.6 0.8 c0 3.2 5.6 6.4 5.6 6.4 s5.6 -3.2 5.6 -6.4 c0 -3.2 -4 -3.2 -5.6 -0.8 z" opacity="0.5" />
            <path d="M62 165 c-1.4 -2.1 -4.9 -2.1 -4.9 0.7 c0 2.8 4.9 5.6 4.9 5.6 s4.9 -2.8 4.9 -5.6 c0 -2.8 -3.5 -2.8 -4.9 -0.7 z" opacity="0.5" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}

export interface BijiCardProps {
  /** 색 테마 소스 — budgetPercentile tier. 이름은 안 쓴다(테마 전용). */
  tier: BudgetTier;
  /**
   * 카드 히어로 타이포 — "{시군구} {사정권 라벨}" (예 "마포구 사정권").
   * 미지정 시 sigungu 기반 중립 폴백("마포구 판정").
   */
  heroName?: string;
  /** 시군구 — 히어로 이름 폴백·메타 표시용. */
  sigungu?: string | null;
  /** 동(읍·면) 이름. 표시용 — 없으면 시군구만. */
  dongName?: string | null;
  /** 평형(전용 ㎡). */
  areaM2?: number | null;
  /** 라이프스타일 칩(최대 3개 권장) — 예: ["🏫 초품아", "🌊 한강변", "🚗 자차 25분"]. */
  chips?: string[];
  /**
   * D-day 메인 숫자 — "한 방" 카드의 심장. headline 예: "D-2,847" / "지금 입성 가능" / "D-아득".
   * caption 예: "마포구 중위 입성까지". verdict = 자조 한 줄("서울이 나를 거부함 🦫").
   */
  dday?: { headline: string; caption: string; verdict?: string | null };
  /** 카드 폭을 부모 max-w로 끌어쓰기 — 기본 max-w-sm. */
  className?: string;
  /** 첫 등장 모션. 기본 true. */
  popIn?: boolean;
}

// 등급별 본문 텍스트/카피 색. 동적 hex는 인라인 style로(여기서는 light/dark 두 리터럴만).
function textColors(tier: BudgetTier) {
  const light = tier.theme.textTone === "light";
  return {
    primary: light ? "text-white" : "text-[#3a2c1d]",
    secondary: light ? "text-white/85" : "text-[#6e5b46]",
    muted: light ? "text-white/65" : "text-[#9c8a72]",
    divider: light ? "border-white/20" : "border-[rgba(70,48,24,0.12)]",
    chipBg: light ? "bg-white/15 text-white" : "bg-[rgba(70,48,24,0.08)] text-[#3a2c1d]",
  };
}

export function BijiCard({
  tier,
  heroName,
  sigungu,
  dongName,
  areaM2,
  chips,
  dday,
  className = "",
  popIn = true,
}: BijiCardProps) {
  const colors = textColors(tier);
  // 히어로 이름 — 사정권 라벨 합성이 정본. 미지정 호출부는 중립 "판정" 폴백.
  const name = heroName ?? composeReachName(sigungu ?? null, null);
  const meta = [sigungu, dongName, areaM2 ? `전용 ${areaM2}㎡` : null].filter(Boolean).join(" · ");
  const accentColor = tier.theme.nameColor ?? tier.theme.accent;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl shadow-card ${popIn ? "biji-pop-in" : ""} ${className}`}
      style={{ background: tier.theme.cardBg, aspectRatio: "5 / 7" }}
      aria-label={`${name} 판정 카드`}
    >
      {/* 코너 글로우 — 등급별 무드. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: tier.theme.glow }} />
      {/* 등급별 미세 장식 — 별·하트·점 (추상, 그림 아님). */}
      <Ornament kind={tier.theme.ornament} accent={tier.theme.accent} />

      <div className="absolute inset-0 flex flex-col justify-between px-5 pb-4 pt-5">
        {/* ── 상단: 히어로 이름("{시군구} {사정권 라벨}")이 카드의 얼굴 — 타이포 초대형 ── */}
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${colors.muted}`}>
            내 판정
          </p>
          <h3
            className="font-jua mt-1 break-keep leading-[1.06] tracking-tight"
            style={{
              fontSize: name.length >= 8 ? "2.1rem" : name.length >= 6 ? "2.45rem" : "2.9rem",
              color: accentColor,
            }}
            title={name}
          >
            {name}
          </h3>
          {meta && (
            <p className={`mt-1 text-[11.5px] ${colors.muted} truncate`} title={meta}>
              {meta}
            </p>
          )}
        </div>

        {/* ── 하단: D-day + 칩 + 워터마크 ── */}
        <div className="min-w-0">
          {/* D-day — 카드의 심장. 캡션(어디까지) + 메인 숫자(Jua 영웅화) + 자조 한 줄. 캡처 단위 완성. */}
          {dday && (
            <div className="mt-2 min-w-0">
              <p className={`text-[10px] font-semibold ${colors.muted} truncate`}>
                {dday.caption}
              </p>
              <p
                className="font-jua leading-none tracking-tight"
                style={{
                  fontSize: dday.headline.length >= 8 ? "1.5rem" : "1.9rem",
                  color: accentColor,
                }}
              >
                {dday.headline}
              </p>
              {dday.verdict && (
                <p className={`mt-1 text-[10.5px] font-semibold ${colors.secondary} truncate`}>
                  {dday.verdict}
                </p>
              )}
            </div>
          )}

          {/* 라이프스타일 칩 — 최대 2개 (D-day 있으면 verdict에 자리 양보, 0개). */}
          {chips && chips.length > 0 && !dday && (
            <div className="mt-2 flex flex-wrap gap-1">
              {chips.slice(0, 2).map((chip, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.chipBg}`}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* 워터마크 — 캡쳐 공유 시 출처 동행. */}
          <div className={`mt-2.5 flex items-center gap-1 border-t ${colors.divider} pt-1.5`}>
            <span className={`text-[10.5px] font-extrabold tracking-tight ${colors.primary}`}>비집고</span>
            <span className={`ml-auto text-[9.5px] font-semibold ${colors.muted} truncate`}>{SITE_DOMAIN}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
