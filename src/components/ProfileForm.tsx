"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type {
  CoupleProfile,
  HouseholdType,
  PriorityKey,
  Workplace,
  AreaRangeKey,
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
} from "@/types/profile";
import type { RecommendationResult } from "@/types/recommendation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Segmented } from "@/components/ui/Segmented";
import { StepDots } from "@/components/ui/StepDots";
import { formatKrwHuman } from "@/lib/format";
import { estimateBudget } from "@/lib/budget";
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
        <p className="text-[15px] font-semibold text-[#1d1d1f] leading-snug">
          {label}
        </p>
        {description && (
          <p className="text-[13px] text-[#86868b] mt-0.5">{description}</p>
        )}
      </div>
      <span
        role="switch"
        aria-checked={checked}
        className={[
          "relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-4",
          trackCls,
          checked ? "bg-indigo-600" : "bg-[#d1d1d6]",
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
      <p className="text-[15px] font-semibold text-[#1d1d1f]">{label}</p>

      {/* 직장 검색 / 선택 */}
      {hasSelected ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-200">
          <span className="flex-1 text-[15px] text-[#1d1d1f] font-medium">
            {state.selected!.label}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
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
              className="w-full px-4 py-3 rounded-2xl border border-[#d1d1d6] bg-white text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-[15px]"
            />
            {state.loading && (
              <span className="absolute right-4 text-xs text-[#86868b]">
                검색 중...
              </span>
            )}
          </div>

          {!state.loading &&
            state.query.length >= 2 &&
            state.results.length === 0 && (
              <p className="mt-2 text-[13px] text-amber-600 leading-snug">
                결과가 없어요. 가까운 지하철역·지역명으로 입력해 보세요
                <br />
                <span className="text-[#86868b]">예: 강남역, 판교, 여의도</span>
              </p>
            )}

          {state.results.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#e5e5ea] rounded-2xl shadow-xl overflow-hidden">
              {state.results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelect(r)}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors text-[14px] text-[#1d1d1f]"
                  >
                    <span className="font-medium">{r.label}</span>
                    {r.address && (
                      <span className="ml-2 text-[#86868b]">{r.address}</span>
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
          <p className="text-[13px] text-[#6e6e73] mb-2">통근 허용시간 (자차 기준)</p>
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
  const [householdType, setHouseholdType] =
    useState<HouseholdType>("dualIncome");
  const [preferredAreaRange, setPreferredAreaRange] =
    useState<AreaRangeKey>(DEFAULT_AREA_RANGE);

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
  const [isExpectingChild, setIsExpectingChild] = useState(false);
  const [isNewlywed, setIsNewlywed] = useState(false);
  const [hasOwnedHome, setHasOwnedHome] = useState(false);

  // ── Step 4: 예산 / 대출 ─────────────────────────────────────
  // 모든 금액 입력: 만원 단위
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
      householdType,
      priorities,
      preferredAreaRange,
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
      hasOwnedHomeBefore: hasOwnedHome,
      isNewlywed,
      existingHome,
    };
  }, [
    householdType,
    priorities,
    preferredAreaRange,
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
    hasOwnedHome,
    isNewlywed,
    hasExistingHome,
    existingHomeSalePrice,
    existingHomeLoan,
    existingHomeTaxExempt,
  ]);

  // ── Step 4 예산 미리보기 ─────────────────────────────────────
  // 보유 현금·연 소득이 모두 입력돼야 추정이 의미 있으므로 그 전엔 숨긴다.
  const canPreviewBudget =
    (parseFloat(seedMoney) || 0) > 0 && (parseFloat(householdIncome) || 0) > 0;

  const previewBudget = useMemo(
    () => (canPreviewBudget ? estimateBudget(buildProfile()) : null),
    [canPreviewBudget, buildProfile],
  );

  // ── Step 3 정책대출 예비 힌트 ────────────────────────────────
  // 가족 구성(자녀·신혼·무주택)만으로 짚어줄 수 있는 항목. 소득·자산 요건은
  // Step 4 입력 후 estimateBudget 이 정식 판정한다.
  const familyPolicyHints = useMemo(() => {
    const hints: string[] = [];
    if (hasOwnedHome) return hints;
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
  }, [hasInfant, hasTwoOrMoreChildren, isNewlywed, hasOwnedHome]);

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
        <p className="text-[13px] text-[#86868b]">
          {visualStep + 1}단계 / {visualTotal}
        </p>
      </div>

      {/* ── Step 1: 가구 유형 & 평수 ──────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#1d1d1f] leading-snug">
              가구 유형을 선택해 주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
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
                      "rounded-3xl border-2 px-4 py-5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400",
                      selected
                        ? "border-indigo-600 bg-indigo-50 shadow-md"
                        : "border-[#e5e5ea] bg-white hover:border-indigo-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "block text-[15px] font-semibold leading-snug",
                        selected ? "text-indigo-700" : "text-[#1d1d1f]",
                      ].join(" ")}
                    >
                      {HOUSEHOLD_TYPE_LABELS[type]}
                    </span>
                    <span className="mt-1 block text-[12px] text-[#86868b]">
                      {subtitles[type]}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* 선호 평수 */}
          <div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-3">
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

          <Button onClick={goNext} fullWidth>
            다음
          </Button>
        </div>
      )}

      {/* ── Step 2: 직장 & 통근 ───────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#1d1d1f] leading-snug">
              직장 위치를 알려주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
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
            <h2 className="text-[22px] font-bold text-[#1d1d1f] leading-snug">
              가족 구성을 알려주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              학군·정책대출 요건 판정에 활용됩니다
            </p>
          </div>

          {/* 자녀·가족 신호 — 해당 항목 모두 선택 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[#1d1d1f]">
                자녀 / 가족 상황
              </p>
              <p className="text-[13px] text-[#86868b] mt-0.5">
                해당되는 항목을 모두 선택해 주세요. 학군 점수와 정책대출 자격
                판정에 활용됩니다.
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
                  {
                    key: "two",
                    label: "자녀 2명 이상",
                    why: "디딤돌(일반) 소득 기준 완화 판정",
                    state: hasTwoOrMoreChildren,
                    set: (updater: boolean | ((v: boolean) => boolean)) => {
                      const next =
                        typeof updater === "function"
                          ? updater(hasTwoOrMoreChildren)
                          : updater;
                      setHasTwoOrMoreChildren(next);
                      if (!next) setHasThreeOrMoreChildren(false);
                    },
                  },
                  {
                    key: "three",
                    label: "자녀 3명 이상 (다자녀)",
                    why: "다자녀 추가 정책 확인 권고 — 현 계산엔 디딤돌(일반) 완화만 반영",
                    state: hasThreeOrMoreChildren,
                    set: (updater: boolean | ((v: boolean) => boolean)) => {
                      const next =
                        typeof updater === "function"
                          ? updater(hasThreeOrMoreChildren)
                          : updater;
                      setHasThreeOrMoreChildren(next);
                      if (next) setHasTwoOrMoreChildren(true);
                    },
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
                      ? "bg-indigo-50 border-indigo-300"
                      : "bg-white border-[#e5e5ea] hover:border-[#d1d1d6]"
                  }`}
                >
                  <div>
                    <p
                      className={`text-[15px] font-medium ${item.state ? "text-indigo-900" : "text-[#1d1d1f]"}`}
                    >
                      {item.label}
                    </p>
                    <p className="text-[12px] text-[#86868b] mt-0.5">
                      {item.why}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      item.state
                        ? "bg-indigo-600 border-indigo-600"
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

          {/* 주택 보유 이력 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[#1d1d1f]">
                전에 집을 가져본 적 있나요?
              </p>
              <p className="text-[13px] text-[#86868b] mt-0.5">
                생애최초 취득세 감면·정책대출 판정에 사용됩니다
              </p>
            </div>
            <Segmented
              options={[
                { value: "yes", label: "있어요" },
                { value: "no", label: "없어요" },
              ]}
              value={hasOwnedHome ? "yes" : "no"}
              onChange={(v) => setHasOwnedHome(v === "yes")}
            />
          </div>

          {/* 정책대출 예비 안내 — 가족 구성 기준 */}
          <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5 flex flex-col gap-2">
            <p className="text-[15px] font-semibold text-[#1d1d1f]">
              정책대출 예비 안내
            </p>
            {familyPolicyHints.length > 0 ? (
              <>
                <p className="text-[13px] text-[#6e6e73] leading-relaxed">
                  지금까지 입력한 가족 구성 기준으로 아래 항목에 해당할 수 있어요.
                  소득·순자산 요건은 다음 단계에서 확인합니다.
                </p>
                <ul className="flex flex-col gap-1.5 mt-0.5">
                  {familyPolicyHints.map((hint) => (
                    <li
                      key={hint}
                      className="flex gap-1.5 text-[13px] text-indigo-800 leading-relaxed"
                    >
                      <span className="mt-0.5 flex-shrink-0 text-indigo-400">
                        &#9679;
                      </span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[13px] text-[#6e6e73] leading-relaxed">
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
            <h2 className="text-[22px] font-bold text-[#1d1d1f] leading-snug">
              예산과 대출 정보를 입력해 주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              모든 금액은 만원 단위로 입력하세요
            </p>
          </div>

          {/* 정책대출 안내 배너 */}
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
            <p className="text-[13px] text-indigo-700 leading-relaxed">
              입력 정보로 디딤돌·신생아 특례·보금자리론 등 정책대출 자격도 함께 확인해 드립니다
            </p>
          </div>

          {/* 기본 재무 정보 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-5">
            <p className="text-[15px] font-semibold text-[#1d1d1f]">
              기본 재무 정보
            </p>

            <TextField
              label="보유 현금"
              value={seedMoney}
              onChange={setSeedMoney}
              type="number"
              placeholder="예: 10000"
              suffix="만원"
              hint={manwonHint(seedMoney)}
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
              label="순자산 총액"
              value={netAssets}
              onChange={setNetAssets}
              type="number"
              placeholder="예: 30000"
              suffix="만원"
              hint={
                netAssets
                  ? `${manwonHint(netAssets)} — 금융자산+부동산−부채 개략값`
                  : "금융자산+부동산−부채 개략값 (정책대출 자산요건 판정용)"
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
                  : "주담대·신용대출·할부 전부 합산. 없으면 0"
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
                        <p className="text-[14px] font-medium text-[#1d1d1f]">
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
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c7c7cc] text-[10px] font-bold text-[#86868b] hover:border-indigo-400 hover:text-indigo-600 cursor-pointer"
                        >
                          ?
                        </span>
                      </div>
                      <p className="text-[12px] text-[#86868b]">
                        세금 절감 — 1세대 1주택 양도세 비과세 요건
                      </p>
                    </div>
                    <span
                      role="switch"
                      aria-checked={existingHomeTaxExempt}
                      className={[
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ml-4",
                        existingHomeTaxExempt ? "bg-indigo-600" : "bg-[#d1d1d6]",
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
                    <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200 px-4 py-3">
                      <p className="text-[12px] font-semibold text-indigo-800 mb-2">
                        1세대 1주택 양도세 비과세 — 모두 충족해야 적용
                      </p>
                      <ul className="flex flex-col gap-1.5 text-[12px] leading-relaxed text-indigo-900">
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
                      <p className="mt-2 text-[11px] text-indigo-700 leading-relaxed">
                        헷갈리면 ❌ 그대로 두세요 — 양도세 6% 정도가 계산에 반영돼
                        보수적으로 추정됩니다. 정확한 판정은 세무사 상담 권장.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 예산 미리보기 — 보유 현금·연 소득 입력 시 노출 */}
          {previewBudget ? (
            <BudgetPreview budget={previewBudget} />
          ) : (
            <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-[#f5f5f7] p-5">
              <p className="text-[13px] text-[#86868b] leading-relaxed">
                보유 현금과 연 가구소득을 입력하면 예상 대출 가능액·실매수 가능가가
                여기 바로 표시됩니다.
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
            <h2 className="text-[22px] font-bold text-[#1d1d1f] leading-snug">
              무엇을 중요하게 볼까요?
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              세 조건의 중요도가 분석 가중치에 반영됩니다
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {(Object.keys(PRIORITY_LABELS) as PriorityKey[]).map((key) => {
              const hints: Record<PriorityKey, string> = {
                commute: "자차 통근 시간 기준 (대중교통 미반영)",
                school: "초등학교 도보 거리 기준 (중·고·학업성취도·학원가 미반영)",
                buildingAge: "준공년도 — 신축일수록 가점",
              };
              return (
              <div
                key={key}
                className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[#1d1d1f]">
                      {PRIORITY_LABELS[key]}
                    </p>
                    <p className="text-[11px] text-[#86868b] mt-0.5">
                      {hints[key]}
                    </p>
                  </div>
                  <span
                    className={[
                      "text-[13px] font-medium",
                      priorities[key] >= 4
                        ? "text-indigo-600"
                        : "text-[#86868b]",
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

          {/* 분석 중 안내 */}
          {submitting && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="text-[13px] text-indigo-700 leading-relaxed">
                조건에 맞는 단지를 탐색하고 예산·대출을 계산하고 있습니다. 잠시만 기다려 주세요.
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
