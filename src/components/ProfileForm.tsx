"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type {
  CoupleProfile,
  HouseholdType,
  PriorityKey,
  Workplace,
  AreaRangeKey,
  LocationVibe,
  LocationVibes,
  BudgetFlex,
  ExistingHome,
} from "@/types/profile";
import {
  HOUSEHOLD_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_SCALE_LABELS,
  DEFAULT_PRIORITIES,
  DEFAULT_MAX_COMMUTE_MIN,
  AREA_RANGES,
  AREA_RANGE_ORDER,
  DEFAULT_AREA_RANGE,
  LOCATION_VIBE_LABELS,
  LOCATION_VIBE_ORDER,
  LOCATION_VIBE_LEVEL_LABELS,
  BUDGET_FLEX_ORDER,
  BUDGET_FLEX_LABELS,
  BUDGET_FLEX_DESC,
  DEFAULT_BUDGET_FLEX,
} from "@/types/profile";
import type { RecommendationResult } from "@/types/recommendation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Segmented } from "@/components/ui/Segmented";
import { StepDots } from "@/components/ui/StepDots";
import { Homi } from "@/components/Homi";
import { RequiredRegionPicker } from "@/components/RequiredRegionPicker";
import { vibeReflectionLabel } from "@/lib/recommend/locationVibe";
import { formatKrwHuman } from "@/lib/format";
import { estimateBudget } from "@/lib/budget";

// 선호 입지 칩 — 다른 입력과 달리 키워드마다 색·이모지를 줘 '재미 탭'으로 차별화.
const VIBE_CHIP: Record<
  LocationVibe,
  { emoji: string; active: string; idle: string }
> = {
  riverside: {
    emoji: "🌊",
    active: "border-sky-500 bg-sky-500 text-white focus:ring-sky-300",
    idle: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400",
  },
  quiet: {
    emoji: "🍃",
    active: "border-emerald-500 bg-emerald-500 text-white focus:ring-emerald-300",
    idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400",
  },
};
import { BudgetPreview } from "./BudgetPreview";

// ── 내부 타입 ──────────────────────────────────────────────────

/** 실제 폼 단계 — retired 는 step 2(직장)를 건너뜀 */
type Step = 1 | 2 | 3 | 4 | 5;

interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  address?: string;
}

interface WorkplaceFormState {
  selected: Workplace | null;
  query: string;
  results: GeoResult[];
  loading: boolean;
}

function makeEmptyWorkplace(): WorkplaceFormState {
  return { selected: null, query: "", results: [], loading: false };
}

