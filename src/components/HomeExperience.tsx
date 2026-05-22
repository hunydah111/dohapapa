"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import type {
  RecommendationResult,
  MoreCandidate,
  RelaxationAction,
} from "@/types/recommendation";
import { odsayTransitMinutes } from "@/lib/commute/odsayClient";
import type { CoupleProfile, AreaRangeKey } from "@/types/profile";
import { AREA_RANGES, AREA_RANGE_ORDER } from "@/types/profile";
import { BudgetSummary } from "./BudgetSummary";
import { CandidateCard } from "./CandidateCard";
import { HeroResultCard } from "./HeroResultCard";
import { LandingHero } from "./LandingHero";
import { Homi } from "./Homi";
import { RequiredRegionPicker } from "./RequiredRegionPicker";
import { getHomeType } from "@/lib/homeType";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Card } from "@/components/ui/Card";
import { formatKrwHuman } from "@/lib/format";
import { SHARE_PARAM, encodeProfile, decodeProfile } from "@/lib/shareLink";

type ResultState = {
  result: RecommendationResult;
  profile: CoupleProfile;
};

// ── 대중교통 실측(ODsay) → 티어 재정렬 헬퍼 ────────────────────────────────────
// 서버 1차 결과는 mock(직선거리) 통근으로 랭킹된다. 화면 후보 풀(상위 ~12)에 대해
// 브라우저에서 ODsay 실측을 모은 뒤 그 값을 서버 recommend 에 다시 넘겨(override)
// 점수·하드필터·티어를 실측 기준으로 재계산한다(2-pass). 비용을 위해 풀에 상한을 둔다.

const RERANK_POOL_MAX = 12;

type PoolLegRef = {
  key: string; // `${complexId}:${workplace}`
  complexId: string;
  workplace: "A" | "B";
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
};

// 재정렬 대상 풀(후보 + 상위 moreCandidates, 상한)의 대중교통 leg 목록.
function buildRerankLegs(
  result: RecommendationResult,
  profile: CoupleProfile,
): PoolLegRef[] {
  const transitWps: { label: "A" | "B"; lat: number; lng: number }[] = [];
  if (profile.workplaceA?.commuteMode === "transit")
    transitWps.push({
      label: "A",
      lat: profile.workplaceA.lat,
      lng: profile.workplaceA.lng,
    });
  if (profile.workplaceB?.commuteMode === "transit")
    transitWps.push({
      label: "B",
      lat: profile.workplaceB.lat,
      lng: profile.workplaceB.lng,
    });
  if (transitWps.length === 0) return [];

  const pool: { id: string; lat: number; lng: number }[] = [];
  const seen = new Set<string>();
  const add = (id: string, lat: number, lng: number) => {
    if (seen.has(id) || pool.length >= RERANK_POOL_MAX) return;
    seen.add(id);
    pool.push({ id, lat, lng });
  };
  for (const c of result.candidates) add(c.complexId, c.latitude, c.longitude);
  for (const m of result.moreCandidates) add(m.complexId, m.latitude, m.longitude);

  const legs: PoolLegRef[] = [];
  for (const c of pool)
    for (const w of transitWps)
      legs.push({
        key: `${c.id}:${w.label}`,
        complexId: c.id,
        workplace: w.label,
        originLat: w.lat,
        originLng: w.lng,
        destLat: c.lat,
        destLng: c.lng,
      });
  return legs;
}

// 결과의 대중교통 leg 에 realTransit 표식 — override 가 있던 leg 은 실측(true),
// 없으면 폴백(false=직선거리 추정). 도식 라벨·재실행 방지에 사용.
function markRealTransit(
  result: RecommendationResult,
  overrides: Record<string, { A?: number; B?: number }>,
): RecommendationResult {
  return {
    ...result,
    candidates: result.candidates.map((c) => ({
      ...c,
      commuteLegs: c.commuteLegs.map((leg) =>
        leg.mode === "transit"
          ? {
              ...leg,
              realTransit: overrides[c.complexId]?.[leg.workplace] != null,
            }
          : leg,
      ),
    })),
  };
}

