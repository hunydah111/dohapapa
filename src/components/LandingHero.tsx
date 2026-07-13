import { Button } from "@/components/ui/Button";
import { POLICY_META } from "@/lib/policyLoan";
import { friendDdayLabel, friendReachName, type FriendTag } from "@/lib/friendShare";
// 지면 명조 — DailyFront 와 같은 인스턴스(공유 모듈, 중복 선언 금지).
import { serif } from "@/lib/paperTone";

// 정책(대출·세제) 점검 시점 — "2026-05-25" → "2026.5".
const POLICY_VERIFIED_SHORT: string = (() => {
  const [y, m] = POLICY_META.lastVerified.split("-");
  return `${y}.${Number(m)}`;
})();

// 첫 화면 하부 — 2026-07-13 사장 "홈 하부 줄여": 대형 슬로건+예시 카드 히어로 폐지.
// 지면(1면)이 본체가 된 뒤로 하부 히어로는 지면 안 코랄 CTA와 같은 걸 두 번 팔았다 —
// 이제 하부는 "판정 진입 스트립"(작은 타이틀 + CTA + 신뢰 1줄)만. 슬로건은 콜로폰·og가
// 담당. 친구 비교 배너(?f= 유입 기능)는 유지. (예시 BijiCard 풀은 폐기 — 결과 화면이 실물.)

export function LandingHero({
  onStart,
  friendTag,
}: {
  onStart: () => void;
  friendTag?: FriendTag | null;
}) {
  const friendName = friendReachName(friendTag);

  return (
    <section className="relative px-1 pt-4 pb-4 text-center">
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

      {/* 판정 진입 스트립 — 작은 타이틀 + 단일 CTA + 신뢰 1줄. 분기 없음. */}
      <div className="mx-auto max-w-md">
        <h2
          className={`${serif.className} break-keep text-[1.35rem] font-black leading-[1.3] tracking-tight`}
          style={{ color: "#191713" }}
        >
          통장 까면, 동네 나온다.
        </h2>
        <p
          className="mx-auto mt-1.5 max-w-sm break-keep text-[12.5px] leading-relaxed"
          style={{ color: "#5d574c" }}
        >
          가능 아파트 · 돈 모자라면 D-며칠 · 놓친 정책대출까지
        </p>
      </div>

      <div className="mx-auto mt-4 w-full max-w-sm">
        <Button onClick={onStart} fullWidth>
          30초, 통장 판독 받기 →
        </Button>

        {/* 신뢰 1줄 — CTA 직하단 고정 (입력 직전 불안 차단). */}
        <p
          className="mx-auto mt-2.5 max-w-xs text-[11.5px] leading-relaxed"
          style={{ color: "#8a857a" }}
        >
          가입·로그인 없음 · 민감정보 저장 안 함 · 국토부 공개 실거래 기반 · 정책{" "}
          {POLICY_VERIFIED_SHORT} 점검
        </p>
      </div>
    </section>
  );
}
