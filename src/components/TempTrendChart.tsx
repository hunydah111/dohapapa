// 온도 추이 차트(최대 약 6년, '20.9~) — 시안 B 축 차트, 서버 SVG · 라이브러리 0.
// 1면(DailyFront)과 온도 공유 착지(/s/temp)가 공용(2026-07-13 — 카드엔 차트가 있는데
// 착지 페이지엔 없던 역전 해소). DailyFront 파일 프라이빗이던 것을 그대로 추출.
//
// 월별 above/matched 비율 곡선 + 50% 중립 점선 + 오늘 점(빨강) + 국면 참조선(관측 평균)
// + 시계열 최저점 마커. 계약월 기준. x축 눈금은 데이터 길이에 적응 — 3년 이상이면 연
// 단위('25), 미만이면 3분위 월('25.7). 그릴 점이 2개 미만(표본 전무)이면 null.

import { REFERENCE_PHASES, phaseAvg, type TempSeriesFile } from "@/lib/tempSeries";
import { PAPER, INK, INK_SOFT, RULE, UP, DOWN } from "@/lib/paperTone";

/** "2022-10" → "'22.10" — 최저점 라벨 병기(기준월 의무). */
function ymApos(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `'${m[1].slice(2)}.${Number(m[2])}` : ym;
}

