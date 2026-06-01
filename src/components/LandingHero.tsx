import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { HeroNumber } from "@/components/ui/HeroNumber";
import { NeighborhoodChart } from "@/components/NeighborhoodChart";
import { PopularComplexChart } from "@/components/PopularComplexChart";
import { LivePulse } from "@/components/LivePulse";
import { getLivePulse } from "@/lib/livePulse";
import { POLICY_META } from "@/lib/policyLoan";
import type { FriendTag } from "@/lib/friendShare";
import { composeBijiName } from "@/lib/bijiName";
import { pickTierImage } from "@/lib/budgetPercentile";

// 정책(대출·세제) 점검 시점 — "2026-05-25" → "2026.5".
const POLICY_VERIFIED_SHORT: string = (() => {
  const [y, m] = POLICY_META.lastVerified.split("-");
  return `${y}.${Number(m)}`;
})();

// 첫 화면(랜딩) — sober-warm 톤. 정체성(한강·비집고·코랄)은 보존하되 절제.
// 변경 핵심(2026-05-26 디자인 라운드 F2):
//  • CTA 2개 → 1개(plan은 텍스트 링크로 약화) — 당근/토스 패턴
//  • 3티어 칩 → 예시 카드로 통합 (한 fold 요소 수 감축)
//  • 안내 3줄 → 신뢰 1줄로 압축
//  • 페이지 배경에 페일 코랄 wash (Mercury 페이지별 페일 액센트 패턴)

function MiniBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#f3ece4] px-2.5 py-1 text-[11px] font-semibold text-[#6b6157]">
      {children}
    </span>
  );
}

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
            <p className="text-[11px] font-semibold text-coral-700">👬 친구가 너랑 비교하재</p>
            <p className="mt-0.5 truncate text-[15px] font-bold text-[#3a2c1d]" title={friendName}>
              {friendName}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#8a7d6e]">
              너도 30초컷 검색 끝내면 비지 옆에 나란히!
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

      {/* 브랜드 히어로 — 한강에서 서울을 바라보며 '비집고' 들어갈 집을 그리는 비지.
          모바일: 위·좌·우 풀블리드(검은 하늘이 화면 끝까지)
          데스크탑: 페이지 컨테이너에 맞춘 max-w-2xl(672px). 도미네이트 X.
          친구 배너 있을 때만 -mt-10 제거 — 그 자리에 배너가 차지하므로 hangang 끌어올림 X (overlap 방지). */}
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

      {/* 캐치프레이즈 — 시크 위트 3줄. 사용자 핵심 인용 — 머리는 차갑게 / 비집고 / 통장은 뜨겁게 */}
      <p
        className="font-jua mx-auto mt-3 text-[15px] sm:text-[17px]"
        style={{ color: "#8a7d6e" }}
      >
        머리는 차갑게
      </p>
      <h1
        className="font-jua -mt-0.5 text-[3rem] leading-[1] tracking-tight sm:text-[3.6rem]"
        style={{ color: "#e8662f" }}
      >
        비집고
      </h1>
      <p
        className="font-jua mx-auto mt-0 text-[15px] sm:text-[17px]"
        style={{ color: "#8a7d6e" }}
      >
        통장은 뜨겁게
      </p>

      {/* 기능 한 줄 — 무엇을 해주는지 3초 안에 (정량 단정·위트 톤) */}
      <p
        className="mx-auto mt-4 max-w-sm text-[14px] leading-relaxed text-balance sm:text-[15px]"
        style={{ color: "#6b6157" }}
      >
        수도권 아파트단지 1만 곳
        <br />
        내 통장에 맞는 단지만 잡아줌
      </p>

      {/* 라이브 펄스 — "이 사이트 살아있다·매주 갱신된다"를 어느 진입에서도 1초 인지.
          번들 데이터(주간 크론 자동 갱신)에서 매주 바뀌는 값만 회전 노출. DB0·API0. */}
      <LivePulse data={getLivePulse()} />

      {/* 단일 메인 CTA — 한 화면 한 결정 (토스/Mercury 패턴) */}
      <div className="mx-auto mt-7 w-full max-w-sm">
        <Button onClick={onStart} fullWidth>
          30초컷, 내 집 잡기 →
        </Button>
        {/* 비집고 두 축의 다른 한 쪽 — primary CTA 아래 풀너비 세컨더리 버튼(약화하되 또렷이 보이게) */}
        <Link
          href="/plan"
          className="mt-2.5 flex w-full items-center justify-center rounded-2xl border-2 border-coral-300 bg-white px-4 py-3 text-[15px] font-bold transition-colors hover:border-coral-500"
          style={{ color: "#c4521f" }}
        >
          내집마련플랜 D-day 계산해보자 →
        </Link>
        {/* 플랜 CTA 보조 카피 — 무엇을 답해주는지 한 줄(목표집·내 예산·언제) */}
        <p className="mt-1.5 text-center text-[12.5px] font-medium" style={{ color: "#9a8f82" }}>
          목표 아파트, 내 예산으로 언제?
        </p>

        {/* 신뢰 한 줄 (3줄 → 1줄 압축) — 가입·민감정보·데이터·정책 점검 한 호흡 */}
        <p
          className="mx-auto mt-5 max-w-xs text-[11.5px] leading-relaxed"
          style={{ color: "#9a8f82" }}
        >
          가입·로그인 없음 · 민감정보 저장 안 함
          <br />
          국토부 공개 실거래 기반 · 정책 {POLICY_VERIFIED_SHORT} 점검
        </p>
        {/* ── 놀이 섹션 — 데일리 리텐션 훅 묶음. 검색·플랜(1차 결정)과 구분선으로 분리해
            "탭할 게 5개" 산만함 대신 하나의 놀이터로 인지시킴. 카드 3색은 3게임 구분 신호로 유지. */}
        <div className="mt-7">
          <div className="flex items-center gap-2.5">
            <span className="h-px flex-1" style={{ background: "#e6dcc9" }} />
            <span className="text-[11.5px] font-bold tracking-tight" style={{ color: "#9a8f82" }}>🎮 잠깐, 놀고 갈래?</span>
            <span className="h-px flex-1" style={{ background: "#e6dcc9" }} />
          </div>

          {/* 부동산 촉 — 시세 감각 entry */}
          <Link
            href="/play"
            className="mx-auto mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-coral-200 px-4 py-3 shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(100deg,#fff1ea,#ffe1d3)" }}
          >
            <span className="text-[20px]" aria-hidden>🎯</span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10.5px] font-bold" style={{ color: "#d98a5a" }}>
                7문제 시세 감각 테스트 · 동네가 시장 이길까?
              </span>
              <span className="text-[15px] font-extrabold" style={{ color: "#e8662f" }}>
                내 부동산 촉, 몇 단?
              </span>
            </span>
            <span className="ml-auto text-[16px] font-bold" style={{ color: "#e8662f" }} aria-hidden>→</span>
          </Link>
          {/* 부동산 성향 테스트 */}
          <Link
            href="/persona"
            className="mx-auto mt-2 flex w-full items-center gap-2.5 rounded-2xl border border-[#e3d5bd] px-4 py-3 shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(100deg,#fbf4e8,#f5e7cc)" }}
          >
            <span className="text-[20px]" aria-hidden>🦫</span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10.5px] font-bold" style={{ color: "#b08948" }}>
                10문항 성향 테스트 · 영끌? 가성비?
              </span>
              <span className="text-[15px] font-extrabold" style={{ color: "#9a5a1e" }}>
                나는 무슨 부동산 비지?
              </span>
            </span>
            <span className="ml-auto text-[16px] font-bold" style={{ color: "#b08948" }} aria-hidden>→</span>
          </Link>
          {/* 동네 자존심 리그 */}
          <Link
            href="/league"
            className="mx-auto mt-2 flex w-full items-center gap-2.5 rounded-2xl border border-[#cfe0d2] px-4 py-3 shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(100deg,#eef6ef,#dcecdf)" }}
          >
            <span className="text-[20px]" aria-hidden>🚩</span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10.5px] font-bold" style={{ color: "#5f8a6a" }}>
                상승·거래·가성비·꾸준 4부문
              </span>
              <span className="text-[15px] font-extrabold" style={{ color: "#3f7a52" }}>
                우리 동네 이 달 몇 위?
              </span>
            </span>
            <span className="ml-auto text-[16px] font-bold" style={{ color: "#5f8a6a" }} aria-hidden>→</span>
          </Link>

          {/* 놀이터 푸터 — 리텐션 약속 한 줄 + 도감 discovery 흡수 */}
          <p className="mt-3 text-center text-[11px] leading-relaxed" style={{ color: "#b3a99c" }}>
            매일 와도 새 판 · 30초 안에 결과 카톡 공유 ·{" "}
            <Link href="/biji" className="font-semibold underline-offset-2 hover:underline" style={{ color: "#b89a6a" }}>
              비지 11종 도감 →
            </Link>
          </p>
        </div>
      </div>

      {/* 예시 결과 미니카드 — 첫 fold 아래(스크롤 보상). 3티어 칩 통합 위치 */}
      <div className="mx-auto mt-10 w-full max-w-sm">
        <p className="mb-3 text-[12px] font-semibold" style={{ color: "#9a8f82" }}>
          이렇게 잡아줘
        </p>
        <div
          className="relative rounded-3xl bg-white p-5 text-left"
          style={{
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.08)",
          }}
        >
          <span className="absolute right-4 top-4 rounded-full bg-[#f7ead0] px-2.5 py-0.5 text-[10px] font-bold text-[#9a5a1e]">
            예시 화면
          </span>
          {/* 3티어 미리보기 통합 — 카드 안에서 "균형형이 강조됨"으로 자연스럽게 */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className="rounded-full bg-[#f5f3ee] px-2 py-0.5" style={{ color: "#9a8f82" }}>
              안정
            </span>
            <span className="rounded-full bg-coral-600 px-2.5 py-0.5 text-white">
              균형
            </span>
            <span className="rounded-full bg-[#f5f3ee] px-2 py-0.5" style={{ color: "#9a8f82" }}>
              도전
            </span>
            <span className="ml-auto text-[10px] font-medium" style={{ color: "#9a8f82" }}>
              3티어로 정리
            </span>
          </div>
          <h3 className="mt-3 text-[18px] font-bold leading-snug" style={{ color: "#3a322c" }}>
            ○○○아파트{" "}
            <span className="text-[13px] font-medium" style={{ color: "#9a8f82" }}>
              전용 84㎡
            </span>
          </h3>
          {/* 가격 영웅화 — 비집고 시그니처(Jua + 페일 골드, 당근에 없는 황토 톤) */}
          <div className="mt-3">
            <HeroNumber
              value="12억 1,000만"
              caption="추정 현재가 · 국토부 실거래 환산"
              size="hero"
              tone="gold"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <MiniBadge>통근 28분</MiniBadge>
            <MiniBadge>초품아</MiniBadge>
            <MiniBadge>종합 88점</MiniBadge>
          </div>
        </div>
      </div>

      {/* 이번 주 인기 동네·아파트(멜론식) — 데이터 빈약하면 각 컴포넌트가 스스로 숨음 */}
      <NeighborhoodChart />
      <PopularComplexChart />
    </section>
  );
}
