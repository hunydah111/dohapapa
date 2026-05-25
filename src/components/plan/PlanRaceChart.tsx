"use client";

import { useState } from "react";
import type { PlanResult, ScenarioKey } from "@/lib/plan";

// "저축 vs 집값 경주" 차트 — 의존성 없는 자체 SVG.
// 40인 사용성 테스트 반영: ① 선이 무엇인지 그래프 바로 아래 한 문장으로 설명(코랄=내가 모으는
// 돈·대출 포함 / 회색=집값), ② 교차점(●)=살 수 있는 때를 명시, ③ 추정 범위 밴드는 기본 숨김·토글,
// ④ 선택한 시나리오(focus)를 굵게 비춤. 예측 아님 — 과거 지표 + 가정.

const COLOR = {
  power: "#fe7644",
  price: "#8a96a3",
  band: "#94a3b8",
  reach: "#2fb39a",
  axis: "#9c8a72",
  grid: "#eee7dd",
};

const W = 400;
const H = 240;
const PAD = { l: 40, r: 14, t: 16, b: 24 };

const FOCUS_LABEL: Record<ScenarioKey, string> = {
  down: "하락 가정",
  flat: "보합 가정",
  up: "상승 가정",
};

function eok(krw: number): string {
  return (krw / 1e8).toFixed(1) + "억";
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

export function PlanRaceChart({
  result,
  focus = "flat",
}: {
  result: PlanResult;
  focus?: ScenarioKey;
}) {
  const [showBand, setShowBand] = useState(false);
  const reduce =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const { years, affordable, price } = result.curve;
  const horizon = years[years.length - 1] || 1;
  const target = price.flat[0];
  const focusPrice = price[focus];

  // y 범위: 내 힘 + 포커스 집값 + (범위 보기 시 하락). 폭주하는 상승은 clip.
  const visible = [...affordable, ...focusPrice, target, ...(showBand ? price.down : [])];
  const lo = Math.min(...visible);
  const hi = Math.max(...visible);
  const padY = (hi - lo) * 0.08 || hi * 0.08 || 1;
  const yMin = lo - padY;
  const yMax = hi + padY;
  const range = yMax - yMin || 1;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const X = (yr: number) => PAD.l + (yr / horizon) * plotW;
  const Y = (v: number) => PAD.t + plotH - ((v - yMin) / range) * plotH;
  const poly = (s: number[]) =>
    years.map((yr, i) => `${X(yr).toFixed(1)},${Y(s[i]).toFixed(1)}`).join(" ");

  const bandPts =
    years.map((yr, i) => `${X(yr).toFixed(1)},${Y(price.up[i]).toFixed(1)}`).join(" ") +
    " " +
    years
      .map((_, i) => years.length - 1 - i)
      .map((i) => `${X(years[i]).toFixed(1)},${Y(price.down[i]).toFixed(1)}`)
      .join(" ");

  // 교차 = 선택 시나리오
  const fs = result.scenarios.find((s) => s.key === focus)!;
  const reachable = fs.months !== null && fs.months / 12 <= horizon;
  const crossT = reachable ? fs.months! / 12 : 0;
  const crossX = reachable ? X(crossT) : null;
  const crossY = reachable ? Y(target * Math.pow(1 + fs.rateAnnual, crossT)) : null;
  const crossYear = reachable ? new Date().getFullYear() + Math.round(fs.months! / 12) : null;

  const step = niceStep(range / 3);
  const yticks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yticks.push(v);

  const xstep = horizon <= 6 ? 2 : horizon <= 12 ? 3 : 5;
  const xticks: number[] = [];
  for (let yr = 0; yr <= horizon; yr += xstep) xticks.push(yr);
  if (xticks[xticks.length - 1] !== horizon) xticks.push(horizon);

  const startY = Y(affordable[0]);
  const targetY = Y(target);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="저축 대비 집값 경주 차트"
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id="planPlotClip">
            <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {yticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={Y(v)} x2={W - PAD.r} y2={Y(v)} stroke={COLOR.grid} strokeWidth={1} />
            <text x={PAD.l - 4} y={Y(v) + 3} fontSize={9} fill={COLOR.axis} textAnchor="end">
              {eok(v)}
            </text>
          </g>
        ))}

        {/* 살 수 있는 구간 */}
        {reachable && crossX !== null && (
          <>
            <rect x={crossX} y={PAD.t} width={W - PAD.r - crossX} height={plotH} fill={COLOR.reach} opacity={0.09} />
            <text x={W - PAD.r - 3} y={PAD.t + 11} fontSize={9} fill={COLOR.reach} textAnchor="end" fontWeight={600}>
              살 수 있는 구간
            </text>
          </>
        )}

        <g clipPath="url(#planPlotClip)">
          {showBand && (
            <>
              <polygon points={bandPts} fill={COLOR.band} opacity={0.12} />
              <polyline points={poly(price.up)} fill="none" stroke={COLOR.band} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <polyline points={poly(price.down)} fill="none" stroke={COLOR.band} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            </>
          )}
          {/* 집값 (선택 시나리오) */}
          <polyline points={poly(focusPrice)} fill="none" stroke={COLOR.price} strokeWidth={1.8} />
          {/* 내 구매가능가 (영웅) */}
          <polyline points={poly(affordable)} fill="none" stroke={COLOR.power} strokeWidth={2.8} />
        </g>

        {/* 오늘 + 지금 부족액 */}
        <line x1={X(0)} y1={PAD.t} x2={X(0)} y2={PAD.t + plotH} stroke={COLOR.axis} strokeWidth={1} strokeDasharray="2 2" opacity={0.45} />
        {result.gapKrw > 0 && Math.abs(startY - targetY) > 14 && (
          <>
            <line x1={X(0)} y1={startY} x2={X(0)} y2={targetY} stroke={COLOR.power} strokeWidth={1} opacity={0.4} />
            <text x={X(0) + 3} y={(startY + targetY) / 2 + 3} fontSize={8.5} fill={COLOR.power}>
              지금 {eok(result.gapKrw)} 부족
            </text>
          </>
        )}

        {/* 교차 마커 — 입력 바뀌면 새 위치로 부드럽게 미끄러짐 */}
        {reachable && crossX !== null && crossY !== null && (
          <g
            style={{
              transform: `translate(${crossX}px, ${crossY}px)`,
              transition: reduce ? undefined : "transform 0.6s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <circle cx={0} cy={0} r={9} fill={COLOR.power} opacity={0.18} />
            <circle cx={0} cy={0} r={5} fill={COLOR.power} stroke="#fff" strokeWidth={2} />
            <FlagLabel
              x={0}
              y={0}
              text={`${crossYear}년 가능`}
              rightHalf={crossX > PAD.l + plotW / 2}
              below={crossY < PAD.t + 30}
            />
          </g>
        )}

        {!reachable && (
          <text
            x={W - PAD.r}
            y={Y(affordable[affordable.length - 1]) - 6}
            fontSize={9}
            fill={COLOR.power}
            textAnchor="end"
            fontWeight={600}
          >
            계속 좁혀가는 중
          </text>
        )}

        {xticks.map((yr) => (
          <text
            key={yr}
            x={X(yr)}
            y={H - 8}
            fontSize={9}
            fill={COLOR.axis}
            textAnchor={yr === 0 ? "start" : yr === horizon ? "end" : "middle"}
          >
            {yr === 0 ? "오늘" : `${yr}년`}
          </text>
        ))}
      </svg>

      {/* 그래프 바로 아래 한 문장 설명 (40인 테스트 #1 요청) */}
      <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "#6e5b46" }}>
        <b style={{ color: COLOR.power }}>굵은 선</b> = 내가 모으는 돈(대출 포함) ·{" "}
        <span style={{ color: COLOR.price }}>회색 선</span> = 집값({FOCUS_LABEL[focus]}). 둘이 만나는{" "}
        <b style={{ color: COLOR.power }}>●</b>이 살 수 있는 때예요.
      </p>

      <button
        type="button"
        onClick={() => setShowBand((v) => !v)}
        className="mt-1 text-[11px] font-semibold underline"
        style={{ color: "#9c8a72" }}
      >
        {showBand ? "집값 범위 접기 ▴" : "집값이 오르내릴 범위 보기 ▾"}
      </button>
    </div>
  );
}

function FlagLabel({
  x,
  y,
  text,
  rightHalf,
  below,
}: {
  x: number;
  y: number;
  text: string;
  rightHalf: boolean;
  below?: boolean;
}) {
  const w = text.length * 8 + 12;
  const fx = rightHalf ? x - w - 8 : x + 8;
  const fy = below ? y + 8 : y - 24;
  return (
    <g>
      <rect x={fx} y={fy} width={w} height={16} rx={8} fill="#fff" stroke="#fe7644" strokeWidth={1} />
      <text x={fx + w / 2} y={fy + 11} fontSize={9} fill="#fe7644" textAnchor="middle" fontWeight={700}>
        {text}
      </text>
    </g>
  );
}
