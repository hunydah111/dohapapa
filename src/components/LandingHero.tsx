import { Button } from "@/components/ui/Button";
import { BijiCard } from "@/components/BijiCard";
import { POLICY_META } from "@/lib/policyLoan";
import { budgetTier } from "@/lib/budgetPercentile";
import { friendDdayLabel, type FriendTag } from "@/lib/friendShare";
import { composeBijiName } from "@/lib/bijiName";
import { pickTierImage } from "@/lib/budgetPercentile";

// 정책(대출·세제) 점검 시점 — "2026-05-25" → "2026.5".
const POLICY_VERIFIED_SHORT: string = (() => {
  const [y, m] = POLICY_META.lastVerified.split("-");
  return `${y}.${Number(m)}`;
})();

// 첫 화면(랜딩) — 2026-06-11 "한 방" 개편: 판정기 포지션.
//  • 훅: 도발(현실 직시) → CTA 한 방. 헷지 톤("재미로") 전부 제거 — 판정기는 사과하지 않는다.
//  • 동선 1개: 통장 판독 CTA. 놀이터·차트·플랜 분기 없음 (plan 진입은 결과카드에서만).
//  • 예시 BijiCard 1장 — "이게 네 판정 카드다" 미리보기 (캡처 단위 인지).

// 예시 카드 — 상위 23%(비버) × 마포구. 실존 등급 시스템 그대로 사용해 결과와 톤 일치.
const EXAMPLE_TIER = budgetTier(23);

export function LandingHero({
  onStart,
  friendTag,
}: {
  onStart: () => void;
  friendTag?: FriendTag | null;
}) {
  const friendName = friendTag ? composeBijiName(friendTag.sigungu, friendTag.tier) : null;
  const friendImage = friendTag
    ? pickTierImage(friendTag.tier.image, friendTag.sigungu)
    : null;

  return (
    <section className="relative px-1 pt-6 pb-4 text-center sm:pt-10">
      {/* 친구 비교 배너 — URL ?f= 친구 비지 있을 때만. 친구가 너랑 비교하자고 보낸 링크임을
          1초 안에 인지시키는 funnel 진입 hook. */}
      {friendTag && friendName && friendImage && (
        <div className="biji-pop-in relative mx-auto mb-5 flex max-w-sm items-center gap-3 rounded-2xl border-2 border-coral-300 bg-coral-50 p-3 text-left shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${friendImage}?v=4`}
            alt={`친구의 비지: ${friendName}`}
            className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain ring-1 ring-coral-200"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-coral-700">🦫 친구가 판정 까고 던졌다</p>
            <p className="mt-0.5 truncate text-[15px] font-bold text-[#3a2c1d]" title={friendName}>
              {friendName}
              {friendDdayLabel(friendTag) && (
                <span className="ml-1.5 font-jua text-[14px]" style={{ color: "#e8662f" }}>
                  {friendDdayLabel(friendTag)}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#8a7d6e]">
              너도 30초 까보고 옆에 서봐.
            </p>
          </div>
        </div>
      )}

      {/* 페이지별 페일 액센트 — 한강 위쪽으로 부드러운 코랄 wash (Mercury 패턴) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-screen -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 0%, var(--accent-home) 0%, transparent 70%)",
        }}
      />

      {/* 히어로 — 토스/당근 패턴: 큰 타이포가 메시지 전부, 비주얼은 제품(판정 카드) 그 자체.
          일러스트·오버레이·슬로건 배너 없음. 타이포(잉크 단색) → 제품 카드 → CTA 순. */}
      <div className={`mx-auto max-w-md ${friendTag ? "pt-2" : "pt-8 sm:pt-12"}`}>
        <h1
          className="font-jua break-keep text-[2.5rem] leading-[1.18] tracking-tight sm:text-[3.1rem]"
          style={{ color: "#2c2118" }}
        >
          통장 까면,
          <br />
          동네 나온다.
        </h1>
        <p
          className="mx-auto mt-4 max-w-sm break-keep text-[15px] leading-relaxed sm:text-[16px]"
          style={{ color: "#8a7d6e" }}
        >
          닿는 단지 · 모자라면 D-며칠 · 놓친 나라 돈까지
        </p>
      </div>

      {/* 제품 = 비주얼 — 토스가 앱 스크린샷 놓는 자리에 진짜 판정 카드(D-day 포함). */}
      <div className="relative mx-auto mt-9 w-full max-w-[252px]">
        <div className="rotate-[2.5deg] transition-transform duration-300 hover:rotate-0">
          <BijiCard
            tier={EXAMPLE_TIER}
            sigungu="마포구"
            dongName="아현동"
            areaM2={84}
            chips={["🚇 통근 28분"]}
            dday={{
              caption: "마포구 중위 입성까지",
              headline: "D-3,044",
              verdict: "버틸 만한 싸움이다.",
            }}
            popIn={false}
          />
        </div>
        <span className="absolute -right-2 -top-2 rounded-full bg-[#3a2c1d] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
          예시
        </span>
      </div>

      {/* 단일 CTA — 한 화면 한 결정. 분기 없음. */}
      <div className="mx-auto mt-9 w-full max-w-sm">
        <Button onClick={onStart} fullWidth>
          30초, 통장 판독 받기 →
        </Button>

        {/* 신뢰 1줄 — CTA 직하단 고정 (입력 직전 불안 차단). */}
        <p
          className="mx-auto mt-3 max-w-xs text-[11.5px] leading-relaxed"
          style={{ color: "#9a8f82" }}
        >
          가입·로그인 없음 · 민감정보 저장 안 함
          <br />
          국토부 공개 실거래 기반 · 정책 {POLICY_VERIFIED_SHORT} 점검
        </p>
      </div>
    </section>
  );
}
