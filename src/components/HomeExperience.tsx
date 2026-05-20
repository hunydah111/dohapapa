"use client";

import { useState, useEffect, useCallback } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import type { RecommendationResult, MoreCandidate } from "@/types/recommendation";
import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import { AREA_RANGES, AREA_RANGE_ORDER } from "@/types/profile";
import { BudgetSummary } from "./BudgetSummary";
import { CandidateCard } from "./CandidateCard";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Card } from "@/components/ui/Card";
import { formatKrwHuman } from "@/lib/format";
import { SHARE_PARAM, encodeProfile, decodeProfile } from "@/lib/shareLink";

type ResultState = {
  result: RecommendationResult;
  profile: CoupleProfile;
};

export function HomeExperience() {
  const [state, setState] = useState<ResultState | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // 조건 수정 패널 상태
  const [panelOpen, setPanelOpen] = useState(false);
  // 만원 단위 문자열로 관리 (P1 단위 통일)
  const [editSeedMoneyMan, setEditSeedMoneyMan] = useState("");
  const [editAreaRange, setEditAreaRange] = useState<AreaRangeKey | "">("");
  // 분 단위 문자열 (빈 값이면 기존 profile 값 유지 — P1 NaN 버그 수정)
  const [editMaxCommute, setEditMaxCommute] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);

  const handleResult = useCallback(
    (result: RecommendationResult, profile: CoupleProfile) => {
      setState({ result, profile });
      setPanelOpen(false);
      // 조건 수정 패널 기본값을 현재 프로필로 초기화 (만원 단위)
      const seedManwon = Math.round(profile.seedMoneyKrw / 10_000);
      setEditSeedMoneyMan(String(seedManwon));
      setEditAreaRange(profile.preferredAreaRange);
      const commuteMin =
        profile.workplaceA?.maxCommuteMinutes ??
        profile.workplaceB?.maxCommuteMinutes ??
        50;
      setEditMaxCommute(String(commuteMin));
      setReanalyzeError(null);

      // URL 에 프로필 인코딩 — 부부가 같은 결과 링크로 공유 가능
      try {
        const slug = encodeProfile(profile);
        const url = new URL(window.location.href);
        url.searchParams.set(SHARE_PARAM, slug);
        window.history.replaceState(null, "", url.toString());
      } catch {
        // 인코딩 실패해도 결과는 정상 노출 — URL 만 갱신 안 됨
      }
    },
    [],
  );

  // 공유 링크 진입 시 자동 분석 — ?p={encoded} 가 있으면 폼 건너뛰고 결과 로드
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get(SHARE_PARAM);
    if (!slug) return;
    const profile = decodeProfile(slug);
    if (!profile) return;

    // 마운트 시 공유링크(?p=) 자동 분석을 위한 의도적 fetch 트리거 — 외부 시스템 동기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoLoading(true);
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("auto-load failed");
        const result = (await res.json()) as RecommendationResult;
        handleResult(result, profile);
      })
      .catch(() => {
        // 공유 링크가 깨졌거나 만료된 경우 → 폼 화면 유지
      })
      .finally(() => setAutoLoading(false));
    // handleResult 는 안정적 — 의존성 OK
  }, [handleResult]);

  async function handleShare() {
    if (!state) return;
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setShareToast("주소를 복사했어요. 카톡·SNS에 붙여넣으면 배우자도 같은 결과를 볼 수 있어요.");
      setTimeout(() => setShareToast(null), 3500);
    } catch {
      setShareToast("복사에 실패했어요. 주소창에서 직접 복사해주세요.");
      setTimeout(() => setShareToast(null), 3500);
    }
  }

  function handleRestart() {
    setState(null);
    // URL 의 공유 파라미터 제거
    const url = new URL(window.location.href);
    url.searchParams.delete(SHARE_PARAM);
    window.history.replaceState(null, "", url.toString());
  }

  async function handleReanalyze() {
    if (!state) return;
    setReanalyzing(true);
    setReanalyzeError(null);

    // 만원 단위 → 원 변환 (P1 단위 통일). 빈 값이면 기존 profile 값 유지.
    const seedKrw =
      editSeedMoneyMan.trim() !== ""
        ? Math.round(parseFloat(editSeedMoneyMan)) * 10_000
        : state.profile.seedMoneyKrw;

    const areaRange: AreaRangeKey =
      editAreaRange !== "" ? editAreaRange : state.profile.preferredAreaRange;

    // P1 NaN 버그 수정: 빈 값이면 기존 profile 값 유지
    const parsedCommute =
      editMaxCommute.trim() !== "" ? parseInt(editMaxCommute, 10) : NaN;
    const maxMinA = Number.isFinite(parsedCommute)
      ? parsedCommute
      : state.profile.workplaceA?.maxCommuteMinutes ?? 50;
    const maxMinB = Number.isFinite(parsedCommute)
      ? parsedCommute
      : state.profile.workplaceB?.maxCommuteMinutes ?? 50;

    // 기존 프로필에 변경값 머지
    const merged: CoupleProfile = {
      ...state.profile,
      seedMoneyKrw: seedKrw,
      preferredAreaRange: areaRange,
      ...(state.profile.workplaceA
        ? {
            workplaceA: {
              ...state.profile.workplaceA,
              maxCommuteMinutes: maxMinA,
            },
          }
        : {}),
      ...(state.profile.workplaceB
        ? {
            workplaceB: {
              ...state.profile.workplaceB,
              maxCommuteMinutes: maxMinB,
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
      // handleResult 로 통일 — URL 공유링크도 새 프로필로 갱신됨
      handleResult(newResult, merged);
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
    if (autoLoading) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-indigo-100 bg-indigo-50/60 px-6 py-12 text-center">
          <span className="flex h-3 w-3">
            <span className="animate-ping inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          </span>
          <p className="text-sm font-semibold text-indigo-700">
            공유 링크 분석 중…
          </p>
          <p className="text-xs text-indigo-500/80">
            잠시만 기다려 주세요
          </p>
        </div>
      );
    }
    return <ProfileForm onResult={handleResult} />;
  }

  const { result } = state;

  // ── 결과 화면 ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8">
      {/* 상단 바: 검토 단지 수 + 공유 + 처음부터 */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: "#6e6e73" }}>
          검토 {result.consideredComplexCount.toLocaleString()}개 단지 분석 완료
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="md" onClick={handleShare}>
            <span className="inline-flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.475l6.733-3.366A2.52 2.52 0 0113 4.5z" />
              </svg>
              결과 공유
            </span>
          </Button>
          <Button variant="ghost" size="md" onClick={handleRestart}>
            처음부터
          </Button>
        </div>
      </div>

      {/* 공유 토스트 */}
      {shareToast && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          {shareToast}
        </div>
      )}

      {/* 예산 분석 */}
      <BudgetSummary budget={result.budget} />

      {/* 조건에 맞는 단지 or 0건 */}
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
        /* 0건 화면 */
        <Card>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "#1d1d1f" }}
          >
            아직 딱 맞는 단지가 없어요
          </h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: "#6e6e73" }}>
            수도권{" "}
            <span className="font-semibold" style={{ color: "#1d1d1f" }}>
              {result.consideredComplexCount.toLocaleString("ko-KR")}곳
            </span>
            을 살펴봤지만 입력하신 모든 조건을 동시에 만족하는 단지가 없어요.
            {result.relaxationSuggestions.length > 0
              ? " 조건을 조금만 풀면 후보가 나옵니다 ↓"
              : " 조건을 한두 가지 크게 조정해야 후보가 나올 것 같아요."}
          </p>

          {result.relaxationSuggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p
                className="text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "#86868b" }}
              >
                추천 조정 ({result.relaxationSuggestions.length}개)
              </p>
              {result.relaxationSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className={`group flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    i === 0
                      ? "border-indigo-300 bg-indigo-50 hover:bg-white"
                      : "border-black/[0.08] bg-[#f5f5f7] hover:bg-white hover:border-indigo-300"
                  }`}
                >
                  <span
                    className="text-sm font-medium leading-relaxed"
                    style={{ color: "#1d1d1f" }}
                  >
                    {s.message}
                  </span>
                  <span
                    className={`ml-4 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      i === 0
                        ? "bg-indigo-600 text-white"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {s.resultCount}곳
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-4 mb-2">
              <p className="text-sm font-semibold text-amber-800 mb-2">
                흔한 원인
              </p>
              <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-amber-900">
                <li className="flex gap-2">
                  <span className="flex-shrink-0">·</span>
                  <span>
                    <strong>예산이 빡빡함</strong> — 보유 현금·소득을 다시 보거나, 정책대출 자격 충족 시 한도가 크게 늘어요
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0">·</span>
                  <span>
                    <strong>통근 시간이 짧음</strong> — 자차 30분 이내는 도심 근무자에게 좁아요. 40~50분으로 늘려보세요
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0">·</span>
                  <span>
                    <strong>선호 평수가 좁음</strong> — 한 단지대 위·아래로 한 칸 넓혀보세요
                  </span>
                </li>
              </ul>
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

      {/* P1 "그 밖의 후보" — 시각 위계 강화 */}
      {result.moreCandidates.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "#1d1d1f" }}
            >
              그 밖의 후보
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: "#6e6e73" }}>
              상세 분석 외 추가로 조건에 근접한 {result.moreCandidates.length}곳
            </p>
          </div>
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
                    {formatKrwHuman(m.medianPriceKrw)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 조건 빠른 수정 패널 (접이식) */}
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {panelOpen && (
          <Card className="mt-2 flex flex-col gap-5">
            <p className="text-sm" style={{ color: "#6e6e73" }}>
              자주 바꾸는 조건만 수정하고 다시 분석할 수 있습니다.
            </p>

            {/* P1 단위 통일: 만원 단위 */}
            <TextField
              label="보유 현금"
              type="number"
              value={editSeedMoneyMan}
              onChange={setEditSeedMoneyMan}
              suffix="만원"
              placeholder="예: 30000"
              hint="보유 현금 기준 (갈아타기 매도액 별도). 만원 단위로 입력."
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

            {/* P1 A/B 통근시간 공통 적용 명시 */}
            <TextField
              label="통근 허용 시간"
              type="number"
              value={editMaxCommute}
              onChange={setEditMaxCommute}
              suffix="분"
              placeholder="예: 50"
              hint="본인·배우자 직장 모두 공통으로 적용됩니다. 비워두면 기존 설정 유지."
            />

            {/* P2 로딩 진행 표시 */}
            {reanalyzing && (
              <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                <span className="flex h-4 w-4 flex-shrink-0">
                  <span className="animate-ping inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                </span>
                <span className="text-sm font-medium text-indigo-700">
                  조건에 맞는 단지를 다시 분석하고 있습니다...
                </span>
              </div>
            )}

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
      <footer className="rounded-2xl border border-black/[0.06] bg-[#f5f5f7] px-5 py-4">
        <p className="text-xs leading-relaxed" style={{ color: "#86868b" }}>
          {result.disclaimer}
        </p>
      </footer>
    </div>
  );
}
