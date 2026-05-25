"use client";

import { useMemo, useState } from "react";
import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import {
  AREA_RANGES,
  AREA_RANGE_ORDER,
  SEOUL_GU,
  GYEONGGI_SIGUNGU,
} from "@/types/profile";
import { estimateBudget } from "@/lib/budget";
import { computePlan, formatDday, type ScenarioKey } from "@/lib/plan";
import { PlanRaceChart } from "@/components/plan/PlanRaceChart";
import { formatKrwHuman } from "@/lib/format";
import regionPrices from "@/data/regionPrices.json";

const manwon = (s: string) => (parseFloat(s) || 0) * 10_000;
const eok = (krw: number) => (krw / 1e8).toFixed(1) + "억";

type Cell = { medianKrw: number; sampleCount: number };
const REGIONS = regionPrices.regions as Record<
  string,
  Partial<Record<AreaRangeKey, Cell>>
>;
// 데이터 있는 시군구만, 서울→경기 순.
const SGG_OPTIONS = [...SEOUL_GU, ...GYEONGGI_SIGUNGU].filter((s) => REGIONS[s]);
const bandsOf = (sgg: string): AreaRangeKey[] =>
  AREA_RANGE_ORDER.filter((k) => REGIONS[sgg]?.[k]);
const pickBand = (sgg: string): AreaRangeKey =>
  REGIONS[sgg]?.["p32_35"] ? "p32_35" : (bandsOf(sgg)[0] ?? "p32_35");

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
  // 목표 — 동네+평형 → 대표가 (직접입력 폴백)
  const [sgg, setSgg] = useState(DEFAULT_SGG);
  const [band, setBand] = useState<AreaRangeKey>(pickBand(DEFAULT_SGG));
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
  const [upPct, setUpPct] = useState(3.5);

  const cell = REGIONS[sgg]?.[band];
  const targetKrw = manualMode ? manwon(manualTarget) : (cell?.medianKrw ?? 0);

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

  const plan = useMemo(() => {
    const budget = estimateBudget(profile);
    return computePlan(budget, profile, {
      targetPriceKrw: targetKrw,
      monthlySavingKrw: saveM * 10_000,
      monthlySideKrw: sideM * 10_000,
      appreciation: { down: -0.05, flat: 0, up: upPct / 100 },
    });
  }, [profile, targetKrw, saveM, sideM, upPct]);

  return (
    <div className="flex flex-col gap-5">
      {/* 목표 — 후크 */}
      <section className="rounded-3xl border border-coral-200 bg-coral-50/60 p-5">
        <h2 className="mb-1 text-[15px] font-bold" style={{ color: "#3a322c" }}>
          어디 살고 싶어요?
        </h2>
        <p className="mb-3 text-[12px]" style={{ color: "#6b6157" }}>
          동네·평형을 고르면 그 동네 대표 시세로 목표를 잡아요.
        </p>

        {!manualMode ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="동네"
                value={sgg}
                onChange={(v) => {
                  setSgg(v);
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
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-[13px]" style={{ color: "#6b6157" }}>
                {sgg} {cell ? AREA_RANGES[band].label : ""} 대표 시세
              </span>
              <span className="text-2xl font-extrabold tabular-nums" style={{ color: "#f2603c" }}>
                {cell ? eok(cell.medianKrw) : "—"}
              </span>
            </div>
            {cell && (
              <p className="mt-0.5 text-[11px]" style={{ color: "#9a8f82" }}>
                국토부 실거래 {cell.sampleCount}건 추정 중위가 · 추정치
              </p>
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

      {/* D-day 범위 */}
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
      </section>

      {/* 경주 차트 */}
      <section className="rounded-3xl border border-[#e5e5ea] bg-white p-4 shadow-sm">
        <PlanRaceChart result={plan} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "#6b6157" }}>
          <span>지금 구매가능가 <b>{formatKrwHuman(plan.purchaseNowKrw)}</b></span>
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
        <Slider label="집값 상승률 가정(연)" value={upPct} suffix="%" min={-5} max={10} step={0.5} onChange={setUpPct} />
      </section>

      <p className="px-1 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
        모든 수치는 공개 공식·과거 지표 기반 <b>추정</b>이며 미래 가격 예측이 아닙니다. 과거 ≠ 미래,
        투자자문이 아닙니다. 실제 한도·세액은 금융기관·세무 상담 결과에 따릅니다.
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
