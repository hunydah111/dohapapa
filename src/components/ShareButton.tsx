"use client";

// 지면 공유 버튼 — 콜로폰 옆 소형(각진 지면 톤, 먹 테두리). 코랄 금지(CTA 전용색).
// navigator.share 지원(모바일)이면 OS 공유 시트, 미지원(데스크톱)이면 클립보드 복사
// + "링크 복사됨" 토스트. JS 한 줌짜리 클라이언트 컴포넌트 — 지면 본문은 서버 렌더 유지.

import { useEffect, useRef, useState } from "react";
import { INK, PAPER } from "@/lib/paperTone";

/** 레거시 복사 폴백 — async Clipboard API 가 권한/포커스 문제로 거부될 때(일부 웹뷰·
 *  임베드 환경) 사용자 제스처 내 execCommand 로 한 번 더 시도한다. */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ShareButton({ title }: { title: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function showToast(msg: string) {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2000);
  }

  async function onShare() {
    // 해시(#biji-verdict 등) 제거 — 공유는 지면 자체로.
    const url = window.location.origin + window.location.pathname;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // 사용자가 공유 시트를 닫음 — 아무것도 하지 않는다(강요 금지).
        return;
      }
    }
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      ok = legacyCopy(url); // 권한 거부 환경 폴백
    }
    // 실패를 성공으로 꾸미지 않는다 — 정직한 실패 안내.
    showToast(ok ? "링크 복사됨" : "복사 실패 — 주소창 링크를 이용해 주세요");
  }

  return (
    <span className="relative inline-block">
      {/* 토스트 — 버튼 위 소형, 각진 먹 바탕. */}
      {toast && (
        <span
          role="status"
          className="absolute bottom-full right-0 mb-1.5 whitespace-nowrap px-2 py-[3px] text-[10.5px] font-bold"
          style={{ background: INK, color: PAPER }}
        >
          {toast}
        </span>
      )}
      <button
        type="button"
        onClick={onShare}
        className="px-2.5 py-[5px] text-[11px] font-bold tracking-[0.08em]"
        style={{ background: PAPER, color: INK, border: `1.5px solid ${INK}` }}
        aria-label="이 지면 링크 공유"
      >
        공유
      </button>
    </span>
  );
}
