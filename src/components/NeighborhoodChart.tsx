"use client";

import { useEffect, useState } from "react";

// 멜론식 "이번 주 인기 동네" 차트 — 비집고에서 조건에 맞아 많이 뜬 수도권 시군구의
// 주간 순위. 비-PII 집계(/api/neighborhood-chart). 데이터가 빈약하면 조용히 숨는다
// (이제 막 쌓이는 주엔 안 보임 — type 분포 차트와 같은 degrade 철학).

interface ChartEntry {
  rank: number;
  sigungu: string;
  count: number;
  rankDelta: number | null;
}
interface ChartData {
  week: string;
  entries: ChartEntry[];
  total: number;
  lastUpdated: string | null;
}

// ISO 시각 → KST "M.D" (서버 UTC 기준이라 +9h 시프트 후 표기).
function fmtKST(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
}

// 표본이 너무 적으면 숨김 — 한두 줄짜리 빈 차트의 신뢰도 문제 방지.
const MIN_ENTRIES = 5;
const MIN_TOTAL = 10;

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="rounded-full bg-coral-100 px-1.5 py-0.5 text-[10px] font-bold text-coral-700">
        NEW
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
        <span aria-hidden>▲</span>
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-500">
        <span aria-hidden>▼</span>
        {Math.abs(delta)}
      </span>
    );
  }
  return <span className="text-[11px] font-bold text-[#c4bcb0]">−</span>;
}

export function NeighborhoodChart() {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/neighborhood-chart")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ChartData | null) => {
        if (!cancelled && j) setData(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.entries.length < MIN_ENTRIES || data.total < MIN_TOTAL) {
    return null; // 표본 빈약 → 숨김
  }

  const maxCount = data.entries[0]?.count || 1;

  return (
    <section className="mx-auto mt-8 w-full max-w-sm text-left">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[13px] font-bold" style={{ color: "#3a322c" }}>
          🔥 이번 주 인기 동네
        </p>
        <p className="text-[11px]" style={{ color: "#9a8f82" }}>
          매주 갱신
          {data.lastUpdated ? ` · ${fmtKST(data.lastUpdated)} 기준` : ""}
        </p>
      </div>
      <div
        className="rounded-3xl bg-white p-4"
        style={{
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.08)",
        }}
      >
        <ul className="flex flex-col gap-2.5">
          {data.entries.map((e) => {
            const top = e.rank <= 3;
            return (
              <li key={e.sigungu} className="flex items-center gap-3">
                <span
                  className="w-5 shrink-0 text-center text-[15px] font-extrabold tabular-nums"
                  style={{ color: top ? "#e8662f" : "#c4bcb0" }}
                >
                  {e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="truncate text-[14px] font-semibold"
                      style={{ color: "#3a322c" }}
                    >
                      {e.sigungu}
                    </span>
                    <DeltaBadge delta={e.rankDelta} />
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f3ece4]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(8, (e.count / maxCount) * 100)}%`,
                        background: top ? "#fe7644" : "#f0b894",
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "#9a8f82" }}>
          비집고에서 조건에 맞아 많이 뜬 수도권 동네 집계 · 광고·순위 보장 아님.
        </p>
      </div>
    </section>
  );
}
