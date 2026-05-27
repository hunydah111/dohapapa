"use client";

import { useEffect, useState } from "react";
import type { NeighborhoodData } from "@/lib/neighborhood";

// 동네 분석 — 표시 단지의 반경 1km 시설을 '사실'로 보여주고(배지) 5축 레이더로 요약.
// 데이터는 /api/neighborhood(카카오 카테고리). 키 없으면 null → 카드 내 블록 자동 숨김.
// 배치 fetch 훅(useNeighborhood) + 카드 인라인 표시(NeighborhoodInline)로 분리 —
// 단지 카드 안에 동네 정보를 직접 박는다(별도 하단 섹션 없음).

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

export function NeighborhoodRadar({ scores }: { scores: NeighborhoodData["scores"] }) {
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
  // 바닥 floor — 어떤 축도 중심까지 꺼지지 않게 한다. 거래가 적어 환금 점수가 0이어도
  // 오각형이 찌그러져 "여긴 못 판다"는 인상을 주면 소유주가 기분 상한다(우리 목적 아님).
  // 점수 [0,100] → 반지름 [maxR*FLOOR, maxR]. 상대 차이는 유지하되 바닥은 안 친다.
  // 0.5 = 최소 면적 약 25% — 0점 축도 '패인 톱니'가 아니라 채워진 도형으로 보인다.
  const FLOOR = 0.5;
  const radius = (v: number) =>
    maxR * (FLOOR + (1 - FLOOR) * (Math.max(0, Math.min(100, v)) / 100));
  const dataPoly = AXES.map((ax, i) =>
    pt(i, radius(scores[ax.key])).join(","),
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

// 배치 fetch 훅 — 표시 후보의 반경 1km 시설을 한 번에 가져온다(라운드트립 1회).
// id 시그니처로만 재요청해 부모 리렌더마다 재fetch되는 걸 막는다.
// 키 없음/실패 → 빈 맵(카드에서 자동 숨김). early-return 앞에서 무조건 호출할 것.
export function useNeighborhood(
  items: NeighborhoodItem[],
): Record<string, NeighborhoodData | null> {
  const [data, setData] = useState<Record<string, NeighborhoodData | null>>({});
  const sig = items.map((it) => it.id).join(",");

  useEffect(() => {
    // 0건이면 그냥 둔다 — 카드가 안 그려지고 consumer는 현재 complexId로 조회하므로 stale 무해.
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
        const j = (await res.json()) as {
          results?: Record<string, NeighborhoodData | null>;
        };
        if (!cancelled) setData(j.results ?? {});
      } catch {
        /* 동네 분석 실패 — 카드에서 자동 숨김 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // sig(=id 목록)가 바뀔 때만 재요청 — items 배열 ref 변화는 무시.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return data;
}

// 카드 내부 인라인 — 단지 카드 안 '동네' 서브섹션(레이더 + 시설 배지). 화이트 박스 래퍼 없음.
// 컴플라이언스: '시설 수 기반 사실(추천·평가 아님)' 캡션을 단지마다 유지(평점처럼 보이지 않게).
export function NeighborhoodInline({ data }: { data: NeighborhoodData }) {
  const c = data.counts;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold" style={{ color: "#9a8f82" }}>
        동네 · 반경 1km 시설 수 기반 사실 (추천·평가 아님)
      </p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <NeighborhoodRadar scores={data.scores} />
        <div className="flex flex-1 flex-wrap gap-1.5">
          <Chip>
            🚇{" "}
            {data.nearestSubwayM != null
              ? `지하철 ${data.nearestSubwayM}m`
              : `지하철역 ${c.subway}개`}
          </Chip>
          {c.subway > 0 && data.nearestSubwayM != null && (
            <Chip>도보권 역 {c.subway}개</Chip>
          )}
          <Chip>🛒 마트 {c.mart}</Chip>
          <Chip>🏫 학교 {c.school}</Chip>
          <Chip>🧸 어린이집·유치원 {c.kinder}</Chip>
          <Chip>☕ 카페 {c.cafe}</Chip>
          <Chip>🎭 문화시설 {c.culture}</Chip>
        </div>
      </div>
    </div>
  );
}
