import type { BudgetEstimate } from "@/types/recommendation";
import { Card } from "@/components/ui/Card";

function formatEok(krw: number): string {
  const val = krw / 100_000_000;
  return `${val.toFixed(1)}억`;
}

function formatMan(krw: number): string {
  const val = Math.round(krw / 10_000);
  return `${val.toLocaleString("ko-KR")}만원`;
}

export function BudgetSummary({ budget }: { budget: BudgetEstimate }) {
  const hasHomeSale = budget.homeSaleNetKrw > 0;

  return (
    <Card>
      {/* 섹션 제목 */}
      <div className="mb-6">
        <h2 className="text-lg font-bold" style={{ color: "#1d1d1f" }}>
          예산 분석
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: "#6e6e73" }}>
          공개 공식 기반 추정치입니다. 실제 한도는 금융기관 상담 결과에 따릅니다.
        </p>
      </div>

      {/* 자금 흐름 */}
      <div className="flex flex-col gap-2 mb-5">
        {/* 시드머니 */}
        <FlowRow
          label="보유 시드머니"
          value={formatEok(budget.seedMoneyKrw)}
          color="#1d1d1f"
        />

        {/* 갈아타기: 매도 순수령액 */}
        {hasHomeSale && (
          <FlowRow
            label="기존 집 매도 순수령액"
            hint={
              budget.capitalGainsTaxKrw > 0
                ? `(양도세 ${formatEok(budget.capitalGainsTaxKrw)} 차감 후)`
                : undefined
            }
            value={`+ ${formatEok(budget.homeSaleNetKrw)}`}
            color="#1d1d1f"
          />
        )}

        {/* 소계: 가용 자기자본 */}
        <div className="flex items-center justify-between rounded-xl bg-[#f5f5f7] px-4 py-2.5">
          <span className="text-sm font-semibold" style={{ color: "#6e6e73" }}>
            가용 자기자본
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: "#1d1d1f" }}
          >
            {formatEok(budget.totalEquityKrw)}
          </span>
        </div>

        {/* 추정 대출 */}
        <FlowRow
          label="추정 대출 가능액"
          value={`+ ${formatEok(budget.loanEstimateKrw)}`}
          color="#1d1d1f"
        />

        {/* 구분선 */}
        <div className="my-1 border-t border-black/[0.06]" />

        {/* 총예산 */}
        <FlowRow
          label="총예산"
          value={`= ${formatEok(budget.grossBudgetKrw)}`}
          color="#1d1d1f"
          semibold
        />

        {/* 취득·부대비용 */}
        <FlowRow
          label="취득세 · 부대비용"
          value={`− ${formatEok(budget.acquisitionCostsKrw)}`}
          color="#6e6e73"
        />
      </div>

      {/* 실 매입가능 상한 — 하이라이트 블록 */}
      <div
        className="rounded-2xl px-5 py-5 mb-5"
        style={{
          background: "linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)",
          boxShadow: "0 1px 3px rgba(79,70,229,0.08)",
        }}
      >
        <p className="text-xs font-medium mb-1" style={{ color: "#6e6e73" }}>
          실 매입가능 상한 (추정치)
        </p>
        <p
          className="text-4xl font-extrabold tabular-nums tracking-tight"
          style={{ color: "#1d1d1f" }}
        >
          {formatEok(budget.netPurchasePowerKrw)}
        </p>
      </div>

      {/* 월 상환액 — P1#8 */}
      {budget.monthlyPaymentKrw > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 mb-5 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "#6e6e73" }}>
            추정 월 상환액
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: "#4338ca" }}
          >
            약 {formatMan(budget.monthlyPaymentKrw)}
          </span>
        </div>
      )}

      {/* 경고 (앰버) */}
      {budget.warnings.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">유의사항</p>
          <ul className="flex flex-col gap-1">
            {budget.warnings.map((w, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-amber-800 leading-relaxed">
                <span className="mt-0.5 flex-shrink-0 text-amber-400">&#9679;</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 계산 가정 — 흐린 불릿 목록 */}
      {budget.assumptions.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "#86868b" }}>
            계산 가정
          </p>
          <ul className="flex flex-col gap-1">
            {budget.assumptions.map((a, i) => (
              <li key={i} className="flex gap-1.5 text-xs leading-relaxed" style={{ color: "#86868b" }}>
                <span className="mt-0.5 flex-shrink-0" style={{ color: "#c7c7cc" }}>&#9679;</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function FlowRow({
  label,
  hint,
  value,
  color,
  semibold,
}: {
  label: string;
  hint?: string;
  value: string;
  color: string;
  semibold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <span className="text-sm" style={{ color: "#6e6e73" }}>
        {label}
        {hint && (
          <span className="ml-1 text-xs" style={{ color: "#86868b" }}>
            {hint}
          </span>
        )}
      </span>
      <span
        className={`text-sm tabular-nums ${semibold ? "font-semibold" : "font-medium"}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
