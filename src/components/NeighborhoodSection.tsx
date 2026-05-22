"use client";

import { useEffect, useState } from "react";
import type { NeighborhoodData } from "@/lib/neighborhood";

// 동네 분석 — 표시 단지의 반경 1km 시설을 '사실'로 보여주고(배지) 5축 레이더로 요약.
// 데이터는 /api/neighborhood(카카오 카테고리). 키 없으면 null → 섹션 자동 숨김.

export interface NeighborhoodItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  transactionCount: number;
}

const AXES: { key: keyof NeighborhoodData["scores"]; label: string }[] = [
  { key: "transit", label: "교통" },
  { key: "convenience", label: "편의" },
  { key: "education", label: "교육" },
  { key: "culture", label: "문화" },
  { key: "liquidity", label: "환금" },
];

function Radar({ scores }: { scores: NeighborhoodData["scores"] }) {
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 58;
  const n = AXES.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const ring = (frac: number) =>
    AXES.map((_, i) => pt(i, maxR * frac).join(",")).join(" ");
  const dataPoly = AXES.map((ax, i) =>
    pt(i, maxR * (Math.max(0, Math.min(100, scores[ax.key])) / 100)).join(","),
  ).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {/* 격자 */}
      {[1, 0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#e5e0d6" strokeWidth={1} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = pt(i, maxR);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e0d6" strokeWidth={1} />;
      })}
      {/* 데이터 */}
      <polygon points={dataPoly} fill="rgba(242,96,60,0.22)" stroke="#f2603c" strokeWidth={2} />
      {/* 라벨 */}
      {AXES.map((ax, i) => {
        const [x, y] = pt(i, maxR + 12);
        return (
          <text
            key={ax.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={700}
            fill="#6b6157"
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#f3ece4] px-2.5 py-1 text-[12px] font-semibold text-[#6b6157]">
      {children}
    </span>
  );
}

export function NeighborhoodSection({ items }: { items: NeighborhoodItem[] }) {
  const [data, setData] = useState<Record<string, NeighborhoodData | null>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/neighborhood", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: items.map((it) => ({
              id: it.id,
              lat: it.lat,
              lng: it.lng,
              transactionCount: it.transactionCount,
            })),
          }),
        });
        if (!res.ok) return;
        const j = (await res.json()) as { results?: Record<string, NeighborhoodData | null> };
        if (!cancelled) {
          setData(j.results ?? {});
          setLoaded(true);
        }
      } catch {
        /* 동네 분석 실패 — 섹션 숨김 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  // 키 없음/전부 실패 → 표시할 게 없으면 섹션 숨김(우아한 degrade)
  const hasAny = loaded && items.some((it) => data[it.id]);
  if (!hasAny) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: "#3a322c" }}>
          동네 분석
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: "#6b6157" }}>
          단지 반경 1km 시설 수 기반 — 사실 정보예요(추천·평가 아님)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((it) => {
          const d = data[it.id];
          if (!d) return null;
          const c = d.counts;
          return (
            <div
              key={it.id}
              className="rounded-3xl bg-white p-5"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.12)" }}
            >
              <p className="mb-3 text-[15px] font-bold" style={{ color: "#3a322c" }}>
                {it.name}
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <Radar scores={d.scores} />
                <div className="flex flex-1 flex-wrap gap-1.5">
                  <Chip>
                    🚇{" "}
                    {d.nearestSubwayM != null
                      ? `지하철 ${d.nearestSubwayM}m`
                      : `지하철역 ${c.subway}개`}
                  </Chip>
                  {c.subway > 0 && d.nearestSubwayM != null && <Chip>도보권 역 {c.subway}개</Chip>}
                  <Chip>🛒 마트 {c.mart}</Chip>
                  <Chip>🏫 학교 {c.school}</Chip>
                  <Chip>🧸 어린이집·유치원 {c.kinder}</Chip>
                  <Chip>☕ 카페 {c.cafe}</Chip>
                  <Chip>🎭 문화시설 {c.culture}</Chip>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
