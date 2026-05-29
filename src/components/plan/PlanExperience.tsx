"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import {
  AREA_RANGES,
  AREA_RANGE_ORDER,
  SEOUL_GU,
  GYEONGGI_SIGUNGU,
} from "@/types/profile";
import { estimateBudget } from "@/lib/budget";
import { evaluatePolicyLoans } from "@/lib/policyLoan";
import { estimateCapitalGainsTax } from "@/lib/capitalGainsTax";
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
import { TrajectorySection } from "@/components/plan/TrajectorySection";
import { buildLadder } from "@/lib/plan/trajectory";
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

// 전용㎡ → 평형 밴드 (찾기→플랜 크로스링크 prefill용)
const bandOfArea = (m2: number): AreaRangeKey | null => {
  for (const k of AREA_RANGE_ORDER) {
    const r = AREA_RANGES[k];
    if (m2 >= r.minM2 && (r.maxM2 === null || m2 < r.maxM2)) return k;
  }
  return null;
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

function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// D-day 숫자가 새 값으로 부드럽게 굴러가는(롤링) 표시값. null(40년+)은 즉시 전환.
function useRollingMonths(target: number | null): number | null {
  const [disp, setDisp] = useState<number | null>(target);
  const prev = useRef<number | null>(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (target === null || from === null || from === target || prefersReduced()) {
      setDisp(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 600);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(from + (target - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return disp;
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

// 결과에 따라 반응하는 비버 — MZ 시크 톤. 끝은 희망(멀어도 같이 세보자).
function heroBeaver(months: number | null, basics: boolean): { src: string; word: string } {
  if (basics) return { src: "biji-wallet-empty", word: "저축시작,\n할수있어!" };
  if (months === null) return { src: "biji-think-cool", word: "동네 다시\n골라야겠는데" };
  if (months <= 36) return { src: "biji-cheer-cocky", word: "레고레고~" };
  if (months <= 84) return { src: "biji-running", word: "이대로\n쭉 ㄱㄱ" };
  return { src: "biji-clock-sigh", word: "오래걸려도\n포기X" };
}

// ── R3 재방문 — "살아있는 D-day": 저장된 플랜으로 경과월만큼 모았다면 시점 재계산 ──
type SavedPlan = {
  g: string; b: AreaRangeKey; t: TierKey; mm: number; mt: string;
  i: string; c: string; s: string; sd: string; u: number; sc: ScenarioKey;
  nh: number; nw: number; nb: number; at: number; sm: number | null;
  // v2 (선택): 1주택 갈아타기 — em=on, es=매도가, er=잔금, ea=취득가(0이면 미상), ey=보유연수, ex=비과세
  em?: number; es?: string; er?: string; ea?: string; ey?: string; ex?: number;
};

function planProfileFrom(s: SavedPlan, extraCashKrw = 0): CoupleProfile {
  const cash = manwon(s.c) + extraCashKrw;
  const em = !!s.em;
  const existingHome = em
    ? {
        expectedSalePriceKrw: manwon(s.es ?? "0"),
        remainingLoanKrw: manwon(s.er ?? "0"),
        qualifiesForTaxExemption: !!s.ex,
        acquisitionPriceKrw: parseFloat(s.ea ?? "0") > 0 ? manwon(s.ea ?? "0") : undefined,
        holdingYears: parseInt(s.ey ?? "0") > 0 ? parseInt(s.ey ?? "0") : undefined,
      }
    : undefined;
  return {
    householdType: "single",
    priorities: { commute: 3, school: 3, buildingAge: 3, largeComplex: 2 },
    preferredAreaRanges: ["p32_35"],
    hasSchoolAgedChild: false, hasInfant: !!s.nb, hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false, isExpectingChild: false,
    budgetMode: "detailed",
    householdIncomeKrwYear: manwon(s.i), seedMoneyKrw: cash, netAssetsKrw: cash,
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: em ? true : !s.nh,
    isNewlywed: !!s.nw,
    ownedHomeCount: em ? 1 : 0,
    existingHome,
  };
}
function withIncome(p: CoupleProfile, krw: number): CoupleProfile {
  return { ...p, householdIncomeKrwYear: krw };
}

// 부업이 소득요건을 넘겨 정책대출 한도가 줄기 시작하는 지점(만원/월). 한도 변화 없으면 null.
function computeSideWarn(
  profile: CoupleProfile,
  incomeKrw: number,
  sigungu?: string | null,
): { keepMan: number; lost: string[] } | null {
  const base = withIncome(profile, incomeKrw); // 부업 제외 기본 소득
  const baseLoan = estimateBudget(base, { sigungu }).loanEstimateKrw;
  if (baseLoan <= 0) return null;
  const baseElig = evaluatePolicyLoans(base)
    .filter((m) => m.eligible)
    .map((m) => m.productName);
  if (baseElig.length === 0) return null;
  for (let v = 10; v <= 300; v += 10) {
    const over = withIncome(profile, incomeKrw + v * 120_000); // +v만/월
    if (estimateBudget(over, { sigungu }).loanEstimateKrw < baseLoan - 1_000_000) {
      const overElig = new Set(
        evaluatePolicyLoans(over)
          .filter((m) => m.eligible)
          .map((m) => m.productName),
      );
      const lost = baseElig.filter((p) => !overElig.has(p));
      return { keepMan: Math.max(0, v - 10), lost: lost.length ? lost : baseElig };
    }
  }
  return null;
}

function planTargetKrw(s: SavedPlan): number {
  if (s.mm) return manwon(s.mt);
  const cell = REGIONS[s.g]?.[s.b];
  const tier = cell?.tiers?.find((t) => t.key === s.t) ?? cell?.tiers?.[1] ?? cell?.tiers?.[0];
  return tier?.krw ?? cell?.medianKrw ?? 0;
}
function planMonthsFor(s: SavedPlan, extraCashKrw = 0): number | null {
  const prof = planProfileFrom(s, extraCashKrw);
  const scen = regionScenarios(s.g);
  const target = planTargetKrw(s);
  const p = computePlan(estimateBudget(prof, { targetPriceKrw: target, sigungu: s.g }), prof, {
    targetPriceKrw: target,
    monthlySavingKrw: manwon(s.s),
    monthlySideKrw: manwon(s.sd),
    appreciation: { down: scen.down.rateAnnual, flat: 0, up: s.u / 100 },
    headlineKey: s.sc,
  });
  return p.scenarios.find((x) => x.key === s.sc)!.months;
}
function downloadPlanIcs() {
  const start = new Date(Date.now() + 30 * 86_400_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//bijigo//plan//KO", "BEGIN:VEVENT",
    "UID:" + Date.now() + "@bijigo.kr", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(start),
    "SUMMARY:비집고 — 내 집 마련 플랜 다시 보기",
    "DESCRIPTION:그동안 모은 만큼 D-day가 당겨졌는지 확인해보세요 https://bijigo.kr/plan",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "비집고-내집마련-점검일.ics";
  a.click();
  URL.revokeObjectURL(url);
}

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

  // 1주택 갈아타기 (existingHome) — 토글 + 매도가/잔금/취득가/보유연수/비과세 요건
  const [existingMode, setExistingMode] = useState(false);
  const [existingSaleStr, setExistingSaleStr] = useState("60000"); // 6억
  const [existingRemainStr, setExistingRemainStr] = useState("20000"); // 2억
  const [existingAcqStr, setExistingAcqStr] = useState(""); // 취득가(선택, 만원)
  const [existingYearsStr, setExistingYearsStr] = useState("5"); // 보유연수(기본 5)
  const [existingExempt, setExistingExempt] = useState(true);

  // 레버 (저축·부업은 캡 없이 직접 입력 — 만원)
  const [saveStr, setSaveStr] = useState("200");
  const [sideStr, setSideStr] = useState("0");
  const [upPct, setUpPct] = useState(() => defaultUpPct(DEFAULT_SGG));
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("flat");
  // 복리 이자 가정 — 현금자산은 (1+r)^t, 월저축은 annuity FV로 복리.
  const [interestOn, setInterestOn] = useState(false);
  const [interestPct, setInterestPct] = useState(5);
  const interestRateAnnual = interestOn ? interestPct / 100 : undefined;
  // 이스터에그: 차트 배경색 5단계 순환 (다크 → 핑크 → 노랑 → 흰 → 초록). 우상단 작은 점.
  const [chartBgIdx, setChartBgIdx] = useState(0);

  // 무거운 재계산은 디바운스된 값으로(타이핑 부드럽게). 입력칸 표시·미리보기는 즉시.
  const incomeKrw = useDebounced(manwon(income));
  const cashKrw = useDebounced(manwon(cash));
  const saveKrw = useDebounced(manwon(saveStr));
  const sideKrw = useDebounced(manwon(sideStr));
  const existingSaleKrw = useDebounced(manwon(existingSaleStr));
  const existingRemainKrw = useDebounced(manwon(existingRemainStr));
  const existingAcqKrw = useDebounced(manwon(existingAcqStr));
  const existingYears = useDebounced(parseInt(existingYearsStr) || 0);

  // 갈아타기 ON 시 budget 엔진에 넘길 existingHome — 매도가/잔금/(취득가)/(보유연수)/비과세.
  const existingHomeObj = useMemo(
    () =>
      existingMode
        ? {
            expectedSalePriceKrw: existingSaleKrw,
            remainingLoanKrw: existingRemainKrw,
            qualifiesForTaxExemption: existingExempt,
            acquisitionPriceKrw: existingAcqKrw > 0 ? existingAcqKrw : undefined,
            holdingYears: existingYears > 0 ? existingYears : undefined,
          }
        : undefined,
    [existingMode, existingSaleKrw, existingRemainKrw, existingExempt, existingAcqKrw, existingYears],
  );

  // 자기자본 분해 표시용 양도세 추정(엔진과 동일 모듈, 표시만 별도).
  const cgtEst = useMemo(
    () =>
      existingHomeObj && existingHomeObj.expectedSalePriceKrw > 0
        ? estimateCapitalGainsTax(existingHomeObj)
        : null,
    [existingHomeObj],
  );
  const homeSaleNetKrw = useMemo(() => {
    if (!existingHomeObj) return 0;
    const net =
      existingHomeObj.expectedSalePriceKrw -
      existingHomeObj.remainingLoanKrw -
      (cgtEst?.taxKrw ?? 0);
    return net; // 음수도 그대로 — 언더워터 경고용
  }, [existingHomeObj, cgtEst]);

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
      // 부업도 부부합산 소득에 포함(현실화) — 대출 한도·정책대출 자격에 반영.
      householdIncomeKrwYear: incomeKrw + sideKrw * 12,
      seedMoneyKrw: cashKrw,
      netAssetsKrw: cashKrw,
      existingLoanMonthlyKrw: 0,
      // 갈아타기 ON → 기보유(1주택), 그 외엔 noHome 칩 반전.
      hasOwnedHomeBefore: existingMode ? true : !noHome,
      isNewlywed: newlywed,
      ownedHomeCount: existingMode ? 1 : 0,
      existingHome: existingHomeObj,
    }),
    [incomeKrw, sideKrw, cashKrw, noHome, newlywed, newborn, existingMode, existingHomeObj],
  );

  const budget = useMemo(
    () => estimateBudget(profile, { targetPriceKrw: targetKrw, sigungu: sgg }),
    [profile, targetKrw, sgg],
  );

  // 부업 절벽 경고 — 대출 한도가 실제로 줄어드는 경우(정책대출 활용 중)에만 노출.
  const sideWarn = computeSideWarn(profile, incomeKrw, sgg);

  const plan = useMemo(
    () =>
      computePlan(budget, profile, {
        targetPriceKrw: targetKrw,
        monthlySavingKrw: saveKrw,
        monthlySideKrw: sideKrw,
        appreciation: { down: downRate, flat: 0, up: upPct / 100 },
        headlineKey: scenarioKey,
        interestRateAnnual,
      }),
    [budget, profile, targetKrw, saveKrw, sideKrw, upPct, downRate, scenarioKey, interestRateAnnual],
  );

  const guide = useMemo(() => planGuidance(plan), [plan]);

  // 동네 사다리 — 사용자가 고른 시나리오(하락/보합/상승) 그대로 재사용(단일 진실).
  // ~72 시군구 × computePlan이라 디바운스된 입력으로만 재계산.
  const ladder = useMemo(
    () =>
      buildLadder(profile, {
        band,
        monthlySavingKrw: saveKrw,
        monthlySideKrw: sideKrw,
        scenarioKey,
        interestRateAnnual,
      }),
    [profile, band, saveKrw, sideKrw, scenarioKey, interestRateAnnual],
  );

  // 선택 시나리오의 도달 시점 + "월 30만 더" 시뮬(행동 유도).
  const selectedMonths = plan.scenarios.find((s) => s.key === scenarioKey)!.months;
  const boostedMonths = useMemo(() => {
    const p = computePlan(budget, profile, {
      targetPriceKrw: targetKrw,
      monthlySavingKrw: saveKrw + 300_000,
      monthlySideKrw: sideKrw,
      appreciation: { down: downRate, flat: 0, up: upPct / 100 },
      headlineKey: scenarioKey,
      interestRateAnnual,
    });
    return p.scenarios.find((s) => s.key === scenarioKey)!.months;
  }, [budget, profile, targetKrw, saveKrw, sideKrw, upPct, downRate, scenarioKey, interestRateAnnual]);

  const rollingSelected = useRollingMonths(selectedMonths);
  const tierLabel = manualMode ? "직접 입력" : (selectedTier?.label ?? "");

  // R3 재방문 — 이 기기에 저장한 플랜 복원 + "그동안 모았다면" 진전 표시.
  // 추천(찾기)에서 단지 클릭으로 들어온 경우 URL 파라미터를 우선 적용한다.
  const [revisit, setRevisit] = useState<
    { months: number; savedMonths: number; advanced: number } | null
  >(null);
  const [fromComplex, setFromComplex] = useState<
    { name?: string; sgg?: string; dong?: string; price: number } | null
  >(null);
  const [justSaved, setJustSaved] = useState(false);
  const searchParams = useSearchParams();
  /* eslint-disable react-hooks/set-state-in-effect -- localStorage·URL 복원은 마운트 후 1회(하이드레이션 안전) */
  useEffect(() => {
    // URL 파라미터(찾기→플랜 크로스링크)가 있으면 우선 적용.
    const priceP = searchParams?.get("price");
    const priceN = priceP ? parseFloat(priceP) : 0;
    if (priceN > 0) {
      const nameP = searchParams?.get("name") ?? undefined;
      const sggP = searchParams?.get("sgg") ?? undefined;
      const dongP = searchParams?.get("dong") ?? undefined;
      const areaP = searchParams?.get("area");
      setManualMode(true);
      setManualTarget(Math.round(priceN / 10_000).toString());
      if (sggP && REGIONS[sggP]) {
        setSgg(sggP);
        setUpPct(defaultUpPct(sggP));
        if (areaP) {
          const b = bandOfArea(parseFloat(areaP));
          if (b && REGIONS[sggP]?.[b]) setBand(b);
        }
      }
      setFromComplex({ name: nameP, sgg: sggP, dong: dongP, price: priceN });
      return; // URL prefill 시 localStorage·revisit 무시
    }
    try {
      const raw = localStorage.getItem("biji-plan");
      if (!raw) return;
      const s = JSON.parse(raw) as SavedPlan;
      if (!s || !s.g) return;
      setSgg(s.g); setBand(s.b); setTierKey(s.t); setManualMode(!!s.mm); setManualTarget(s.mt);
      setIncome(s.i); setCash(s.c); setSaveStr(s.s); setSideStr(s.sd); setUpPct(s.u); setScenarioKey(s.sc);
      setNoHome(!!s.nh); setNewlywed(!!s.nw); setNewborn(!!s.nb);
      if (s.em) {
        setExistingMode(true);
        if (s.es) setExistingSaleStr(s.es);
        if (s.er) setExistingRemainStr(s.er);
        if (s.ea) setExistingAcqStr(s.ea);
        if (s.ey) setExistingYearsStr(s.ey);
        setExistingExempt(!!s.ex);
      }
      // 경과월만큼 계획대로 모았다면 — 당겨진 시점
      if (s.sm != null) {
        const days = (Date.now() - s.at) / 86_400_000;
        const months = Math.floor(days / 30);
        const accum = manwon(s.s) + Math.round(manwon(s.sd) * 0.9);
        if (days >= 7 && months >= 1 && accum > 0) {
          const advanced = planMonthsFor(s, months * accum);
          if (advanced != null && advanced < s.sm) {
            setRevisit({ months, savedMonths: s.sm, advanced });
          }
        }
      }
    } catch {
      /* 손상된 저장값 무시 */
    }
  }, [searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */
  function savePlan() {
    const s: SavedPlan = {
      g: sgg, b: band, t: tierKey, mm: manualMode ? 1 : 0, mt: manualTarget,
      i: income, c: cash, s: saveStr, sd: sideStr, u: upPct, sc: scenarioKey,
      nh: noHome ? 1 : 0, nw: newlywed ? 1 : 0, nb: newborn ? 1 : 0,
      at: Date.now(), sm: selectedMonths,
      em: existingMode ? 1 : 0,
      es: existingMode ? existingSaleStr : undefined,
      er: existingMode ? existingRemainStr : undefined,
      ea: existingMode ? existingAcqStr : undefined,
      ey: existingMode ? existingYearsStr : undefined,
      ex: existingMode && existingExempt ? 1 : 0,
    };
    try {
      localStorage.setItem("biji-plan", JSON.stringify(s));
      setJustSaved(true);
    } catch {
      /* 저장 불가(시크릿 모드 등) — 조용히 무시 */
    }
  }

  // 각 티어의 '보합 기준' 도달 시점 — 카드에 띄워 "이 집이면 D−Xy, 한 칸 아래면 D−Yy" 체감.
  // 티어마다 가격이 달라 LTV 캡(15/25억)이 다를 수 있어 티어별 budget을 계산.
  const tierMonths = useMemo(() => {
    const out: Partial<Record<TierKey, number | null>> = {};
    if (tiers) {
      for (const t of tiers) {
        const tBudget = estimateBudget(profile, { targetPriceKrw: t.krw, sigungu: sgg });
        const p = computePlan(tBudget, profile, {
          targetPriceKrw: t.krw,
          monthlySavingKrw: saveKrw,
          monthlySideKrw: sideKrw,
          appreciation: { down: downRate, flat: 0, up: upPct / 100 },
        });
        out[t.key] = p.scenarios.find((s) => s.key === "flat")!.months;
      }
    }
    return out;
  }, [tiers, profile, sgg, saveKrw, sideKrw, upPct, downRate]);

  return (
    <div className="flex flex-col gap-5">
      {/* 결론 히어로 — 답 먼저 + 반응형 비버 */}
      <section
        className="relative overflow-hidden rounded-3xl px-5 py-6 text-white"
        style={{
          background: "linear-gradient(135deg,#ff8a5c 0%,#fe7644 55%,#e8662f 100%)",
          boxShadow: "0 10px 26px -12px rgba(232,102,47,0.55)",
        }}
      >
        <div className="flex items-stretch gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.88)" }}>
              {sgg} {cell ? AREA_RANGES[band].label : ""}
              {tierLabel ? ` · ${tierLabel}` : ""} · {SCEN_INFO[scenarioKey].label} 가정
            </p>
            {selectedMonths === null ? (
              <>
                <p className="font-jua mt-1.5 leading-tight" style={{ fontSize: 25 }}>
                  이대로면 길어
                </p>
                <p className="mt-1.5 text-[13px]" style={{ color: "rgba(255,255,255,0.92)" }}>
                  근데 동네 한 칸 내리거나 저축 늘리면 가능 — 보자~
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                  지금 속도면 내 집 마련까지
                </p>
                <div className="mt-0.5 flex flex-wrap items-end gap-x-2 gap-y-0.5">
                  <span className="font-jua leading-none" style={{ fontSize: 42 }}>
                    {rollingSelected !== null && rollingSelected > 0 ? "약 " : ""}{formatDday(rollingSelected)}
                  </span>
                  <DeltaCallout months={selectedMonths} />
                </div>
                {boostedMonths != null && boostedMonths < selectedMonths && (
                  <p className="mt-1.5 text-[13px]" style={{ color: "rgba(255,255,255,0.92)" }}>
                    월 30만원 더 모으면 <b>{boostedMonths > 0 ? "약 " : ""}{formatDday(boostedMonths)}</b>
                  </p>
                )}
                {/* 목표 달성률 progress bar — 추정 구매력 ÷ 목표가. 동기부여. */}
                {targetKrw > 0 && budget.netPurchasePowerKrw > 0 && (() => {
                  const pct = Math.min(100, Math.round((budget.netPurchasePowerKrw / targetKrw) * 100));
                  return (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                        <span>지금 살 수 있는 가격 / 목표가</span>
                        <span className="font-jua text-[13px]" style={{ color: "#fff8e8" }}>{pct}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 100 ? "#a8e6a3" : "#ffd596",
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <div className="flex w-[78px] shrink-0 flex-col items-center justify-end">
            {(() => {
              const hero = heroBeaver(selectedMonths, guide.tone === "needBasics");
              // 시크 비지 5장 모두 자체 모션 비디오 있음 — 자리에 따라 자동 video 분기.
              // 임시 비활성화 — colorkey 알파 비디오 문제(눈 빨강·흰 잔여) 해결 라운드까지 PNG만.
              const HAS_VIDEO = new Set<string>();
              if (HAS_VIDEO.has(hero.src)) {
                return (
                  <>
                    {/* key={hero.src} — src 변경 시 <video> 강제 re-mount해 새 source 로드.
                        (video 태그는 src 변경만으론 reload 안 함 — 시나리오별 모션 안 바뀜 원인.) */}
                    <video
                      key={hero.src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                      width={72}
                      height={72}
                      className="biji-motion-video h-[72px] w-[72px] drop-shadow-md"
                      aria-label="비집고 비지"
                    >
                      <source src={`/biji/${hero.src}.webm`} type="video/webm" />
                      <source src={`/biji/${hero.src}.mp4`} type="video/mp4" />
                    </video>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/biji/${hero.src}.png?v=16`}
                      alt="비집고 비지"
                      width={72}
                      height={72}
                      className="biji-motion-fallback h-[72px] w-[72px] drop-shadow-md"
                      draggable={false}
                    />
                  </>
                );
              }
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/biji/${hero.src}.png?v=16`}
                  alt="비집고 비지"
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] drop-shadow-md"
                  draggable={false}
                />
              );
            })()}
            <span
              className="mt-1 whitespace-pre-line rounded-2xl bg-white/20 px-2 py-1 text-center text-[10px] font-semibold leading-tight"
              style={{ backdropFilter: "blur(2px)" }}
            >
              {heroBeaver(selectedMonths, guide.tone === "needBasics").word}
            </span>
          </div>
        </div>
      </section>

      {/* R3 재방문 — 지난번보다 당겨진 D-day */}
      {revisit && (
        <section className="flex items-center gap-3 rounded-3xl border border-[#ecd9b3] bg-[#fdf6e7]/80 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/biji/biji-compare.png"
            alt=""
            aria-hidden
            className="h-14 w-auto shrink-0"
            draggable={false}
          />
          <div className="min-w-0">
            <p className="text-[12px]" style={{ color: "#6e5b46" }}>
              지난번 플랜이야 · 계획대로 <b>{revisit.months}개월</b> 모았다면
            </p>
            <p className="mt-0.5 text-sm font-bold" style={{ color: "#3a2c1d" }}>
              {formatDday(revisit.savedMonths)}{" "}
              <span style={{ color: "#9c8a72" }}>→</span>{" "}
              <span style={{ color: "#fe7644" }}>{formatDday(revisit.advanced)}</span> 로 당겨졌네 ▼
            </p>
          </div>
        </section>
      )}

      {/* 목표 — 동네+평형 → 티어 선택 (또는 찾기에서 넘어온 단지 기준) */}
      <section className="rounded-3xl border border-[#ecd9b3] bg-[#fdf6e7]/70 p-5">
        {fromComplex ? (
          <div
            className="mb-3 rounded-2xl border px-3 py-2.5"
            style={{ background: "#fff7e6", borderColor: "#f0d9a0" }}
          >
            <p className="text-[13px] font-bold" style={{ color: "#3a2c1d" }}>
              🔑 {fromComplex.name ?? "선택한 집"} 기준 플랜
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "#9a5a1e" }}>
              {fromComplex.sgg ?? ""} {fromComplex.dong ?? ""} · {eok(fromComplex.price)} (찾기에서
              넘어옴)
            </p>
          </div>
        ) : null}
        <h2 className="mb-1 text-[15px] font-bold" style={{ color: "#3a2c1d" }}>
          어느 동네 원하세요?
        </h2>
        <p className="mb-3 text-[12px]" style={{ color: "#6e5b46" }}>
          동네·평형을 고르고, 어느 정도 집을 목표로 할지 골라요. 평균이 아니라 <b>내가 원하는 집</b>으로.
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
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#9c8a72" }}>
                  동네 등급 아님 · <b>내가 목표로 할 가격대</b>. 국토부 공개 실거래 예시 · 추정
                  {fmtMonth(cell?.asOf) ? ` · ${fmtMonth(cell?.asOf)} 기준` : FRESH_DATE ? ` · ${FRESH_DATE} 기준` : ""}
                  {cell ? ` · ${cell.sampleCount}건` : ""}. 예시는 그 가격대 실거래 단지 중 하나 · 매수 권유 아님.
                </p>
              </>
            ) : (
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px]" style={{ color: "#6e5b46" }}>
                    {sgg} {cell ? AREA_RANGES[band].label : ""} 추정 시세
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums" style={{ color: "#fe7644" }}>
                    {cell ? eok(cell.medianKrw) : "—"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: "#9c8a72" }}>
                  표본 적어 단일 추정만
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
          className="mt-3 inline-flex items-center gap-1 rounded-full border-2 border-coral-300 bg-white px-4 py-2 text-[13px] font-bold transition-colors hover:border-coral-500 hover:bg-coral-50"
          style={{ color: "#c4521f" }}
        >
          {manualMode ? "🏘️ 동네로 고르기" : "⌨️ 직접 금액 입력"}
        </button>
      </section>

      {/* 내 상황 */}
      <section className="rounded-3xl border border-[#e5e5ea] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-[15px] font-bold" style={{ color: "#3a2c1d" }}>
          내 상황은 <span className="font-medium" style={{ color: "#9c8a72" }}>소득 / 예금 (대출한도 계산용)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="연 가구소득(만원)" value={income} onChange={setIncome} hint={unitHint(income)} />
          <NumField label="보유 현금(만원)" value={cash} onChange={setCash} hint={unitHint(cash)} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#9c8a72" }}>
          소득 = <b>대출 한도</b>(DSR) / 현금 = <b>자기자본</b> — 둘이 “지금 살 수 있는
          가격”의 출발선. 아래 <b>월 저축</b>은 ‘모으는 속도’.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip
            on={noHome && !existingMode}
            onClick={() => {
              setNoHome((v) => !v);
              if (existingMode) setExistingMode(false); // 무주택↔갈아타기 상호 배타
            }}
            label="무주택"
          />
          <Chip on={newlywed} onClick={() => setNewlywed((v) => !v)} label="혼인 7년 이내" />
          <Chip on={newborn} onClick={() => setNewborn((v) => !v)} label="출산 2년 이내" />
          <Chip
            on={existingMode}
            onClick={() => {
              const next = !existingMode;
              setExistingMode(next);
              if (next) setNoHome(false); // 갈아타기 ON → 무주택 OFF
            }}
            label="🏠 1주택 갈아타기"
          />
        </div>

        {existingMode && (
          <div className="mt-3 rounded-2xl border border-[#ecd9b3] bg-[#fdf6e7]/60 p-4">
            <p className="text-[12px] font-bold" style={{ color: "#3a2c1d" }}>
              지금 사는 집 정보 — 매도 순수령액이 새 집 자기자본에 합산
            </p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "#9a5a1e" }}>
              <b>양도세</b>는 매도가·취득가·보유기간으로 달라짐. 취득가 입력하면 정확해짐,
              모르면 보수적으로 매도가의 약 6%로 잡아요. 모두 추정 · 실 세액은 세무사 상담.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumField
                label="예상 매도가(만원)"
                value={existingSaleStr}
                onChange={setExistingSaleStr}
                hint={unitHint(existingSaleStr)}
              />
              <NumField
                label="남은 주담대 잔금(만원)"
                value={existingRemainStr}
                onChange={setExistingRemainStr}
                hint={unitHint(existingRemainStr)}
              />
              <NumField
                label="취득가(만원, 선택)"
                value={existingAcqStr}
                onChange={setExistingAcqStr}
                hint={parseFloat(existingAcqStr) > 0 ? unitHint(existingAcqStr) : "모르면 비워두세요"}
              />
              <NumField
                label="보유 연수(년)"
                value={existingYearsStr}
                onChange={setExistingYearsStr}
                hint={parseInt(existingYearsStr) > 0 ? `장특공제 산정` : undefined}
              />
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl bg-white px-3 py-2.5">
              <input
                type="checkbox"
                checked={existingExempt}
                onChange={(e) => setExistingExempt(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#fe7644]"
              />
              <span className="text-[12px] leading-relaxed" style={{ color: "#3a2c1d" }}>
                <b>1세대 1주택 비과세 요건 충족</b> (2년 이상 보유 · 거주, 매도가 12억 이하면 양도세 0)
                <span className="ml-1 text-[11px]" style={{ color: "#9c8a72" }}>
                  · 매도가 12억 초과 시 초과분만 과세
                </span>
              </span>
            </label>
            {cgtEst && (
              <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-[12px] leading-relaxed">
                <p style={{ color: "#3a2c1d" }}>
                  <b>매도 순수령액 약 {eok(Math.max(0, homeSaleNetKrw))}</b>
                  <span style={{ color: "#9c8a72" }}>
                    {" "}
                    = 매도 {eok(existingSaleKrw)} − 잔금 {eok(existingRemainKrw)} − 양도세 약{" "}
                    {formatKrwHuman(cgtEst.taxKrw)}
                  </span>
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "#9a5a1e" }}>
                  💰 {cgtEst.note}
                </p>
                {homeSaleNetKrw < 0 && (
                  <p className="mt-1 text-[11px] font-bold" style={{ color: "#c4521f" }}>
                    ⚠️ 매도가 − 잔금 − 양도세가 음수 — 자기자본 줄어듦. 매도 타이밍·잔금
                    정리 우선 고려.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* D-day 범위 / 가이드 */}
      <section
        className="rounded-3xl px-5 py-5"
        style={{
          background: "linear-gradient(135deg, #fff4ef 0%, #f7ead0 100%)",
          boxShadow: "0 1px 3px rgba(242,96,60,0.08)",
        }}
      >
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/biji/biji-talk.png"
            alt=""
            aria-hidden
            className="h-11 w-auto shrink-0"
            draggable={false}
          />
          <p className="text-xs font-medium" style={{ color: "#6e5b46" }}>
            집값이 앞으로 어떻게 될까요?{" "}
            <span style={{ color: "#9c8a72" }}>· 가정(예측 아님), 골라보세요</span>
          </p>
        </div>

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
            <span className="text-[11px]" style={{ color: "#6e5b46" }}>
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
                    : "border-[#e0d3bf] bg-white text-[#9c8a72]"
                }`}
              >
                +{r}%
              </button>
            ))}
            <span className="text-[11px]" style={{ color: "#9c8a72" }}>
              · 동네 10년 평균 ≈ +{Math.round(defaultUpPct(sgg))}%(KB)
            </span>
          </div>
        )}

        {guide.tone === "needBasics" ? (
          <BasicsGuide />
        ) : guide.tone === "hopeless" ? (
          <HopelessGuide guide={guide} regionLabel={manualMode ? null : sgg} />
        ) : null}

        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#9c8a72" }}>
          하락 −6%(직전 하락기 2022·부동산원) · 보합 0% · 상승(동네 10년 평균·KB). 예측 아님 — 과거
          지표 + 가정. 아래 저축 늘리면 시점 당겨짐 👇
        </p>
      </section>

      {/* 경주 차트 — 따뜻한 다크 클라이맥스(코랄선이 빛남). 우상단 작은 점은 배경색 이스터에그(5단계). */}
      {(() => {
        const BG_THEMES = [
          { bg: "linear-gradient(165deg,#3a2c1d 0%,#2c2116 100%)", dark: true,  text: "rgba(255,255,255,0.7)", titleColor: "white", dotColor: "rgba(255,255,255,0.4)" },
          { bg: "linear-gradient(165deg,#fce7f3 0%,#fbcfe8 100%)", dark: false, text: "#a8336a", titleColor: "#831843", dotColor: "rgba(131,24,67,0.35)" },
          { bg: "linear-gradient(165deg,#fef9c3 0%,#fef08a 100%)", dark: false, text: "#854d0e", titleColor: "#713f12", dotColor: "rgba(113,63,18,0.35)" },
          { bg: "#ffffff",                                        dark: false, text: "#6e5b46", titleColor: "#3a2c1d", dotColor: "rgba(58,44,29,0.3)"  },
          { bg: "linear-gradient(165deg,#d1fae5 0%,#a7f3d0 100%)", dark: false, text: "#047857", titleColor: "#064e3b", dotColor: "rgba(6,78,59,0.35)" },
        ];
        const t = BG_THEMES[chartBgIdx];
        return (
          <section
            className="relative rounded-3xl p-4"
            style={{
              background: t.bg,
              color: t.titleColor,
              boxShadow: "0 12px 30px -14px rgba(44,33,22,0.6)",
            }}
          >
            {/* 이스터에그 토글 — 작은 점 (우상단). 클릭 시 배경색 순환. */}
            <button
              type="button"
              onClick={() => setChartBgIdx((i) => (i + 1) % BG_THEMES.length)}
              className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full opacity-60 transition-opacity hover:opacity-100"
              style={{ background: t.dotColor }}
              aria-label="차트 배경색 변경"
            />
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[12px] font-semibold" style={{ color: t.text }}>
                저축 vs 집값 경주
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/biji/biji-point-up.png"
                alt=""
                aria-hidden
                className="h-12 w-auto drop-shadow"
                draggable={false}
              />
            </div>
            <PlanRaceChart result={plan} focus={scenarioKey} dark={t.dark} />
        <details className="mt-3 rounded-2xl bg-white/10 p-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-baseline justify-between">
            <span className="text-[12px] font-semibold text-white">
              지금 살 수 있는 가격{" "}
              <span className="text-[11px] font-normal" style={{ color: "rgba(255,255,255,0.6)" }}>
                (출발선 · 자세히 ▾)
              </span>
            </span>
            <span className="text-base font-extrabold tabular-nums" style={{ color: "#ff8a5c" }}>
              {eok(Math.max(0, plan.purchaseNowKrw))}
            </span>
          </summary>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
            자기자본 <b>{eok(plan.equityKrw)}</b>
            {existingMode && cgtEst ? (
              <>
                {" "}
                <span style={{ color: "rgba(255,255,255,0.6)" }}>
                  (현금 {eok(cashKrw)} + 매도 순수령액 {eok(Math.max(0, homeSaleNetKrw))})
                </span>
              </>
            ) : null}{" "}
            + 소득 기반 추정 대출 <b>{eok(plan.loanKrw)}</b> − 부대비용{" "}
            <b>{eok(plan.acqCostKrw)}</b>
          </p>
          {existingMode && cgtEst && (
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.66)" }}>
              🏠 매도 {eok(existingSaleKrw)} − 잔금 {eok(existingRemainKrw)} − 양도세 약{" "}
              {formatKrwHuman(cgtEst.taxKrw)} · LTV는 1주택 처분조건부 50% 적용
            </p>
          )}
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            여기서 <b>월 {formatKrwHuman(plan.monthlyAccumKrw)}</b>씩 모아 목표까지 부족한{" "}
            <b>{eok(plan.gapKrw)}</b>을 따라잡는 게 위 그래프. 모두 추정.
          </p>
        </details>
          </section>
        );
      })()}

      {/* 동네 사다리 — "지금 어디" 가 아니라 "시간이 갈수록 어디로 올라가나" (트라젝토리 #1) */}
      <TrajectorySection ladder={ladder} monthlySavingKrw={saveKrw} />

      {/* 저축 레버 */}
      <section className="rounded-3xl border border-[#ecd9b3] bg-[#fdf6e7]/70 p-5">
        <h2 className="mb-1 text-[15px] font-bold" style={{ color: "#3a2c1d" }}>
          저축 레버 — 바꾸면 시점이 움직여요
        </h2>
        <p className="mb-3 text-[11px]" style={{ color: "#9c8a72" }}>
          매달 더 모을수록 위 ‘내 집 마련 시점’이 당겨져요.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <NumField label="월 실제저축액(만원)" value={saveStr} onChange={setSaveStr} hint={unitHint(saveStr)} />
            <input
              type="range"
              min={0}
              max={3000}
              step={10}
              value={Math.min(parseFloat(saveStr) || 0, 3000)}
              onChange={(e) => setSaveStr(e.target.value)}
              className="mt-2 w-full accent-coral-600"
              aria-label="월 실제저축액 슬라이더"
            />
            <div className="flex justify-between text-[10px]" style={{ color: "#9c8a72" }}>
              <span>0</span><span>3,000만</span>
            </div>
          </div>
          <div>
            <NumField label="월 부업·세후(만원)" value={sideStr} onChange={setSideStr} hint={unitHint(sideStr)} />
            <input
              type="range"
              min={0}
              max={1000}
              step={10}
              value={Math.min(parseFloat(sideStr) || 0, 1000)}
              onChange={(e) => setSideStr(e.target.value)}
              className="mt-2 w-full accent-coral-600"
              aria-label="월 부업 슬라이더"
            />
            <div className="flex justify-between text-[10px]" style={{ color: "#9c8a72" }}>
              <span>0</span><span>1,000만</span>
            </div>
          </div>
        </div>
        {sideWarn && (
          <p
            className="mt-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
            style={{ background: "#fdf4e3", color: "#9a5a1e" }}
          >
            💡 부업도 부부합산 소득에 잡힘.{" "}
            {sideWarn.keepMan > 0 ? (
              <>
                <b>월 {sideWarn.keepMan}만</b>까지는 <b>{sideWarn.lost.join("·")}</b> 자격 유지,
                그 이상이면 소득요건 초과 — 정책대출 한도 줄 수 있음.
              </>
            ) : (
              <>
                부업 더하면 소득 늘어 <b>{sideWarn.lost.join("·")}</b> 소득요건 초과 — 정책대출
                한도 줄 수 있음.
              </>
            )}{" "}
            추정이며 실제 자격은 기관 확인.
          </p>
        )}

        {/* 복리 이자 가정 — 모은 돈+매달 저축이 은행 이자로 늘어남 */}
        <div className="mt-3 rounded-2xl border border-[#e0d3bf] bg-white/70 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={interestOn}
              onChange={(e) => setInterestOn(e.target.checked)}
              className="h-4 w-4 accent-coral-600"
            />
            <span className="font-semibold" style={{ color: "#3a2c1d" }}>
              💰 복리 이자 적용
            </span>
            <span className="text-[11px]" style={{ color: "#9c8a72" }}>
              모은 돈+매달 저축에 이자
            </span>
          </label>
          {interestOn && (
            <>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-[12px]" style={{ color: "#6e5b46" }}>연</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={interestPct}
                  onChange={(e) => setInterestPct(Math.max(0, Math.min(20, parseFloat(e.target.value) || 0)))}
                  className="w-16 rounded-md border border-[#e0d3bf] bg-white px-2 py-1 text-right text-[13px] tabular-nums font-semibold"
                  style={{ color: "#3a2c1d" }}
                />
                <span className="text-[12px]" style={{ color: "#6e5b46" }}>% 복리</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={Math.min(interestPct, 10)}
                  onChange={(e) => setInterestPct(parseFloat(e.target.value))}
                  className="flex-1 accent-coral-600"
                  aria-label="복리 이자율"
                />
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed" style={{ color: "#9c8a72" }}>
                기본 5% — 은행 예금 이자 가정. 모은 돈은 (1+r)<sup>t</sup>, 월 저축은 적금처럼 매달 이자가 붙어요.
              </p>
            </>
          )}
        </div>
      </section>

      {/* 도달의 모습 — 비지가 새 집 앞에서 (끝은 희망) */}
      <section className="overflow-hidden rounded-3xl border border-coral-100 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/biji/biji-newhome.png?v=2"
          alt="입주 후 한강 뷰를 바라보는 비지 뒷모습"
          className="block w-full"
          draggable={false}
        />
        <p
          className="px-4 py-2.5 text-center text-[12px] font-semibold"
          style={{ background: "#fff4ef", color: "#9a5a1e" }}
        >
          응원할게 🔑
        </p>
      </section>

      {/* R3 저장 — 한 달 뒤 다시 보기(이 기기에만) */}
      <section className="rounded-3xl border border-coral-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/biji/biji-calendar.png"
            alt=""
            aria-hidden
            className="h-14 w-auto shrink-0"
            draggable={false}
          />
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold" style={{ color: "#3a2c1d" }}>
              한 달 뒤 다시 보기
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "#6e5b46" }}>
              지금 저장해두면, 한 달 뒤 다시 왔을 때 그동안 계획대로 모은 만큼 D-day가 당겨져 보여요.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "#9c8a72" }}>
              💾 <b>이 브라우저에만</b> 저장돼요 (서버 X · 회원가입 X). 같은 기기·같은 브라우저로
              bijigo.kr/plan 다시 오시면 자동 복원.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={savePlan}
            className="rounded-full bg-coral-600 px-4 py-2 text-[13px] font-bold text-white"
          >
            {justSaved ? "이 기기에 저장됨 ✓" : "이 플랜 저장"}
          </button>
          {justSaved && (
            <button
              type="button"
              onClick={downloadPlanIcs}
              className="rounded-full border border-coral-300 px-4 py-2 text-[13px] font-semibold"
              style={{ color: "#c4521f" }}
            >
              📅 점검일 캘린더에 추가
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px]" style={{ color: "#9c8a72" }}>
          소득·현금 포함 <b>이 기기에만</b> 저장 · 서버 전송 X.
        </p>
      </section>

      <p className="px-1 text-[11px] leading-relaxed" style={{ color: "#9c8a72" }}>
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
          style={{ color: selected ? "#fe7644" : "#3a2c1d" }}
        >
          {tier.label}
        </span>
        <span className="text-lg font-extrabold tabular-nums" style={{ color: "#fe7644" }}>
          {eok(tier.krw)}
        </span>
      </div>
      {!hideNames && names && (
        <p className="mt-0.5 truncate text-[11px]" style={{ color: "#6e5b46" }}>
          예: {names} 등 (이 가격대 실거래 중)
        </p>
      )}
      <p className="mt-0.5 text-[11px]" style={{ color: "#9c8a72" }}>
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
            background: "#fe7644",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: "#9c8a72" }}>
        <span>최저 {eok(min)}</span>
        <span>이 동네·평형 실거래</span>
        <span style={{ color: "#6e5b46", fontWeight: 600 }}>최고 {eok(max)}</span>
      </div>
    </div>
  );
}

// 소득·현금·저축이 모두 0 — 시점 계산 불가. 출발선 격려.
function BasicsGuide() {
  return (
    <div className="mt-2 rounded-2xl bg-white/80 p-4">
      <p className="text-sm font-bold" style={{ color: "#3a2c1d" }}>
        출발선. 우선 현금흐름 잡자~
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "#6e5b46" }}>
        소득·현금·월 저축이 모두 0이라 아직 시점 못 그려. 아래 <b>월 저축</b>을 올리거나
        위에서 <b>소득·현금</b> 채워봐 — 너는 되는 애야.
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
      <p className="text-sm font-bold" style={{ color: "#3a2c1d" }}>
        이대로면 길어. 근데 옆 동네면 가능 — 보자~
      </p>
      <ul className="mt-2 flex flex-col gap-2.5">
        <li className="text-[12px] leading-relaxed" style={{ color: "#6e5b46" }}>
          <span className="font-semibold" style={{ color: "#fe7644" }}>
            ① 동네를 한 칸 낮추면
          </span>{" "}
          — 지금 저축 페이스라면 {guide.horizonYears}년이면 약{" "}
          <b>{formatKrwHuman(guide.reachableInHorizonKrw)}</b>까지 닿아요.{" "}
          {regionLabel ? `${regionLabel}보다 한 단계 아래 ` : "한 단계 아래 "}동네·작은 평형부터
          노려보면 훨씬 빨라져요.
          <Link
            href="/"
            className="ml-1 font-semibold underline"
            style={{ color: "#fe7644" }}
          >
            그 가격대 매물 보기 →
          </Link>
        </li>
        {showSaveLever && (
          <li className="text-[12px] leading-relaxed" style={{ color: "#6e5b46" }}>
            <span className="font-semibold" style={{ color: "#fe7644" }}>
              ② 저축을 조금 더 늘리면
            </span>{" "}
            — 월 순증(저축+부업)을 약 <b>{formatKrwHuman(guide.neededMonthlyKrw)}</b>으로 올리면
            보합 기준 {guide.neededYears}년 안에 닿아요. 아래 레버로 맞춰보세요 👇
          </li>
        )}
      </ul>
      <p className="mt-2.5 text-[11px] leading-relaxed" style={{ color: "#9c8a72" }}>
        조급할 필요 없음. 동네 한 칸 낮추거나 저축 조금만 늘려도 시점 확 당겨짐 — 잘좀 하자.
        (예측 아님 — 과거 지표 + 가정 시나리오.)
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
      <span className="text-[12px]" style={{ color: "#6e5b46" }}>
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
      <span className="text-[12px]" style={{ color: "#6e5b46" }}>
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
        style={{ color: "#fe7644" }}
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
        on ? "border-coral-600 bg-coral-600 text-white" : "border-[#e0d3bf] bg-white text-[#9c8a72]"
      }`}
    >
      {label}
    </button>
  );
}

// 레버 조작으로 시점이 바뀌면 "▼ N개월 당겨졌어요" 플로팅(1.5s 페이드).
function DeltaCallout({ months }: { months: number | null }) {
  const prev = useRef<number | null>(months);
  const [delta, setDelta] = useState<{ v: number; id: number } | null>(null);
  useEffect(() => {
    const from = prev.current;
    prev.current = months;
    if (from === null || months === null || from === months || prefersReduced()) return;
    setDelta({ v: months - from, id: Date.now() });
  }, [months]);
  if (!delta) return null;
  const faster = delta.v < 0;
  return (
    <span
      key={delta.id}
      className="plan-delta text-[12px] font-bold"
      style={{ color: faster ? "#fff" : "rgba(255,255,255,0.8)" }}
    >
      {faster ? "▼" : "▲"} {formatDday(Math.abs(delta.v))} {faster ? "당겨졌네" : "늦어졌네"}
    </span>
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
          <span className="text-[13px] font-bold" style={{ color: "#3a2c1d" }}>
            {info.label}
          </span>{" "}
          <span className="text-[11px]" style={{ color: "#9c8a72" }}>
            연 {sign}% · {info.hint}
          </span>
        </span>
      </span>
      <span
        className="shrink-0 text-[13px] font-bold tabular-nums"
        style={{ color: selected ? "#fe7644" : "#6e5b46" }}
      >
        {formatDday(months)}
      </span>
    </button>
  );
}
