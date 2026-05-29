"use client";

import type { Ladder } from "@/lib/plan/trajectory";
import { formatKrwHuman } from "@/lib/format";

// 트라젝토리(사다리) 뷰 — "지금 어디" 가 아니라 "시간이 갈수록 어디로 올라가나".
// 컴플라이언스: 전부 추정 · 미래가치 예측·투자권유 아님. 가격=공개 실거래.

const SCEN_LABEL: Record<string, string> = { down: "하락", flat: "보합", up: "상승" };

function ddayLabel(months: number | null, affordableNow: boolean): string {
  if (affordableNow) return "지금";
  if (months === null) return "25년+";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월 뒤`;
  if (m === 0) return `${y}년 뒤`;
  return `${y}년 ${m}개월 뒤`;
}

export function TrajectorySection({
  ladder,
  monthlySavingKrw,
}: {
  ladder: Ladder;
  monthlySavingKrw: number;
}) {
  if (ladder.rungs.length === 0) return null;
  const saveMan = Math.round(monthlySavingKrw / 1e4);

  return (
    <section className="rounded-3xl border border-[#ecd9b3] bg-[#fffdf8] p-5 shadow-sm">
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-[17px] font-bold" style={{ color: "#3a2c1d" }}>
          내 동네 사다리
        </h3>
        <span className="text-[11px] font-semibold" style={{ color: "#b08948" }}>
          추정 시나리오
        </span>
      </div>
      <p className="mb-4 text-[12.5px]" style={{ color: "#8a7a63" }}>
        {ladder.bandLabel} 기준 · 월 {saveMan.toLocaleString()}만원 저축 ·{" "}
        {SCEN_LABEL[ladder.scenarioKey] ?? "보합"} 가정으로 진입 가능해지는 순서
      </p>

      {/* 세로 타임라인 — 채운 점(현재)→빈 점(미래). */}
      <ol className="relative flex flex-col gap-0">
        {ladder.rungs.map((r, i) => {
          const last = i === ladder.rungs.length - 1;
          return (
            <li key={r.sigungu} className="relative flex gap-3 pb-4 last:pb-0">
              {/* 연결선 */}
              {!last && (
                <span
                  aria-hidden
                  className="absolute left-[7px] top-4 h-full w-0.5"
                  style={{ background: "#ecd9b3" }}
                />
              )}
              {/* 점 */}
              <span
                aria-hidden
                className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2"
                style={
                  r.affordableNow
                    ? { background: "#e8662f", borderColor: "#e8662f" }
                    : { background: "#fffdf8", borderColor: "#d9b98a" }
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{ color: r.affordableNow ? "#e8662f" : "#6e5b46" }}
                  >
                    {ddayLabel(r.monthsAway, r.affordableNow)}
                  </span>
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{ color: "#b87914" }}
                  >
                    {formatKrwHuman(r.entryKrw)}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[15px] font-bold" style={{ color: "#3a2c1d" }}>
                    {r.sigungu}
                  </span>
                  {r.repName && (
                    <span className="truncate text-[11.5px]" style={{ color: "#9c8a72" }}>
                      예: {r.repName}
                      {r.repYear ? ` (${r.repYear}년)` : ""}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {ladder.note && (
        <p
          className="mt-3 rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed"
          style={{ background: "#fdf6e7", color: "#7a5a2a" }}
        >
          {ladder.note}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-snug" style={{ color: "#b3a99c" }}>
        진입가 = 동네 안정형(하위 40%) 가격대 추정 · 저축으로 자기자본이 쌓이는 속도 기준 ·
        미래가치 예측·투자자문 아님 · 국토부 공개 실거래
      </p>
    </section>
  );
}
