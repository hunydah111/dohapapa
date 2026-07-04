"use client";

// 문턱 게이지 — "오늘의 1면" 개인 블록. 옵트인으로 기기에 저장된 프로필이 있을 때만
// 렌더(없으면 빈 껍데기도 안 그림). 매일 갱신되는 오늘 중위가 기준으로 부족액·개월을
// 다시 계산한다 — 서버 전송 없음, 계산 전부 브라우저.
//
// 워딩은 "닿다" 계열(닿아요/아득해요). 공유 버튼 없음 — 개인 전용.

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { loadLocalProfile } from "@/lib/localProfile";
import { computeDdayForSigungu, type DdayResult } from "@/lib/plan/dday";
import { formatKrwHuman } from "@/lib/format";

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

  let line: React.ReactNode;
  if (dday.capped) {
    // 박탈감 캡 — 숫자 대신 담백하게 + 대안 동선. 빨간 경보 금지.
    line = (
      <>
        <span className="font-bold text-[#3a2c1d]">
          {sigungu} 문턱, 지금 기준 아득해요
        </span>
        <a
          href="#biji-verdict"
          className="ml-2 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-coral-700 shadow-sm"
        >
          대안 동네 보기 →
        </a>
      </>
    );
  } else if (dday.months === 0) {
    line = (
      <span className="font-bold text-[#3a2c1d]">
        {sigungu} — 지금 닿아요
      </span>
    );
  } else {
    line = (
      <span className="text-[#3a2c1d]">
        <span className="font-bold">{sigungu} 문턱까지 </span>
        <span className="font-bold text-[#b87914]">
          {formatKrwHuman(dday.gapKrw)}
        </span>
        <span className="text-[#6b6157]">
          {" "}
          · 월 {savingMan.toLocaleString("ko-KR")}만원 저축 기준{" "}
          {dday.months}개월
        </span>
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-[#ecd9b3] bg-[#fdf6e7] px-4 py-3">
      <p className="text-[13px] leading-relaxed">
        <span aria-hidden="true">🎯 </span>
        {line}
      </p>
      <p className="mt-1 text-[10px]" style={{ color: "#9a8f82" }}>
        이 폰에 저장한 조건 · 오늘 중위가 기준 · 전부 추정(예측 아님)
      </p>
    </div>
  );
}
