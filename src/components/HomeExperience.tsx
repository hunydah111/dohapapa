"use client";

import { useState } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import type { RecommendationResult, MoreCandidate } from "@/types/recommendation";
import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import { AREA_RANGES, AREA_RANGE_ORDER } from "@/types/profile";
import { BudgetSummary } from "./BudgetSummary";
import { CandidateCard } from "./CandidateCard";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Card } from "@/components/ui/Card";

function formatEok(krw: number): string {
  const val = krw / 100_000_000;
  return `${val.toFixed(1)}억`;
}

type ResultState = {
  result: RecommendationResult;
  profile: CoupleProfile;
};

export function HomeExperience() {
  const [state, setState] = useState<ResultState | null>(null);

  // 조건 수정 패널 상태
  const [panelOpen, setPanelOpen] = useState(false);
  const [editSeedMoney, setEditSeedMoney] = useState(""); // 억 단위 문자열
  const [editAreaRange, setEditAreaRange] = useState<AreaRangeKey | "">("");
  const [editMaxCommute, setEditMaxCommute] = useState(""); // 분 단위 문자열
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);

  function handleResult(result: RecommendationResult, profile: CoupleProfile) {
    setState({ result, profile });
    setPanelOpen(false);
    // 조건 수정 패널 기본값을 현재 프로필로 초기화
    setEditSeedMoney(String((profile.seedMoneyKrw / 100_000_000).toFixed(1)));
    setEditAreaRange(profile.preferredAreaRange);
    const commuteMin = profile.workplaceA?.maxCommuteMinutes ?? 50;
    setEditMaxCommute(String(commuteMin));
    setReanalyzeError(null);
  }

  async function handleReanalyze() {
    if (!state) return;
    setReanalyzing(true);
    setReanalyzeError(null);

    const seedKrw =
      editSeedMoney !== ""
        ? parseFloat(editSeedMoney) * 100_000_000
        : state.profile.seedMoneyKrw;

    const areaRange: AreaRangeKey =
      editAreaRange !== "" ? editAreaRange : state.profile.preferredAreaRange;

    const maxMin =
      editMaxCommute !== ""
        ? parseInt(editMaxCommute, 10)
        : 50;

    // 기존 프로필에 변경값 머지
    const merged: CoupleProfile = {
      ...state.profile,
      seedMoneyKrw: seedKrw,
      preferredAreaRange: areaRange,
      ...(state.profile.workplaceA
        ? {
            workplaceA: {
              ...state.profile.workplaceA,
              maxCommuteMinutes: maxMin,
            },
          }
        : {}),
      ...(state.profile.workplaceB
        ? {
            workplaceB: {
              ...state.profile.workplaceB,
              maxCommuteMinutes: maxMin,
            },
          }
        : {}),
    };

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setReanalyzeError(
          errData.message ?? "분석 중 오류가 발생했습니다. 다시 시도해 주세요."
        );
        return;
      }

      const newResult = (await res.json()) as RecommendationResult;
      setState({ result: newResult, profile: merged });
      setPanelOpen(false);
    } catch {
      setReanalyzeError(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요."
      );
    } finally {
      setReanalyzing(false);
    }
  }

  // ── 입력 화면 ──────────────────────────────────────────────
  if (state === null) {
    return <ProfileForm onResult={handleResult} />;
  }

  const { result } = state;

  // ── 결과 화면 ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8">
      {/* 상단 바: 처음부터 버튼 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "#6e6e73" }}>
          검토 {result.consideredComplexCount.toLocaleString()}개 단지 분석 완료
        </p>
        <Button
          variant="ghost"
          size="md"
          onClick={() => setState(null)}
        >
          처음부터
        </Button>
      </div>

      {/* 예산 분석 */}
      <BudgetSummary budget={result.budget} />

      {/* ── 조건에 맞는 단지 or 0건 ── */}
      {result.candidates.length > 0 ? (
        <section className="flex flex-col gap-5">
          <div>
            <h2
              className="text-xl font-bold"
              style={{ color: "#1d1d1f" }}
            >
              조건에 맞는 단지
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: "#6e6e73" }}>
              검토 {result.consideredComplexCount.toLocaleString()}개 중 상위{" "}
              {result.candidates.length}곳
            </p>
          </div>

          <ul className="flex flex-col gap-6">
            {result.candidates.map((candidate, i) => (
              <li key={candidate.complexId}>
                <CandidateCard candidate={candidate} rank={i + 1} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        /* P0#2 — 0건 화면 */
        <Card>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "#1d1d1f" }}
          >
            조건에 맞는 단지를 찾지 못했습니다
          </h2>
          <p className="text-sm mb-6" style={{ color: "#6e6e73" }}>
            입력하신 조건에 딱 맞는 단지가 없습니다. 아래 제안 중 하나를
            선택해 조건을 조정해 보세요.
          </p>

          {result.relaxationSuggestions.length > 0 && (
            <div className="flex flex-col gap-3">
              {result.relaxationSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="group flex items-center justify-between rounded-2xl border border-black/[0.08] bg-[#f5f5f7] px-5 py-4 text-left transition-colors hover:bg-white hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <span
                    className="text-sm font-medium leading-relaxed"
                    style={{ color: "#1d1d1f" }}
                  >
                    {s.message}
                  </span>
                  <span
                    className="ml-4 flex-shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700"
                  >
                    {s.resultCount}곳
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setPanelOpen(true)}
              fullWidth
            >
              조건 수정하기
            </Button>
          </div>
        </Card>
      )}

      {/* 그 밖의 후보 — 이름 목록 */}
      {result.moreCandidates.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2
            className="text-base font-semibold"
            style={{ color: "#6e6e73" }}
          >
            그 밖의 후보 {result.moreCandidates.length}곳
          </h2>
          <div
            className="overflow-hidden rounded-3xl bg-white"
            style={{
              boxShadow:
                "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.12)",
            }}
          >
            <ul className="divide-y divide-black/[0.05]">
              {result.moreCandidates.map((m: MoreCandidate, i) => (
                <li
                  key={m.complexId}
                  className="flex items-start gap-3 px-5 py-4"
                >
                  <span
                    className="mt-0.5 w-6 flex-shrink-0 text-sm tabular-nums"
                    style={{ color: "#86868b" }}
                  >
                    {i + 4}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm leading-snug"
                      style={{ color: "#1d1d1f" }}
                    >
                      {m.complexName}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: "#86868b" }}
                    >
                      {m.sigungu} · {m.dongName} · {m.representativeArea}㎡ ·{" "}
                      {m.commuteSummary}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: "#1d1d1f" }}
                  >
                    {formatEok(m.medianPriceKrw)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* P1#5 — 조건 빠른 수정 패널 (접이식) */}
      <section>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-black/[0.08] bg-[#f5f5f7] px-5 py-4 text-left transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <span className="text-sm font-semibold" style={{ color: "#1d1d1f" }}>
            조건 수정
          </span>
          <svg
            className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${panelOpen ? "rotate-180" : ""}`}
            style={{ color: "#86868b" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {panelOpen && (
          <Card className="mt-2 flex flex-col gap-5">
            <p className="text-sm" style={{ color: "#6e6e73" }}>
              자주 바꾸는 조건만 수정하고 다시 분석할 수 있습니다.
            </p>

            <TextField
              label="시드머니"
              type="number"
              value={editSeedMoney}
              onChange={setEditSeedMoney}
              suffix="억"
              placeholder="예: 3.0"
              hint="보유 현금 기준 (갈아타기 매도액 별도)"
            />

            {/* 선호 평수 선택 */}
            <div className="flex flex-col gap-2">
              <p
                className="text-sm font-semibold"
                style={{ color: "#1d1d1f" }}
              >
                선호 평수대
              </p>
              <div className="flex flex-wrap gap-2">
                {AREA_RANGE_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditAreaRange(key)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      editAreaRange === key
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-black/[0.10] bg-white text-[#6e6e73] hover:border-indigo-300"
                    }`}
                  >
                    {AREA_RANGES[key].label}
                  </button>
                ))}
              </div>
            </div>

            <TextField
              label="통근 허용 시간"
              type="number"
              value={editMaxCommute}
              onChange={setEditMaxCommute}
              suffix="분"
              placeholder="예: 50"
              hint="본인·배우자 공통으로 적용됩니다"
            />

            {reanalyzeError && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {reanalyzeError}
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={handleReanalyze}
              disabled={reanalyzing}
              fullWidth
            >
              {reanalyzing ? "분석 중..." : "다시 분석"}
            </Button>
          </Card>
        )}
      </section>

      {/* 면책 고지 */}
      <footer
        className="rounded-2xl border border-black/[0.06] bg-[#f5f5f7] px-5 py-4"
      >
        <p
          className="text-xs leading-relaxed"
          style={{ color: "#86868b" }}
        >
          {result.disclaimer}
        </p>
      </footer>
    </div>
  );
}
