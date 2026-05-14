"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  DEFAULT_COMMUTE_MODE,
  AREA_RANGES,
  AREA_RANGE_ORDER,
  DEFAULT_AREA_RANGE,
} from "@/types/profile";
import type { RecommendationResult } from "@/types/recommendation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Segmented } from "@/components/ui/Segmented";
import { StepDots } from "@/components/ui/StepDots";

// ── 내부 타입 ──────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

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

// ── 서브컴포넌트: 직장 입력 ────────────────────────────────────

interface WorkplaceInputProps {
  label: string;
  state: WorkplaceFormState;
  onQueryChange: (q: string) => void;
  onSelect: (r: GeoResult) => void;
  onClear: () => void;
  onCommuteModeChange: (mode: "transit" | "car") => void;
  onMaxCommuteChange: (minutes: string) => void;
  maxCommuteValue: string;
  commuteModeValue: "transit" | "car";
  autoFocus?: boolean;
}

function WorkplaceInput({
  label,
  state,
  onQueryChange,
  onSelect,
  onClear,
  onCommuteModeChange,
  onMaxCommuteChange,
  maxCommuteValue,
  commuteModeValue,
  autoFocus,
}: WorkplaceInputProps) {
  const dropdownRef = useRef<HTMLUListElement>(null);

  return (
    <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 flex flex-col gap-4 shadow-sm">
      <p className="text-[15px] font-semibold text-[#1d1d1f]">{label}</p>

      {/* 직장 검색 / 선택 */}
      {state.selected ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-200">
          <span className="flex-1 text-[15px] text-[#1d1d1f] font-medium">
            {state.selected.label}
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
            <ul
              ref={dropdownRef}
              className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#e5e5ea] rounded-2xl shadow-xl overflow-hidden"
            >
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

      {/* 통근 설정 — 직장 선택 후만 표시 */}
      {state.selected && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[13px] text-[#6e6e73] mb-2">통근 수단</p>
            <Segmented
              options={[
                { value: "transit", label: "대중교통" },
                { value: "car", label: "자차" },
              ]}
              value={commuteModeValue}
              onChange={(v) => onCommuteModeChange(v as "transit" | "car")}
            />
          </div>
          <div>
            <p className="text-[13px] text-[#6e6e73] mb-2">통근 허용시간</p>
            <TextField
              value={maxCommuteValue}
              onChange={onMaxCommuteChange}
              type="number"
              placeholder="50"
              suffix="분"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export function ProfileForm({
  onResult,
}: {
  onResult: (result: RecommendationResult, profile: CoupleProfile) => void;
}) {
  const TOTAL_STEPS = 4;
  const [step, setStep] = useState<Step>(1);

  // ── Step 1 상태 ────────────────────────────────────────────
  const [householdType, setHouseholdType] =
    useState<HouseholdType>("dualIncome");
  const [preferredAreaRange, setPreferredAreaRange] =
    useState<AreaRangeKey>(DEFAULT_AREA_RANGE);

  // ── Step 2 상태 ────────────────────────────────────────────
  const [wpA, setWpA] = useState<WorkplaceFormState>(makeEmptyWorkplace());
  const [wpB, setWpB] = useState<WorkplaceFormState>(makeEmptyWorkplace());
  const [commuteModeA, setCommuteModeA] = useState<"transit" | "car">(
    DEFAULT_COMMUTE_MODE
  );
  const [commuteModeB, setCommuteModeB] = useState<"transit" | "car">(
    DEFAULT_COMMUTE_MODE
  );
  const [maxCommuteA, setMaxCommuteA] = useState(
    String(DEFAULT_MAX_COMMUTE_MIN)
  );
  const [maxCommuteB, setMaxCommuteB] = useState(
    String(DEFAULT_MAX_COMMUTE_MIN)
  );

  // ── Step 3 상태 ────────────────────────────────────────────
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [childAgeInput, setChildAgeInput] = useState("");
  const [householdIncome, setHouseholdIncome] = useState("");
  const [seedMoney, setSeedMoney] = useState("");
  const [existingLoan, setExistingLoan] = useState("0");
  const [hasOwnedHome, setHasOwnedHome] = useState<boolean>(false);
  const [hasExistingHome, setHasExistingHome] = useState(false);
  const [existingHomeSalePrice, setExistingHomeSalePrice] = useState("");
  const [existingHomeLoan, setExistingHomeLoan] = useState("");
  const [existingHomeTaxExempt, setExistingHomeTaxExempt] = useState(false);

  // ── Step 4 상태 ────────────────────────────────────────────
  const [priorities, setPriorities] = useState<Record<PriorityKey, number>>({
    ...DEFAULT_PRIORITIES,
  });

  // ── 제출 상태 ──────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Geocode 디바운스 ───────────────────────────────────────
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

  // Workplace A 검색
  useEffect(() => {
    if (debounceARef.current) clearTimeout(debounceARef.current);
    if (wpA.query.length < 2) {
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

  // Workplace B 검색
  useEffect(() => {
    if (debounceBRef.current) clearTimeout(debounceBRef.current);
    if (wpB.query.length < 2) {
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

  // ── 헬퍼 ──────────────────────────────────────────────────

  function selectWorkplace(
    which: "A" | "B",
    r: GeoResult,
    mode: "transit" | "car",
    maxMin: string
  ) {
    const selected: Workplace = {
      label: r.label,
      lat: r.lat,
      lng: r.lng,
      commuteMode: mode,
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

  function handleAddChild() {
    const age = parseInt(childAgeInput, 10);
    if (!isNaN(age) && age >= 0 && age <= 25) {
      setChildrenAges((prev) => [...prev, age]);
      setChildAgeInput("");
    }
  }

  function removeChild(index: number) {
    setChildrenAges((prev) => prev.filter((_, i) => i !== index));
  }

  // Step 2 진행 가능 여부
  function step2CanProceed(): boolean {
    if (householdType === "retired") return true;
    if (!wpA.selected) return false;
    if (householdType === "dualIncome" && !wpB.selected) return false;
    return true;
  }

  // 실제 단계 진행 (retired 이면 Step 2 건너뜀)
  function goNext() {
    if (step === 1) {
      if (householdType === "retired") {
        setStep(3);
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  }

  function goPrev() {
    if (step === 2) setStep(1);
    else if (step === 3) {
      if (householdType === "retired") setStep(1);
      else setStep(2);
    } else if (step === 4) setStep(3);
  }

  // commute 설정 변경 시 selected Workplace 에도 즉시 반영
  function syncWorkplaceSettings(
    which: "A" | "B",
    mode: "transit" | "car",
    maxMin: string
  ) {
    const setter = which === "A" ? setWpA : setWpB;
    setter((prev) => {
      if (!prev.selected) return prev;
      return {
        ...prev,
        selected: {
          ...prev.selected,
          commuteMode: mode,
          maxCommuteMinutes: parseInt(maxMin, 10) || DEFAULT_MAX_COMMUTE_MIN,
        },
      };
    });
  }

  function handleCommuteModeA(mode: "transit" | "car") {
    setCommuteModeA(mode);
    syncWorkplaceSettings("A", mode, maxCommuteA);
  }
  function handleCommuteModeB(mode: "transit" | "car") {
    setCommuteModeB(mode);
    syncWorkplaceSettings("B", mode, maxCommuteB);
  }
  function handleMaxCommuteA(v: string) {
    setMaxCommuteA(v);
    syncWorkplaceSettings("A", commuteModeA, v);
  }
  function handleMaxCommuteB(v: string) {
    setMaxCommuteB(v);
    syncWorkplaceSettings("B", commuteModeB, v);
  }

  // ── 제출 ──────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);

    const existingHome: ExistingHome | undefined = hasExistingHome
      ? {
          expectedSalePriceKrw:
            (parseFloat(existingHomeSalePrice) || 0) * 1e8,
          remainingLoanKrw: (parseFloat(existingHomeLoan) || 0) * 1e8,
          qualifiesForTaxExemption: existingHomeTaxExempt,
        }
      : undefined;

    const finalWpA: Workplace | undefined =
      wpA.selected
        ? {
            ...wpA.selected,
            commuteMode: commuteModeA,
            maxCommuteMinutes:
              parseInt(maxCommuteA, 10) || DEFAULT_MAX_COMMUTE_MIN,
          }
        : undefined;

    const finalWpB: Workplace | undefined =
      householdType === "dualIncome" && wpB.selected
        ? {
            ...wpB.selected,
            commuteMode: commuteModeB,
            maxCommuteMinutes:
              parseInt(maxCommuteB, 10) || DEFAULT_MAX_COMMUTE_MIN,
          }
        : undefined;

    const profile: CoupleProfile = {
      householdType,
      priorities,
      preferredAreaRange,
      workplaceA: finalWpA,
      workplaceB: finalWpB,
      childrenAges,
      householdIncomeKrwYear: (parseFloat(householdIncome) || 0) * 10_000,
      seedMoneyKrw: (parseFloat(seedMoney) || 0) * 1e8,
      existingLoanMonthlyKrw: (parseFloat(existingLoan) || 0) * 10_000,
      hasOwnedHomeBefore: hasOwnedHome,
      existingHome,
    };

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

  // ── 시각적 스텝 번호 (retired 는 2단계 없음 → 1·3·4 를 1·2·3으로 표시) ──
  const visualStep =
    householdType === "retired" && step >= 3 ? step - 1 : step;
  const visualTotal = householdType === "retired" ? 3 : TOTAL_STEPS;

  // ── 렌더 ──────────────────────────────────────────────────

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      {/* 진행 표시 */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <StepDots current={visualStep} total={visualTotal} />
        <p className="text-[13px] text-[#86868b]">
          {visualStep}단계 / {visualTotal}
        </p>
      </div>

      {/* ── Step 1: 가구 유형 & 평수 ─────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#1d1d1f] leading-snug">
              가구 유형을 선택해 주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              통근 조건·추천 방식이 달라집니다
            </p>
          </div>

          {/* 가구 유형 카드 */}
          <div className="grid grid-cols-2 gap-3">
            {(
              Object.keys(HOUSEHOLD_TYPE_LABELS) as HouseholdType[]
            ).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setHouseholdType(type)}
                className={[
                  "rounded-3xl border-2 px-4 py-5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400",
                  householdType === type
                    ? "border-indigo-600 bg-indigo-50 shadow-md"
                    : "border-[#e5e5ea] bg-white hover:border-indigo-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "block text-[15px] font-semibold leading-snug",
                    householdType === type
                      ? "text-indigo-700"
                      : "text-[#1d1d1f]",
                  ].join(" ")}
                >
                  {HOUSEHOLD_TYPE_LABELS[type]}
                </span>
                <span className="mt-1 block text-[12px] text-[#86868b]">
                  {type === "single" && "1인 단독 통근"}
                  {type === "dualIncome" && "두 직장 모두 고려"}
                  {type === "singleIncome" && "한 직장 기준"}
                  {type === "retired" && "통근 조건 없음"}
                </span>
              </button>
            ))}
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

          {/* 직장 A */}
          <WorkplaceInput
            label={
              householdType === "dualIncome" ? "본인 직장" : "직장"
            }
            state={wpA}
            onQueryChange={(q) =>
              setWpA((prev) => ({ ...prev, query: q, selected: null }))
            }
            onSelect={(r) => selectWorkplace("A", r, commuteModeA, maxCommuteA)}
            onClear={() => clearWorkplace("A")}
            onCommuteModeChange={handleCommuteModeA}
            onMaxCommuteChange={handleMaxCommuteA}
            commuteModeValue={commuteModeA}
            maxCommuteValue={maxCommuteA}
            autoFocus
          />

          {/* 직장 B — 맞벌이만 */}
          {householdType === "dualIncome" && (
            <WorkplaceInput
              label="배우자 직장"
              state={wpB}
              onQueryChange={(q) =>
                setWpB((prev) => ({ ...prev, query: q, selected: null }))
              }
              onSelect={(r) =>
                selectWorkplace("B", r, commuteModeB, maxCommuteB)
              }
              onClear={() => clearWorkplace("B")}
              onCommuteModeChange={handleCommuteModeB}
              onMaxCommuteChange={handleMaxCommuteB}
              commuteModeValue={commuteModeB}
              maxCommuteValue={maxCommuteB}
            />
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={goPrev}>
              이전
            </Button>
            <Button
              fullWidth
              disabled={!step2CanProceed()}
              onClick={goNext}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: 가족 & 자금 ───────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#1d1d1f] leading-snug">
              가족 구성과 예산을 입력해 주세요
            </h2>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              예산 추정과 대출 한도 계산에 활용됩니다
            </p>
          </div>

          {/* 자녀 나이 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-[#1d1d1f]">
              자녀 나이
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <TextField
                  value={childAgeInput}
                  onChange={setChildAgeInput}
                  type="number"
                  placeholder="나이 입력 (0~25)"
                  suffix="세"
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={handleAddChild}
                disabled={
                  childAgeInput === "" ||
                  isNaN(parseInt(childAgeInput, 10)) ||
                  parseInt(childAgeInput, 10) < 0 ||
                  parseInt(childAgeInput, 10) > 25
                }
              >
                추가
              </Button>
            </div>

            {childrenAges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {childrenAges.map((age, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-[13px] font-medium text-indigo-800"
                  >
                    {age}세
                    <button
                      type="button"
                      onClick={() => removeChild(i)}
                      aria-label={`${age}세 삭제`}
                      className="w-4 h-4 flex items-center justify-center rounded-full bg-indigo-200 text-indigo-600 hover:bg-indigo-300 transition-colors text-[10px] font-bold leading-none"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#86868b]">
                자녀가 없으면 비워두세요.
              </p>
            )}
          </div>

          {/* 재무 정보 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-5">
            <p className="text-[15px] font-semibold text-[#1d1d1f]">
              재무 정보
            </p>

            <TextField
              label="연 가구소득"
              value={householdIncome}
              onChange={setHouseholdIncome}
              type="number"
              placeholder="예: 8000"
              suffix="만원"
              hint={
                householdIncome
                  ? `= ${(parseFloat(householdIncome) * 10_000).toLocaleString("ko-KR")}원`
                  : undefined
              }
            />

            <TextField
              label="보유 시드머니"
              value={seedMoney}
              onChange={setSeedMoney}
              type="number"
              placeholder="예: 2.5"
              suffix="억"
              hint={
                seedMoney
                  ? `= ${(parseFloat(seedMoney) * 1e8).toLocaleString("ko-KR")}원`
                  : undefined
              }
            />

            <TextField
              label="기존 대출 월 상환액"
              value={existingLoan}
              onChange={setExistingLoan}
              type="number"
              placeholder="0"
              suffix="만원/월"
              hint="없으면 0을 입력하세요"
            />
          </div>

          {/* 주택 보유 이력 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[#1d1d1f]">
                주택 보유 이력
              </p>
              <p className="text-[13px] text-[#86868b] mt-0.5">
                생애최초 취득세 감면 판정에 사용됩니다
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

          {/* 갈아타기 토글 */}
          <div className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setHasExistingHome((v) => !v)}
              className="flex items-center justify-between w-full"
            >
              <div className="text-left">
                <p className="text-[15px] font-semibold text-[#1d1d1f]">
                  기존 집을 팔아 자금을 마련해요
                </p>
                <p className="text-[13px] text-[#86868b] mt-0.5">
                  갈아타기 — 매도 예상가와 잔대출을 입력하면 순수령액을 계산합니다
                </p>
              </div>
              <span
                className={[
                  "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-4",
                  hasExistingHome ? "bg-indigo-600" : "bg-[#d1d1d6]",
                ].join(" ")}
                aria-pressed={hasExistingHome}
                role="switch"
              >
                <span
                  className={[
                    "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    hasExistingHome ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </span>
            </button>

            {hasExistingHome && (
              <div className="flex flex-col gap-4 pt-2 border-t border-[#f0f0f0]">
                <TextField
                  label="예상 매도가"
                  value={existingHomeSalePrice}
                  onChange={setExistingHomeSalePrice}
                  type="number"
                  placeholder="예: 8"
                  suffix="억"
                  hint={
                    existingHomeSalePrice
                      ? `= ${(parseFloat(existingHomeSalePrice) * 1e8).toLocaleString("ko-KR")}원`
                      : undefined
                  }
                />

                <TextField
                  label="남은 대출 잔금"
                  value={existingHomeLoan}
                  onChange={setExistingHomeLoan}
                  type="number"
                  placeholder="없으면 0"
                  suffix="억"
                  hint={
                    existingHomeLoan
                      ? `= ${(parseFloat(existingHomeLoan) * 1e8).toLocaleString("ko-KR")}원`
                      : undefined
                  }
                />

                {/* 비과세 요건 토글 */}
                <button
                  type="button"
                  onClick={() => setExistingHomeTaxExempt((v) => !v)}
                  className="flex items-center justify-between w-full py-1"
                >
                  <div className="text-left">
                    <p className="text-[14px] font-medium text-[#1d1d1f]">
                      2년 이상 보유·거주했어요
                    </p>
                    <p className="text-[12px] text-[#86868b]">
                      1세대 1주택 양도세 비과세 요건
                    </p>
                  </div>
                  <span
                    className={[
                      "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ml-4",
                      existingHomeTaxExempt ? "bg-indigo-600" : "bg-[#d1d1d6]",
                    ].join(" ")}
                    aria-pressed={existingHomeTaxExempt}
                    role="switch"
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
              </div>
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

      {/* ── Step 4: 우선순위 & 제출 ───────────────────────────── */}
      {step === 4 && (
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
            {(Object.keys(PRIORITY_LABELS) as PriorityKey[]).map((key) => (
              <div
                key={key}
                className="rounded-3xl bg-white border border-[#e5e5ea] p-5 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">
                    {PRIORITY_LABELS[key]}
                  </p>
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
            ))}
          </div>

          {/* 에러 */}
          {submitError && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-[14px] text-red-700 leading-snug">
              {submitError}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={goPrev}>
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
