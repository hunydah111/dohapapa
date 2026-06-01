"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LivePulseData } from "@/lib/livePulse";

// 라이브 펄스 스트립 — 초록 펄스 점(데이터 살아있음) + 신선도 기준일 + 회전 팩트.
// "방송 중" 느낌으로 정지 화면을 깬다. 모든 값은 주간 크론으로 자동 갱신(번들·DB0).

const CYCLE_MS = 3000;

export function LivePulse({ data }: { data: LivePulseData }) {
  const [i, setI] = useState(0);
  const n = data.facts.length;

  useEffect(() => {
    if (n <= 1) return;
    const id = setInterval(() => setI((p) => (p + 1) % n), CYCLE_MS);
    return () => clearInterval(id);
  }, [n]);

  const fact = data.facts[i];

  return (
    <Link
      href="/updates"
      className="mx-auto mt-4 flex w-full max-w-sm items-center gap-2.5 rounded-2xl border border-[#e6dcc9] bg-white/70 px-3.5 py-2.5 shadow-sm transition-colors hover:border-[#cfe0d2] hover:bg-white"
    >
      {/* 살아있음 펄스 점 */}
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="live-dot absolute inline-flex h-full w-full rounded-full" style={{ background: "#4f9d54" }} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#4f9d54" }} />
      </span>

      <div className="min-w-0 flex-1 text-left leading-tight">
        {/* 신선도 기준일 — 항상 보이는 신호 */}
        <p className="text-[10.5px] font-semibold" style={{ color: "#5f8a6a" }}>
          실거래 {data.freshDate} 반영 · 매주 자동 갱신
        </p>
        {/* 회전 팩트 — fade로 흐름(살아있음) */}
        <p key={i} className="live-fact truncate text-[12.5px] font-bold" style={{ color: "#3a2c1d" }}>
          <span aria-hidden>{fact.icon}</span> {fact.label}{" "}
          <span style={{ color: "#9a5a1e" }}>{fact.value}</span>
        </p>
      </div>

      {/* 회전 진행 점 */}
      {n > 1 && (
        <span className="flex shrink-0 gap-1" aria-hidden>
          {data.facts.map((_, k) => (
            <span
              key={k}
              className="h-1 w-1 rounded-full transition-colors"
              style={{ background: k === i ? "#4f9d54" : "#dfe6da" }}
            />
          ))}
        </span>
      )}
      <span className="shrink-0 text-[13px] font-bold" style={{ color: "#b8a98f" }} aria-hidden>›</span>
    </Link>
  );
}
