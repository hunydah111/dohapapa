"use client";

import { useState } from "react";
import { REGION_GROUPS, REGION_PRESETS } from "@/types/profile";

// 필수 지역(하드 필터) 선택 위젯 — 입력 폼과 결과 화면 '조건 수정' 양쪽에서 재사용.
// 선택 상태(value)는 부모가 소유하고, 탭/검색어만 내부 상태로 둔다.
export function RequiredRegionPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [regionTab, setRegionTab] = useState<"서울" | "경기">("서울");
  const [regionQuery, setRegionQuery] = useState("");

  return (
    <div>
      <p className="text-[15px] font-semibold text-[#191713]">
        절대 포기 못 하는 지역{" "}
        <span className="text-[12px] font-medium text-[#8a857a]">
          (복수 선택)
        </span>
      </p>
      <p className="mt-0.5 mb-1 text-[12px] leading-relaxed text-[#5d574c]">
        고른 지역의 단지만 보여줘요. 안 고르면 수도권 전체.
      </p>
      {/* 1곳만 골랐을 때 예산 추정도 그 시군구 LTV·DSR로 정확. 다중·미선택은 보수적 가정. */}
      <p className="mt-0 mb-2 text-[11px] leading-relaxed text-[#c4521f]">
        💡 1곳만 고르면 예산 추정도 그 동네 LTV로 정확해져요 (2025.10.15 대책 반영).
      </p>
      {/* 빠른 선택 (핫플 → 해당 구) */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-medium text-[#8a857a]">
          빠른 선택
        </span>
        {REGION_PRESETS.map((p) => {
          const on = p.regions.every((r) => value.includes(r));
          return (
            <button
              key={p.label}
              type="button"
              onClick={() =>
                onChange(
                  on
                    ? value.filter((r) => !p.regions.includes(r))
                    : [...new Set([...value, ...p.regions])],
                )
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                on
                  ? "border-coral-500 bg-coral-600 text-white"
                  : "border-black/[0.10] bg-white text-[#5d574c] hover:border-coral-300"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange(value.filter((x) => x !== r))}
              className="inline-flex items-center gap-1 rounded-full bg-coral-600 px-2.5 py-1 text-xs font-semibold text-white"
            >
              {r} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
      <div className="mb-2 flex items-center gap-2">
        {(["서울", "경기"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setRegionTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              regionTab === t
                ? "bg-coral-600 text-white"
                : "border border-black/[0.08] bg-[#f4f2ea] text-[#5d574c]"
            }`}
          >
            {t}
          </button>
        ))}
        {/* 현재 탭(서울/경기) 전체 한 번에 선택·해제 */}
        {(() => {
          const tabRegions = REGION_GROUPS.find((g) => g.label === regionTab)!
            .regions;
          const allOn = tabRegions.every((r) => value.includes(r));
          return (
            <button
              type="button"
              onClick={() =>
                onChange(
                  allOn
                    ? value.filter((r) => !tabRegions.includes(r))
                    : [...new Set([...value, ...tabRegions])],
                )
              }
              className={`ml-auto rounded-full border px-3 py-1.5 text-xs font-semibold ${
                allOn
                  ? "border-coral-500 bg-coral-600 text-white"
                  : "border-coral-300 bg-coral-50 text-coral-700 hover:bg-coral-100"
              }`}
            >
              {regionTab} 전체 {allOn ? "해제" : "선택"}
            </button>
          );
        })()}
      </div>
      <input
        type="text"
        value={regionQuery}
        onChange={(e) => setRegionQuery(e.target.value)}
        placeholder="구·시 검색 (예: 강남)"
        className="mb-2 w-full rounded-2xl border border-[#d1d1d6] px-4 py-2.5 text-[14px] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-coral-500"
      />
      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
        {REGION_GROUPS.find((g) => g.label === regionTab)!
          .regions.filter((r) => r.includes(regionQuery.trim()))
          .map((r) => {
            const sel = value.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() =>
                  onChange(
                    sel ? value.filter((x) => x !== r) : [...value, r],
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  sel
                    ? "border-coral-500 bg-coral-50 text-coral-700"
                    : "border-black/[0.10] bg-white text-[#5d574c] hover:border-coral-300"
                }`}
              >
                {r}
              </button>
            );
          })}
      </div>
    </div>
  );
}
