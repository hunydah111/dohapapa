import type { BudgetEstimate } from "@/types/recommendation";
import { formatKrwHuman } from "@/lib/format";

/**
 * 폼 입력 도중 보여주는 예산 미리보기 (Step 4 인라인).
 *
 * 결과 화면의 BudgetSummary 와 같은 estimateBudget 결과를 쓰되, 항목별 상세·경고
 * 전체를 펼치지 않고 핵심 숫자(대출 가능액·총예산·실매수가)만 압축해 보여준다.
 */
export function BudgetPreview({ budget }: { budget: BudgetEstimate }) {
  const eligible = budget.policyLoanMatches.filter((m) => m.eligible);
  const negative = budget.netPurchasePowerKrw <= 0;

  return (
    <div className="rounded-3xl border border-[#ecd9b3] bg-[#fdf6e7]/70 p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-[#3a322c]">
          예상 예산 미리보기
        </p>
        <span className="text-[11px] text-[#9a8f82]">입력에 따라 자동 갱신</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <PreviewRow
          label={
            budget.appliedLoanType === "policy" && budget.appliedPolicyName
              ? `추정 대출 가능액 (${budget.appliedPolicyName})`
              : "추정 대출 가능액 (일반 DSR·LTV)"
          }
          value={`+ ${formatKrwHuman(budget.loanEstimateKrw)}`}
        />
        <PreviewRow
          label="총예산"
          value={`= ${formatKrwHuman(budget.grossBudgetKrw)}`}
        />
      </div>

      <div className="rounded-2xl bg-white px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#6b6157]">
          실매수 가능가
        </span>
        <span
          className="text-[22px] font-extrabold tabular-nums tracking-tight"
          style={{ color: negative ? "#dc2626" : "#3a322c" }}
        >
          {formatKrwHuman(budget.netPurchasePowerKrw)}
        </span>
      </div>

      {budget.monthlyPaymentKrw > 0 && (
        <p className="text-[12px] text-[#6b6157]">
          추정 월 원리금 상환액 약 {formatKrwHuman(budget.monthlyPaymentKrw)}
        </p>
      )}

      {eligible.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {eligible.map((m) => (
            <span
              key={m.productName}
              className="rounded-full bg-coral-100 px-2.5 py-0.5 text-[11px] font-semibold text-coral-700"
            >
              {m.productName} 적격
            </span>
          ))}
        </div>
      )}

      {budget.warnings.length > 0 && (
        <p className="text-[11px] leading-relaxed text-amber-700">
          {budget.warnings[0]}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-[#9a8f82]">
        공개 DSR·LTV 공식 기반 추정. 항목별 상세는 마지막 단계 후 결과 화면에서.
      </p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#6b6157]">{label}</span>
      <span className="text-[14px] font-semibold tabular-nums text-[#3a322c]">
        {value}
      </span>
    </div>
  );
}
