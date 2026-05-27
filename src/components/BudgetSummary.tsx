import type { BudgetEstimate, PolicyLoanMatch } from "@/types/recommendation";
import { Card } from "@/components/ui/Card";
import { Homi } from "@/components/Homi";
import { MonthlyBurden } from "@/components/MonthlyBurden";
import { POLICY_META, policyFreshness } from "@/lib/policyLoan";
import { formatKrwHuman, formatManwon } from "@/lib/format";

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

  // 예산 상황별 비지 — 빠듯/음수면 빈 지갑, 아니면 계산기(분석).
  const budgetMood =
    budget.netPurchasePowerKrw <= 0 ||
    budget.totalEquityKrw < 0 ||
    homeSaleNegative
      ? "walletEmpty"
      : "calc";

  return (
    <Card>
      {/* 섹션 제목 — 비지가 예산 분석 */}
      <div className="mb-6 flex items-center gap-3">
        <Homi mood={budgetMood} size={46} className="shrink-0" />
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#3a322c" }}>
            예산 분석
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
            공개 공식 기반 추정 · 실제 한도는 은행 심사 결과
          </p>
        </div>
      </div>

      {/* 정책·세제 반영 기준 — 눈에 띄게(신뢰). 검증일 오래되면 '확인 필요'. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#f3ece4] px-3.5 py-2.5">
        <span
          className="text-[11px] leading-relaxed"
          style={{ color: "#6b6157" }}
        >
          정책·세제{" "}
          <span className="font-bold" style={{ color: "#3a322c" }}>
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
          <div className="ml-4 mt-1 mb-2 rounded-xl bg-[#fdf6e7]/60 border border-[#ecd9b3] px-3 py-2.5">
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

      {/* 실 매입가능 상한 — 하이라이트 블록 (따뜻한 코랄·골드 톤) */}
      <div
        className="rounded-2xl px-5 py-5 mb-5"
        style={{
          background: "linear-gradient(135deg, #fff4ef 0%, #f7ead0 100%)",
          boxShadow: "0 1px 3px rgba(242,96,60,0.08)",
        }}
      >
        <p className="text-xs font-medium mb-1" style={{ color: "#6b6157" }}>
          실 매입가능 상한 (추정치)
        </p>
        {budget.netPurchasePowerKrw > 0 ? (
          <>
            <p
              className="font-jua text-5xl tabular-nums tracking-tight"
              style={{ color: "#b87914" }}
            >
              {formatKrwHuman(budget.netPurchasePowerKrw)}
            </p>
            {/* 안내 — 대출이 계산되는 상세 예산모드에서만(간단모드는 대출=0이라 생략). */}
            {budget.loanEstimateKrw > 0 && (
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#6b6157" }}>
                🏠 이 가격대면{" "}
                <span className="font-bold" style={{ color: "#3a322c" }}>
                  {budget.appliedLoanType === "policy" && budget.appliedPolicyName
                    ? budget.appliedPolicyName
                    : "추정"}{" "}
                  대출 {formatKrwHuman(budget.loanEstimateKrw)}
                </span>
                {" "}+ 자기자본 {formatKrwHuman(budget.totalEquityKrw)}로 닿음.
                {budget.monthlyPaymentKrw > 0
                  ? ` 월 약 ${formatManwon(budget.monthlyPaymentKrw)} 상환.`
                  : ""}
              </p>
            )}
          </>
        ) : (
          <>
            <p
              className="text-xl font-extrabold tracking-tight"
              style={{ color: "#3a322c" }}
            >
              현금 좀 더 필요 — 우선 현금흐름 잡자~
            </p>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#6b6157" }}>
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
                이 조건엔 자격 안 됨
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
      <div className="rounded-2xl border border-[#ecd9b3] bg-[#fdf6e7] px-4 py-3">
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
          조건 확인 필요
        </span>
      </div>
    </div>
  );
}
