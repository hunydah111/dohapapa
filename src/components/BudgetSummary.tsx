import type { BudgetEstimate } from "@/types/recommendation";

function formatEok(krw: number): string {
  const eok = krw / 1_0000_0000;
  return `${eok.toFixed(1)}억`;
}

export function BudgetSummary({ budget }: { budget: BudgetEstimate }) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm p-6 flex flex-col gap-5">
      <h2 className="text-base font-semibold text-zinc-700">예산 분석</h2>

      {/* 핵심 계산식 */}
      <div className="flex flex-col gap-2 text-sm text-zinc-700">
        <div className="flex justify-between">
          <span>시드머니</span>
          <span className="tabular-nums font-medium">
            {formatEok(budget.seedMoneyKrw)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>추정 대출</span>
          <span className="tabular-nums font-medium">
            + {formatEok(budget.loanEstimateKrw)}
          </span>
        </div>
        <div className="border-t border-zinc-200 pt-2 flex justify-between">
          <span>총예산</span>
          <span className="tabular-nums font-medium">
            = {formatEok(budget.grossBudgetKrw)}
          </span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>취득·부대비용</span>
          <span className="tabular-nums">
            − {formatEok(budget.acquisitionCostsKrw)}
          </span>
        </div>
      </div>

      {/* 실 매입가능 상한 — 가장 두드러지게 */}
      <div className="rounded-xl bg-zinc-50 ring-1 ring-zinc-200 px-5 py-4 flex flex-col gap-1">
        <p className="text-xs text-zinc-500">실 매입가능 상한 (추정치입니다)</p>
        <p className="text-3xl font-extrabold tabular-nums text-zinc-900">
          {formatEok(budget.netPurchasePowerKrw)}
        </p>
      </div>

      {/* 계산 가정 */}
      {budget.assumptions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 mb-1">계산 가정</p>
          <ul className="list-disc list-inside space-y-0.5">
            {budget.assumptions.map((a, i) => (
              <li key={i} className="text-xs text-zinc-400 leading-snug">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 경고 */}
      {budget.warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 flex flex-col gap-1">
          <p className="text-xs font-semibold text-amber-700 mb-1">유의사항</p>
          <ul className="list-disc list-inside space-y-0.5">
            {budget.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700 leading-snug">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
