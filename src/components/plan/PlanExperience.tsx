"use client";

import { useEffect, useMemo, useState } from "react";
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

// 입력칸 단위 미리보기 — "7000" → "= 7,000만원" / "20000" → "= 2억"
const unitHint = (s: string): string | undefined =>
  parseFloat(s) > 0 ? `= ${formatKrwHuman(manwon(s))}` : undefined;

// 타이핑마다 전체 재계산되어 느려지는 것 방지 — 무거운 계산은 디바운스된 값으로.
function useDebounced<T>(value: T, ms = 200): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

const SCEN_COLOR: Record<ScenarioKey, string> = {
  down: "#4CB07A",
  flat: "#b9a98f",
  up: "#e0682f",
};
const SCEN_INFO: Record<ScenarioKey, { label: string; hint: string }> = {
  down: { label: "하락", hint: "집값 떨어질 때" },
  flat: { label: "보합", hint: "비슷할 때 · 기본" },
  up: { label: "상승", hint: "오를 때" },
};
const SCEN_MEANING: Record<ScenarioKey, string> = {
  down: "집값이 떨어지면",
  flat: "집값이 그대로면",
  up: "집값이 오르면",
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

  // 레버 (저축·부업은 캡 없이 직접 입력 — 만원)
  const [saveStr, setSaveStr] = useState("200");
  const [sideStr, setSideStr] = useState("0");
  const [upPct, setUpPct] = useState(() => defaultUpPct(DEFAULT_SGG));
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("flat");

  // 무거운 재계산은 디바운스된 값으로(타이핑 부드럽게). 입력칸 표시·미리보기는 즉시.
  const incomeKrw = useDebounced(manwon(income));
  const cashKrw = useDebounced(manwon(cash));
  const saveKrw = useDebounced(manwon(saveStr));
  const sideKrw = useDebounced(manwon(sideStr));

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
      householdIncomeKrwYear: incomeKrw,
      seedMoneyKrw: cashKrw,
      netAssetsKrw: cashKrw,
      existingLoanMonthlyKrw: 0,
      hasOwnedHomeBefore: !noHome,
      isNewlywed: newlywed,
      ownedHomeCount: 0,
    }),
    [incomeKrw, cashKrw, noHome, newlywed, newborn],
  );

  const budget = useMemo(() => estimateBudget(profile), [profile]);

  const plan = useMemo(
    () =>
      computePlan(budget, profile, {
        targetPriceKrw: targetKrw,
        monthlySavingKrw: saveKrw,
        monthlySideKrw: sideKrw,
        appreciation: { down: downRate, flat: 0, up: upPct / 100 },
        headlineKey: scenarioKey,
      }),
    [budget, profile, targetKrw, saveKrw, sideKrw, upPct, downRate, scenarioKey],
  );

  const guide = useMemo(() => planGuidance(plan), [plan]);

  // 선택 시나리오의 도달 시점 + "월 30만 더" 시뮬(행동 유도).
  const selectedMonths = plan.scenarios.find((s) => s.key === scenarioKey)!.months;
  const boostedMonths = useMemo(() => {
    const p = computePlan(budget, profile, {
      targetPriceKrw: targetKrw,
      monthlySavingKrw: saveKrw + 300_000,
      monthlySideKrw: sideKrw,
      appreciation: { down: downRate, flat: 0, up: upPct / 100 },
      headlineKey: scenarioKey,
    });
    return p.scenarios.find((s) => s.key === scenarioKey)!.months;
  }, [budget, profile, targetKrw, saveKrw, sideKrw, upPct, downRate, scenarioKey]);

  // 각 티어의 '보합 기준' 도달 시점 — 카드에 띄워 "이 집이면 D−Xy, 한 칸 아래면 D−Yy" 체감.
  const tierMonths = useMemo(() => {
    const out: Partial<Record<TierKey, number | null>> = {};
    if (tiers) {
      for (const t of tiers) {
        const p = computePlan(budget, profile, {
          targetPriceKrw: t.krw,
          monthlySavingKrw: saveKrw,
          monthlySideKrw: sideKrw,
          appreciation: { down: downRate, flat: 0, up: upPct / 100 },
        });
        out[t.key] = p.scenarios.find((s) => s.key === "flat")!.months;
      }
    }
    return out;
  }, [tiers, budget, profile, saveKrw, sideKrw, upPct, downRate]);

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
          <NumField label="목표 집값(만원)" value={manualTarget} onChange={setManualTarget} hint={unitHint(manualTarget)} />
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
          <NumField label="연 가구소득(만원)" value={income} onChange={setIncome} hint={unitHint(income)} />
          <NumField label="보유 현금(만원)" value={cash} onChange={setCash} hint={unitHint(cash)} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
          소득은 <b>대출 한도</b>(DSR), 현금은 <b>자기자본</b>을 정해요 — 이 둘이 “지금 살 수 있는
          가격”의 출발선이에요. 아래 <b>월 저축</b>은 거기서부터 ‘모으는 속도’고요.
        </p>
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
          집값이 앞으로 어떻게 될까요?{" "}
          <span style={{ color: "#9a8f82" }}>· 가정(예측 아님), 골라보세요</span>
        </p>

        <div className="mt-2 flex flex-col gap-1.5">
          {(["down", "flat", "up"] as ScenarioKey[]).map((k) => (
            <ScenarioRow
              key={k}
              scenKey={k}
              ratePct={k === "down" ? -6 : k === "flat" ? 0 : Math.round(upPct)}
              months={plan.scenarios.find((s) => s.key === k)!.months}
              selected={scenarioKey === k}
              onSelect={() => setScenarioKey(k)}
            />
          ))}
        </div>

        {scenarioKey === "up" && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px]" style={{ color: "#6b6157" }}>
              상승률
            </span>
            {[3, 5, 7].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setUpPct(r)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  Math.round(upPct) === r
                    ? "border-coral-600 bg-coral-600 text-white"
                    : "border-[#e0d3bf] bg-white text-[#9a8f82]"
                }`}
              >
                +{r}%
              </button>
            ))}
            <span className="text-[11px]" style={{ color: "#9a8f82" }}>
              · 동네 10년 평균 ≈ +{Math.round(defaultUpPct(sgg))}%(KB)
            </span>
          </div>
        )}

        {guide.tone === "reachable" ? (
          <div className="mt-3 rounded-2xl bg-white/70 p-3">
            <p className="text-[15px] font-bold" style={{ color: "#3a322c" }}>
              {SCEN_MEANING[scenarioKey]} 내 집 마련까지{" "}
              <span style={{ color: "#f2603c" }}>약 {formatDday(selectedMonths)}</span>
            </p>
            {boostedMonths != null &&
              selectedMonths != null &&
              boostedMonths < selectedMonths && (
                <p className="mt-0.5 text-[12px]" style={{ color: "#6b6157" }}>
                  월 30만원 더 모으면{" "}
                  <b style={{ color: "#f2603c" }}>약 {formatDday(boostedMonths)}</b>로 당겨져요.
                </p>
              )}
          </div>
        ) : guide.tone === "needBasics" ? (
          <BasicsGuide />
        ) : (
          <HopelessGuide guide={guide} regionLabel={manualMode ? null : sgg} />
        )}

        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
          하락 −6%(직전 하락기 2022·부동산원) · 보합 0% · 상승(동네 10년 평균·KB). 예측이 아니라 과거
          지표 + 가정이에요. 아래 저축을 늘리면 시점이 당겨져요 👇
        </p>
      </section>

      {/* 경주 차트 */}
      <section className="rounded-3xl border border-[#e5e5ea] bg-white p-4 shadow-sm">
        <PlanRaceChart result={plan} focus={scenarioKey} />
        <div className="mt-3 rounded-2xl bg-coral-50/50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-semibold" style={{ color: "#3a322c" }}>
              지금 살 수 있는 가격{" "}
              <span className="text-[11px] font-normal" style={{ color: "#9a8f82" }}>
                (그래프 출발선)
              </span>
            </span>
            <span className="text-base font-extrabold tabular-nums" style={{ color: "#f2603c" }}>
              {eok(Math.max(0, plan.purchaseNowKrw))}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "#6b6157" }}>
            현금(자기자본) <b>{eok(plan.equityKrw)}</b> + 소득 기반 추정 대출{" "}
            <b>{eok(plan.loanKrw)}</b> − 부대비용 <b>{eok(plan.acqCostKrw)}</b>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
            여기서 <b>월 {formatKrwHuman(plan.monthlyAccumKrw)}</b>씩 모아 목표까지 부족한{" "}
            <b>{eok(plan.gapKrw)}</b>을 따라잡는 게 위 그래프예요. 모두 추정.
          </p>
        </div>
      </section>

      {/* 레버 */}
      <section className="rounded-3xl border border-coral-100 bg-coral-50/50 p-5">
        <h2 className="mb-1 text-[15px] font-bold" style={{ color: "#3a322c" }}>
          레버 — 바꾸면 시점이 움직여요
        </h2>
        <p className="mb-3 text-[11px]" style={{ color: "#9a8f82" }}>
          매달 더 모을수록 위 ‘내 집 마련 시점’이 당겨져요.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="월 저축(만원)" value={saveStr} onChange={setSaveStr} hint={unitHint(saveStr)} />
          <NumField label="월 부업·세전(만원)" value={sideStr} onChange={setSideStr} hint={unitHint(sideStr)} />
        </div>
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
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
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
      <span
        className="h-3.5 text-[11px] font-semibold tabular-nums"
        style={{ color: "#f2603c" }}
      >
        {hint ?? ""}
      </span>
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

function ScenarioRow({
  scenKey,
  ratePct,
  months,
  selected,
  onSelect,
}: {
  scenKey: ScenarioKey;
  ratePct: number;
  months: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const info = SCEN_INFO[scenKey];
  const sign = ratePct > 0 ? `+${ratePct}` : `${ratePct}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition-colors ${
        selected ? "border-coral-500 bg-white shadow-sm" : "border-[#e7ddcd] bg-white/60"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="inline-block shrink-0"
          style={{ width: 8, height: 8, borderRadius: 9, background: SCEN_COLOR[scenKey] }}
        />
        <span className="truncate">
          <span className="text-[13px] font-bold" style={{ color: "#3a322c" }}>
            {info.label}
          </span>{" "}
          <span className="text-[11px]" style={{ color: "#9a8f82" }}>
            연 {sign}% · {info.hint}
          </span>
        </span>
      </span>
      <span
        className="shrink-0 text-[13px] font-bold tabular-nums"
        style={{ color: selected ? "#f2603c" : "#6b6157" }}
      >
        {formatDday(months)}
      </span>
    </button>
  );
}
