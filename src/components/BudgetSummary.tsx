import type { BudgetEstimate, PolicyLoanMatch } from "@/types/recommendation";
import { Card } from "@/components/ui/Card";
import { MonthlyBurden } from "@/components/MonthlyBurden";
import { POLICY_META, policyFreshness } from "@/lib/policyLoan";
import { formatKrwHuman } from "@/lib/format";

// "2026-05-25" → "2026.5.25"
function fmtPolicyDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}.${Number(m)}.${Number(d)}`;
}

export function BudgetSummary({ budget }: { budget: BudgetEstimate }) {
  const hasHomeSale = budget.homeSaleNetKrw !== 0;
  const homeSaleNegative = budget.homeSaleNetKrw < 0;
  const fresh = policyFreshness();

  const eligibleLoans = budget.policyLoanMatches.filter((m) => m.eligible);
  const ineligibleLoans = budget.policyLoanMatches.filter((m) => !m.eligible);

  // D3 결론 1개 강조 — 나열 대신 "당신 케이스 = OO 가능성 높음". 엔진이 이미 최선 정책을
  // 골라 예산에 적용하므로(appliedPolicyName) 그게 결론. 없으면 적격 첫 번째. 나머지는 접음.
  // 컴플라이언스: "확정" 아니라 "가능성 높음" + 면책 동반(아래 시뮬레이션 안내).
  const appliedName =
    budget.appliedLoanType === "policy" ? budget.appliedPolicyName : null;
  const conclusionLoan =
    eligibleLoans.find((m) => m.productName === appliedName) ?? eligibleLoans[0] ?? null;
  const restEligible = eligibleLoans.filter((m) => m !== conclusionLoan);

  return (
    <Card>
      {/* 섹션 제목 */}
      <div className="mb-6 flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#191713" }}>
            예산 분석
          </h2>
        </div>
      </div>

      {/* 정책·세제 반영 기준 — 눈에 띄게(신뢰). 검증일 오래되면 '확인 필요'. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#f4f2ea] px-3.5 py-2.5">
        <span
          className="text-[11px] leading-relaxed"
          style={{ color: "#5d574c" }}
        >
          정책·세제{" "}
          <span className="font-bold" style={{ color: "#191713" }}>
            {POLICY_META.effectiveLabel}
          </span>{" "}
          · 최종 점검 {fmtPolicyDate(POLICY_META.lastVerified)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            fresh.stale
              ? "bg-amber-100 text-amber-700"
              : "bg-coral-100 text-coral-700"
          }`}
        >
          {fresh.stale ? "확인 필요" : "최신 점검됨"}
        </span>
      </div>

      {/* P0: 갈아타기 음수 경고 */}
      {homeSaleNegative && (
        <div className="mb-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-4">
          <p className="text-sm font-bold text-red-700 mb-1">
            갈아타기 위험 — 매도해도 적자
          </p>
          <p className="text-xs text-red-600 leading-relaxed">
            기존 집 매도해도 잔금·양도세가 더 커서{" "}
            <span className="font-semibold">
              {formatKrwHuman(Math.abs(budget.homeSaleNetKrw))}
            </span>
            {" "}추가 부담 필요. 갈아타기 전 전문가 상담 필수.
          </p>
        </div>
      )}

      {/* 자금 흐름 */}
      <div className="flex flex-col gap-2 mb-5">
        {/* 보유 현금 */}
        <FlowRow
          label="보유 현금"
          value={formatKrwHuman(budget.seedMoneyKrw)}
          color="#191713"
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
            color={homeSaleNegative ? "#dc2626" : "#191713"}
          />
        )}

        {/* 가용 자기자본 소계 */}
        <div className="flex items-center justify-between rounded-xl bg-[#f4f2ea] px-4 py-2.5">
          <span className="text-sm font-semibold" style={{ color: "#5d574c" }}>
            가용 자기자본
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: budget.totalEquityKrw < 0 ? "#dc2626" : "#191713" }}
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
          color="#191713"
        />

        {/* 대출 산출 근거 — 왜 이 금액인지 단계별 설명 */}
        {budget.loanReasonLines.length > 0 && (
          <div className="ml-4 mt-1 mb-2 rounded-xl bg-[#f4f2ea]/60 border border-[#c9c3b4] px-3 py-2.5">
            <p
              className="text-[11px] font-semibold mb-1.5"
              style={{ color: "#e8571f" }}
            >
              이 금액이 어떻게 나왔는지
            </p>
            <ul className="flex flex-col gap-1">
              {budget.loanReasonLines.map((line, i) => (
                <li
                  key={i}
                  className="text-[11px] leading-relaxed"
                  style={{ color: "#e8571f" }}
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 구분선 */}
        <div className="my-1 border-t border-black/[0.06]" />

        {/* 총예산 */}
        <FlowRow
          label="총예산"
          value={`= ${formatKrwHuman(budget.grossBudgetKrw)}`}
          color="#191713"
          semibold
        />

        {/* 취득·부대비용 */}
        <FlowRow
          label="취득세 · 부대비용"
          value={`− ${formatKrwHuman(budget.acquisitionCostsKrw)}`}
          color="#5d574c"
        />
      </div>

      {/* 실 매입가능 상한 — 하이라이트 블록 (따뜻한 코랄·골드 톤) */}
      <div
        className="rounded-2xl px-5 py-5 mb-5"
        style={{
          background: "linear-gradient(135deg, #fdf0e9 0%, #f4f2ea 100%)",
          boxShadow: "0 1px 3px rgba(232,87,31,0.08)",
        }}
      >
        <p className="text-xs font-medium mb-1" style={{ color: "#5d574c" }}>
          실 매입가능 상한 (추정치)
        </p>
        {budget.netPurchasePowerKrw > 0 ? (
          <p
            className="font-jua text-5xl tabular-nums tracking-tight"
            style={{ color: "#191713" }}
          >
            {formatKrwHuman(budget.netPurchasePowerKrw)}
          </p>
        ) : (
          <>
            <p
              className="text-xl font-extrabold tracking-tight"
              style={{ color: "#191713" }}
            >
              현금 좀 더 필요 — 우선 현금흐름 잡자~
            </p>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#5d574c" }}>
              근데 정책대출 자격 보거나, 조건 살짝 바꾸면 가능 — 아래 안내 보자~
            </p>
          </>
        )}
      </div>

      {/* 월 상환액 + 은행최대/안전선 토글(#6) + 부담 신호등(#2) + 금리 스트레스(#3) */}
      {budget.monthlyPaymentKrw > 0 && <MonthlyBurden budget={budget} />}

      {/* P0: 정책대출 매칭 섹션 */}
      {budget.policyLoanMatches.length > 0 && (
        <div className="mb-5">
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-sm font-bold" style={{ color: "#191713" }}>
              정책대출 자격 안내
            </p>
            {budget.appliedLoanType === "policy" &&
              budget.appliedPolicyName && (
                <span className="rounded-full bg-coral-100 px-2.5 py-0.5 text-xs font-semibold text-coral-700">
                  이 예산은 {budget.appliedPolicyName} 기준 적용
                </span>
              )}
          </div>

          {conclusionLoan ? (
            /* 결론 1개 강조 + 나머지 접기 (D3) */
            <div className="flex flex-col gap-2 mb-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="mb-0.5 text-xs font-bold text-emerald-700">
                  당신 케이스 → {conclusionLoan.productName} 가능성 높음
                </p>
                <p className="text-[12px] leading-snug" style={{ color: "#191713" }}>
                  {conclusionLoan.reason}
                </p>
              </div>
              {(restEligible.length > 0 || ineligibleLoans.length > 0) && (
                <details className="rounded-2xl bg-[#f4f2ea] px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
                  <summary
                    className="cursor-pointer list-none text-xs font-semibold"
                    style={{ color: "#5d574c" }}
                  >
                    다른 정책 자격 자세히 ▾ ({restEligible.length + ineligibleLoans.length})
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {restEligible.map((loan) => (
                      <PolicyLoanCard key={loan.productName} loan={loan} eligible />
                    ))}
                    {ineligibleLoans.map((loan) => (
                      <PolicyLoanCard key={loan.productName} loan={loan} eligible={false} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            /* 적격 없음 — 거짓 결론 만들지 않고 미적격 나열 그대로 */
            ineligibleLoans.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                <p className="text-xs font-semibold" style={{ color: "#8a857a" }}>
                  이 조건엔 자격 안 됨
                </p>
                {ineligibleLoans.map((loan) => (
                  <PolicyLoanCard key={loan.productName} loan={loan} eligible={false} />
                ))}
              </div>
            )
          )}

          {/* 컴플라이언스 안내 */}
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "#8a857a" }}
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
            style={{ color: "#8a857a" }}
          >
            계산 가정
          </p>
          <ul className="flex flex-col gap-1">
            {budget.assumptions.map((a, i) => (
              <li
                key={i}
                className="flex gap-1.5 text-xs leading-relaxed"
                style={{ color: "#8a857a" }}
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
      <span className="text-sm" style={{ color: "#5d574c" }}>
        {label}
        {hint && (
          <span className="ml-1 text-xs" style={{ color: "#8a857a" }}>
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
      <div className="rounded-2xl border border-[#c9c3b4] bg-[#f4f2ea] px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: "#3730a3" }}>
              {loan.productName}
            </p>
            <p
              className="mt-0.5 text-xs leading-relaxed"
              style={{ color: "#e8571f" }}
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
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#191713" }}>
                한도 {formatKrwHuman(loan.loanLimitKrw)}
              </span>
            )}
            {loan.rateMin !== undefined && loan.rateMax !== undefined && (
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#191713" }}>
                금리 연 {loan.rateMin}%~{loan.rateMax}%
              </span>
            )}
            {loan.rateMin !== undefined && loan.rateMax === undefined && (
              <span className="text-xs font-semibold tabular-nums" style={{ color: "#191713" }}>
                금리 연 {loan.rateMin}%~
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#f4f2ea] px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: "#8a857a" }}>
            {loan.productName}
          </p>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "#8a857a" }}
          >
            {loan.reason}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-full border border-black/[0.08] bg-white px-2.5 py-0.5 text-[11px] font-medium" style={{ color: "#8a857a" }}>
          조건 확인 필요
        </span>
      </div>
    </div>
  );
}
