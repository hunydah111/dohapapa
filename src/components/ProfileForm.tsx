"use client";

import { useState, useRef, useEffect } from "react";
import type {
  CoupleProfile,
  PriorityKey,
  Workplace,
  AreaRangeKey,
} from "@/types/profile";
import {
  PRIORITY_LABELS,
  PRIORITY_SCALE_LABELS,
  DEFAULT_PRIORITIES,
  DEFAULT_MAX_COMMUTE_MIN,
  AREA_RANGES,
  AREA_RANGE_ORDER,
  DEFAULT_AREA_RANGE,
  DEFAULT_COMMUTE_MODE,
} from "@/types/profile";
import type { CommuteMode, RecommendationResult } from "@/types/recommendation";

export function ProfileForm({ onResult }: { onResult: (result: RecommendationResult) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — 선호 평수 · 통근수단 · 3개 조건 중요도 (1~5)
  const [preferredAreaRange, setPreferredAreaRange] =
    useState<AreaRangeKey>(DEFAULT_AREA_RANGE);
  const [commuteMode, setCommuteMode] =
    useState<CommuteMode>(DEFAULT_COMMUTE_MODE);
  const [priorities, setPriorities] = useState<Record<PriorityKey, number>>({
    ...DEFAULT_PRIORITIES,
  });

  // Step 2
  const [workplaceA, setWorkplaceA] = useState<Workplace | null>(null);
  const [workplaceAQuery, setWorkplaceAQuery] = useState("");
  const [workplaceAResults, setWorkplaceAResults] = useState<{ label: string; lat: number; lng: number; address?: string }[]>([]);
  const [workplaceALoading, setWorkplaceALoading] = useState(false);

  const [dualIncome, setDualIncome] = useState(false);
  const [workplaceB, setWorkplaceB] = useState<Workplace | null>(null);
  const [workplaceBQuery, setWorkplaceBQuery] = useState("");
  const [workplaceBResults, setWorkplaceBResults] = useState<{ label: string; lat: number; lng: number; address?: string }[]>([]);
  const [workplaceBLoading, setWorkplaceBLoading] = useState(false);

  const [maxCommuteA, setMaxCommuteA] = useState<string>(String(DEFAULT_MAX_COMMUTE_MIN));
  const [maxCommuteB, setMaxCommuteB] = useState<string>(String(DEFAULT_MAX_COMMUTE_MIN));

  // Step 3
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [childAgeInput, setChildAgeInput] = useState("");
  const [householdIncome, setHouseholdIncome] = useState("");
  const [seedMoney, setSeedMoney] = useState("");
  const [existingLoan, setExistingLoan] = useState("0");
  const [hasOwnedHome, setHasOwnedHome] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounce refs
  const debounceARef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceBRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Geocode fetch for Workplace A
  useEffect(() => {
    if (debounceARef.current) clearTimeout(debounceARef.current);
    if (workplaceAQuery.length < 2) {
      setWorkplaceAResults([]);
      return;
    }
    debounceARef.current = setTimeout(async () => {
      setWorkplaceALoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(workplaceAQuery)}`);
        if (res.ok) {
          const data = (await res.json()) as { results: { label: string; lat: number; lng: number; address?: string }[] };
          setWorkplaceAResults(data.results);
        }
      } finally {
        setWorkplaceALoading(false);
      }
    }, 300);
    return () => {
      if (debounceARef.current) clearTimeout(debounceARef.current);
    };
  }, [workplaceAQuery]);

  // Geocode fetch for Workplace B
  useEffect(() => {
    if (debounceBRef.current) clearTimeout(debounceBRef.current);
    if (workplaceBQuery.length < 2) {
      setWorkplaceBResults([]);
      return;
    }
    debounceBRef.current = setTimeout(async () => {
      setWorkplaceBLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(workplaceBQuery)}`);
        if (res.ok) {
          const data = (await res.json()) as { results: { label: string; lat: number; lng: number; address?: string }[] };
          setWorkplaceBResults(data.results);
        }
      } finally {
        setWorkplaceBLoading(false);
      }
    }, 300);
    return () => {
      if (debounceBRef.current) clearTimeout(debounceBRef.current);
    };
  }, [workplaceBQuery]);

  // ── Handlers ──────────────────────────────────────────────────

  function handleStep2Next() {
    if (!workplaceA) return;
    setStep(3);
  }

  function handleAddChild() {
    const age = parseInt(childAgeInput, 10);
    if (!isNaN(age) && age >= 0) {
      setChildrenAges((prev) => [...prev, age]);
      setChildAgeInput("");
    }
  }

  function handleRemoveChild(index: number) {
    setChildrenAges((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!workplaceA) return;

    const profile: CoupleProfile = {
      priorities,
      preferredAreaRange,
      commuteMode,
      workplaceA,
      workplaceB: dualIncome && workplaceB ? workplaceB : undefined,
      childrenAges,
      householdIncomeKrwYear: (parseFloat(householdIncome) || 0) * 10_000,
      seedMoneyKrw: (parseFloat(seedMoney) || 0) * 100_000_000,
      existingLoanMonthlyKrw: (parseFloat(existingLoan) || 0) * 10_000,
      hasOwnedHomeBefore: hasOwnedHome,
      maxCommuteMinutesA: parseInt(maxCommuteA, 10) || DEFAULT_MAX_COMMUTE_MIN,
      maxCommuteMinutesB: dualIncome ? (parseInt(maxCommuteB, 10) || DEFAULT_MAX_COMMUTE_MIN) : undefined,
    };

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { message?: string };
        setSubmitError(errData.message ?? "분석 중 오류가 발생했습니다. 다시 시도해 주세요.");
        return;
      }

      const result = (await res.json()) as RecommendationResult;
      onResult(result);
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Progress bar ──────────────────────────────────────────────

  const progressWidth = step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full";

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      {/* Progress */}
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-gray-500">
          3단계 중 {step}단계
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full bg-indigo-600 transition-all duration-300 ${progressWidth}`}
          />
        </div>
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div>
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            어떤 집을 찾으세요?
          </h2>

          {/* 선호 평수 */}
          <div className="mb-7">
            <p className="mb-2 text-sm font-semibold text-gray-700">선호 평수</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {AREA_RANGE_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreferredAreaRange(key)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    preferredAreaRange === key
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-gray-200 bg-white text-gray-500 hover:border-indigo-300"
                  }`}
                >
                  {AREA_RANGES[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* 통근 수단 */}
          <div className="mb-7">
            <p className="mb-2 text-sm font-semibold text-gray-700">통근 수단</p>
            <div className="flex gap-2">
              {(
                [
                  { value: "transit", label: "대중교통" },
                  { value: "car", label: "자차" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCommuteMode(opt.value)}
                  className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    commuteMode === opt.value
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-gray-200 bg-white text-gray-500 hover:border-indigo-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 우선순위 */}
          <p className="mb-3 text-sm font-semibold text-gray-700">
            무엇을 중요하게 볼까요?
            <span className="ml-1 font-normal text-gray-400">
              세 가지 조건의 중요도가 추천 가중치에 반영됩니다.
            </span>
          </p>
          <div className="flex flex-col gap-5">
            {(Object.keys(PRIORITY_LABELS) as PriorityKey[]).map((key) => (
              <div key={key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-base font-semibold text-gray-800">
                    {PRIORITY_LABELS[key]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {PRIORITY_SCALE_LABELS[priorities[key]]}
                  </span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setPriorities((p) => ({ ...p, [key]: v }))
                      }
                      aria-label={`${PRIORITY_LABELS[key]} 중요도 ${v}`}
                      className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                        priorities[key] === v
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : priorities[key] > v
                            ? "border-indigo-200 bg-indigo-50 text-indigo-400"
                            : "border-gray-200 bg-white text-gray-400 hover:border-indigo-300"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-8 w-full rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            다음
          </button>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">직장 위치를 알려주세요</h2>

          {/* Workplace A */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1">본인 직장 <span className="text-red-500">*</span></label>
            {workplaceA ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                <span className="flex-1 text-gray-800">{workplaceA.label}</span>
                <button
                  onClick={() => { setWorkplaceA(null); setWorkplaceAQuery(""); }}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  변경
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={workplaceAQuery}
                  onChange={(e) => setWorkplaceAQuery(e.target.value)}
                  placeholder="직장명 또는 주소 입력"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                {workplaceALoading && (
                  <p className="mt-1 text-xs text-gray-400">검색 중...</p>
                )}
                {!workplaceALoading &&
                  workplaceAQuery.length >= 2 &&
                  workplaceAResults.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      찾지 못했어요. 가까운 지하철역·지역명으로 입력해 보세요 (예: 강남역, 판교, 여의도)
                    </p>
                  )}
                {workplaceAResults.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                    {workplaceAResults.map((r, i) => (
                      <li key={i}>
                        <button
                          onClick={() => {
                            setWorkplaceA({ label: r.label, lat: r.lat, lng: r.lng });
                            setWorkplaceAResults([]);
                            setWorkplaceAQuery("");
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors text-sm text-gray-800"
                        >
                          <span className="font-medium">{r.label}</span>
                          {r.address && <span className="ml-2 text-gray-400">{r.address}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Dual income toggle */}
          <div className="mb-6">
            <button
              onClick={() => { setDualIncome((v) => !v); setWorkplaceB(null); setWorkplaceBQuery(""); }}
              className={`px-5 py-2 rounded-full border-2 text-sm font-semibold transition-colors duration-150 ${dualIncome ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-300 text-gray-600 bg-white hover:border-indigo-400"}`}
            >
              맞벌이예요
            </button>
          </div>

          {/* Workplace B */}
          {dualIncome && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1">배우자 직장</label>
              {workplaceB ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <span className="flex-1 text-gray-800">{workplaceB.label}</span>
                  <button
                    onClick={() => { setWorkplaceB(null); setWorkplaceBQuery(""); }}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    변경
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={workplaceBQuery}
                    onChange={(e) => setWorkplaceBQuery(e.target.value)}
                    placeholder="직장명 또는 주소 입력"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                  {workplaceBLoading && (
                    <p className="mt-1 text-xs text-gray-400">검색 중...</p>
                  )}
                  {!workplaceBLoading &&
                    workplaceBQuery.length >= 2 &&
                    workplaceBResults.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        찾지 못했어요. 가까운 지하철역·지역명으로 입력해 보세요 (예: 강남역, 판교, 여의도)
                      </p>
                    )}
                  {workplaceBResults.length > 0 && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                      {workplaceBResults.map((r, i) => (
                        <li key={i}>
                          <button
                            onClick={() => {
                              setWorkplaceB({ label: r.label, lat: r.lat, lng: r.lng });
                              setWorkplaceBResults([]);
                              setWorkplaceBQuery("");
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors text-sm text-gray-800"
                          >
                            <span className="font-medium">{r.label}</span>
                            {r.address && <span className="ml-2 text-gray-400">{r.address}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Commute time */}
          <div className="mb-8 p-4 rounded-2xl bg-gray-50 border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-3">통근 허용시간 (분)</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label className="w-20 text-sm text-gray-600">본인</label>
                <input
                  type="number"
                  min={0}
                  value={maxCommuteA}
                  onChange={(e) => setMaxCommuteA(e.target.value)}
                  className="w-24 px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                />
                <span className="text-sm text-gray-500">분</span>
              </div>
              {dualIncome && (
                <div className="flex items-center gap-3">
                  <label className="w-20 text-sm text-gray-600">배우자</label>
                  <input
                    type="number"
                    min={0}
                    value={maxCommuteB}
                    onChange={(e) => setMaxCommuteB(e.target.value)}
                    className="w-24 px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                  />
                  <span className="text-sm text-gray-500">분</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-2xl border-2 border-gray-300 text-gray-600 font-semibold hover:border-gray-400 transition-colors"
            >
              이전
            </button>
            <button
              onClick={handleStep2Next}
              disabled={!workplaceA}
              className="flex-1 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">가족 구성과 예산을 입력해 주세요</h2>

          {/* Children ages */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">자녀 나이</label>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                min={0}
                max={25}
                value={childAgeInput}
                onChange={(e) => setChildAgeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddChild(); }}
                placeholder="나이 입력"
                className="w-28 px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={handleAddChild}
                className="px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition-colors"
              >
                추가
              </button>
            </div>
            {childrenAges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {childrenAges.map((age, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-sm text-indigo-800"
                  >
                    {age}세
                    <button
                      onClick={() => handleRemoveChild(i)}
                      className="ml-1 text-indigo-400 hover:text-indigo-700 font-bold leading-none"
                      aria-label={`${age}세 삭제`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
            {childrenAges.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">자녀가 없으면 비워두세요.</p>
            )}
          </div>

          {/* Household income */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1">연 가구소득</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={householdIncome}
                onChange={(e) => setHouseholdIncome(e.target.value)}
                placeholder="예: 8000"
                className="w-40 px-4 py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-gray-600">만원</span>
            </div>
            {householdIncome && (
              <p className="mt-1 text-xs text-gray-400">
                = {(parseFloat(householdIncome) * 10_000).toLocaleString("ko-KR")}원
              </p>
            )}
          </div>

          {/* Seed money */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1">보유 시드머니</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.1}
                value={seedMoney}
                onChange={(e) => setSeedMoney(e.target.value)}
                placeholder="예: 2.5"
                className="w-40 px-4 py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-gray-600">억</span>
            </div>
            {seedMoney && (
              <p className="mt-1 text-xs text-gray-400">
                = {(parseFloat(seedMoney) * 100_000_000).toLocaleString("ko-KR")}원
              </p>
            )}
          </div>

          {/* Existing loan */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1">기존 대출 월 상환액</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={existingLoan}
                onChange={(e) => setExistingLoan(e.target.value)}
                placeholder="0"
                className="w-40 px-4 py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-gray-600">만원 / 월</span>
            </div>
          </div>

          {/* Has owned home */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-2">주택 보유 이력</label>
            <div className="flex gap-3">
              <button
                onClick={() => setHasOwnedHome(true)}
                className={`px-5 py-2 rounded-full border-2 text-sm font-semibold transition-colors duration-150 ${hasOwnedHome ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-300 text-gray-600 bg-white hover:border-indigo-400"}`}
              >
                예
              </button>
              <button
                onClick={() => setHasOwnedHome(false)}
                className={`px-5 py-2 rounded-full border-2 text-sm font-semibold transition-colors duration-150 ${!hasOwnedHome ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-300 text-gray-600 bg-white hover:border-indigo-400"}`}
              >
                아니오
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">생애최초 취득세 감면 판정에 사용됩니다.</p>
          </div>

          {/* Error */}
          {submitError && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 rounded-2xl border-2 border-gray-300 text-gray-600 font-semibold hover:border-gray-400 transition-colors"
            >
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "분석 중..." : "분석 시작"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
