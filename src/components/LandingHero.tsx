import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BijiCard } from "@/components/BijiCard";
import { POLICY_META } from "@/lib/policyLoan";
import { budgetTier } from "@/lib/budgetPercentile";
import { friendDdayLabel, friendReachName, type FriendTag } from "@/lib/friendShare";
// 지면 명조 — DailyFront 와 같은 인스턴스(공유 모듈, 중복 선언 금지).
import { serif } from "@/lib/paperTone";

// 정책(대출·세제) 점검 시점 — "2026-05-25" → "2026.5".
const POLICY_VERIFIED_SHORT: string = (() => {
  const [y, m] = POLICY_META.lastVerified.split("-");
  return `${y}.${Number(m)}`;
})();

// 첫 화면(랜딩) — 2026-06-11 "한 방" 개편: 판정기 포지션.
//  • 훅: 도발(현실 직시) → CTA 한 방. 헷지 톤("재미로") 전부 제거 — 판정기는 사과하지 않는다.
//  • 동선 1개: 통장 판독 CTA. 놀이터·차트·플랜 분기 없음 (plan 진입은 결과카드에서만).
//  • 예시 BijiCard 1장 — "이게 네 판정 카드다" 미리보기 (캡처 단위 인지).

// 예시 카드 풀 — 새로고침마다 랜덤 1장. 색 테마 스펙트럼(budgetTier pct)과
// 사정권 라벨 4단계(입성·사정권·문밖·아득) + D-day 3상태(지금/숫자/아득)를 다 보여줘
// "내 건 뭘까" 호기심을 만든다. verdict는 결과 화면과 동일 톤(자조·건조).
// hero = "{시군구} {사정권 라벨}" — D-day와 일치(≤3,650일 사정권 · 초과 문밖 · 캡 아득).
const EXAMPLES = [
  { pct: 23, sigungu: "마포구", dong: "아현동", area: 84, chip: "🚇 통근 28분", hero: "마포구 사정권",
    dday: { caption: "마포구 중위 입성까지", headline: "D-3,044", verdict: "버틸 만한 싸움이다." } },
  { pct: 1, sigungu: "서초구", dong: "반포동", area: 84, chip: "🌊 한강뷰", hero: "서초구 입성",
    dday: { caption: "서초구 중위 단지", headline: "지금 입성 가능", verdict: "지금 자산 기준, 가능." } },
  { pct: 85, sigungu: "강남구", dong: "대치동", area: 59, chip: "🏫 초품아", hero: "강남구 아득",
    dday: { caption: "강남구 중위 입성까지", headline: "D-아득", verdict: "서울이 나를 거부함 🦫" } },
  { pct: 8, sigungu: "성동구", dong: "옥수동", area: 84, chip: "🚇 통근 19분", hero: "성동구 사정권",
    dday: { caption: "성동구 중위 입성까지", headline: "D-1,204", verdict: "적금 만기 몇 번이면 끝." } },
  { pct: 50, sigungu: "노원구", dong: "상계동", area: 59, chip: "🌳 공원 옆", hero: "노원구 문밖",
    dday: { caption: "노원구 중위 입성까지", headline: "D-5,114", verdict: "길다. 근데 0은 아니다." } },
  { pct: 35, sigungu: "수원시 영통구", dong: "광교동", area: 84, chip: "🚗 자차 31분", hero: "영통구 사정권",
    dday: { caption: "영통구 중위 입성까지", headline: "D-2,190", verdict: "루틴만 지키면 온다." } },
] as const;

