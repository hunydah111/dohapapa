import type { PlanResult, ScenarioKey } from "@/lib/plan";

// "저축 vs 집값 경주" 차트 — 의존성 없는 자체 SVG.
// 내 구매가능가(확정 실선) vs 집값 3색 밴드(하락/보합/상승, 불확실).
// 예측 아님 — 과거 지표 앵커 + 사용자 가정의 시나리오. (면책은 호출부에서)

const COLOR: Record<ScenarioKey | "afford", string> = {
  afford: "#f2603c", // 코랄 — 내 구매가능가
  up: "#e0682f", // 상승
  flat: "#b9a98f", // 보합
  down: "#4CB07A", // 하락
};

const W = 400;
const H = 230;
const PAD = { l: 12, r: 12, t: 14, b: 22 };

function eok(krw: number): string {
  return (krw / 1e8).toFixed(1) + "억";
}

export function PlanRaceChart({ result }: { result: PlanResult }) {
  const { years, affordable, price } = result.curve;
  const horizon = years[years.length - 1] || 1;

  const all = [...affordable, ...price.up, ...price.down, ...price.flat];
  const yMin = Math.min(...all);
  const yMax = Math.max(...all);
  const range = yMax - yMin || 1;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const x = (yr: number) => PAD.l + (yr / horizon) * plotW;
  const y = (v: number) => PAD.t + plotH - ((v - yMin) / range) * plotH;

  const line = (s: number[]) =>
    years.map((yr, i) => `${x(yr).toFixed(1)},${y(s[i]).toFixed(1)}`).join(" ");

  // 하락~상승 사이 불확실 밴드(폴리곤)
  const band =
    years.map((yr, i) => `${x(yr).toFixed(1)},${y(price.up[i]).toFixed(1)}`).join(" ") +
    " " +
    [...years]
      .reverse()
      .map((yr) => {
        const i = years.indexOf(yr);
        return `${x(yr).toFixed(1)},${y(price.down[i]).toFixed(1)}`;
      })
      .join(" ");

  // 교차 지점 마커
  const dots = result.scenarios
    .filter((s) => s.months !== null && s.months / 12 <= horizon)
    .map((s) => {
      const t = s.months! / 12;
      const v = result.curve.price.flat[0] * Math.pow(1 + s.rateAnnual, t);
      return { key: s.key, cx: x(t), cy: y(v) };
    });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="저축 대비 집값 경주 차트"
        style={{ display: "block" }}
      >
        {/* 불확실 밴드 */}
        <polygon points={band} fill={COLOR.up} opacity={0.08} />
        {/* 집값 시나리오 */}
        <polyline points={line(price.down)} fill="none" stroke={COLOR.down} strokeWidth={1.5} />
        <polyline
          points={line(price.flat)}
          fill="none"
          stroke={COLOR.flat}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <polyline points={line(price.up)} fill="none" stroke={COLOR.up} strokeWidth={1.5} />
        {/* 내 구매가능가 — 확정 실선(굵게) */}
        <polyline points={line(affordable)} fill="none" stroke={COLOR.afford} strokeWidth={2.6} />
        {/* 교차 마커 */}
        {dots.map((d) => (
          <g key={d.key}>
            <circle cx={d.cx} cy={d.cy} r={4.5} fill="#fff" stroke={COLOR[d.key]} strokeWidth={2} />
          </g>
        ))}
        {/* x축 라벨 */}
        <text x={PAD.l} y={H - 6} fontSize={10} fill="#9a8f82">
          0년
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize={10} fill="#9a8f82" textAnchor="end">
          {horizon}년
        </text>
        {/* y축 끝값(억) */}
        <text x={PAD.l} y={PAD.t - 3} fontSize={10} fill="#9a8f82">
          {eok(yMax)}
        </text>
      </svg>

      {/* 범례 */}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <Legend color={COLOR.afford} label="내 구매가능가" bold />
        <Legend color={COLOR.up} label="상승" />
        <Legend color={COLOR.flat} label="보합" />
        <Legend color={COLOR.down} label="하락" />
      </div>
    </div>
  );
}

function Legend({ color, label, bold }: { color: string; label: string; bold?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "#6b6157" }}>
      <span
        className="inline-block rounded-full"
        style={{ width: 10, height: bold ? 4 : 3, background: color }}
      />
      <span className={bold ? "font-semibold" : ""}>{label}</span>
    </span>
  );
}
