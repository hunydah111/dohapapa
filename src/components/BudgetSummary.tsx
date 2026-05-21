import type { BudgetEstimate, PolicyLoanMatch } from "@/types/recommendation";
import { Card } from "@/components/ui/Card";
import { Homi } from "@/components/Homi";
import { formatKrwHuman, formatManwon } from "@/lib/format";

export function BudgetSummary({ budget }: { budget: BudgetEstimate }) {
  const hasHomeSale = budget.homeSaleNetKrw !== 0;
  const homeSaleNegative = budget.homeSaleNetKrw < 0;

  const eligibleLoans = budget.policyLoanMatches.filter((m) => m.eligible);
  const ineligibleLoans = budget.policyLoanMatches.filter((m) => !m.eligible);

  return (
    <Card>
      {/* 섹션 제목 — 비지가 통장 보며 고민 */}
      <div className="mb-6 flex items-center gap-3">
        <Homi mood="think" size={46} className="shrink-0" />
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#3a322c" }}>
            예산 분석
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
            공개 공식 기반 추정치입니다. 실제 한도는 금융기관 상담 결과에 따릅니다.
          </p>
        </div>
      </div>

      {/* P0: 갈아타기 음수 경고 */}
      {homeSaleNegative && (
        <div className="mb-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-4">
          <p className="text-sm font-bold text-red-700 mb-1">
            갈아타기 주의 — 순수령액이 음수입니다
          </p>
          <p className="text-xs text-red-600 leading-relaxed">
            기존 집을 매도해도 대출 잔금 · 양도세가 매도가보다 커서{" "}
            <span className="font-semibold">
              {formatKrwHuman(Math.abs(budget.homeSaleNetKrw))}
            </span>
            를 추가로 부담해야 합니다. 갈아타기 전 전문가 상담을 권고합니다.
          </p>
        </div>
      )}

      {/* 자금 흐름 */}
      <div className="flex flex-col gap-2 mb-5">
        {/* 보유 현금 */}
        <FlowRow
          label="보유 현금"
          value={formatKrwHuman(budget.seedMoneyKrw)}
          color="#3a322c"
        />

        {/* 갈아타기: 매도 순수령액 */}
        {hasHomeSale && (
          <FlowRow
            label="기존 집 매도 순수령액"
            hint={
              budget.capitalGainsTaxKrw > 0
                ? `(양도세 ${formatKrwHuman(budget.capitalGainsTaxKrw)} 차감 후)`
                : undefined
            }
            value={
              homeSaleNegative
                ? `− ${formatKrwHuman(Math.abs(budget.homeSaleNetKrw))}`
                : `+ ${formatKrwHuman(budget.homeSaleNetKrw)}`
            }
            color={homeSaleNegative ? "#dc2626" : "#3a322c"}
          />
        )}

        {/* 가용 자기자본 소계 */}
        <div className="flex items-center justify-between rounded-xl bg-[#f3ece4] px-4 py-2.5">
          <span className="text-sm font-semibold" style={{ color: "#6b6157" }}>
            가용 자기자본
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: budget.totalEquityKrw < 0 ? "#dc2626" : "#3a322c" }}
          >
            {budget.totalEquityKrw < 0
              ? `− ${formatKrwHuman(Math.abs(budget.totalEquityKrw))}`
              : formatKrwHuman(budget.totalEquityKrw)}
          </span>
        </div>

        {/* 추정 대출 */}
        <FlowRow
          label={
            budget.appliedLoanType === "policy" && budget.appliedPolicyName
              ? `추정 대출 가능액 (${budget.appliedPolicyName} 기준)`
              : "추정 대출 가능액 (일반 DSR·LTV 기준)"
          }
          value={`+ ${formatKrwHuman(budget.loanEstimateKrw)}`}
          color="#3a322c"
        />

        {/* 대출 산출 근거 — 왜 이 금액인지 단계별 설명 */}
        {budget.loanReasonLines.length > 0 && (
          <div className="ml-4 mt-1 mb-2 rounded-xl bg-coral-50/40 border border-coral-100 px-3 py-2.5">
            <p
              className="text-[11px] font-semibold mb-1.5"
              style={{ color: "#f2603c" }}
            >
              이 금액이 어떻게 나왔는지
            </p>
            <ol className="flex flex-col gap-1">
              {budget.loanReasonLines.map((line, i) => (
                <li
                  key={i}
                  className="flex gap-1.5 text-[11px] leading-relaxed"
                  style={{ color: "#f2603c" }}
                >
                  <span className="flex-shrink-0 tabular-nums font-semibold opacity-70">
                    {i + 1}.
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 구분선 */}
        <div className="my-1 border-t border-black/[0.06]" />

        {/* 총예산 */}
        <FlowRow
          label="총예산"
          value={`= ${formatKrwHuman(budget.grossBudgetKrw)}`}
          color="#3a322c"
          semibold
        />

        {/* 취득·부대비용 */}
        <FlowRow
          label="취득세 · 부대비용"
          value={`− ${formatKrwHuman(budget.acquisitionCostsKrw)}`}
          color="#6b6157"
        />
      </div>

      {/* 실 매입가능 상한 — 하이라이트 블록 */}
      <div
        className="rounded-2xl px-5 py-5 mb-5"
        style={{
          background: "linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)",
          boxShadow: "0 1px 3px rgba(242,96,60,0.08)",
        }}
      >
        <p className="text-xs font-medium mb-1" style={{ color: "#6b6157" }}>
          실 매입가능 상한 (추정치)
        </p>
        <p
          className="text-4xl font-extrabold tabular-nums tracking-tight"
          style={{ color: "#3a322c" }}
        >
          {formatKrwHuman(budget.netPurchasePowerKrw)}
        </p>
      </div>

      {/* 월 상환액 */}
      {budget.monthlyPaymentKrw > 0 && (
        <div className="rounded-2xl border border-coral-100 bg-coral-50/60 px-5 py-4 mb-5 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "#6b6157" }}>
            추정 월 원리금 상환액
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: "#f2603c" }}
          >
            약 {formatManwon(budget.monthlyPaymentKrw)}
          </span>
        </div>
      )}

      {/* P0: 정책대출 매칭 섹션 */}
      {budget.policyLoanMatches.length > 0 && (
        <div className="mb-5">
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-sm font-bold" style={{ color: "#3a322c" }}>
              정책대출 자격 안내
            </p>
            {budget.appliedLoanType === "policy" &&
              budget.appliedPolicyName && (
                <span className="rounded-full bg-coral-100 px-2.5 py-0.5 text-xs font-semibold text-coral-700">
                  이 예산은 {budget.appliedPolicyName} 기준 적용
                </span>
              )}
          </div>

          {/* 적격 상품 */}
          {eligibleLoans.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {eligibleLoans.map((loan) => (
                <PolicyLoanCard key={loan.productName} loan={loan} eligible />
              ))}
            </div>
          )}

          {/* 미적격 상품 */}
          {ineligibleLoans.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              <p
                className="text-xs font-semibold"
                style={{ color: "#9a8f82" }}
              >
                미해당 상품
              </p>
              {ineligibleLoans.map((loan) => (
                <PolicyLoanCard
                  key={loan.productName}
                  loan={loan}
                  eligible={false}
                />
              ))}
            </div>
          )}

          {/* 컴플라이언스 안내 */}
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "#9a8f82" }}
          >
            본 결과는 자격요건 시뮬레이션입니다 — 실제 한도·금리·승인 여부는
            취급 금융기관(주택도시기금 · 한국주택금융공사) 심사 기준을 따르므로
            은행 상담이 필수입니다. 본 서비스는 특정 금융기관 상품과 직접
            연결되지 않으며, 대출모집·중개를 수행하지 않습니다.
          </p>
        </div>
      )}

      {/* 경고 (P0: 음수 외 추가 경고) */}
      {budget.warnings.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">
            유의사항
          </p>
          <ul className="flex flex-col gap-1">
            {budget.warnings.map((w, i) => (
              <li
                key={i}
                className="flex gap-1.5 text-xs text-amber-800 leading-relaxed"
              >
                <span className="mt-0.5 flex-shrink-0 text-amber-500">&#9679;</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 계산 가정 */}
      {budget.assumptions.length > 0 && (
        <div>
          <p
            className="text-xs font-semibold mb-1.5"
            style={{ color: "#9a8f82" }}
          >
            계산 가정
          </p>
          <ul className="flex flex-col gap-1">
            {budget.assumptions.map((a, i) => (
              <li
                key={i}
                className="flex gap-1.5 text-xs leading-relaxed"
                style={{ color: "#9a8f82" }}
              >
                <span
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: "#c7c7cc" }}
                >
                  &#9679;
                </span>
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
      <span className="text-sm" style={{ color: "#6b6157" }}>
        {label}
        {hint && (
          <span className="ml-1 text-xs" style={{ color: "#9a8f82" }}>
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

function PolicyLoanCard({
  loan,
  eligible,
}: {
  loan: PolicyLoanMatch;
  eligible: boolean;
}) {
  if (eligible) {
    return (
      <div className="rounded-2xl border border-coral-200 bg-coral-50 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: "#3730a3" }}>
              {loan.productName}
            </p>
            <p
              className="mt-0.5 text-xs leading-relaxed"
              style={{ color: "#f2603c" }}
            >
              {loan.reason}
            </p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-coral-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
            적격
          </span>
        </div>
        {(loan.loanLimitKrw !== undefined ||
          loan.rateMin !== undefined) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {loan.loanLimitKrw !== undefined && (
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#3a322c" }}>
                한도 {formatKrwHuman(loan.loanLimitKrw)}
              </span>
            )}
            {loan.rateMin !== undefined && loan.rateMax !== undefined && (
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#3a322c" }}>
                금리 연 {loan.rateMin}%~{loan.rateMax}%
              </span>
            )}
            {loan.rateMin !== undefined && loan.rateMax === undefined && (
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#3a322c" }}>
                금리 연 {loan.rateMin}%~
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#f3ece4] px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "#9a8f82" }}>
            {loan.productName}
          </p>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "#9a8f82" }}
          >
            {loan.reason}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-full border border-black/[0.08] bg-white px-2.5 py-0.5 text-[11px] font-medium" style={{ color: "#9a8f82" }}>
          미해당
        </span>
      </div>
    </div>
  );
}
