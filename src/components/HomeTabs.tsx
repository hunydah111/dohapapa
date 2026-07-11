"use client";

// 홈 상단 [1면 | 동네판] 탭 (v2.6) — 지면 톤의 먹 칩 탭, JS 한 줌짜리 소형 클라이언트.
//
// "눈뜨고 3초": 구독자(biji-my-regions 있음)는 마운트 시 동네판이 기본 선택 —
// 탭 전환·로그인·조작 0 으로 내 동네 브리핑이 즉시 뜬다. 미구독자는 1면 기본.
// URL 해시(#local)로 직링크 가능 — 해시가 구독 여부보다 우선(공유·진입점용).
//
// 두 지면(서버 컴포넌트)은 children prop 으로 받아 둘 다 마운트한 채 display 로만
// 전환한다 — RSC 페이로드는 어차피 둘 다 내려오고, 전환 시 재마운트(스크롤·펼침 상태
// 소실)를 피한다. SSR 초기값은 1면 — 구독자는 마운트 직후 동네판으로 스위치(hydration
// 불일치 방지 위해 localStorage 는 effect 에서만).

import { useEffect, useState, type ReactNode } from "react";
import { loadMyRegions } from "@/lib/myRegions";
import { INK, PAPER, RULE } from "@/lib/paperTone";
import { InstallButton } from "./InstallButton";

export const LOCAL_TAB_HASH = "#local";

type TabKey = "front" | "local";

const TABS: { key: TabKey; label: string }[] = [
  { key: "front", label: "1면" },
  { key: "local", label: "동네판" },
];

export function HomeTabs({ front, local }: { front: ReactNode; local: ReactNode }) {
  const [tab, setTab] = useState<TabKey>("front");

  // 마운트 시 기본 탭 — ①해시 직링크 ②구독자면 동네판 ③그 외 1면.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부(URL·localStorage) 동기화
    if (window.location.hash === LOCAL_TAB_HASH) setTab("local");
    else if (loadMyRegions() !== null) setTab("local");
  }, []);

  // #local 해시 진입점(1면 거래 지도 아래 링크 등) — 지면 중간에서 눌러도 탭 전환 + 상단으로.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === LOCAL_TAB_HASH) {
        setTab("local");
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const select = (next: TabKey) => {
    setTab(next);
    // 해시 동기화 — 히스토리 오염·스크롤 점프 없이(replaceState). 1면은 해시 제거.
    const url = new URL(window.location.href);
    url.hash = next === "local" ? LOCAL_TAB_HASH : "";
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="mx-auto w-full max-w-md">
      {/* ── 먹 칩 탭 바 — 지면 위 얇은 괘선 띠 ── */}
      <div
        role="tablist"
        aria-label="오늘의 판 지면 선택"
        className="mb-2 flex items-stretch gap-1.5"
      >
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`home-pane-${key}`}
              onClick={() => select(key)}
              className={`px-3 py-[6px] text-[12.5px] tracking-[0.1em] ${
                active ? "font-extrabold" : "font-bold"
              }`}
              style={
                active
                  ? { background: INK, color: PAPER, border: `1px solid ${INK}` }
                  : { background: "transparent", color: INK, border: `1px solid ${RULE}` }
              }
            >
              {label}
            </button>
          );
        })}
        {/* 홈 화면 바로가기 칩 — 탭 줄 맨 오른쪽 상주(2026-07-11 사장). */}
        <InstallButton />
      </div>

      {/* ── 지면 페인 — 둘 다 마운트, display 전환(상태 보존) ── */}
      <div
        id="home-pane-front"
        role="tabpanel"
        aria-hidden={tab !== "front"}
        style={tab !== "front" ? { display: "none" } : undefined}
      >
        {front}
      </div>
      <div
        id="home-pane-local"
        role="tabpanel"
        aria-hidden={tab !== "local"}
        style={tab !== "local" ? { display: "none" } : undefined}
      >
        {local}
      </div>
    </div>
  );
}
