"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import {
  AREA_RANGES,
  AREA_RANGE_ORDER,
  SEOUL_GU,
  GYEONGGI_SIGUNGU,
} from "@/types/profile";
import { estimateBudget } from "@/lib/budget";
import {
  computePlan,
  formatDday,
  planGuidance,
  regionScenarios,
  defaultUpPct,
  type ScenarioKey,
  type PlanGuidance,
} from "@/lib/plan";
import { PlanRaceChart } from "@/components/plan/PlanRaceChart";
import { formatKrwHuman } from "@/lib/format";
import regionPrices from "@/data/regionPrices.json";
import dataMeta from "@/data/dataMeta.json";

const manwon = (s: string) => (parseFloat(s) || 0) * 10_000;
const eok = (krw: number) => (krw / 1e8).toFixed(1) + "억";

// 대표시세 기준일 — 첫 화면과 동일 소스(dataMeta.latestDealDate)로 통일. "2026-05-22" → "2026.5.22".
const FRESH_DATE: string | null = (() => {
  const d = dataMeta.latestDealDate;
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${y}.${Number(m)}.${Number(day)}`;
})();

type TierKey = "stable" | "balanced" | "challenge";
type Rep = { name: string; dong: string | null; year: number | null; krw: number };
type Tier = { key: TierKey; label: string; krw: number; reps: Rep[] };
type Cell = {
  medianKrw: number;
  sampleCount: number;
  asOf?: string;
  min?: number;
  max?: number;
  tiers?: Tier[];
};
const REGIONS = regionPrices.regions as Record<
  string,
  Partial<Record<AreaRangeKey, Cell>>
>;
const DEFAULT_TIER: TierKey = "balanced"; // 가운데(평균 위·럭셔리 아님) — 행동경제 권고
// 데이터 있는 시군구만, 서울→경기 순.
const SGG_OPTIONS = [...SEOUL_GU, ...GYEONGGI_SIGUNGU].filter((s) => REGIONS[s]);
const bandsOf = (sgg: string): AreaRangeKey[] =>
  AREA_RANGE_ORDER.filter((k) => REGIONS[sgg]?.[k]);
const pickBand = (sgg: string): AreaRangeKey =>
  REGIONS[sgg]?.["p32_35"] ? "p32_35" : (bandsOf(sgg)[0] ?? "p32_35");

// "2026-05" → "2026.5"
const fmtMonth = (s?: string): string | null => {
  if (!s) return null;
  const [y, m] = s.split("-");
  return m ? `${y}.${Number(m)}` : y;
};

const SCEN_LABEL: Record<ScenarioKey, string> = { down: "하락", flat: "보합", up: "상승" };
const SCEN_COLOR: Record<ScenarioKey, string> = {
  down: "#4CB07A",
  flat: "#b9a98f",
  up: "#e0682f",
};

// 기본 동네 — 타깃(무주택 신혼·생애최초)에 현실적인 수도권 중가 동네로(첫 데모가 '희망'이게).
const DEFAULT_SGG = REGIONS["구리시"]
  ? "구리시"
  : REGIONS["마포구"]
    ? "마포구"
    : SGG_OPTIONS[0];

export function PlanExperience() {
  // 목표 — 동네+평형 → 티어(안정/균형/도전) 선택 (직접입력 폴백)
  const [sgg, setSgg] = useState(DEFAULT_SGG);
  const [band, setBand] = useState<AreaRangeKey>(pickBand(DEFAULT_SGG));
  const [tierKey, setTierKey] = useState<TierKey>(DEFAULT_TIER);
  const [manualMode, setManualMode] = useState(false);
  const [manualTarget, setManualTarget] = useState("52000");

  // 내 상황
  const [income, setIncome] = useState("7000");
  const [cash, setCash] = useState("20000");
  const [noHome, setNoHome] = useState(true);
  const [newlywed, setNewlywed] = useState(false);
  const [newborn, setNewborn] = useState(false);

  // 레버
  const [saveM, setSaveM] = useState(200);
  const [sideM, setSideM] = useState(0);
  const [upPct, setUpPct] = useState(() => defaultUpPct(DEFAULT_SGG));

  const scen = regionScenarios(sgg);
  const downRate = scen.down.rateAnnual;
  const cell = REGIONS[sgg]?.[band];
  const tiers = cell?.tiers;
  const selectedTier =
    !manualMode && tiers
      ? (tiers.find((t) => t.key === tierKey) ?? tiers[1] ?? tiers[0])
      : undefined;
  const targetKrw = manualMode
    ? manwon(manualTarget)
    : (selectedTier?.krw ?? cell?.medianKrw ?? 0);

  const profile: CoupleProfile = useMemo(
    () => ({
      householdType: "single",
      priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
      preferredAreaRanges: ["p32_35"],
      hasSchoolAgedChild: false,
      hasInfant: newborn,
      hasTwoOrMoreChildren: false,
      hasThreeOrMoreChildren: false,
      isExpectingChild: false,
      budgetMode: "detailed",
      householdIncomeKrwYear: manwon(income),
      seedMoneyKrw: manwon(cash),
      netAssetsKrw: manwon(cash),
      existingLoanMonthlyKrw: 0,
      hasOwnedHomeBefore: !noHome,
      isNewlywed: newlywed,
      ownedHomeCount: 0,
    }),
    [income, cash, noHome, newlywed, newborn],
  );

  const budget = useMemo(() => estimateBudget(profile), [profile]);

  const plan = useMemo(
    () =>
      computePlan(budget, profile, {
        targetPriceKrw: targetKrw,
        monthlySavingKrw: saveM * 10_000,
        monthlySideKrw: sideM * 10_000,
        appreciation: { down: downRate, flat: 0, up: upPct / 100 },
      }),
    [budget, profile, targetKrw, saveM, sideM, upPct, downRate],
  );

  const guide = useMemo(() => planGuidance(plan), [plan]);

  // 각 티어의 '보합 기준' 도달 시점 — 카드에 띄워 "이 집이면 D−Xy, 한 칸 아래면 D−Yy" 체감.
  const tierMonths = useMemo(() => {
    const out: Partial<Record<TierKey, number | null>> = {};
    if (tiers) {
      for (const t of tiers) {
        const p = computePlan(budget, profile, {
          targetPriceKrw: t.krw,
          monthlySavingKrw: saveM * 10_000,
          monthlySideKrw: sideM * 10_000,
          appreciation: { down: downRate, flat: 0, up: upPct / 100 },
        });
        out[t.key] = p.scenarios.find((s) => s.key === "flat")!.months;
      }
    }
    return out;
  }, [tiers, budget, profile, saveM, sideM, upPct, downRate]);

  return (
    <div className="flex flex-col gap-5">
      {/* 목표 — 동네+평형 → 티어 선택 */}
      <section className="rounded-3xl border border-coral-200 bg-coral-50/60 p-5">
        <h2 className="mb-1 text-[15px] font-bold" style={{ color: "#3a322c" }}>
          어떤 집을 그리세요?
        </h2>
        <p className="mb-3 text-[12px]" style={{ color: "#6b6157" }}>
          동네·평형을 고르고, 어느 정도 집을 목표로 할지 골라요. 평균이 아니라 <b>내가 그리는 집</b>으로.
        </p>

        {!manualMode ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="동네"
                value={sgg}
                onChange={(v) => {
                  setSgg(v);
                  setUpPct(defaultUpPct(v));
                  if (!REGIONS[v]?.[band]) setBand(pickBand(v));
                }}
                options={SGG_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="평형"
                value={band}
                onChange={(v) => setBand(v as AreaRangeKey)}
                options={bandsOf(sgg).map((k) => ({
                  value: k,
                  label: AREA_RANGES[k].label,
                }))}
              />
            </div>

            {tiers ? (
              <>
                <div className="mt-3 flex flex-col gap-2">
                  {tiers.map((t) => (
                    <TierCard
                      key={t.key}
                      tier={t}
                      selected={t.key === selectedTier?.key}
                      months={tierMonths[t.key]}
                      hideNames={t.key === "stable"}
                      onSelect={() => setTierKey(t.key)}
                    />
                  ))}
                </div>
                {cell?.min != null && cell?.max != null && (
                  <DistributionBar
                    min={cell.min}
                    max={cell.max}
                    value={targetKrw}
                  />
                )}
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
                  동네 등급이 아니라 <b>내가 목표로 할 가격대</b>예요. 국토부 공개 실거래 예시 · 추정
                  {fmtMonth(cell?.asOf) ? ` · ${fmtMonth(cell?.asOf)} 기준` : FRESH_DATE ? ` · ${FRESH_DATE} 기준` : ""}
                  {cell ? ` · ${cell.sampleCount}건` : ""}. 예시는 그 가격대 실거래 단지 중 하나이며 매수 권유가 아니에요.
                </p>
              </>
            ) : (
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px]" style={{ color: "#6b6157" }}>
                    {sgg} {cell ? AREA_RANGES[band].label : ""} 추정 시세
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums" style={{ color: "#f2603c" }}>
                    {cell ? eok(cell.medianKrw) : "—"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: "#9a8f82" }}>
                  표본이 적어 티어 없이 단일 추정치예요
                  {cell ? ` · 실거래 ${cell.sampleCount}건` : ""}
                  {fmtMonth(cell?.asOf) ? ` · ${fmtMonth(cell?.asOf)} 기준` : ""}
                </p>
              </div>
            )}
          </>
        ) : (
          <NumField label="목표 집값(만원)" value={manualTarget} onChange={setManualTarget} />
        )}

        <button
          type="button"
          onClick={() => setManualMode((v) => !v)}
          className="mt-3 text-[12px] font-semibold underline"
          style={{ color: "#6b6157" }}
        >
          {manualMode ? "동네로 고르기" : "직접 금액 입력"}
        </button>
      </section>

      {/* 내 상황 */}
      <section className="rounded-3xl border border-[#e5e5ea] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-[15px] font-bold" style={{ color: "#3a322c" }}>
          내 상황
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="연 가구소득(만원)" value={income} onChange={setIncome} />
          <NumField label="보유 현금(만원)" value={cash} onChange={setCash} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip on={noHome} onClick={() => setNoHome((v) => !v)} label="무주택" />
          <Chip on={newlywed} onClick={() => setNewlywed((v) => !v)} label="혼인 7년 이내" />
          <Chip on={newborn} onClick={() => setNewborn((v) => !v)} label="출산 2년 이내" />
        </div>
      </section>

      {/* D-day 범위 / 가이드 */}
      <section
        className="rounded-3xl px-5 py-5"
        style={{
          background: "linear-gradient(135deg, #fff4ef 0%, #f7ead0 100%)",
          boxShadow: "0 1px 3px rgba(242,96,60,0.08)",
        }}
      >
        <p className="text-xs font-medium" style={{ color: "#6b6157" }}>
          내 집 마련 시점 (시나리오 · 추정)
        </p>

        {guide.tone === "reachable" ? (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              {plan.scenarios.map((s) => (
                <span
                  key={s.key}
                  className="rounded-full bg-white px-3 py-1 text-sm font-bold"
                  style={{ color: SCEN_COLOR[s.key] }}
                >
                  {SCEN_LABEL[s.key]} {formatDday(s.months)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
              예측이 아니라 과거 지표 + 가정 시나리오예요. 레버를 당기면 시점이 당겨져요 👇
            </p>
          </>
        ) : guide.tone === "needBasics" ? (
          <BasicsGuide />
        ) : (
          <HopelessGuide guide={guide} regionLabel={manualMode ? null : sgg} />
        )}
      </section>

      {/* 경주 차트 */}
      <section className="rounded-3xl border border-[#e5e5ea] bg-white p-4 shadow-sm">
        <PlanRaceChart result={plan} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "#6b6157" }}>
          <span>지금 구매가능가 <b>{formatKrwHuman(Math.max(0, plan.purchaseNowKrw))}</b></span>
          <span>부족액 <b>{formatKrwHuman(plan.gapKrw)}</b></span>
          <span>월 순증 <b>{formatKrwHuman(plan.monthlyAccumKrw)}</b></span>
        </div>
      </section>

      {/* 레버 */}
      <section className="rounded-3xl border border-coral-100 bg-coral-50/50 p-5">
        <h2 className="mb-3 text-[15px] font-bold" style={{ color: "#3a322c" }}>
          레버 — 당기면 시점이 움직여요
        </h2>
        <Slider label="월 저축" value={saveM} suffix="만원" min={0} max={500} step={10} onChange={setSaveM} />
        <Slider label="월 부업(세전)" value={sideM} suffix="만원" min={0} max={300} step={10} onChange={setSideM} />
        <Slider label="‘상승’ 시나리오 연 상승률" value={upPct} suffix="%" min={0} max={10} step={0.5} onChange={setUpPct} />
        <p className="-mt-1 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
          하락 −6%(직전 하락기 2022·한국부동산원) · 보합 0% · 상승 기본 {Math.round(scen.up.rateAnnual * 100)}%({scen.up.basis}·KB 2025.9).
          이 레버는 ‘상승’만 조절해요 — 예측이 아니라 과거 기준이에요.
        </p>
      </section>

      <p className="px-1 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
        모든 수치는 공개 공식·과거 지표 기반 <b>추정</b>이며 미래 가격 예측이 아닙니다. 과거 ≠ 미래,
        투자자문이 아닙니다. 실제 한도·세액은 금융기관·세무 상담 결과에 따릅니다.
      </p>
    </div>
  );
}

function TierCard({
  tier,
  selected,
  months,
  hideNames,
  onSelect,
}: {
  tier: Tier;
  selected: boolean;
  months: number | null | undefined;
  hideNames: boolean;
  onSelect: () => void;
}) {
  const names = tier.reps.map((r) => r.name).join(" · ");
  const first = tier.reps[0];
  const sub = !hideNames && first
    ? `${first.dong ? first.dong : ""}${first.year ? ` · ${first.year}년` : ""}`
    : "";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected ? "border-coral-500 bg-white shadow-sm" : "border-[#e7ddcd] bg-white/60"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-sm font-bold"
          style={{ color: selected ? "#f2603c" : "#3a322c" }}
        >
          {tier.label}
        </span>
        <span className="text-lg font-extrabold tabular-nums" style={{ color: "#f2603c" }}>
          {eok(tier.krw)}
        </span>
      </div>
      {!hideNames && names && (
        <p className="mt-0.5 truncate text-[11px]" style={{ color: "#6b6157" }}>
          예: {names} 등 (이 가격대 실거래 중)
        </p>
      )}
      <p className="mt-0.5 text-[11px]" style={{ color: "#9a8f82" }}>
        {sub ? `${sub} · ` : ""}보합 가정 {formatDday(months ?? null)}
      </p>
    </button>
  );
}

function DistributionBar({
  min,
  max,
  value,
}: {
  min: number;
  max: number;
  value: number;
}) {
  const pct = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
  return (
    <div className="mt-3">
      <div
        className="relative h-1.5 rounded-full"
        style={{ background: "linear-gradient(90deg,#cfe6da,#f7ead0,#f6c3ad)" }}
      >
        <span
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white"
          style={{
            left: `calc(${(pct * 100).toFixed(1)}% - 6px)`,
            background: "#f2603c",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: "#9a8f82" }}>
        <span>최저 {eok(min)}</span>
        <span>이 동네·평형 실거래</span>
        <span style={{ color: "#6b6157", fontWeight: 600 }}>최고 {eok(max)}</span>
      </div>
    </div>
  );
}

// 소득·현금·저축이 모두 0 — 시점 계산 불가. 출발선 격려.
function BasicsGuide() {
  return (
    <div className="mt-2 rounded-2xl bg-white/80 p-4">
      <p className="text-sm font-bold" style={{ color: "#3a322c" }}>
        🌱 아직 출발선이에요
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "#6b6157" }}>
        소득·현금·월 저축이 모두 0이라 아직 시점을 그릴 수 없어요. 아래 레버에서 <b>월 저축</b>을
        올리거나 위에서 <b>소득·현금</b>을 채워보면 길이 보이기 시작해요.
      </p>
    </div>
  );
}

// 전 시나리오 40년+ — 맨 숫자 대신 동네↓·저축↑ 레버로 길 제시("끝은 희망").
function HopelessGuide({
  guide,
  regionLabel,
}: {
  guide: PlanGuidance;
  regionLabel: string | null;
}) {
  const showSaveLever = guide.neededMonthlyKrw > 0 && guide.neededMonthlyKrw <= 5_000_000;
  return (
    <div className="mt-2 rounded-2xl bg-white/80 p-4">
      <p className="text-sm font-bold" style={{ color: "#3a322c" }}>
        지금 페이스로는 시간이 걸려요 — 그래도 길은 있어요
      </p>
      <ul className="mt-2 flex flex-col gap-2.5">
        <li className="text-[12px] leading-relaxed" style={{ color: "#6b6157" }}>
          <span className="font-semibold" style={{ color: "#f2603c" }}>
            ① 동네를 한 칸 낮추면
          </span>{" "}
          — 지금 저축 페이스라면 {guide.horizonYears}년이면 약{" "}
          <b>{formatKrwHuman(guide.reachableInHorizonKrw)}</b>까지 닿아요.{" "}
          {regionLabel ? `${regionLabel}보다 한 단계 아래 ` : "한 단계 아래 "}동네·작은 평형부터
          노려보면 훨씬 빨라져요.
          <Link
            href="/"
            className="ml-1 font-semibold underline"
            style={{ color: "#f2603c" }}
          >
            그 가격대 매물 보기 →
          </Link>
        </li>
        {showSaveLever && (
          <li className="text-[12px] leading-relaxed" style={{ color: "#6b6157" }}>
            <span className="font-semibold" style={{ color: "#f2603c" }}>
              ② 저축을 조금 더 늘리면
            </span>{" "}
            — 월 순증(저축+부업)을 약 <b>{formatKrwHuman(guide.neededMonthlyKrw)}</b>으로 올리면
            보합 기준 {guide.neededYears}년 안에 닿아요. 아래 레버로 맞춰보세요 👇
          </li>
        )}
      </ul>
      <p className="mt-2.5 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
        조급해하지 않아도 돼요. 동네를 한 칸 낮추거나 저축을 조금만 늘려도 시점은 확 당겨집니다.
        (예측이 아니라 과거 지표 + 가정 시나리오예요.)
      </p>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px]" style={{ color: "#6b6157" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-sm focus:border-coral-400 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px]" style={{ color: "#6b6157" }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-sm tabular-nums focus:border-coral-400 focus:outline-none"
      />
    </label>
  );
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        on ? "border-coral-600 bg-coral-600 text-white" : "border-[#e0d3bf] bg-white text-[#9a8f82]"
      }`}
    >
      {label}
    </button>
  );
}

function Slider({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium" style={{ color: "#3a322c" }}>
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: "#f2603c" }}>
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1.5 w-full accent-coral-600"
      />
    </div>
  );
}
