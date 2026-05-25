import type { PlanResult } from "@/lib/plan";

// "저축 vs 집값 경주" 차트 — 의존성 없는 자체 SVG.
// 핵심: ① 색 온도로 "내 힘(따뜻한 코랄 실선·확정) vs 쫓는 집값(차가운 회색·불확실)"을 분리,
// ② D-day(보합 교차)를 영웅 마커+연도 플래그로, ③ 오늘 기준선·부족액·실 눈금, ④ 도달 후는
// "살 수 있는 구간" 워시. 예측 아님 — 과거 지표 앵커 + 사용자 가정(면책은 호출부).

const COLOR = {
  power: "#f2603c", // 내 구매가능가 (따뜻·확정)
  price: "#8a96a3", // 보합 집값 (차가운 회색)
  band: "#94a3b8", // 불확실 밴드
  reach: "#2fb39a", // 살 수 있는 구간 (민트)
  axis: "#9a8f82",
  grid: "#eee7dd",
};

const W = 400;
const H = 244;
const PAD = { l: 40, r: 14, t: 18, b: 26 };

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

export function PlanRaceChart({ result }: { result: PlanResult }) {
  const { years, affordable, price } = result.curve;
  const horizon = years[years.length - 1] || 1;
  const target = price.flat[0];

  // y 범위는 '내 구매가능가·보합·하락'으로 잡는다. 상승 밴드는 장기에 폭주하므로 제외하고
  // 위로 넘치는 부분은 clip(상한선 위로 잘림 = "더 오를 수도" 시각적 정직).
  const visible = [...affordable, ...price.down, target];
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

  // 불확실 밴드 폴리곤: 상승(위) → 하락(아래, 역순)
  const bandPts =
    years.map((yr, i) => `${X(yr).toFixed(1)},${Y(price.up[i]).toFixed(1)}`).join(" ") +
    " " +
    years
      .map((_, i) => years.length - 1 - i)
      .map((i) => `${X(years[i]).toFixed(1)},${Y(price.down[i]).toFixed(1)}`)
      .join(" ");

  // D-day = 보합 교차
  const flat = result.scenarios.find((s) => s.key === "flat")!;
  const reachable = flat.months !== null && flat.months / 12 <= horizon;
  const crossX = reachable ? X(flat.months! / 12) : null;
  const crossY = reachable ? Y(target) : null;
  const crossYear = reachable
    ? new Date().getFullYear() + Math.round(flat.months! / 12)
    : null;

  // y 눈금(억)
  const step = niceStep(range / 3);
  const yticks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yticks.push(v);

  // x 눈금(년)
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
        {/* y 격자 + 라벨 */}
        {yticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} y1={Y(v)} x2={W - PAD.r} y2={Y(v)} stroke={COLOR.grid} strokeWidth={1} />
            <text x={PAD.l - 4} y={Y(v) + 3} fontSize={9} fill={COLOR.axis} textAnchor="end">
              {eok(v)}
            </text>
          </g>
        ))}

        {/* 살 수 있는 구간 워시 */}
        {reachable && crossX !== null && (
          <>
            <rect x={crossX} y={PAD.t} width={W - PAD.r - crossX} height={plotH} fill={COLOR.reach} opacity={0.09} />
            <text x={W - PAD.r - 3} y={PAD.t + 11} fontSize={9} fill={COLOR.reach} textAnchor="end" fontWeight={600}>
              살 수 있는 구간
            </text>
          </>
        )}

        {/* 불확실 밴드 (상승이 폭주해도 플롯 영역으로 clip) */}
        <g clipPath="url(#planPlotClip)">
          <polygon points={bandPts} fill={COLOR.band} opacity={0.12} />
          <polyline points={poly(price.up)} fill="none" stroke={COLOR.band} strokeWidth={1} strokeDasharray="3 3" opacity={0.65} />
          <polyline points={poly(price.down)} fill="none" stroke={COLOR.band} strokeWidth={1} strokeDasharray="3 3" opacity={0.65} />
          {/* 보합 집값 (기준선) */}
          <polyline points={poly(price.flat)} fill="none" stroke={COLOR.price} strokeWidth={1.8} />
          {/* 내 구매가능가 (영웅) */}
          <polyline points={poly(affordable)} fill="none" stroke={COLOR.power} strokeWidth={2.8} />
        </g>

        {/* 오늘 기준선 + 지금 부족액 */}
        <line x1={X(0)} y1={PAD.t} x2={X(0)} y2={PAD.t + plotH} stroke={COLOR.axis} strokeWidth={1} strokeDasharray="2 2" opacity={0.45} />
        {result.gapKrw > 0 && Math.abs(startY - targetY) > 14 && (
          <>
            <line x1={X(0)} y1={startY} x2={X(0)} y2={targetY} stroke={COLOR.power} strokeWidth={1} opacity={0.4} />
            <text x={X(0) + 3} y={(startY + targetY) / 2 + 3} fontSize={8.5} fill={COLOR.power}>
              지금 −{eok(result.gapKrw)}
            </text>
          </>
        )}

        {/* D-day 영웅 마커 */}
        {reachable && crossX !== null && crossY !== null && (
          <g>
            <circle cx={crossX} cy={crossY} r={9} fill={COLOR.power} opacity={0.18} />
            <circle cx={crossX} cy={crossY} r={5} fill={COLOR.power} stroke="#fff" strokeWidth={2} />
            <FlagLabel
              x={crossX}
              y={crossY}
              text={`${crossYear}년 가능`}
              rightHalf={crossX > PAD.l + plotW / 2}
              below={crossY < PAD.t + 30}
            />
          </g>
        )}

        {/* 희망없음: 거짓 교차 대신 '계속 좁혀가는 중' */}
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

        {/* x 눈금 */}
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

      {/* 범례 */}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <Legend color={COLOR.power} label="내 구매가능가" bold />
        <Legend color={COLOR.price} label="집값(보합 가정)" />
        <Legend color={COLOR.band} label="집값 추정 범위" dashed />
      </div>
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
      <rect x={fx} y={fy} width={w} height={16} rx={8} fill="#fff" stroke="#f2603c" strokeWidth={1} />
      <text x={fx + w / 2} y={fy + 11} fontSize={9} fill="#f2603c" textAnchor="middle" fontWeight={700}>
        {text}
      </text>
    </g>
  );
}

function Legend({
  color,
  label,
  bold,
  dashed,
}: {
  color: string;
  label: string;
  bold?: boolean;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "#6b6157" }}>
      <span
        className="inline-block"
        style={{
          width: 12,
          height: bold ? 4 : 3,
          borderRadius: 2,
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`
            : color,
        }}
      />
      <span className={bold ? "font-semibold" : ""}>{label}</span>
    </span>
  );
}
