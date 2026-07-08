"use client";

// 오늘의 반응 (v2.6) — 거래 행 아래 시세 평가 스탬프 칩 (🌡️과열 · 👌적당 · 💎싸다).
//
// 배치 컨텍스트: 서버 페이지가 한 지면 분량 dealKey 배열을 <ReactionsProvider>에
// 넘기면 마운트 시 1회 GET(/api/react?dealKeys=…)으로 전 행 카운트를 받는다 —
// 행마다 fetch 금지. 탭은 낙관적 갱신 + POST(실패 무시 — 집계는 부가).
//
// 규칙(2026-07-08 개정 — 사장 "클릭보드" 제보): 좋아요 누적식 리액션 pill.
//  · 카운트는 1부터 표시(count>0) — 5명 문턱 숨김 폐지(빈 투표판처럼 보이던 원인).
//    이상 참여 감지(anomaly)면 카운트 숨김 + "집계 보류"는 유지(조직 투표 방어).
//  · 칩은 경량(괘선 1px·소형) — 지면의 본문보다 튀지 않게. 선택만 코랄.
//  · 중복 방지 localStorage 1일 1거래 1스탬프 — v1은 최초 1회만, 이후 전 버튼 비활성.
//  · 법적 캡션("지난 거래에 대한 독자 평가…")은 행마다 반복하지 않는다 — 코너당 1회
//    (게재면이 코너 각주로 배치, ReactionsCaption 참조).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  REACTION_STAMPS,
  REACTION_MIN_TOTAL, // 낙관적 갱신의 showCounts 계산용(서버 규칙과 동일) — UI 표시는 count>0
  reactedStorageKey,
  reactionDateKey,
  type DealReactionSummary,
  type ReactionStampSlug,
} from "@/lib/reaction";
// 지면 조판 토큰 — 공유 단일 소스(중복 선언 금지). 선택 강조만 코랄.
import { INK, INK_SOFT, RULE, CORAL } from "@/lib/paperTone";

interface ReactionsCtx {
  /** 서버 집계 — dealKey → 요약. 로드 전엔 비어 있음. */
  summaries: ReadonlyMap<string, DealReactionSummary>;
  /** 내가 오늘 이 거래에 찍은 스탬프(localStorage). 없으면 null. */
  reactedOf: (dealKey: string) => ReactionStampSlug | null;
  react: (dealKey: string, slug: ReactionStampSlug) => void;
}

const Ctx = createContext<ReactionsCtx | null>(null);

function readReacted(dateKey: string, dealKey: string): ReactionStampSlug | null {
  try {
    const v = window.localStorage.getItem(reactedStorageKey(dateKey, dealKey));
    return REACTION_STAMPS.some((s) => s.slug === v) ? (v as ReactionStampSlug) : null;
  } catch {
    return null; // localStorage 차단 환경 — 버튼은 동작하되 중복 방지만 약화
  }
}