// ── 토글 스위치 공통 ───────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
  size?: "sm" | "md";
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  size = "md",
}: ToggleSwitchProps) {
  const trackCls =
    size === "sm"
      ? "h-6 w-11"
      : "h-7 w-12";
  const thumbCls =
    size === "sm"
      ? "h-5 w-5"
      : "h-6 w-6";
  const translateOn = size === "sm" ? "translate-x-5" : "translate-x-5";

  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center justify-between w-full text-left"
    >
      <div>
        <p className="text-[15px] font-semibold text-[#3a322c] leading-snug">
          {label}
        </p>
        {description && (
          <p className="text-[13px] text-[#9a8f82] mt-0.5">{description}</p>
        )}
      </div>
      <span
        role="switch"
        aria-checked={checked}
        className={[
          "relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-4",
          trackCls,
          checked ? "bg-coral-600" : "bg-[#d1d1d6]",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
            thumbCls,
            checked ? translateOn : "translate-x-0",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

// ── 금액 변환 / hint ──────────────────────────────────────────

/** 만원 단위 문자열 → 원. 빈 값·비숫자는 0. */
function manwonToKrw(s: string): number {
  return (parseFloat(s) || 0) * 10_000;
}

/** 만원 단위 입력값을 억 환산 hint 문자열로 변환 */
function manwonHint(manwonStr: string): string | undefined {
  const n = parseFloat(manwonStr);
  if (!manwonStr || isNaN(n) || n === 0) return undefined;
  return `= ${formatKrwHuman(n * 10_000)}`;
}

// ── 직장 입력 서브컴포넌트 ─────────────────────────────────────

interface WorkplaceInputProps {
  label: string;
  state: WorkplaceFormState;
  onQueryChange: (q: string) => void;
  onSelect: (r: GeoResult) => void;
  onClear: () => void;
  onMaxCommuteChange: (minutes: string) => void;
  maxCommuteValue: string;
  autoFocus?: boolean;
}

function WorkplaceInput({
  label,
  state,
  onQueryChange,
  onSelect,
  onClear,
  onMaxCommuteChange,
  maxCommuteValue,
  autoFocus,
}: WorkplaceInputProps) {
  const hasSelected = !!state.selected;

  return (
    <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 flex flex-col gap-4 shadow-sm">
      <p className="text-[15px] font-semibold text-[#3a322c]">{label}</p>

      {/* 직장 검색 / 선택 */}
      {hasSelected ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-coral-50 border border-coral-200">
          <span className="flex-1 text-[15px] text-[#3a322c] font-medium">
            {state.selected!.label}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-coral-600 font-medium hover:text-coral-800 transition-colors"
          >
            변경
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={state.query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="직장명 또는 주소 입력"
              autoFocus={autoFocus}
              className="w-full px-4 py-3 rounded-2xl border border-[#d1d1d6] bg-white text-[#3a322c] placeholder-[#9a8f82] focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-transparent transition text-[15px]"
            />
            {state.loading && (
              <span className="absolute right-4 text-xs text-[#9a8f82]">
                검색 중...
              </span>
            )}
          </div>

          <p className="mt-2 text-[12px] text-[#9a8f82] leading-snug">
            가게·회사명이 안 나오면{" "}
            <span className="font-medium text-[#6b6157]">도로명주소</span>로 입력해
            보세요.
          </p>

          {!state.loading &&
            state.query.length >= 2 &&
            state.results.length === 0 && (
              <p className="mt-2 text-[13px] text-amber-600 leading-snug">
                결과가 없어요. 가게·회사명이 안 잡히면 도로명주소로 입력해 보세요
                <br />
                <span className="text-[#9a8f82]">
                  예: 서울 강남구 테헤란로 152, 강남역, 판교
                </span>
              </p>
            )}

          {state.results.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#e5e5ea] rounded-2xl shadow-xl overflow-hidden">
              {state.results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelect(r)}
                    className="w-full text-left px-4 py-3 hover:bg-coral-50 transition-colors text-[14px] text-[#3a322c]"
                  >
                    <span className="font-medium">{r.label}</span>
                    {r.address && (
                      <span className="ml-2 text-[#9a8f82]">{r.address}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 통근 허용시간 — 직장 선택 전에도 흐리게(disabled) 미리보기 */}
      <div
        className={[
          "flex flex-col gap-3 transition-opacity duration-200",
          hasSelected ? "opacity-100" : "opacity-40 pointer-events-none select-none",
        ].join(" ")}
        aria-disabled={!hasSelected}
      >
        <div>
          <p className="text-[13px] text-[#6b6157] mb-2">통근 허용시간 (자차 기준)</p>
          <TextField
            value={maxCommuteValue}
            onChange={onMaxCommuteChange}
            type="number"
            placeholder="50"
            suffix="분"
          />
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export function ProfileForm({
  onResult,
}: {
  onResult: (result: RecommendationResult, profile: CoupleProfile) => void;
}) {
  // retired 는 직장 단계 없으므로 시각적으로 4단계, 나머지 5단계
  const [step, setStep] = useState<Step>(1);

  // ── Step 1: 가구 유형 & 평수 ────────────────────────────────
  const [householdType, setHouseholdType] = useState<HouseholdType | "">("");
  const [preferredAreaRange, setPreferredAreaRange] =
    useState<AreaRangeKey>(DEFAULT_AREA_RANGE);
  const [locationVibes, setLocationVibes] = useState<LocationVibes>({});
  // 추가 조건 (접이식)
  const [extraOpen, setExtraOpen] = useState(false);
  const [requiredRegions, setRequiredRegions] = useState<string[]>([]);
  const [budgetFlex, setBudgetFlex] = useState<BudgetFlex>(DEFAULT_BUDGET_FLEX);

  // ── Step 2: 직장 & 통근 ─────────────────────────────────────
  // 카카오 길찾기 API 가 자차만 지원하므로 통근 수단은 자차로 고정.
  const [wpA, setWpA] = useState<WorkplaceFormState>(makeEmptyWorkplace());
  const [wpB, setWpB] = useState<WorkplaceFormState>(makeEmptyWorkplace());
  const [maxCommuteA, setMaxCommuteA] = useState(
    String(DEFAULT_MAX_COMMUTE_MIN)
  );
  const [maxCommuteB, setMaxCommuteB] = useState(
    String(DEFAULT_MAX_COMMUTE_MIN)
  );

  // ── Step 3: 가족 ────────────────────────────────────────────
  // 자녀 신호는 boolean 3개로 단순화 — 학교 데이터가 초등 거리뿐이라 정밀한
  // 나이는 의미가 없고, 실제로 코드가 쓰는 건 (학령기 여부 / 영유아 여부 / 2명 이상)
  // 세 신호뿐이다. 이를 그대로 사용자에게 노출한다.
  const [hasSchoolAgedChild, setHasSchoolAgedChild] = useState(false);
  const [hasInfant, setHasInfant] = useState(false);
  const [hasTwoOrMoreChildren, setHasTwoOrMoreChildren] = useState(false);
  const [hasThreeOrMoreChildren, setHasThreeOrMoreChildren] = useState(false);
  const [childCount, setChildCount] = useState<"0" | "1" | "2" | "3">("0");
  const [isExpectingChild, setIsExpectingChild] = useState(false);
  const [isNewlywed, setIsNewlywed] = useState(false);
  const [ownedHomeCount, setOwnedHomeCount] = useState(0); // 보유 주택 수 (0/1/2+)

  // ── Step 4: 예산 / 대출 ─────────────────────────────────────
  // 모든 금액 입력: 만원 단위
  const [detailedBudget, setDetailedBudget] = useState(false); // false=간단, true=자세히
  const [availableBudget, setAvailableBudget] = useState(""); // 간단: 가용 예산 (만원)
  const [additionalFunds, setAdditionalFunds] = useState(""); // 추가 동원자금 (만원)
  const [seedMoney, setSeedMoney] = useState("");          // 보유 현금 (만원)
  const [householdIncome, setHouseholdIncome] = useState(""); // 연 가구소득 (만원)
  const [netAssets, setNetAssets] = useState("");          // 순자산 총액 (만원)
  const [existingLoan, setExistingLoan] = useState("0");   // 매달 갚는 대출 (만원/월)
  const [hasExistingHome, setHasExistingHome] = useState(false);
  const [existingHomeSalePrice, setExistingHomeSalePrice] = useState(""); // 매도가 (만원)
  const [existingHomeLoan, setExistingHomeLoan] = useState("");            // 잔금 (만원)
  const [existingHomeTaxExempt, setExistingHomeTaxExempt] = useState(false);
  const [showTaxGuide, setShowTaxGuide] = useState(false);

  // ── Step 5: 우선순위 ────────────────────────────────────────
  const [priorities, setPriorities] = useState<Record<PriorityKey, number>>({
    ...DEFAULT_PRIORITIES,
  });

  // ── 제출 상태 ────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Geocode 디바운스 ─────────────────────────────────────────
  const debounceARef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceBRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGeocode = useCallback(
    async (
      query: string,
      setLoading: (v: boolean) => void,
      setResults: (r: GeoResult[]) => void
    ) => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { results: GeoResult[] };
          setResults(data.results ?? []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (debounceARef.current) clearTimeout(debounceARef.current);
    if (wpA.query.length < 2) {
      // 검색어 짧아지면 이전 결과 즉시 비움 — 의도된 동기화
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWpA((prev) => ({ ...prev, results: [] }));
      return;
    }
    debounceARef.current = setTimeout(() => {
      fetchGeocode(
        wpA.query,
        (v) => setWpA((prev) => ({ ...prev, loading: v })),
        (r) => setWpA((prev) => ({ ...prev, results: r }))
      );
    }, 300);
    return () => {
      if (debounceARef.current) clearTimeout(debounceARef.current);
    };
  }, [wpA.query, fetchGeocode]);

  useEffect(() => {
    if (debounceBRef.current) clearTimeout(debounceBRef.current);
    if (wpB.query.length < 2) {
      // 검색어 짧아지면 이전 결과 즉시 비움 — 의도된 동기화
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWpB((prev) => ({ ...prev, results: [] }));
      return;
    }
    debounceBRef.current = setTimeout(() => {
      fetchGeocode(
        wpB.query,
        (v) => setWpB((prev) => ({ ...prev, loading: v })),
        (r) => setWpB((prev) => ({ ...prev, results: r }))
      );
    }, 300);
    return () => {
      if (debounceBRef.current) clearTimeout(debounceBRef.current);
    };
  }, [wpB.query, fetchGeocode]);

  // ── 헬퍼 ─────────────────────────────────────────────────────

  function selectWorkplace(
    which: "A" | "B",
    r: GeoResult,
    maxMin: string
  ) {
    const selected: Workplace = {
      label: r.label,
      lat: r.lat,
      lng: r.lng,
      commuteMode: "car",
      maxCommuteMinutes: parseInt(maxMin, 10) || DEFAULT_MAX_COMMUTE_MIN,
    };
    if (which === "A") {
      setWpA({ selected, query: "", results: [], loading: false });
    } else {
      setWpB({ selected, query: "", results: [], loading: false });
    }
  }

  function clearWorkplace(which: "A" | "B") {
    if (which === "A") setWpA(makeEmptyWorkplace());
    else setWpB(makeEmptyWorkplace());
  }

  function syncMaxCommute(which: "A" | "B", maxMin: string) {
    const setter = which === "A" ? setWpA : setWpB;
    setter((prev) => {
      if (!prev.selected) return prev;
      return {
        ...prev,
        selected: {
          ...prev.selected,
          maxCommuteMinutes: parseInt(maxMin, 10) || DEFAULT_MAX_COMMUTE_MIN,
        },
      };
    });
  }

  function handleMaxCommuteA(v: string) {
    setMaxCommuteA(v);
    syncMaxCommute("A", v);
  }
  function handleMaxCommuteB(v: string) {
    setMaxCommuteB(v);
    syncMaxCommute("B", v);
  }

  // Step 2 진행 가능 여부
  function step2CanProceed(): boolean {
    if (householdType === "retired") return true;
    if (!wpA.selected) return false;
    if (householdType === "dualIncome" && !wpB.selected) return false;
    return true;
  }

  // 실제 step 번호 → 논리적 다음/이전 (retired 는 step 2 건너뜀)
  function goNext() {
    if (step === 1) {
      setStep(householdType === "retired" ? 3 : 2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    }
  }

  function goPrev() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(householdType === "retired" ? 1 : 2);
    else if (step === 4) setStep(3);
    else if (step === 5) setStep(4);
  }

  // ── 시각적 스텝 (retired: 4단계, 나머지: 5단계) ──────────────
  const isRetired = householdType === "retired";
  const visualTotal = isRetired ? 4 : 5;
  // step 1→0, 2→1, 3→retired?1:2, 4→retired?2:3, 5→retired?3:4
  const visualStep: number = (() => {
    if (step === 1) return 0;
    if (step === 2) return 1;
    if (step === 3) return isRetired ? 1 : 2;
    if (step === 4) return isRetired ? 2 : 3;
    return isRetired ? 3 : 4;
  })();

  // ── 프로필 빌드 (제출·예산 미리보기 공용) ────────────────────
  const buildProfile = useCallback((): CoupleProfile => {
    const existingHome: ExistingHome | undefined = hasExistingHome
      ? {
          expectedSalePriceKrw: manwonToKrw(existingHomeSalePrice),
          remainingLoanKrw: manwonToKrw(existingHomeLoan),
          qualifiesForTaxExemption: existingHomeTaxExempt,
        }
      : undefined;

    const finalWpA: Workplace | undefined = wpA.selected
      ? {
          ...wpA.selected,
          commuteMode: "car",
          maxCommuteMinutes:
            parseInt(maxCommuteA, 10) || DEFAULT_MAX_COMMUTE_MIN,
        }
      : undefined;

    const finalWpB: Workplace | undefined =
      householdType === "dualIncome" && wpB.selected
        ? {
            ...wpB.selected,
            commuteMode: "car",
            maxCommuteMinutes:
              parseInt(maxCommuteB, 10) || DEFAULT_MAX_COMMUTE_MIN,
          }
        : undefined;

    return {
      householdType: householdType as HouseholdType,
      priorities,
      preferredAreaRange,
      locationVibes,
      requiredRegions: requiredRegions.length > 0 ? requiredRegions : undefined,
      budgetFlex,
      workplaceA: finalWpA,
      workplaceB: finalWpB,
      hasSchoolAgedChild,
      hasInfant,
      hasTwoOrMoreChildren,
      hasThreeOrMoreChildren,
      isExpectingChild,
      householdIncomeKrwYear: manwonToKrw(householdIncome),
      seedMoneyKrw: manwonToKrw(seedMoney),
      netAssetsKrw: manwonToKrw(netAssets),
      existingLoanMonthlyKrw: manwonToKrw(existingLoan),
      hasOwnedHomeBefore: ownedHomeCount > 0,
      isNewlywed,
      budgetMode: detailedBudget ? "detailed" : "simple",
      availableBudgetKrw: detailedBudget
        ? undefined
        : manwonToKrw(availableBudget),
      ownedHomeCount: detailedBudget ? ownedHomeCount : undefined,
      additionalFundsKrw:
        detailedBudget && additionalFunds
          ? manwonToKrw(additionalFunds)
          : undefined,
      existingHome,
    };
  }, [
    householdType,
    priorities,
    preferredAreaRange,
    locationVibes,
    requiredRegions,
    budgetFlex,
    wpA.selected,
    wpB.selected,
    maxCommuteA,
    maxCommuteB,
    hasSchoolAgedChild,
    hasInfant,
    hasTwoOrMoreChildren,
    hasThreeOrMoreChildren,
    isExpectingChild,
    householdIncome,
    seedMoney,
    netAssets,
    existingLoan,
    ownedHomeCount,
    detailedBudget,
    availableBudget,
    additionalFunds,
    isNewlywed,
    hasExistingHome,
    existingHomeSalePrice,
    existingHomeLoan,
    existingHomeTaxExempt,
  ]);

  // ── Step 4 예산 미리보기 ─────────────────────────────────────
  // 보유 현금·연 소득이 모두 입력돼야 추정이 의미 있으므로 그 전엔 숨긴다.
  const canPreviewBudget = detailedBudget
    ? (parseFloat(seedMoney) || 0) > 0 && (parseFloat(householdIncome) || 0) > 0
    : (parseFloat(availableBudget) || 0) > 0;

  const previewBudget = useMemo(
    () => (canPreviewBudget ? estimateBudget(buildProfile()) : null),
    [canPreviewBudget, buildProfile],
  );

  // ── Step 3 정책대출 예비 힌트 ────────────────────────────────
  // 가족 구성(자녀·신혼·무주택)만으로 짚어줄 수 있는 항목. 소득·자산 요건은
  // Step 4 입력 후 estimateBudget 이 정식 판정한다.
  const familyPolicyHints = useMemo(() => {
    const hints: string[] = [];
    if (ownedHomeCount > 0) return hints;
    if (hasInfant) {
      hints.push("1세 이하 자녀 + 무주택 → 신생아 특례 디딤돌 대상 가능");
    }
    if (isNewlywed) {
      hints.push("혼인 7년 이내 + 무주택 → 디딤돌(신혼) 대상 가능");
    }
    if (hasTwoOrMoreChildren) {
      hints.push("자녀 2명 이상 → 디딤돌(일반) 소득 기준 완화 (7,000만원)");
    }
    return hints;
  }, [hasInfant, hasTwoOrMoreChildren, isNewlywed, ownedHomeCount]);

  // ── 제출 ──────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);

    const profile: CoupleProfile = buildProfile();

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setSubmitError(
          errData.message ?? "분석 중 오류가 발생했습니다. 다시 시도해 주세요."
        );
        return;
      }

      const result = (await res.json()) as RecommendationResult;
      onResult(result, profile);
    } catch {
      setSubmitError(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      {/* 진행 표시 */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <StepDots current={visualStep} total={visualTotal} />
        <p className="text-[13px] text-[#9a8f82]">
          {visualStep + 1}단계 / {visualTotal}
        </p>
      </div>

      {/* ── Step 1: 가구 유형 & 평수 ──────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#3a322c] leading-snug">
              가구 유형을 선택해 주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6b6157]">
              통근 조건과 분석 방식이 달라집니다
            </p>
          </div>

          {/* 가구 유형 카드 */}
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(HOUSEHOLD_TYPE_LABELS) as HouseholdType[]).map(
              (type) => {
                const subtitles: Record<HouseholdType, string> = {
                  single: "1인 통근 기준",
                  dualIncome: "두 직장 모두 고려",
                  singleIncome: "한 직장 기준",
                  retired: "통근 조건 없음",
                };
                const selected = householdType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setHouseholdType(type)}
                    className={[
                      "rounded-3xl border-2 px-4 py-5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-coral-400",
                      selected
                        ? "border-coral-600 bg-coral-50 shadow-md"
                        : "border-[#e5e5ea] bg-white hover:border-coral-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "block text-[15px] font-semibold leading-snug",
                        selected ? "text-coral-700" : "text-[#3a322c]",
                      ].join(" ")}
                    >
                      {HOUSEHOLD_TYPE_LABELS[type]}
                    </span>
                    <span className="mt-1 block text-[12px] text-[#9a8f82]">
                      {subtitles[type]}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* 선호 평수 */}
          <div>
            <p className="text-[15px] font-semibold text-[#3a322c] mb-3">
              선호 평수
            </p>
            <Segmented
              options={AREA_RANGE_ORDER.map((key) => ({
                value: key,
                label: AREA_RANGES[key].label,
              }))}
              value={preferredAreaRange}
              onChange={(v) => setPreferredAreaRange(v as AreaRangeKey)}
              columns={3}
            />
          </div>

          {/* 추가 조건 (선택) — 평소 접힘 */}
          <div>
            <button
              type="button"
              onClick={() => setExtraOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-black/[0.08] bg-[#f3ece4] px-5 py-4 text-left transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-coral-500"
            >
              <span className="text-sm font-semibold" style={{ color: "#3a322c" }}>
                추가 조건{" "}
                <span className="font-medium text-[#9a8f82]">
                  (선택 · 지역·거래량·신축·취향)
                </span>
              </span>
              <svg
                className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${extraOpen ? "rotate-180" : ""}`}
                style={{ color: "#9a8f82" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {extraOpen && (
              <div className="mt-3 flex flex-col gap-6">
                {/* 필수 지역 (하드) — 2단계(서울/경기) + 검색 */}
                <RequiredRegionPicker
                  value={requiredRegions}
                  onChange={setRequiredRegions}
                />

                {/* 취향 한 스푼 (입지) — 복수선택 · 강도(한 스푼/두 스푼/듬뿍) */}
                <div className="rounded-3xl border border-dashed border-coral-200 bg-gradient-to-br from-coral-50 via-white to-pink-50 px-4 py-5">
                  <p className="text-[15px] font-bold text-[#3a322c]">
                    🌊 한강변 한 스푼{" "}
                    <span className="text-[12px] font-medium text-coral-500">
                      재미로
                    </span>
                  </p>
                  <p className="mt-1 mb-4 text-[12px] leading-relaxed text-[#6b6157]">
                    누를 때마다 한 스푼 → 두 스푼 → 듬뿍. 진해질수록 점수도
                    커지고,{" "}
                    <strong className="font-semibold">한강에 더 가까워야</strong>{" "}
                    인정돼요.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {LOCATION_VIBE_ORDER.map((key) => {
                      const cfg = VIBE_CHIP[key];
                      const level = locationVibes[key] ?? 0;
                      const active = level > 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setLocationVibes((prev) => {
                              const cur = prev[key] ?? 0;
                              const next = cur >= 3 ? 0 : cur + 1;
                              const copy = { ...prev };
                              if (next === 0) delete copy[key];
                              else copy[key] = next;
                              return copy;
                            })
                          }
                          aria-pressed={active}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1",
                            active ? cfg.active : cfg.idle,
                            active ? "scale-105 shadow-sm" : "",
                          ].join(" ")}
                        >
                          <span aria-hidden="true">{cfg.emoji}</span>
                          {LOCATION_VIBE_LABELS[key]}
                          {active ? ` ${LOCATION_VIBE_LEVEL_LABELS[level]}` : ""}
                          {active && (
                            <span className="ml-0.5 text-[10px] tracking-tighter opacity-90">
                              {"●".repeat(level)}
                              {"○".repeat(3 - level)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* 선택한 스푼이 점수에 어떻게 반영되는지 */}
                  {LOCATION_VIBE_ORDER.map((key) => {
                    const lv = locationVibes[key] ?? 0;
                    if (!lv) return null;
                    return (
                      <p
                        key={key}
                        className="mt-3 text-[12px] leading-relaxed text-coral-700"
                      >
                        {VIBE_CHIP[key].emoji} {LOCATION_VIBE_LABELS[key]}{" "}
                        {LOCATION_VIBE_LEVEL_LABELS[lv]} →{" "}
                        {vibeReflectionLabel(key, lv)}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Button onClick={goNext} disabled={householdType === ""} fullWidth>
            다음
          </Button>
        </div>
      )}

      {/* ── Step 2: 직장 & 통근 ───────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#3a322c] leading-snug">
              직장 위치를 알려주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6b6157]">
              {householdType === "dualIncome"
                ? "두 분의 직장을 모두 입력해 주세요"
                : "직장명이나 주소를 검색하세요"}
            </p>
          </div>

          <WorkplaceInput
            label={householdType === "dualIncome" ? "본인 직장" : "직장"}
            state={wpA}
            onQueryChange={(q) =>
              setWpA((prev) => ({ ...prev, query: q, selected: null }))
            }
            onSelect={(r) => selectWorkplace("A", r, maxCommuteA)}
            onClear={() => clearWorkplace("A")}
            onMaxCommuteChange={handleMaxCommuteA}
            maxCommuteValue={maxCommuteA}
            autoFocus
          />

          {householdType === "dualIncome" && (
            <WorkplaceInput
              label="배우자 직장"
              state={wpB}
              onQueryChange={(q) =>
                setWpB((prev) => ({ ...prev, query: q, selected: null }))
              }
              onSelect={(r) => selectWorkplace("B", r, maxCommuteB)}
              onClear={() => clearWorkplace("B")}
              onMaxCommuteChange={handleMaxCommuteB}
              maxCommuteValue={maxCommuteB}
            />
          )}

          {/* 대중교통 안내 — 현재 자차 기준, 대중교통 추후 지원 */}
          <p className="rounded-2xl bg-[#f3ece4] px-4 py-3 text-[13px] leading-relaxed text-[#6b6157]">
            현재 통근 시간은{" "}
            <strong className="font-semibold text-[#3a322c]">자차 기준</strong>
            으로 계산돼요. 대중교통 이용 시 소요시간은 추후 업데이트 예정입니다.
          </p>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={goPrev}>
              이전
            </Button>
            <Button fullWidth disabled={!step2CanProceed()} onClick={goNext}>
              다음
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: 가족 ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#3a322c] leading-snug">
              가족 구성을 알려주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6b6157]">
              학군·정책대출 요건 판정에 활용됩니다
            </p>
          </div>

          {/* 자녀·가족 신호 — 해당 항목 모두 선택 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[#3a322c]">
                자녀 / 가족 상황
              </p>
              <p className="text-[13px] text-[#9a8f82] mt-0.5">
                해당되는 항목을 모두 선택해 주세요. 학군 점수와 정책대출 자격
                판정에 활용됩니다.
              </p>
            </div>

            {/* 자녀 수 — 없음/1명/2명/3명 이상 */}
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-medium text-[#3a322c]">자녀 수</p>
              <Segmented
                options={[
                  { value: "0", label: "없음" },
                  { value: "1", label: "1명" },
                  { value: "2", label: "2명" },
                  { value: "3", label: "3명 이상" },
                ]}
                value={childCount}
                onChange={(v) => {
                  setChildCount(v);
                  setHasTwoOrMoreChildren(v === "2" || v === "3");
                  setHasThreeOrMoreChildren(v === "3");
                }}
              />
              <p className="text-[12px] text-[#9a8f82]">
                2명 이상이면 디딤돌(일반) 소득 기준 완화 대상이에요.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    key: "school",
                    label: "초등학교 다닐 아이 있음",
                    why: "초등학교 통학 거리 점수에 반영 (중·고등은 미반영)",
                    state: hasSchoolAgedChild,
                    set: setHasSchoolAgedChild,
                  },
                  {
                    key: "infant",
                    label: "출산 2년 이내 아이 있음 (만 2세 이하)",
                    why: "신생아 특례 디딤돌 자격 판정 (출산일 기준 2년 이내)",
                    state: hasInfant,
                    set: setHasInfant,
                  },
                  {
                    key: "expecting",
                    label: "임신 중·출산 예정",
                    why: "출산 후 신생아 특례 재시뮬레이션 권고 — 현 결과엔 미반영",
                    state: isExpectingChild,
                    set: setIsExpectingChild,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={item.state}
                  onClick={() => item.set((v) => !v)}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors text-left ${
                    item.state
                      ? "bg-coral-50 border-coral-300"
                      : "bg-white border-[#e5e5ea] hover:border-[#d1d1d6]"
                  }`}
                >
                  <div>
                    <p
                      className={`text-[15px] font-medium ${item.state ? "text-coral-900" : "text-[#3a322c]"}`}
                    >
                      {item.label}
                    </p>
                    <p className="text-[12px] text-[#9a8f82] mt-0.5">
                      {item.why}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      item.state
                        ? "bg-coral-600 border-coral-600"
                        : "border-[#d1d1d6]"
                    }`}
                  >
                    {item.state && (
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 신혼 여부 — 1인·은퇴 제외 */}
          {householdType !== "single" && householdType !== "retired" && (
            <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm">
              <ToggleSwitch
                checked={isNewlywed}
                onChange={() => setIsNewlywed((v) => !v)}
                label="혼인 7년 이내예요"
                description="신혼 특례 정책대출 요건 판정에 사용됩니다"
              />
            </div>
          )}

          {/* 정책대출 예비 안내 — 가족 구성 기준 */}
          <div className="rounded-3xl border border-coral-100 bg-coral-50/50 p-5 flex flex-col gap-2">
            <p className="text-[15px] font-semibold text-[#3a322c]">
              정책대출 예비 안내
            </p>
            {familyPolicyHints.length > 0 ? (
              <>
                <p className="text-[13px] text-[#6b6157] leading-relaxed">
                  지금까지 입력한 가족 구성 기준으로 아래 항목에 해당할 수 있어요.
                  소득·순자산 요건은 다음 단계에서 확인합니다.
                </p>
                <ul className="flex flex-col gap-1.5 mt-0.5">
                  {familyPolicyHints.map((hint) => (
                    <li
                      key={hint}
                      className="flex gap-1.5 text-[13px] text-coral-800 leading-relaxed"
                    >
                      <span className="mt-0.5 flex-shrink-0 text-coral-400">
                        &#9679;
                      </span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[13px] text-[#6b6157] leading-relaxed">
                다음 단계에서 소득·순자산을 입력하면 디딤돌·신생아 특례·보금자리론
                등 정책대출 자격을 확인해 드려요.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={goPrev}>
              이전
            </Button>
            <Button fullWidth onClick={goNext}>
              다음
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: 예산 / 대출 ───────────────────────────────── */}
      {step === 4 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#3a322c] leading-snug">
              예산을 알려주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6b6157]">
              간단히 가용 예산만 넣어도 되고, 펼쳐서 대출까지 계산받아도 돼요
            </p>
          </div>

          {/* 간단 모드 — 가용 예산 한 칸 */}
          {!detailedBudget && (
            <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm">
              <TextField
                label="집에 쓸 수 있는 총 예산"
                value={availableBudget}
                onChange={setAvailableBudget}
                type="number"
                placeholder="예: 50000"
                suffix="만원"
                hint={
                  availableBudget
                    ? `${manwonHint(availableBudget)} — 현금+받을 대출 다 합친 총 동원 자금`
                    : "현금에 받을 수 있는 대출까지 다 합친 '집 살 수 있는 총액'. 취득세만 빼고 계산해요."
                }
              />
            </div>
          )}

          {/* 간단 ↔ 자세히 전환 */}
          <button
            type="button"
            onClick={() => setDetailedBudget((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-coral-200 bg-coral-50 px-5 py-4 text-left transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-coral-500"
          >
            <span className="text-sm font-semibold text-coral-700">
              {detailedBudget
                ? "← 간단 입력으로 (예산만 직접)"
                : "💡 대출까지 포함해 얼마까지 살 수 있는지 계산받기"}
            </span>
            <span className="ml-3 flex-shrink-0 text-xs text-coral-500">
              {detailedBudget ? "접기" : "소득·대출·정책"}
            </span>
          </button>

          {/* 예산 근접도 — 항상 표시 (결과 가격대 폭) */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm">
            <p className="text-[15px] font-semibold text-[#3a322c] mb-1">
              예산 근접도
            </p>
            <p className="text-[12px] text-[#6b6157] mb-3">
              결과 가격대를 예산에 얼마나 딱 맞출지 골라주세요.
            </p>
            <Segmented
              options={BUDGET_FLEX_ORDER.map((k) => ({
                value: k,
                label: BUDGET_FLEX_LABELS[k],
              }))}
              value={budgetFlex}
              onChange={(v) => setBudgetFlex(v as BudgetFlex)}
              columns={3}
            />
            <p className="mt-2 text-[12px] font-medium text-coral-600">
              {BUDGET_FLEX_DESC[budgetFlex]}
            </p>
          </div>

          {/* ── 자세히 모드 — 소득·대출로 한도 계산 ── */}
          {detailedBudget && (
            <div className="flex flex-col gap-6">
          {/* 정책대출 안내 배너 */}
          <div className="rounded-2xl bg-coral-50 border border-coral-100 px-4 py-3">
            <p className="text-[13px] text-coral-700 leading-relaxed">
              입력 정보로 디딤돌·신생아 특례·보금자리론 등 정책대출 자격도 함께 확인해 드립니다
            </p>
          </div>

          {/* 기본 재무 정보 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-5">
            <p className="text-[15px] font-semibold text-[#3a322c]">
              기본 재무 정보
            </p>

            <TextField
              label="보유 현금 (이번 구매 자금)"
              value={seedMoney}
              onChange={setSeedMoney}
              type="number"
              placeholder="예: 10000"
              suffix="만원"
              hint={
                seedMoney
                  ? `${manwonHint(seedMoney)} — 이번 집 살 때 넣을 현금(종잣돈)`
                  : "이번 집 구매에 넣을 현금(종잣돈) — 계약금·잔금 재원. 구매력 계산에 사용"
              }
            />

            <TextField
              label="연 가구소득"
              value={householdIncome}
              onChange={setHouseholdIncome}
              type="number"
              placeholder="예: 8000"
              suffix="만원"
              hint={manwonHint(householdIncome)}
            />

            <TextField
              label="순자산 총액 (정책대출 자격용)"
              value={netAssets}
              onChange={setNetAssets}
              type="number"
              placeholder="예: 30000"
              suffix="만원"
              hint={
                netAssets
                  ? `${manwonHint(netAssets)} — 위 보유현금까지 포함한 전 재산(금융+부동산−부채)`
                  : "보유현금까지 포함한 전 재산(금융+부동산−부채). 정책대출 자격 판정에만 사용"
              }
            />

            <TextField
              label="매달 갚는 대출"
              value={existingLoan}
              onChange={setExistingLoan}
              type="number"
              placeholder="0"
              suffix="만원/월"
              hint={
                existingLoan && existingLoan !== "0"
                  ? manwonHint(existingLoan)
                  : "주담대·신용대출·전세·자동차할부·카드론 등 매달 갚는 가계대출만 합산하세요. 사업자(기업)대출은 보통 DSR에 안 잡혀 빼도 됩니다. 없으면 0."
              }
            />
          </div>

          {/* 보유 주택 수 + 추가 동원자금 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-5">
            <div>
              <p className="text-[15px] font-semibold text-[#3a322c] mb-1">
                보유 주택 수
              </p>
              <p className="text-[12px] text-[#6b6157] mb-3">
                생애최초·취득세 중과(2주택 8%·3주택+ 12%) 판정에 사용돼요.
              </p>
              <Segmented
                options={[
                  { value: "0", label: "무주택" },
                  { value: "1", label: "1채" },
                  { value: "2", label: "2채 이상" },
                ]}
                value={String(ownedHomeCount)}
                onChange={(v) => setOwnedHomeCount(parseInt(v, 10))}
                columns={3}
              />
            </div>
            <TextField
              label="추가 동원자금 (선택)"
              value={additionalFunds}
              onChange={setAdditionalFunds}
              type="number"
              placeholder="없으면 비워두세요"
              suffix="만원"
              hint={
                additionalFunds
                  ? `${manwonHint(additionalFunds)} — 자기자본에 합산`
                  : "전세보증금 회수·부모지원 등 추가로 끌어올 수 있는 돈. 자기자본에 합산돼요."
              }
            />
          </div>

          {/* 갈아타기 토글 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-4">
            <ToggleSwitch
              checked={hasExistingHome}
              onChange={() => setHasExistingHome((v) => !v)}
              label="기존 집을 팔아 자금을 마련해요"
              description="갈아타기 — 매도 예상가와 잔대출을 입력하면 순수령액을 계산합니다"
            />

            {hasExistingHome && (
              <div className="flex flex-col gap-4 pt-2 border-t border-[#f0f0f0]">
                <TextField
                  label="예상 매도가"
                  value={existingHomeSalePrice}
                  onChange={setExistingHomeSalePrice}
                  type="number"
                  placeholder="예: 80000"
                  suffix="만원"
                  hint={manwonHint(existingHomeSalePrice)}
                />

                <TextField
                  label="남은 대출 잔금"
                  value={existingHomeLoan}
                  onChange={setExistingHomeLoan}
                  type="number"
                  placeholder="없으면 0"
                  suffix="만원"
                  hint={
                    existingHomeLoan
                      ? manwonHint(existingHomeLoan)
                      : "없으면 0을 입력하세요"
                  }
                />

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setExistingHomeTaxExempt((v) => !v)}
                    className="flex items-center justify-between w-full py-1 text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-medium text-[#3a322c]">
                          2년 이상 살면서 보유했어요
                        </p>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTaxGuide((v) => !v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setShowTaxGuide((v) => !v);
                            }
                          }}
                          aria-label="양도세 비과세 요건 안내 보기"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c7c7cc] text-[10px] font-bold text-[#9a8f82] hover:border-coral-400 hover:text-coral-600 cursor-pointer"
                        >
                          ?
                        </span>
                      </div>
                      <p className="text-[12px] text-[#9a8f82]">
                        세금 절감 — 1세대 1주택 양도세 비과세 요건
                      </p>
                    </div>
                    <span
                      role="switch"
                      aria-checked={existingHomeTaxExempt}
                      className={[
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ml-4",
                        existingHomeTaxExempt ? "bg-coral-600" : "bg-[#d1d1d6]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          existingHomeTaxExempt
                            ? "translate-x-5"
                            : "translate-x-0",
                        ].join(" ")}
                      />
                    </span>
                  </button>

                  {/* 양도세 비과세 미니 가이드 — ? 클릭 시 표시 */}
                  {showTaxGuide && (
                    <div className="rounded-2xl bg-coral-50/60 border border-coral-200 px-4 py-3">
                      <p className="text-[12px] font-semibold text-coral-800 mb-2">
                        1세대 1주택 양도세 비과세 — 모두 충족해야 적용
                      </p>
                      <ul className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-coral-900">
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">①</span>
                          <span>매도하는 집이 <strong>1세대 1주택</strong> (세대원 모두 다른 집 없음)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">②</span>
                          <span><strong>2년 이상 보유</strong> (취득일~양도일 기준)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">③</span>
                          <span><strong>2년 이상 거주</strong> (조정대상지역 취득 시 — 서울 전역 해당)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="flex-shrink-0">④</span>
                          <span><strong>양도가 12억원 이하</strong> (12억 초과분은 과세)</span>
                        </li>
                      </ul>
                      <p className="mt-2 text-[11px] text-coral-700 leading-relaxed">
                        헷갈리면 ❌ 그대로 두세요 — 양도세 6% 정도가 계산에 반영돼
                        보수적으로 추정됩니다. 정확한 판정은 세무사 상담 권장.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
          )}

          {/* 예산 미리보기 */}
          {previewBudget ? (
            <BudgetPreview budget={previewBudget} />
          ) : (
            <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-[#f3ece4] p-5">
              <p className="text-[13px] text-[#9a8f82] leading-relaxed">
                {detailedBudget
                  ? "보유 현금과 연 가구소득을 입력하면 예상 대출 가능액·실매수 가능가가 여기 바로 표시됩니다."
                  : "가용 예산을 입력하면 취득세를 뺀 실매수 가능가가 여기 바로 표시됩니다."}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={goPrev}>
              이전
            </Button>
            <Button fullWidth onClick={goNext}>
              다음
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: 우선순위 & 분석 시작 ─────────────────────── */}
      {step === 5 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#3a322c] leading-snug">
              무엇을 중요하게 볼까요?
            </h2>
            <p className="mt-1 text-[15px] text-[#6b6157]">
              세 조건의 중요도가 분석 가중치에 반영됩니다
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {(Object.keys(PRIORITY_LABELS) as PriorityKey[]).map((key) => {
              const hints: Record<PriorityKey, string> = {
                commute: "자차 통근 시간 기준 (대중교통 미반영)",
                school: "초등학교 도보 거리 기준 (중·고·학업성취도·학원가 미반영)",
                buildingAge: "준공년도 — 신축일수록 가점",
                largeComplex: "최근 거래량 기준 — 대단지·인기 단지일수록 가점",
              };
              return (
              <div
                key={key}
                className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[#3a322c]">
                      {PRIORITY_LABELS[key]}
                    </p>
                    <p className="text-[11px] text-[#9a8f82] mt-0.5">
                      {hints[key]}
                    </p>
                  </div>
                  <span
                    className={[
                      "text-[13px] font-medium",
                      priorities[key] >= 4
                        ? "text-coral-600"
                        : "text-[#9a8f82]",
                    ].join(" ")}
                  >
                    {PRIORITY_SCALE_LABELS[priorities[key]]}
                  </span>
                </div>
                <Segmented
                  options={[1, 2, 3, 4, 5].map((v) => ({
                    value: String(v),
                    label: String(v),
                  }))}
                  value={String(priorities[key])}
                  onChange={(v) =>
                    setPriorities((prev) => ({
                      ...prev,
                      [key]: parseInt(v, 10),
                    }))
                  }
                />
              </div>
              );
            })}
          </div>

          {/* 분석 중 안내 — 호미가 돋보기 들고 두리번 */}
          {submitting && (
            <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-coral-50 border border-coral-100 px-4 py-5">
              <Homi mood="searching" size={88} />
              <p className="text-[14px] font-semibold text-coral-700">
                열심히 찾는 중…
              </p>
              <p className="text-[12px] text-coral-600">
                조건에 맞는 단지·예산을 계산하고 있어요
              </p>
            </div>
          )}

          {/* 에러 */}
          {submitError && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-[14px] text-red-700 leading-snug">
              {submitError}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={goPrev} disabled={submitting}>
              이전
            </Button>
            <Button
              fullWidth
              disabled={submitting}
              onClick={handleSubmit}
              type="button"
            >
              {submitting ? "분석 중..." : "분석 시작"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
