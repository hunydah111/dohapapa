"use client";

// 문턱 게이지 — 신문 1면의 [내 문턱 · 구독자란]. 옵트인으로 기기에 저장된 프로필이
// 있을 때만 렌더(없으면 빈 껍데기도 안 그림 — 구독자란 프레임까지 통째 생략).
// 매일 갱신되는 오늘 중위가 기준으로 부족액·개월을 다시 계산한다 — 서버 전송 없음,
// 계산 전부 브라우저(무저장 원칙 — 개인 조건은 localStorage만).
//
// 조판은 DailyFront 신문 토큰과 동일(종이/먹/괘선) — 개인란은 먹 실선 테두리 박스.
// 워딩은 "닿다" 계열(닿아요/아득해요). 공유 버튼 없음 — 개인 전용.

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { loadLocalProfile } from "@/lib/localProfile";
import { computeDdayForSigungu, type DdayResult } from "@/lib/plan/dday";
import { formatKrwHuman } from "@/lib/format";
import { isKnownSigungu, normalizeSigungu } from "@/lib/molit";

/** 시군구명 → 동네면(/r/[시군구]) 링크 — 먹색 유지 + 점선 밑줄(지면 톤).
 *  화이트리스트 밖 값(구 프로필 등)은 링크 없이 텍스트 그대로. */
function GaugeRegion({ sigungu, ink }: { sigungu: string; ink: string }) {
  if (!isKnownSigungu(sigungu)) return <>{sigungu}</>;
  return (
    <a
      href={`/r/${encodeURIComponent(normalizeSigungu(sigungu))}`}
      title={`${sigungu} 동네면`}
      className="underline decoration-dotted underline-offset-2"
      style={{ color: ink }}
    >
      {sigungu}
    </a>
  );
}

/** 스트립 노출 계측 — 서버 컴포넌트(DailyFront)에서 클라이언트로 위임한 1회성 핑. */
export function DailyFrontPing() {
  useEffect(() => {
    track("daily_front_view");
  }, []);
  return null;
}

type GaugeState = { sigungu: string; dday: DdayResult } | null;

export function ThresholdGauge() {
  const [gauge, setGauge] = useState<GaugeState>(null);

  // localStorage 는 클라이언트 전용 — hydration 불일치 방지 위해 마운트 후 로드.
  useEffect(() => {
    const saved = loadLocalProfile();
    if (!saved) return;
    const sigungu =
      saved.lastSigungu ?? saved.profile.requiredRegions?.[0] ?? null;
    if (!sigungu) return;
    const dday = computeDdayForSigungu(saved.profile, sigungu);
    if (!dday) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부(localStorage) 동기화
    setGauge({ sigungu, dday });
    track("threshold_gauge_view");
  }, []);

  if (!gauge) return null;
  const { sigungu, dday } = gauge;
  const savingMan = Math.round(dday.monthlySavingKrw / 10_000);

  // 신문 조판 토큰 (DailyFront와 동일).
  const INK = "#191713";
  const INK_SOFT = "#5d574c";
  const PAPER = "#fbfaf6";

  let line: React.ReactNode;
  if (dday.capped) {
    // 박탈감 캡 — 숫자 대신 담백하게 + 대안 동선. 빨간 경보 금지.
    line = (
      <>
        <span className="font-bold" style={{ color: INK }}>
          <GaugeRegion sigungu={sigungu} ink={INK} /> 문턱, 지금 기준 아득해요
        </span>
        <a
          href="#biji-verdict"
          className="ml-2 inline-block border px-2 py-0.5 text-[11px] font-bold"
          style={{ borderColor: INK, color: INK }}
        >
          대안 동네 보기 →
        </a>
      </>
    );
  } else if (dday.months === 0) {
    line = (
      <span className="font-bold" style={{ color: INK }}>
        <GaugeRegion sigungu={sigungu} ink={INK} /> — 지금 닿아요
      </span>
    );
  } else {
    line = (
      <span className="tabular-nums" style={{ color: INK }}>
        <span className="font-bold">
          <GaugeRegion sigungu={sigungu} ink={INK} /> 문턱까지{" "}
        </span>
        <span className="text-[17px] font-extrabold">{formatKrwHuman(dday.gapKrw)}</span>
        <span style={{ color: INK_SOFT }}>
          {" "}
          · 월 {savingMan.toLocaleString("ko-KR")}만원 저축 기준 {dday.months}개월
        </span>
      </span>
    );
  }

  return (
    <div className="mt-3 px-3.5 py-3" style={{ border: `1.5px solid ${INK}`, background: PAPER }}>
      <span
        className="mb-1.5 inline-block border px-2 py-[2px] text-[11px] font-bold tracking-[0.18em]"
        style={{ borderColor: INK, color: INK, background: PAPER }}
      >
        내 문턱 · 구독자란
      </span>
      <p className="text-[13.5px] leading-relaxed">{line}</p>
      <p className="mt-1 text-[10.5px]" style={{ color: INK_SOFT }}>
        이 폰에 저장한 조건 · 오늘 중위가 기준 · 전부 추정(예측 아님) · 서버 미전송
      </p>
    </div>
  );
}