export function LandingHero({
  onStart,
  friendTag,
}: {
  onStart: () => void;
  friendTag?: FriendTag | null;
}) {
  const friendName = friendReachName(friendTag);

  // 예시 카드 — 새로고침마다 랜덤. SSR/CSR 일치를 위해 첫 렌더는 0번 고정,
  // 마운트 후 랜덤 스왑(key 변화로 pop-in 재생 — 스왑이 버그가 아니라 연출로 보이게).
  const [exampleIdx, setExampleIdx] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 랜덤은 클라이언트에서만 (hydration 안전)
    setExampleIdx(Math.floor(Math.random() * EXAMPLES.length));
  }, []);
  const ex = EXAMPLES[exampleIdx];

  return (
    <section className="relative px-1 pt-6 pb-4 text-center sm:pt-10">
      {/* 친구 비교 배너 — URL ?f= 친구 등급 있을 때만. 친구가 너랑 비교하자고 보낸 링크임을
          1초 안에 인지시키는 funnel 진입 hook. */}
      {friendTag && friendName && (
        <div
          className="biji-pop-in relative mx-auto mb-5 flex max-w-sm items-center gap-3 rounded-sm border p-3 text-left shadow-sm"
          style={{ borderColor: "#c9c3b4", background: "#fffefb" }}
        >
          <span
            className={`${serif.className} flex h-14 min-w-14 shrink-0 items-center justify-center border px-2 text-[14px] font-bold leading-tight`}
            style={{ color: "#e8571f", borderColor: "#c9c3b4", background: "#fbfaf6" }}
            aria-hidden="true"
          >
            {friendTag.reach?.label ?? "판정"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold" style={{ color: "#5d574c" }}>🦫 친구가 판정 까고 던졌다</p>
            <p className="mt-0.5 truncate text-[15px] font-bold text-[#191713]" title={friendName}>
              {friendName}
              {friendDdayLabel(friendTag) && (
                <span className={`${serif.className} ml-1.5 text-[14px] font-bold tabular-nums`} style={{ color: "#e8571f" }}>
                  {friendDdayLabel(friendTag)}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#5d574c]">
              너도 30초 까보고 옆에 서봐.
            </p>
          </div>
        </div>
      )}

      {/* 히어로 — 신문 헤드라인 위계(2026-07-06 지면 톤 통일): 명조 대형 타이포가 메시지 전부,
          비주얼은 제품(판정서 카드) 그 자체. 배경은 종이(body) 그대로 — wash·오버레이 없음. */}
      <div className={`mx-auto max-w-md ${friendTag ? "pt-2" : "pt-8 sm:pt-12"}`}>
        <h1
          className={`${serif.className} break-keep text-[2.35rem] font-black leading-[1.24] tracking-tight sm:text-[2.9rem]`}
          style={{ color: "#191713" }}
        >
          통장 까면,
          <br />
          동네 나온다.
        </h1>
        <p
          className="mx-auto mt-4 max-w-sm break-keep text-[15px] leading-relaxed sm:text-[16px]"
          style={{ color: "#5d574c" }}
        >
          가능 아파트 · 돈 모자라면 D-며칠 · 놓친 정책대출까지
        </p>
      </div>

      {/* 제품 = 비주얼 — 토스가 앱 스크린샷 놓는 자리에 진짜 판정 카드(D-day 포함).
          새로고침마다 다른 등급·동네·D-day (EXAMPLES 랜덤). */}
      <div className="relative mx-auto mt-9 w-full max-w-[252px]">
        <div className="rotate-[2.5deg] transition-transform duration-300 hover:rotate-0">
          <BijiCard
            key={exampleIdx}
            tier={budgetTier(ex.pct)}
            heroName={ex.hero}
            sigungu={ex.sigungu}
            dongName={ex.dong}
            areaM2={ex.area}
            chips={[ex.chip]}
            dday={ex.dday}
            popIn
          />
        </div>
        {/* 예시 배지 — 지면 코너 라벨(먹 바탕 사각 칩) 문법. */}
        <span className="absolute -right-2 -top-2 bg-[#191713] px-2 py-[3px] text-[10px] font-bold tracking-[0.14em] text-[#fbfaf6] shadow-sm">
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
          style={{ color: "#8a857a" }}
        >
          가입·로그인 없음 · 민감정보 저장 안 함
          <br />
          국토부 공개 실거래 기반 · 정책 {POLICY_VERIFIED_SHORT} 점검
        </p>
      </div>
    </section>
  );
}