export function TempTrendChart({
  series,
  todayAbovePct,
  mergedNote,
  minMark,
}: {
  series: TempSeriesFile;
  /** 오늘 공개분 온도(%) — null이면(동네면에서 그날 그 동네 매칭 0건 등) 오늘 점·라벨 생략. */
  todayAbovePct: number | null;
  mergedNote: string;
  /** 시계열 최저점 마커(tempStory.min) — "누구나 아는 그 하락기 바닥" 앵커(2026-07-12 사장). */
  minMark?: { ym: string; pct: number } | null;
}) {
  const n = series.months.length;
  if (!series.generatedAt || n < 2) return null;
  const X0 = 26;
  const X1 = 356;
  const TODAY_X = 384;
  const xOf = (i: number) => X0 + (i * (X1 - X0)) / (n - 1);
  // 동적 y축 — 온도는 35~65% 사이에서 노는 지표라 0~100 고정축이면 변화가 안 보인다
  // (2026-07-06 사장 지시). 데이터 범위 ±4pp, 5 단위 스냅, 50% 균형선은 항상 도메인 안에.
  const pctVals: number[] = [];
  for (let i = 0; i < n; i++) {
    if (series.matched[i] > 0) pctVals.push((series.above[i] / series.matched[i]) * 100);
  }
  if (pctVals.length < 2) return null;
  if (todayAbovePct !== null) pctVals.push(todayAbovePct);
  // 국면 참조 척도(v2.4 사장 지시) — 임의 임계("불장=60%") 단정 금지, 역사적 관측 평균만.
  // phaseAvg는 구간 월 6개 이상 관측 시에만 값 — 소급 백필이 차면 참조선이 자동 등장.
  const phaseLines = REFERENCE_PHASES.flatMap((phase) => {
    const avg = phaseAvg(series, phase);
    return avg === null ? [] : [{ phase, avg }];
  });
  for (const pl of phaseLines) pctVals.push(pl.avg); // 도메인이 참조선을 포함하도록
  const yMin = Math.min(45, Math.max(0, Math.floor((Math.min(...pctVals) - 4) / 5) * 5));
  const yMax = Math.max(55, Math.min(100, Math.ceil((Math.max(...pctVals) + 4) / 5) * 5));
  const yOf = (p: number) => 68 - ((p - yMin) / (yMax - yMin)) * 60;
  const yMid = yOf(50);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (!(series.matched[i] > 0)) continue; // 표본 0 달은 선에서 제외
    pts.push({ x: xOf(i), y: yOf((series.above[i] / series.matched[i]) * 100) });
  }
  if (pts.length < 2) return null;
  const todayY = todayAbovePct !== null ? yOf(todayAbovePct) : null;
  // "오늘 nn%" 라벨 기준선 y — 국면 참조선 라벨의 충돌 회피 판정에도 쓴다(오늘 없으면 화면 밖).
  const todayLabelY = todayY !== null ? (todayY >= 52 ? todayY - 7 : todayY + 13) : -99;
  const line = [...pts, ...(todayY !== null ? [{ x: TODAY_X, y: todayY }] : [])]
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  // x축 눈금 — 연 단위(1월 달) 또는 3분위. "오늘" 라벨(x=370)과 안 겹치는 범위.
  const ticks: { x: number; label: string }[] = [];
  if (n >= 36) {
    for (let i = 0; i < n; i++) {
      if (series.months[i].endsWith("-01"))
        ticks.push({ x: xOf(i), label: `'${series.months[i].slice(2, 4)}` });
    }
  } else {
    // 중복 인덱스 제거 — n이 아주 작으면(2~3) 3분위가 겹친다.
    for (const i of [...new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3)])]) {
      const ym = series.months[i];
      ticks.push({ x: xOf(i), label: `'${ym.slice(2, 4)}.${Number(ym.slice(5, 7))}` });
    }
  }
  // 짧은 구간(소급 수집 전) 안내 — 백필이 채워지면 자동으로 사라진다.
  const shortWindow = n <= 13;
  // 국면 참조선이 하나도 없으면(백필 전) 시리즈 자체 요약 한 줄을 캡션에 병기.
  let seriesSummary: string | null = null;
  if (phaseLines.length === 0) {
    let aSum = 0;
    let mSum = 0;
    let maxP = -Infinity;
    let minP = Infinity;
    let maxYm = "";
    let minYm = "";
    for (let i = 0; i < n; i++) {
      if (!(series.matched[i] > 0)) continue;
      const p = (series.above[i] / series.matched[i]) * 100;
      aSum += series.above[i];
      mSum += series.matched[i];
      if (p > maxP) {
        maxP = p;
        maxYm = series.months[i];
      }
      if (p < minP) {
        minP = p;
        minYm = series.months[i];
      }
    }
    if (mSum > 0) {
      const f = (ym: string) => `'${ym.slice(2, 4)}.${Number(ym.slice(5, 7))}`;
      seriesSummary = `최근 ${n}개월 — 평균 ${Math.round((aSum / mSum) * 100)}% · 최고 ${Math.round(maxP)}%(${f(maxYm)}) · 최저 ${Math.round(minP)}%(${f(minYm)})`;
    }
  }
  return (
    <div className="mt-2">
      <svg
        viewBox="0 0 396 76"
        className="block h-auto w-full"
        role="img"
        aria-label={`온도 추이 — 직전 거래보다 높게 팔린 비율(계약월 기준, ${series.months[0]}~). ${todayAbovePct !== null ? `오늘 ${todayAbovePct}%` : ""}`}
      >
        <text x="0" y="12" fontSize="8.5" fill={INK_SOFT}>{yMax}%</text>
        <text x="7" y={(yMid + 3).toFixed(1)} fontSize="8.5" fill={INK_SOFT}>50</text>
        <text x="7" y="70" fontSize="8.5" fill={INK_SOFT}>{yMin}</text>
        <line x1={X0} y1="8" x2="392" y2="8" stroke="#eee8da" strokeWidth="1" />
        {/* 50% 균형 점선 — 동적 도메인 안에서 위치 계산 */}
        <line x1={X0} y1={yMid.toFixed(1)} x2="392" y2={yMid.toFixed(1)} stroke={RULE} strokeWidth="1" strokeDasharray="3 3" />
        <line x1={X0} y1="68" x2="392" y2="68" stroke={RULE} strokeWidth="1" />
        {/* 국면 참조선 — 해당 기간 관측 평균(임의 기준 아님). "오늘" 라벨과 겹치면 좌측 배치.
            참조선끼리 가까우면(동네 시계열에서 흔함) 앞 라벨과 반대편으로 갈라 앉힌다. */}
        {(() => {
          const sorted = [...phaseLines].sort((a, b) => yOf(a.avg) - yOf(b.avg));
          let prevY: number | null = null;
          let prevLeft = false;
          return sorted.map(({ phase, avg }) => {
            const y = yOf(avg);
            const color = phase.tone === "up" ? UP : DOWN;
            const todayClash = Math.abs(y - todayLabelY) < 11;
            const phaseClash = prevY !== null && Math.abs(y - prevY) < 11;
            const clash = todayClash || (phaseClash && !prevLeft);
            prevY = y;
            prevLeft = clash;
            return (
            <g key={phase.key}>
              <line
                x1={X0}
                y1={y.toFixed(1)}
                x2="392"
                y2={y.toFixed(1)}
                stroke={color}
                strokeOpacity="0.3"
                strokeWidth="1.3"
                strokeDasharray="5 3"
              />
              {/* 종이색 halo(paintOrder stroke) — 점선·본선 위에서도 라벨이 묻히지 않게. */}
              <text
                x={clash ? X0 + 3 : 356}
                y={(y - 2.5).toFixed(1)}
                textAnchor={clash ? "start" : "end"}
                fontSize="8"
                fontWeight="700"
                fill={color}
                stroke={PAPER}
                strokeWidth="2.6"
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {phase.label.split("(")[0]} 평균 {Math.round(avg)}%
              </text>
            </g>
            );
          });
        })()}
        <polyline fill="none" stroke={INK} strokeWidth="1.8" points={line} />
        {/* 시계열 최저점 마커 — 하락기 바닥 앵커(관측값). 라벨은 점 아래(바닥 근처면 위). */}
        {minMark &&
          (() => {
            const mi = series.months.indexOf(minMark.ym);
            if (mi < 0) return null;
            const mx = xOf(mi);
            const my = yOf(minMark.pct);
            const labelAbove = my > 58;
            return (
              <g>
                <circle cx={mx.toFixed(1)} cy={my.toFixed(1)} r="3.2" fill={DOWN} />
                <text
                  x={Math.min(Math.max(mx, 30), 320).toFixed(1)}
                  y={(labelAbove ? my - 6 : my + 12).toFixed(1)}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={DOWN}
                  stroke={PAPER}
                  strokeWidth="2.6"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  최저 {Math.round(minMark.pct)}% ({ymApos(minMark.ym)})
                </text>
              </g>
            );
          })()}
        {/* 오늘 점 (공개 기준) — 오늘 온도가 없으면(동네 표본 0) 생략 */}
        {todayY !== null && (
          <circle cx={TODAY_X} cy={todayY.toFixed(1)} r="3.4" fill={UP} />
        )}
        {todayY !== null && (
          <text
            x="378"
            y={todayLabelY.toFixed(1)}
            textAnchor="end"
            fontSize="9"
            fontWeight="700"
            fill={UP}
            stroke={PAPER}
            strokeWidth="2.6"
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            오늘 {todayAbovePct}%
          </text>
        )}
        {ticks.map((t) => (
          <text key={t.label} x={t.x.toFixed(1)} y="76" fontSize="8.5" fill={INK_SOFT}>
            {t.label}
          </text>
        ))}
        {todayY !== null && (
          <text x="370" y="76" fontSize="8.5" fill={INK_SOFT}>오늘</text>
        )}
      </svg>
      <p className="m-0 mt-1 text-[10px] leading-[1.5]" style={{ color: INK_SOFT }}>
        온도 추이 — 직전 거래보다 높게 팔린 비율. 점선 = 50% 균형선 · 선 = 계약월 기준
        {todayAbovePct !== null && " · 붉은 점 = 오늘 공개분"}
        {phaseLines.length > 0 && " · 참조선 = 해당 기간 관측 평균(임의 기준 아님)"}
        {shortWindow && " · 국토부 수집 구간 기준 — 소급 수집 중"}
        {mergedNote}.
        {seriesSummary && (
          <>
            <br />
            {seriesSummary}
          </>
        )}
      </p>
    </div>
  );
}
