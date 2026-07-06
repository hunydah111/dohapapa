import type { BudgetTier } from "@/lib/budgetPercentile";
import { composeReachName } from "@/lib/bijiName";
import { SITE_DOMAIN } from "@/lib/site";
// 지면 조판 토큰·명조 — DailyFront 와 동일 단일 소스 (중복 선언 금지).
import { serif, PAPER, INK, INK_SOFT, RULE, CORAL } from "@/lib/paperTone";

// 판정서 카드 — 지면(신문) 디자인 언어 재조판 (2026-07-06 홈 하부 톤 통일).
// 파스텔 트레이딩 카드 → "판독 결과지/증서" 문법:
//   종이 흰색 바탕 + 먹 이중 괘선 테두리(바깥 2px + 안쪽 1px) + 라운드 최소화(rounded-sm).
//   등급명("마포구 사정권")은 명조 대형, D-day 숫자는 tabular-nums 초대형.
//   tier 색은 배경이 아니라 상단 밴드 1줄(가는 액센트)로만 잔존 — 등급명 노출 금지 유지.
//   하단 워터마크 = 코랄 플레이트 제호 미니 버전 (스레드 공유 스샷에서 출처 동행).
//
// 박스 비율: 5:7 (포커 카드) 유지. props·공유 로직 불변 — 스킨만 교체.

export interface BijiCardProps {
  /** 색 테마 소스 — budgetPercentile tier. 이름은 안 쓴다(상단 밴드 액센트 전용). */
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
  // 히어로 이름 — 사정권 라벨 합성이 정본. 미지정 호출부는 중립 "판정" 폴백.
  const name = heroName ?? composeReachName(sigungu ?? null, null);
  const meta = [sigungu, dongName, areaM2 ? `전용 ${areaM2}㎡` : null].filter(Boolean).join(" · ");
  // 등급(tier) 액센트 — 상단 밴드 1줄에만 사용. 배경·큰 타이포에는 쓰지 않는다.
  const accentColor = tier.theme.accent;

  return (
    <section
      className={`relative overflow-hidden rounded-sm ${popIn ? "biji-pop-in" : ""} ${className}`}
      style={{
        background: "#fffefb", // 종이 흰색 — 지면(PAPER)보다 살짝 흰 결과지
        color: INK,
        border: `2px solid ${INK}`,
        boxShadow: "0 2px 6px rgba(40,35,25,.14), 0 10px 32px rgba(40,35,25,.16)",
        aspectRatio: "5 / 7",
      }}
      aria-label={`${name} 판정 카드`}
    >
      {/* 안쪽 1px 괘선 — 바깥 2px 먹 테두리와 함께 이중 괘선(증서 문법). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[3px]"
        style={{ border: `1px solid ${INK}` }}
      />
      {/* 등급 액센트 — 상단 밴드 1줄만. 4단계(입성/사정권/문밖/아득) 구분은 이 한 줄이 담당. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[4px] right-[4px] top-[4px] h-[6px]"
        style={{ background: accentColor }}
      />

      <div className="absolute inset-0 flex flex-col justify-between px-5 pb-4 pt-6">
        {/* ── 상단: 판정 라벨 + 등급명 명조 대형 — 판정서의 얼굴 ── */}
        <div className="min-w-0">
          <p
            className="text-[10px] font-bold tracking-[0.24em]"
            style={{ color: INK_SOFT }}
          >
            내 판정
          </p>
          <h3
            className={`${serif.className} mt-1.5 break-keep font-black leading-[1.14] tracking-tight`}
            style={{
              fontSize: name.length >= 8 ? "1.8rem" : name.length >= 6 ? "2.1rem" : "2.5rem",
              color: INK,
            }}
            title={name}
          >
            {name}
          </h3>
          {meta && (
            <p
              className="mt-1.5 truncate border-t border-dotted pt-1.5 text-[11px]"
              style={{ color: INK_SOFT, borderColor: RULE }}
              title={meta}
            >
              {meta}
            </p>
          )}
        </div>

        {/* ── 하단: D-day + 칩 + 코랄 플레이트 워터마크 ── */}
        <div className="min-w-0">
          {/* D-day — 판정서의 심장. 캡션 + tabular-nums 초대형 숫자 + 자조 한 줄. */}
          {dday && (
            <div className="mt-2 min-w-0">
              <p className="truncate text-[10px] font-semibold" style={{ color: INK_SOFT }}>
                {dday.caption}
              </p>
              <p
                className={`${serif.className} font-black leading-none tracking-tight tabular-nums`}
                style={{
                  fontSize: dday.headline.length >= 8 ? "1.55rem" : "2.05rem",
                  color: INK,
                }}
              >
                {dday.headline}
              </p>
              {dday.verdict && (
                <p className="mt-1 truncate text-[10.5px] font-semibold" style={{ color: INK_SOFT }}>
                  {dday.verdict}
                </p>
              )}
            </div>
          )}

          {/* 라이프스타일 칩 — 최대 2개 (D-day 있으면 verdict에 자리 양보, 0개). 각진 괘선 칩. */}
          {chips && chips.length > 0 && !dday && (
            <div className="mt-2 flex flex-wrap gap-1">
              {chips.slice(0, 2).map((chip, i) => (
                <span
                  key={i}
                  className="inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold"
                  style={{ borderColor: RULE, color: INK, background: PAPER }}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* 워터마크 — 코랄 플레이트 제호 미니 버전. 캡쳐 공유 시 출처 동행. */}
          <div
            className="mt-2.5 flex items-center gap-1.5 border-t pt-2"
            style={{ borderColor: RULE }}
          >
            <span
              className={`${serif.className} inline-block px-1.5 py-[2px] text-[10px] font-extrabold leading-none tracking-[0.14em]`}
              style={{ background: CORAL, color: PAPER }}
            >
              비집고
            </span>
            <span className="ml-auto truncate text-[9.5px] font-semibold" style={{ color: INK_SOFT }}>
              {SITE_DOMAIN}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