export function HomeExperience() {
  const [state, setState] = useState<ResultState | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [started, setStarted] = useState(false); // 랜딩 CTA 누르면 폼 시작
  const [shareToast, setShareToast] = useState<string | null>(null);

  // 조건 수정 패널 상태
  const [panelOpen, setPanelOpen] = useState(false);
  // 만원 단위 문자열로 관리 (P1 단위 통일)
  const [editSeedMoneyMan, setEditSeedMoneyMan] = useState("");
  const [editAreaRange, setEditAreaRange] = useState<AreaRangeKey | "">("");
  // 분 단위 문자열 — 직장 A·B 따로. (빈 값이면 기존 profile 값 유지 — NaN 버그 방지)
  const [editMaxCommuteA, setEditMaxCommuteA] = useState("");
  const [editMaxCommuteB, setEditMaxCommuteB] = useState("");
  const [editRequiredRegions, setEditRequiredRegions] = useState<string[]>([]);
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
      setEditMaxCommuteA(
        profile.workplaceA ? String(profile.workplaceA.maxCommuteMinutes) : "",
      );
      setEditMaxCommuteB(
        profile.workplaceB ? String(profile.workplaceB.maxCommuteMinutes) : "",
      );
      setEditRequiredRegions(profile.requiredRegions ?? []);
      setReanalyzeError(null);

      // URL 에 프로필 인코딩 — 부부가 같은 결과 링크로 공유 가능.
      // 프로필(소득·자산·직장)을 쿼리(?p=) 대신 해시(#p=)에 둔다 — 해시는 서버 로그·
      // Referer·외부 스크립트(GA/광고/ODsay 등)로 전송되지 않아 민감정보 유출을 막는다.
      // 인코딩은 압축(async) — URL 갱신은 비핵심이라 fire-and-forget.
      void (async () => {
        try {
          const slug = await encodeProfile(profile);
          const url = new URL(window.location.href);
          url.searchParams.delete(SHARE_PARAM); // 레거시 ?p= 제거
          url.hash = `${SHARE_PARAM}=${slug}`;
          window.history.replaceState(null, "", url.toString());
        } catch {
          // 인코딩 실패해도 결과는 정상 노출 — URL 만 갱신 안 됨
        }
      })();

      // 결과 화면은 항상 맨 위부터 — 폼 하단(분석 시작)에서 스크롤된 위치를 초기화.
      window.scrollTo({ top: 0 });
    },
    [],
  );

  // 공유 링크 진입 시 자동 분석 — #p={encoded}(신규) 또는 ?p=(레거시) 가 있으면
  // 폼 건너뛰고 결과 로드. 해시 우선, 없으면 기존 쿼리 링크도 호환.
  useEffect(() => {
    const rawHash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(rawHash);
    const queryParams = new URLSearchParams(window.location.search);
    const slug = hashParams.get(SHARE_PARAM) ?? queryParams.get(SHARE_PARAM);
    if (!slug) return;

    let cancelled = false;
    // 마운트 시 공유링크(#p=) 자동 분석을 위한 의도적 fetch 트리거 — 외부 시스템 동기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoLoading(true);
    void (async () => {
      try {
        const profile = await decodeProfile(slug); // 압축 해제(async)
        if (!profile) return; // 깨진/만료 링크 → 폼 화면 유지
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        if (!res.ok) throw new Error("auto-load failed");
        const result = (await res.json()) as RecommendationResult;
        if (!cancelled) handleResult(result, profile);
      } catch {
        // 공유 링크가 깨졌거나 만료된 경우 → 폼 화면 유지
      } finally {
        if (!cancelled) setAutoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // handleResult 는 안정적 — 의존성 OK
  }, [handleResult]);

  // ── 대중교통 실측(ODsay) → 티어 재정렬 ─────────────────────────────────────
  // 1차(mock) 결과가 뜨면, 후보 풀의 대중교통 시간을 브라우저에서 실측한 뒤 그 값으로
  // 서버 recommend 를 다시 호출해 점수·티어를 실측 기준으로 재계산한다. result 객체당
  // 한 번만 처리(ref 가드)해 루프를 막는다.
  const rerankDoneRef = useRef<RecommendationResult | null>(null);
  useEffect(() => {
    const result = state?.result;
    const profile = state?.profile;
    if (!result || !profile) return;
    if (rerankDoneRef.current === result) return;
    const legs = buildRerankLegs(result, profile);
    if (legs.length === 0) {
      rerankDoneRef.current = result; // 대중교통 없음 — 재정렬 불필요
      return;
    }
    rerankDoneRef.current = result; // 재진입 방지

    let cancelled = false;
    const headers = { "Content-Type": "application/json" };

    (async () => {
      const resolved: Record<string, number> = {};

      // 1. 캐시(CommuteCache mode=transit) 조회
      try {
        const r = await fetch("/api/transit", {
          method: "POST",
          headers,
          body: JSON.stringify({
            op: "lookup",
            legs: legs.map(({ key, complexId, originLat, originLng }) => ({
              key,
              complexId,
              originLat,
              originLng,
            })),
          }),
        });
        if (r.ok) {
          const j = (await r.json()) as { results?: Record<string, number | null> };
          for (const k in j.results ?? {}) {
            const v = j.results![k];
            if (typeof v === "number") resolved[k] = v;
          }
        }
      } catch {
        // 캐시 실패해도 ODsay 로 진행
      }

      // 2. 캐시 미스 → ODsay 실측 (브라우저, 등록 도메인 Referer 인증)
      const misses = legs.filter((l) => typeof resolved[l.key] !== "number");
      const fetched = await Promise.all(
        misses.map(async (l) => ({
          l,
          m: await odsayTransitMinutes(
            { lat: l.originLat, lng: l.originLng },
            { lat: l.destLat, lng: l.destLng },
          ),
        })),
      );
      const toSave: {
        complexId: string;
        originLat: number;
        originLng: number;
        minutes: number;
      }[] = [];
      for (const { l, m } of fetched) {
        if (m != null) {
          resolved[l.key] = m;
          toSave.push({
            complexId: l.complexId,
            originLat: l.originLat,
            originLng: l.originLng,
            minutes: m,
          });
        }
      }
      if (toSave.length > 0) {
        fetch("/api/transit", {
          method: "POST",
          headers,
          body: JSON.stringify({ op: "save", legs: toSave }),
        }).catch(() => {});
      }

      // 3. 실측값으로 override 구성
      const overrides: Record<string, { A?: number; B?: number }> = {};
      for (const l of legs) {
        const m = resolved[l.key];
        if (typeof m === "number") (overrides[l.complexId] ??= {})[l.workplace] = m;
      }

      if (cancelled) return;

      // 실측이 하나도 없으면(키 없음/전부 실패) 재정렬 생략 — 표시만 폴백(직선거리)으로.
      if (Object.keys(overrides).length === 0) {
        const fb = markRealTransit(result, overrides);
        rerankDoneRef.current = fb;
        setState((prev) =>
          prev && prev.result === result ? { ...prev, result: fb } : prev,
        );
        return;
      }

      // 4. 실측 override 로 서버 재랭킹(restrictToComplexIds = 풀)
      const poolIds = [...new Set(legs.map((l) => l.complexId))];
      let reranked: RecommendationResult | null = null;
      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...profile,
            transitOverrides: overrides,
            restrictToComplexIds: poolIds,
          }),
        });
        if (res.ok) reranked = (await res.json()) as RecommendationResult;
      } catch {
        // 재랭킹 실패 → 폴백
      }

      if (cancelled) return;

      if (!reranked || reranked.candidates.length === 0) {
        const fb = markRealTransit(result, overrides);
        rerankDoneRef.current = fb;
        setState((prev) =>
          prev && prev.result === result ? { ...prev, result: fb } : prev,
        );
        return;
      }

      // 5. 재랭킹 결과 적용 — 검토 단지 수·예산은 1차(넓은) 결과 값 유지.
      const final: RecommendationResult = {
        ...markRealTransit(reranked, overrides),
        consideredComplexCount: result.consideredComplexCount,
        budget: result.budget,
      };
      rerankDoneRef.current = final;
      setState((prev) =>
        prev && prev.result === result ? { ...prev, result: final } : prev,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [state?.result, state?.profile]);

  async function handleShare() {
    if (!state) return;
    const url = window.location.href;
    const shareData = {
      title: "비집고",
      text: "비버 비지가 찾아준 내 집 — 내 결과 보기",
      url,
    };

    // 1. Web Share API — 모바일에선 카카오톡 등 네이티브 공유 시트가 뜬다.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // 사용자가 공유를 취소한 경우(AbortError)엔 조용히 종료
        if (err instanceof DOMException && err.name === "AbortError") return;
        // 그 외 오류는 아래 링크 복사로 폴백
      }
    }

    // 2. 폴백 — 링크 복사 (공유 API 미지원 브라우저)
    try {
      await navigator.clipboard.writeText(url);
      setShareToast("링크 복사됨 ⚠️ 소득·자산·직장 정보가 담겨 있어요 — 믿는 사람에게만 보내세요.");
    } catch {
      setShareToast("복사에 실패했어요. 주소창에서 직접 복사해주세요.");
    }
    setTimeout(() => setShareToast(null), 3500);
  }

  function handleRestart() {
    setState(null);
    setStarted(false); // 랜딩으로 복귀
    // URL 의 공유 파라미터 제거 (해시·쿼리 모두)
    const url = new URL(window.location.href);
    url.searchParams.delete(SHARE_PARAM);
    url.hash = "";
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

    // 직장별로 따로 적용. 빈 값/NaN 이면 기존 profile 값 유지.
    const parsedA =
      editMaxCommuteA.trim() !== "" ? parseInt(editMaxCommuteA, 10) : NaN;
    const parsedB =
      editMaxCommuteB.trim() !== "" ? parseInt(editMaxCommuteB, 10) : NaN;
    const maxMinA = Number.isFinite(parsedA)
      ? parsedA
      : state.profile.workplaceA?.maxCommuteMinutes ?? 50;
    const maxMinB = Number.isFinite(parsedB)
      ? parsedB
      : state.profile.workplaceB?.maxCommuteMinutes ?? 50;

    // 기존 프로필에 변경값 머지
    const merged: CoupleProfile = {
      ...state.profile,
      seedMoneyKrw: seedKrw,
      preferredAreaRange: areaRange,
      requiredRegions:
        editRequiredRegions.length > 0 ? editRequiredRegions : undefined,
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

  // 완화 제안을 누르면 — 해당 변경을 프로필에 자동 적용하고 바로 재검색해 결과를 띄운다.
  async function handleApplyRelaxation(action: RelaxationAction) {
    if (!state) return;
    const p = state.profile;
    let merged: CoupleProfile = { ...p };
    if (action.kind === "budget") {
      // 간단(simple) 모드는 예산이 availableBudgetKrw 로만 결정되고 seedMoneyKrw 는
      // 무시된다(budget.ts estimateSimpleBudget). 서버의 완화 카운트도 그 값 기준이므로
      // 같은 필드에 더해야 "N곳" 약속과 재검색 결과가 일치한다.
      merged =
        p.budgetMode === "simple"
          ? { ...p, availableBudgetKrw: (p.availableBudgetKrw ?? 0) + action.addKrw }
          : { ...p, seedMoneyKrw: p.seedMoneyKrw + action.addKrw };
    } else if (action.kind === "area") {
      merged = { ...p, preferredAreaRange: action.areaRange };
    } else if (action.kind === "commute" && action.workplace === "A" && p.workplaceA) {
      merged = {
        ...p,
        workplaceA: {
          ...p.workplaceA,
          maxCommuteMinutes: p.workplaceA.maxCommuteMinutes + action.addMinutes,
        },
      };
    } else if (action.kind === "commute" && action.workplace === "B" && p.workplaceB) {
      merged = {
        ...p,
        workplaceB: {
          ...p.workplaceB,
          maxCommuteMinutes: p.workplaceB.maxCommuteMinutes + action.addMinutes,
        },
      };
    }

    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        setReanalyzeError("분석 중 오류가 발생했습니다. 다시 시도해 주세요.");
        return;
      }
      const newResult = (await res.json()) as RecommendationResult;
      handleResult(newResult, merged);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setReanalyzeError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
    } finally {
      setReanalyzing(false);
    }
  }

  // ── 입력 화면 ──────────────────────────────────────────────
  if (state === null) {
    if (autoLoading) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-coral-100 bg-coral-50/60 px-6 py-12 text-center">
          <Homi mood="running" size={92} />
          <p className="text-sm font-semibold text-coral-700">
            공유 링크 분석 중…
          </p>
          <p className="text-xs text-coral-500/80">잠시만 기다려 주세요</p>
        </div>
      );
    }
    // 시작 전 = 랜딩 히어로(가치제안+단일 CTA). CTA 누르면 폼 노출.
    if (!started) {
      return (
        <LandingHero
          onStart={() => {
            setStarted(true);
            window.scrollTo({ top: 0 });
          }}
        />
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
        <p className="text-sm font-semibold" style={{ color: "#6b6157" }}>
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

      {/* 재검색(완화 적용) 진행 토스트 — 호미가 다시 두리번 */}
      {reanalyzing && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-coral-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
            <Homi mood="running" size={30} />
            다시 찾는 중…
          </div>
        </div>
      )}

      {/* 공유 토스트 — 스크롤 위치와 무관하게 항상 보이도록 화면 하단 고정 */}
      {shareToast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-coral-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
            {shareToast.includes("복사됨") && (
              <Homi mood="thumbsup" size={28} className="shrink-0" />
            )}
            <span>{shareToast}</span>
          </div>
        </div>
      )}

      {/* 결과 공개 히어로 카드 — 집 찾기 유형 + 1순위 단지 */}
      {result.candidates.length > 0 && (
        <HeroResultCard
          candidate={result.candidates[0]}
          homeType={getHomeType(state.profile)}
          onShare={handleShare}
        />
      )}

      {/* 입지 미스 솔직 안내 — 고른 분위기가 결과에 안 잡혔을 때 + 단지 위치 지도 버튼 */}
      {result.vibeNote && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          <p>{result.vibeNote.message}</p>
          <a
            href={`https://map.kakao.com/?q=${encodeURIComponent(
              `${result.vibeNote.complexName} ${result.vibeNote.dongName}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${result.vibeNote.complexName} 지도에서 위치 보기`}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003z"
                clipRule="evenodd"
              />
            </svg>
            {result.vibeNote.complexName} 지도에서 보기
          </a>
        </div>
      )}

      {/* 예산 분석 */}
      <BudgetSummary budget={result.budget} />

      {/* 조건에 맞는 단지 or 0건 */}
      {result.candidates.length > 0 ? (
        <section className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Homi mood="cheer" size={56} className="shrink-0" />
            <div>
              <h2 className="text-xl font-bold" style={{ color: "#3a322c" }}>
                딱 맞는 집 찾았어요!
              </h2>
              <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
                검토 {result.consideredComplexCount.toLocaleString()}개 중 상위{" "}
                {result.candidates.length}곳
              </p>
            </div>
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
          <Homi mood="crying" size={96} className="mx-auto mb-1" />
          <h2
            className="text-xl font-bold mb-2 text-center"
            style={{ color: "#3a322c" }}
          >
            앗, 딱 맞는 집을 못 찾았어요 😅
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: "#6b6157" }}>
            수도권{" "}
            <span className="font-semibold" style={{ color: "#3a322c" }}>
              {result.consideredComplexCount.toLocaleString("ko-KR")}곳
            </span>
            을 살펴봤는데 조건이 살짝 타이트했나봐요!
            {result.relaxationSuggestions.length > 0
              ? " 아래처럼 살짝만 풀면 바로 나와요 👇"
              : " 한두 가지만 크게 풀어볼까요?"}
          </p>
          {result.emptyReason && (
            <p className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
              {result.emptyReason}
            </p>
          )}

          {result.relaxationSuggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p
                className="text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "#9a8f82" }}
              >
                이렇게 살짝 풀어볼까요? 👇 ({result.relaxationSuggestions.length})
              </p>
              {result.relaxationSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyRelaxation(s.action)}
                  disabled={reanalyzing}
                  className={`group flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-coral-500 disabled:opacity-50 ${
                    i === 0
                      ? "border-coral-300 bg-coral-50 hover:bg-white"
                      : "border-black/[0.08] bg-[#f3ece4] hover:bg-white hover:border-coral-300"
                  }`}
                >
                  <span
                    className="text-sm font-medium leading-relaxed"
                    style={{ color: "#3a322c" }}
                  >
                    {s.message}
                  </span>
                  <span
                    className={`ml-4 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      i === 0
                        ? "bg-coral-600 text-white"
                        : "bg-coral-100 text-coral-700"
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
                    <strong>통근 시간이 짧음</strong> — 30분 이내는 도심 근무자에게 좁아요. 40~50분으로 늘려보세요
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
              style={{ color: "#3a322c" }}
            >
              그 밖의 후보
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
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
                    style={{ color: "#9a8f82" }}
                  >
                    {i + 4}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm leading-snug"
                      style={{ color: "#3a322c" }}
                    >
                      {m.complexName}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: "#9a8f82" }}
                    >
                      {m.sigungu} · {m.dongName} · {m.representativeArea}㎡ ·{" "}
                      {m.commuteSummary}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: "#3a322c" }}
                  >
                    {formatKrwHuman(m.medianPriceKrw)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 통근 한도를 살짝 넘는 후보 (#2) */}
      {result.overLimitCandidates.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#3a322c" }}>
              통근 한도를 살짝 넘는 후보
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
              내가 정한 통근 시간을 조금 넘지만(약 1.3배 이내) 그 외엔 괜찮은{" "}
              {result.overLimitCandidates.length}곳
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/40">
            <ul className="divide-y divide-amber-200/60">
              {result.overLimitCandidates.map((m: MoreCandidate) => (
                <li
                  key={m.complexId}
                  className="flex items-start gap-3 px-5 py-4"
                >
                  <span className="mt-0.5 flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    초과
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm leading-snug"
                      style={{ color: "#3a322c" }}
                    >
                      {m.complexName}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: "#9a8f82" }}
                    >
                      {m.sigungu} · {m.dongName} · {m.representativeArea}㎡ ·{" "}
                      {m.commuteSummary}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: "#3a322c" }}
                  >
                    {formatKrwHuman(m.medianPriceKrw)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 예산을 조금 넘는 후보 — 예산대 결과가 적을 때만(예산 동떨어진 추천 대신 솔직 노출) */}
      {result.overBudgetCandidates.length > 0 && result.candidates.length < 3 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#3a322c" }}>
              예산을 조금 더 쓰면 닿는 후보
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
              예산보다 조금 비싸지만 지역·평수·통근 조건엔 맞는{" "}
              {result.overBudgetCandidates.length}곳
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-coral-200 bg-coral-50/40">
            <ul className="divide-y divide-coral-200/60">
              {result.overBudgetCandidates.map((m: MoreCandidate) => {
                const diff = Math.max(
                  0,
                  m.medianPriceKrw - result.budget.netPurchasePowerKrw,
                );
                return (
                  <li
                    key={m.complexId}
                    className="flex items-start gap-3 px-5 py-4"
                  >
                    <span className="mt-0.5 flex-shrink-0 rounded-full bg-coral-100 px-2 py-0.5 text-[11px] font-bold text-coral-700">
                      +{formatKrwHuman(diff)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-semibold text-sm leading-snug"
                        style={{ color: "#3a322c" }}
                      >
                        {m.complexName}
                      </p>
                      <p
                        className="mt-0.5 text-xs leading-relaxed"
                        style={{ color: "#9a8f82" }}
                      >
                        {m.sigungu} · {m.dongName} · {m.representativeArea}㎡ ·{" "}
                        {m.commuteSummary}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-sm font-semibold tabular-nums"
                      style={{ color: "#3a322c" }}
                    >
                      {formatKrwHuman(m.medianPriceKrw)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* 안전망 — 모든 섹션이 0건일 때만: 조건과 가장 가까운 후보(빈 화면 방지) */}
      {result.closestCandidates.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#3a322c" }}>
              조건과 가장 가까운 후보
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
              딱 맞는 곳은 없었지만, 예산·통근과 차이가 있더라도 가장 가까운{" "}
              {result.closestCandidates.length}곳이에요
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[#e5e0d6] bg-[#f3ece4]/50">
            <ul className="divide-y divide-[#e5e0d6]">
              {result.closestCandidates.map((m: MoreCandidate) => (
                <li
                  key={m.complexId}
                  className="flex items-start gap-3 px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm leading-snug"
                      style={{ color: "#3a322c" }}
                    >
                      {m.complexName}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: "#9a8f82" }}
                    >
                      {m.sigungu} · {m.dongName} · {m.representativeArea}㎡ ·{" "}
                      {m.commuteSummary}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: "#3a322c" }}
                  >
                    {formatKrwHuman(m.medianPriceKrw)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 더 넓게 보기 — 결과가 있을 때 조건 완화 제안 */}
      {result.candidates.length > 0 &&
        result.relaxationSuggestions.length > 0 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#3a322c" }}>
                더 넓게 보기
              </h2>
              <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
                조건을 조금 풀면 후보가 더 늘어나요
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {result.relaxationSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyRelaxation(s.action)}
                  disabled={reanalyzing}
                  className="group flex items-center justify-between rounded-2xl border border-black/[0.08] bg-[#f3ece4] px-5 py-4 text-left transition-colors hover:border-coral-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-coral-500 disabled:opacity-50"
                >
                  <span
                    className="text-sm font-medium leading-relaxed"
                    style={{ color: "#3a322c" }}
                  >
                    {s.message}
                  </span>
                  <span className="ml-4 flex-shrink-0 rounded-full bg-coral-100 px-2.5 py-1 text-xs font-bold text-coral-700">
                    +{s.resultCount}곳
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

      {/* 조건 빠른 수정 패널 (접이식) */}
      <section>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-black/[0.08] bg-[#f3ece4] px-5 py-4 text-left transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-coral-500"
        >
          <span className="text-sm font-semibold" style={{ color: "#3a322c" }}>
            조건 수정
          </span>
          <svg
            className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${panelOpen ? "rotate-180" : ""}`}
            style={{ color: "#9a8f82" }}
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
            <p className="text-sm" style={{ color: "#6b6157" }}>
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
                style={{ color: "#3a322c" }}
              >
                선호 평수대
              </p>
              <div className="flex flex-wrap gap-2">
                {AREA_RANGE_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditAreaRange(key)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-coral-500 ${
                      editAreaRange === key
                        ? "border-coral-500 bg-coral-600 text-white"
                        : "border-black/[0.10] bg-white text-[#6b6157] hover:border-coral-300"
                    }`}
                  >
                    {AREA_RANGES[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* 필수 지역 — 결과 화면에서도 바로 수정 */}
            <div className="flex flex-col gap-2">
              <RequiredRegionPicker
                value={editRequiredRegions}
                onChange={setEditRequiredRegions}
              />
            </div>

            {/* 통근 허용 시간 — 직장별로 따로 수정 */}
            {state.profile.workplaceA && (
              <TextField
                label={`통근 허용 시간 — ${state.profile.workplaceA.label}`}
                type="number"
                value={editMaxCommuteA}
                onChange={setEditMaxCommuteA}
                suffix="분"
                placeholder="예: 50"
                hint="이 직장 기준. 비워두면 기존 설정 유지."
              />
            )}
            {state.profile.workplaceB && (
              <TextField
                label={`통근 허용 시간 — ${state.profile.workplaceB.label}`}
                type="number"
                value={editMaxCommuteB}
                onChange={setEditMaxCommuteB}
                suffix="분"
                placeholder="예: 50"
                hint="이 직장 기준. 비워두면 기존 설정 유지."
              />
            )}

            {/* P2 로딩 진행 표시 */}
            {reanalyzing && (
              <div className="flex items-center gap-3 rounded-2xl bg-coral-50 border border-coral-100 px-4 py-3">
                <span className="flex h-4 w-4 flex-shrink-0">
                  <span className="animate-ping inline-flex h-full w-full rounded-full bg-coral-400 opacity-75" />
                </span>
                <span className="text-sm font-medium text-coral-700">
                  조건에 맞는 단지를 다시 분석하고 있습니다...
                </span>
              </div>
            )}

            {reanalyzeError && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <Homi mood="flustered" size={34} className="shrink-0" />
                <span>{reanalyzeError}</span>
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
      <footer className="rounded-2xl border border-black/[0.06] bg-[#f3ece4] px-5 py-4">
        <p className="text-xs leading-relaxed" style={{ color: "#9a8f82" }}>
          {result.disclaimer}
        </p>
      </footer>
    </div>
  );
}
