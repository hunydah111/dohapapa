"use client";

// 홈 화면 "바로가기" 칩 — 2026-07-11 사장. [1면·동네판] 탭 줄 맨 오른쪽에 상주.
//  · 이름은 "앱 설치"가 아니라 "바로가기"(사장: 앱 설치 아니고 바로가기지).
//  · Android·데스크톱 크로미움: beforeinstallprompt 잡히면 클릭 시 네이티브 추가 프롬프트.
//  · 없으면(사파리·이미 프롬프트 소진) 클릭 시 "브라우저 메뉴 → 홈 화면에 추가" 안내 토글.
//  · 추가해도 칩은 사라지지 않는다(사장: 남아있게) — 프롬프트 소진 후엔 안내로 전환.
//  · 2026-07-14 사장 재확인: standalone(설치된 앱)에서도 숨기지 않는다 — 어떤 상태에서도
//    상주. 설치된 앱 안에서 누르면 "이미 설치된 상태" 안내.

import { useEffect, useRef, useState } from "react";
import { INK, INK_SOFT, PAPER, RULE } from "@/lib/paperTone";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    );
    setIsIOS(/iPhone|iPad|iPod/.test(nav.userAgent) && !/CriOS|FxiOS/.test(nav.userAgent));

    const onBIP = (e: Event) => {
      e.preventDefault(); // 기본 미니바 억제 — 우리 칩으로 유도
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    // 바깥 클릭 시 안내 닫기
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      document.removeEventListener("mousedown", onDoc);
    };
  }, []);

  async function onClick() {
    if (standalone) {
      setShowHelp((v) => !v); // 설치된 앱 안 — 상태 안내만
      return;
    }
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => {});
      setDeferred(null); // 프롬프트는 1회성 — 칩은 유지되고 이후엔 안내로 동작
      return;
    }
    setShowHelp((v) => !v);
  }

  return (
    <div ref={wrapRef} className="relative ml-auto">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2.5 py-[6px] text-[11.5px] font-bold tracking-[0.04em]"
        style={{ background: PAPER, color: INK, border: `1px solid ${RULE}` }}
        aria-label="비집고 홈 화면 바로가기 추가"
      >
        <PhoneIcon /> 바로가기
      </button>

      {showHelp && (
        <div
          className="absolute right-0 z-30 mt-1 w-[220px] rounded-sm p-2.5 text-[11px] leading-[1.6] shadow-lg"
          style={{ background: PAPER, color: INK_SOFT, border: `1.5px solid ${INK}` }}
          role="dialog"
        >
          {standalone ? (
            <>지금 홈 화면 바로가기로 보고 있어요 — 이미 추가된 상태입니다.</>
          ) : isIOS ? (
            <>
              사파리 하단 <b style={{ color: INK }}>공유</b> 버튼(⬆︎) →{" "}
              <b style={{ color: INK }}>홈 화면에 추가</b>를 누르면 홈에 바로가기가 생겨요.
            </>
          ) : (
            <>
              브라우저 메뉴(⋮) →{" "}
              <b style={{ color: INK }}>홈 화면에 추가</b>(또는 <b style={{ color: INK }}>바로가기
              만들기</b>)를 누르면 홈에 바로가기가 생겨요.
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 폰 아이콘 — 이모지 금지(Win10 글리프 사태) → 인라인 SVG. */
function PhoneIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
