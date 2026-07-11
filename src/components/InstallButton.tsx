"use client";

// 홈 화면/바탕화면에 "앱 설치"(A2HS) — 2026-07-11 사장. manifest.ts + 이 버튼으로 실동작.
//  · Android·데스크톱 크로미움: beforeinstallprompt 를 잡아 "설치" 버튼 → 클릭 시 네이티브 프롬프트.
//  · iOS 사파리: 프롬프트 API 없음 → "공유 → 홈 화면에 추가" 안내 토글.
//  · 이미 설치(standalone)로 실행 중이면 아무것도 안 보임.
//  · 그 외(미지원): 브라우저 메뉴 안내 텍스트 폴백.
// JS 한 줌짜리 클라이언트 컴포넌트 — 지면 본문은 서버 렌더 유지.

import { useEffect, useState } from "react";
import { INK, INK_SOFT, PAPER } from "@/lib/paperTone";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const sa =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setStandalone(sa);
    const ua = nav.userAgent;
    // iOS 사파리(크롬·파폭 iOS 제외 — 걔넨 홈 화면 추가 UI가 없음).
    setIsIOS(/iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));

    const onBIP = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 미니바 억제, 우리 버튼으로 유도
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) return null; // 이미 앱으로 실행 중 — 유도 불필요

  async function onInstall() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
  }

  const btnStyle = {
    background: PAPER,
    color: INK,
    border: `1.5px solid ${INK}`,
  } as const;

  // ① Android·데스크톱 크로미움 — 실제 설치 프롬프트
  if (deferred) {
    return (
      <button
        type="button"
        onClick={onInstall}
        className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-bold tracking-[0.02em]"
        style={btnStyle}
        aria-label="비집고를 홈 화면에 앱으로 설치"
      >
        <PhoneIcon /> 홈 화면에 앱으로 설치
      </button>
    );
  }

  // ② iOS 사파리 — 안내 토글(프롬프트 API 미지원)
  if (isIOS) {
    return (
      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => setShowIOSHelp((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-bold tracking-[0.02em]"
          style={btnStyle}
        >
          <PhoneIcon /> 홈 화면에 앱으로 추가
        </button>
        {showIOSHelp && (
          <p className="mt-1.5 text-[11px] leading-[1.6]" style={{ color: INK_SOFT }}>
            사파리 하단 <b style={{ color: INK }}>공유</b> 버튼(⬆︎) → 목록에서{" "}
            <b style={{ color: INK }}>홈 화면에 추가</b>를 누르면 앱처럼 열립니다.
          </p>
        )}
      </div>
    );
  }

  // ③ 미지원 브라우저 — 텍스트 안내 폴백(기존 문구)
  return (
    <p className="mt-1.5 text-[11px] leading-[1.6]" style={{ color: INK_SOFT }}>
      매일 아침 한 번에 — 브라우저 메뉴에서 <b style={{ color: INK }}>홈 화면에 추가</b>하면
      앱처럼 열립니다.
    </p>
  );
}

/** 폰 아이콘 — 이모지 금지(Win10 글리프 사태) → 인라인 SVG. */
function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
