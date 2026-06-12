"use client";

// 정책대출 톨게이트 — 비집고의 "돈 구석" Phase 0.
//
// 한 방 스펙 5단계: 판정 직후 "정책대출 자격 가능성 → 내 한도 확인" 단일 CTA.
// 지금은 기금e든든(주택도시기금 공식) 링크 + policy_cta_click 계측만 — 사용자 과금 0, 제휴 0.
// 점화(제휴 href 교체)는 README의 게이트(주간 카드 수·CTR·금소법 워딩 법률검토) 통과 후에만.
//
// ⚠️ 컴플라이언스 (워딩 고정 — 수정 시 체크리스트 필수):
//  - "자격 가능성 안내"까지만. 추천·중개·보장·확실 표현 금지.
//  - 최종 자격·한도·금리는 심사기관 판단임을 명시.
//  - 특정 은행 상품 연결 금지 (공식 기금 포털만).

import type { PolicyLoanMatch } from "@/types/recommendation";
import { formatKrwHuman } from "@/lib/format";
import { track } from "@/lib/track";

/** 주택도시기금 기금e든든 (공식 포털) — 자산심사·대출신청 입구. */
const FUND_URL = "https://enhuf.molit.go.kr";

export function PolicyLoanCta({
  matches,
  context,
  tone = "plain",
}: {
  /** budget.policyLoanMatches — eligible만 골라 최대 2개 노출. */
  matches: PolicyLoanMatch[] | undefined | null;
  /** 계측용 위치 라벨 — "result" | "plan". */
  context: "result" | "plan";
  /** hero = 코랄 카드 위(흰 글씨), plain = 일반 배경. */
  tone?: "hero" | "plain";
}) {
  const eligible = (matches ?? []).filter((m) => m.eligible);
  if (eligible.length === 0) return null;
  // 한도 큰 순 최대 2개 — 선택지 과잉 차단.
  const top = [...eligible]
    .sort((a, b) => (b.loanLimitKrw ?? 0) - (a.loanLimitKrw ?? 0))
    .slice(0, 2);

  const hero = tone === "hero";
  const box = hero
    ? "rounded-2xl bg-white/15 backdrop-blur-sm"
    : "rounded-2xl border border-[#e3d5bd] bg-[#fbf6ec]";
  const heading = hero ? "text-amber-100" : "text-[#9a5a1e]";
  const body = hero ? "text-white" : "text-[#3a2c1d]";
  const sub = hero ? "text-white/70" : "text-[#9c8a72]";

  return (
    <div className={`${box} px-4 py-3.5 text-left`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${heading}`}>
        💰 놓치고 있을 수 있는 나라 돈
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {top.map((m) => (
          <li key={m.productName} className={`text-[13.5px] font-bold leading-snug ${body}`}>
            {m.productName} 자격 가능성
            {m.loanLimitKrw ? (
              <span className={`ml-1 font-semibold ${sub}`}>
                — 한도 최대 {formatKrwHuman(m.loanLimitKrw)}
                {m.rateMin != null && m.rateMax != null
                  ? ` · 연 ${m.rateMin}~${m.rateMax}%`
                  : ""}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <a
        href={FUND_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          track("policy_cta_click", {
            context,
            product: top[0].productName,
          })
        }
        className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 ${
          hero
            ? "bg-amber-200 text-coral-800 focus:ring-white/70"
            : "bg-coral-600 text-white focus:ring-coral-400"
        }`}
      >
        기금e든든에서 내 한도 확인 →
      </a>
      <p className={`mt-2 text-[10.5px] leading-relaxed ${sub}`}>
        자격 ‘가능성’ 안내이며, 최종 자격·한도·금리는 주택도시기금·심사기관 판단입니다.
        특정 상품 권유가 아닙니다.
      </p>
    </div>
  );
}
