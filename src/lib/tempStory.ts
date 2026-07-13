// 온도 이야기 — 온도 시계열에서 "비교 앵커" 팩트를 파생한다 (2026-07-12 사장 지시:
// "누구나 아는 '22년말 최대 하락기 % 같은 걸 보여서 지금이 어디쯤인지 읽게").
//
// 편집 헌장: 예측·판정("상승기 초입입니다") 금지 — 관측값을 나란히 놓기만 한다.
// 결론은 독자의 몫. 모든 수치에 기준(기간·계약월) 병기.
//
// 소비: 1면 온도 차트(최저점 마커 + 비교 한 줄), /s/temp 공유 카드.
// 순수 함수 — API·파일 접근 없음.

import { REFERENCE_PHASES, phaseAvg, type TempSeriesFile } from "@/lib/tempSeries";

/** 최저점 마커·비교줄에 쓰려면 그 달 표본이 최소 이만큼은 있어야 한다(얇은 달 이상치 방지). */
export const TEMP_STORY_MIN_MATCHED = 30;

export interface TempStory {
  /** 시계열 최저점 — "누구나 아는 그 하락기 바닥". 표본 미달 달은 후보에서 제외. */
  min: { ym: string; pct: number } | null;
  /** 폭등기('20.11~'21.10) 관측 평균 above%(0~100). 관측 부족이면 null. */
  boomAvg: number | null;
  /** 급락기('22) 관측 평균. */
  slumpAvg: number | null;
  /** 오늘 공개분 above%(0~100). */
  todayPct: number;
}

/** 시계열 최저점(표본 TEMP_STORY_MIN_MATCHED 이상 달만) — 동네면 코너가 오늘 온도 없이도
 *  마커를 쓸 수 있게 분리 노출(2026-07-13 동네별 시계열 확장). */
export function seriesMin(series: TempSeriesFile): { ym: string; pct: number } | null {
  let min: { ym: string; pct: number } | null = null;
  for (let i = 0; i < series.months.length; i++) {
    if (!(series.matched[i] >= TEMP_STORY_MIN_MATCHED)) continue;
    const pct = (series.above[i] / series.matched[i]) * 100;
    if (!min || pct < min.pct) min = { ym: series.months[i], pct };
  }
  return min;
}

/** 시계열 + 오늘 온도 → 비교 앵커 묶음. 시리즈가 placeholder면 null. */
export function tempStory(
  series: TempSeriesFile,
  today: { above: number; matched: number } | null,
): TempStory | null {
  if (!series.generatedAt || series.months.length < 2 || !today || today.matched <= 0)
    return null;
  const min = seriesMin(series);
  const boom = REFERENCE_PHASES.find((p) => p.key === "boom");
  const slump = REFERENCE_PHASES.find((p) => p.key === "slump");
  return {
    min,
    boomAvg: boom ? phaseAvg(series, boom) : null,
    slumpAvg: slump ? phaseAvg(series, slump) : null,
    todayPct: (today.above / today.matched) * 100,
  };
}

/** "2022-12" → "'22.12". */
export function ymApos(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `'${m[1].slice(2)}.${Number(m[2])}` : ym;
}

/** 비교 한 줄(팩트만·판정 없음) — 예: "오늘 47% — 급락기('22) 평균 40%보다 +7%p ·
 *  폭등기('20.11~'21.10) 평균 47%와 같음 · 최저는 '22.12 32%". 재료 없으면 null. */
export function tempStoryLine(s: TempStory): string | null {
  const today = Math.round(s.todayPct);
  const parts: string[] = [];
  if (s.slumpAvg !== null) {
    const diff = today - Math.round(s.slumpAvg);
    parts.push(
      `급락기('22) 평균 ${Math.round(s.slumpAvg)}%${diff === 0 ? "와 같음" : `보다 ${diff > 0 ? "+" : "−"}${Math.abs(diff)}%p`}`,
    );
  }
  if (s.boomAvg !== null) {
    const diff = today - Math.round(s.boomAvg);
    parts.push(
      `폭등기('20.11~'21.10) 평균 ${Math.round(s.boomAvg)}%${diff === 0 ? "와 같음" : `보다 ${diff > 0 ? "+" : "−"}${Math.abs(diff)}%p`}`,
    );
  }
  if (s.min) parts.push(`최저는 ${ymApos(s.min.ym)} ${Math.round(s.min.pct)}%`);
  if (parts.length === 0) return null;
  return `오늘 ${today}% — ${parts.join(" · ")}`;
}
