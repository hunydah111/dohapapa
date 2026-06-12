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

      {/* 브랜드 히어로 — 한강에서 서울을 바라보며 '비집고' 들어갈 집을 그리는 비지. */}
      <div className={`biji-pop-in relative left-1/2 mb-5 w-screen -translate-x-1/2 overflow-hidden rounded-b-[26px] shadow-md sm:left-auto sm:mx-auto sm:mt-0 sm:w-full sm:max-w-2xl sm:translate-x-0 sm:rounded-3xl sm:ring-1 sm:ring-black/5 ${friendTag ? "" : "-mt-10"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/biji/biji-hangang.png"
          alt="한강에서 서울 도심을 바라보는 비지 — 비집고 들어갈 집을 그리며"
          width={1200}
          height={731}
          className="block w-full"
          draggable={false}
        />
      </div>

      {/* 훅 — 현실 직시 한 방. 매물 구경(타사)과 "내 것이 되는가"(비집고)의 단절을 찌른다. */}
      <h1
        className="font-jua mx-auto mt-2 max-w-md break-keep text-[1.85rem] leading-[1.22] tracking-tight text-balance sm:text-[2.3rem]"
        style={{ color: "#3a2c1d" }}
      >
        호갱노노 백날 봐도,
        <br />
        <span style={{ color: "#e8662f" }}>그 집은 네 집이 아니야.</span>
      </h1>

      {/* 서브 — 판독이 까주는 것 3가지: 닿는 단지 · D-day · 정책대출 자격. */}
      <p
        className="mx-auto mt-4 max-w-sm break-keep text-[14.5px] leading-relaxed text-balance sm:text-[15.5px]"
        style={{ color: "#6b6157" }}
      >
        네 통장이 <b style={{ color: "#3a2c1d" }}>진짜 닿는 단지</b> — 안 닿으면{" "}
        <b style={{ color: "#3a2c1d" }}>며칠 모자란지(D-day)</b>, 놓친{" "}
        <b style={{ color: "#3a2c1d" }}>정책대출 자격</b>까지.
      </p>

      {/* 단일 CTA — 한 화면 한 결정. 분기 없음. */}
      <div className="mx-auto mt-6 w-full max-w-sm">
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

      {/* 예시 판정 카드 — "끝나면 이 카드가 나온다" 미리보기. 캡처 단위를 첫 화면에서 학습시킴. */}
      <div className="mx-auto mt-10 w-full max-w-[240px]">
        <p className="mb-3 text-[12px] font-semibold" style={{ color: "#9a8f82" }}>
          판독 끝나면 나오는 카드 <span className="rounded-full bg-[#f7ead0] px-2 py-0.5 text-[10px] font-bold text-[#9a5a1e]">예시</span>
        </p>
        <BijiCard
          tier={EXAMPLE_TIER}
          sigungu="마포구"
          dongName="아현동"
          areaM2={84}
          chips={["🚇 통근 28분", "🏫 초품아"]}
          popIn={false}
        />
      </div>
    </section>
  );
}