// 하이드레이션 안전한 "클라이언트 여부" — SSR 첫 렌더는 false(서버와 일치),
// 하이드레이션 직후 true로 재렌더. effect 안 setState 없이 localStorage를 읽기 위한 표준 패턴.
const subscribeNoop = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function ReactionsProvider({
  dealKeys,
  children,
}: {
  dealKeys: string[];
  children: React.ReactNode;
}) {
  const [summaries, setSummaries] = useState<Map<string, DealReactionSummary>>(
    () => new Map(),
  );
  // 오늘 키 — 클라이언트 시계 기준(순수 함수 공유). 상태로 고정해
  // 자정·3시 경계를 걸쳐도 한 세션 안에서는 일관되게 쓴다.
  const [dateKey] = useState<string>(() => reactionDateKey());
  // 이번 세션에서 찍은 것(낙관적) — 과거 참여분은 localStorage에서 렌더 시점에 직접 읽는다.
  const [sessionReacted, setSessionReacted] = useState<Map<string, ReactionStampSlug>>(
    () => new Map(),
  );
  const isClient = useIsClient();

  const keysJoined = useMemo(
    () => dealKeys.map((k) => encodeURIComponent(k)).join(","),
    [dealKeys],
  );

  useEffect(() => {
    if (!keysJoined) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/react?dealKeys=${keysJoined}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { reactions?: Record<string, DealReactionSummary> } =
          await res.json();
        if (!alive || !data.reactions) return;
        setSummaries(new Map(Object.entries(data.reactions)));
      } catch {
        /* 집계 못 받아도 버튼은 동작 — 부가 기능 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [keysJoined]);

  const reactedOf = useCallback(
    (dealKey: string): ReactionStampSlug | null => {
      const s = sessionReacted.get(dealKey);
      if (s) return s;
      if (!isClient) return null; // SSR/하이드레이션 첫 렌더 — 서버 마크업과 일치
      return readReacted(dateKey, dealKey);
    },
    [sessionReacted, isClient, dateKey],
  );

  const react = useCallback(
    (dealKey: string, slug: ReactionStampSlug) => {
      if (reactedOf(dealKey) !== null) return; // v1: 최초 1회만 — 교체 없음
      try {
        window.localStorage.setItem(reactedStorageKey(dateKey, dealKey), slug);
      } catch {
        /* 저장 실패 — 세션 상태로만 중복 방지 */
      }
      setSessionReacted((prev) => new Map(prev).set(dealKey, slug));
      // 낙관적 갱신 — 서버 응답 안 기다림.
      setSummaries((prev) => {
        const next = new Map(prev);
        const cur = next.get(dealKey);
        const counts = { hot: 0, fair: 0, cheap: 0, ...(cur?.counts ?? {}) };
        counts[slug] += 1;
        const total = (cur?.total ?? 0) + 1;
        next.set(dealKey, {
          dealKey,
          counts,
          total,
          anomaly: cur?.anomaly ?? false,
          showCounts: (cur?.anomaly ?? false) ? false : total >= REACTION_MIN_TOTAL,
        });
        return next;
      });
      fetch("/api/react", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dealKey, stamp: slug }),
      }).catch(() => {
        /* 실패 무시 — 다음 방문 GET이 진실 */
      });
    },
    [dateKey, reactedOf],
  );

  const value = useMemo(
    () => ({ summaries, reactedOf, react }),
    [summaries, reactedOf, react],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 거래 행 아래 부착하는 스탬프 칩 줄 — Provider 밖에서는 아무것도 렌더하지 않는다. */
export function DealReactions({ dealKey }: { dealKey: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return <Chips ctx={ctx} dealKey={dealKey} />;
}

function Chips({ ctx, dealKey }: { ctx: ReactionsCtx; dealKey: string }) {
  const s = ctx.summaries.get(dealKey) ?? null;
  const mine = ctx.reactedOf(dealKey);
  const anomaly = s?.anomaly ?? false;

  return (
    <div className="flex flex-wrap items-center gap-1 pb-[3px] pt-[2px]">
      {REACTION_STAMPS.map((st) => {
        const selected = mine === st.slug;
        const count = s?.counts[st.slug] ?? 0;
        // 좋아요 누적식 — 1부터 표시. anomaly면 숨김(집계 보류가 대신 말함).
        const showCount = !anomaly && count > 0;
        return (
          <button
            key={st.slug}
            type="button"
            onClick={() => ctx.react(dealKey, st.slug)}
            disabled={mine !== null}
            aria-pressed={selected}
            aria-label={`이 거래를 '${st.label}'로 평가${
              showCount ? ` — 현재 ${count}명` : ""
            }`}
            className="px-1.5 py-[1px] text-[10px] font-semibold tabular-nums"
            style={{
              background: selected ? CORAL : "transparent",
              color: selected ? "#fff" : INK_SOFT,
              border: `1px solid ${selected ? CORAL : RULE}`,
              opacity: mine !== null && !selected ? 0.45 : 1,
              cursor: mine !== null ? "default" : "pointer",
            }}
          >
            {st.emoji} {st.label}
            {showCount && (
              <b className="ml-1" style={{ color: selected ? "#fff" : INK }}>
                {count}
              </b>
            )}
          </button>
        );
      })}
      {anomaly && (
        <span
          className="text-[10px] font-bold"
          style={{ color: INK_SOFT }}
          role="status"
        >
          참여 급증 감지 — 집계 보류
        </span>
      )}
    </div>
  );
}
