"use client";

import { useState } from "react";
import type { BudgetEstimate } from "@/types/recommendation";
import { formatManwon, formatKrwHuman } from "@/lib/format";

// 월부담 블록 — '은행 최대(DSR) vs 안전선(월 30%)' 토글(#6) + 신호등(#2) + 금리 스트레스(#3).
// 토글은 budget.ts 에서 미리 계산된 두 시나리오를 전환만 하므로 재검색 없이 즉시 반영.
export function MonthlyBurden({ budget }: { budget: BudgetEstimate }) {
  const safe = budget.safeLine;
  // 은행 최대가 이미 안전선 이내(=대출 차이 거의 없음)면 토글 의미 없으니 숨긴다.
  const hasSafeToggle =
    !!safe && safe.loanEstimateKrw < budget.loanEstimateKrw * 0.97;
  const [mode, setMode] = useState<"max" | "safe">("max");
  const useSafe = hasSafeToggle && mode === "safe" && !!safe;

  const monthly = useSafe ? safe!.monthlyPaymentKrw : budget.monthlyPaymentKrw;
  const ratio = useSafe ? safe!.paymentToIncomeRatio : budget.paymentToIncomeRatio;
  const stress = useSafe ? safe!.stressTest : budget.stressTest;

  return (
    <div className="mb-5 rounded-2xl border border-[#c9c3b4] bg-[#f4f2ea]/70 px-5 py-4">
      {hasSafeToggle && safe && (
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/60 p-1">
          {(["max", "safe"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                mode === m
                  ? "bg-coral-600 text-white shadow-sm"
                  : "text-[#8a857a]"
              }`}
            >
              {m === "max" ? "은행 최대" : "안전선 (월 30%)"}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "#5d574c" }}>
          추정 월 원리금 상환액
        </span>
        <span
          className="text-lg font-bold tabular-nums"
          style={{ color: "#e8571f" }}
        >
          약 {formatManwon(monthly)}
        </span>
      </div>

      {useSafe && safe && (
        <p
          className="mt-1.5 text-[11px] leading-relaxed"
          style={{ color: "#8a857a" }}
        >
          안전선 — 대출을{" "}
          <span className="font-semibold" style={{ color: "#5d574c" }}>
            {formatKrwHuman(safe.loanEstimateKrw)}
          </span>
          로 줄여 월 상환을 소득의 ~30% 이내로. 이 기준 실매입 상한 약{" "}
          <span className="font-semibold" style={{ color: "#5d574c" }}>
            {formatKrwHuman(safe.netPurchasePowerKrw)}
          </span>
          .
        </p>
      )}

      {ratio !== undefined && <BurdenSignal ratio={ratio} />}

      {stress && stress.length > 0 && (
        <StressRows base={monthly} stress={stress} />
      )}
    </div>
  );
}

// 월부담 신호등 색·문구 — 단정(과부담) 금지, 30% 참고선 기준 부드럽게.
function burdenTone(pct: number): { color: string; label: string } {
  if (pct <= 25) return { color: "#2BB3A0", label: "여유 있는 편이에요" };
  if (pct <= 35) return { color: "#E8A33D", label: "참고선 부근이에요" };
  return { color: "#d9803a", label: "참고선 위 — 여유를 점검해보세요" };
}

function BurdenSignal({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const tone = burdenTone(pct);
  return (
    <div className="mt-3 border-t border-coral-100/70 pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs" style={{ color: "#5d574c" }}>
          월소득 대비 원리금
        </span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: tone.color }}
        >
          약 {pct}%
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: "#e5e2d6" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, background: tone.color }}
        />
      </div>
      <p
        className="mt-1.5 text-[11px] leading-relaxed"
        style={{ color: "#8a857a" }}
      >
        일반적으로 <span className="font-semibold">30% 안팎</span>을 부담 경계로
        참고만 (공식 단일 기준 아님). {tone.label}.
      </p>
    </div>
  );
}

function StressRows({
  base,
  stress,
}: {
  base: number;
  stress: { deltaRatePct: number; monthlyPaymentKrw: number }[];
}) {
  return (
    <div className="mt-3 border-t border-coral-100/70 pt-3">
      <p className="mb-1.5 text-xs font-medium" style={{ color: "#5d574c" }}>
        금리가 더 오르면 (추정 월 원리금)
      </p>
      <div className="flex flex-col gap-1">
        {stress.map((s) => {
          const delta = s.monthlyPaymentKrw - base;
          return (
            <div
              key={s.deltaRatePct}
              className="flex items-baseline justify-between text-xs"
            >
              <span style={{ color: "#8a857a" }}>금리 +{s.deltaRatePct}%p</span>
              <span className="tabular-nums" style={{ color: "#191713" }}>
                약 {formatManwon(s.monthlyPaymentKrw)}
                {delta > 0 && (
                  <span
                    className="ml-1 font-semibold"
                    style={{ color: "#d9803a" }}
                  >
                    (+{formatManwon(delta)})
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
