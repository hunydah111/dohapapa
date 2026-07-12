// 온도 이야기(tempStory) — 최저점·국면 평균 비교 앵커 테스트 (2026-07-12 사장 지시).
import { describe, expect, it } from "vitest";
import { tempStory, tempStoryLine, TEMP_STORY_MIN_MATCHED } from "@/lib/tempStory";
import type { TempSeriesFile } from "@/lib/tempSeries";

/** 폭등기('20.11~'21.10)·급락기('22)를 각각 6개월 이상 관측시킨 시리즈 스텁. */
function makeSeries(): TempSeriesFile {
  const months: string[] = [];
  const above: number[] = [];
  const below: number[] = [];
  const matched: number[] = [];
  const push = (ym: string, abovePct: number, m = 100) => {
    months.push(ym);
    above.push(Math.round((abovePct / 100) * m));
    below.push(0);
    matched.push(m);
  };
  // 폭등기 6개월 — 평균 55%.
  for (let i = 5; i <= 10; i++) push(`2021-${String(i).padStart(2, "0")}`, 55);
  // 급락기 6개월 — 평균 40%, 그중 '22.12가 최저 32%.
  for (let i = 7; i <= 11; i++) push(`2022-${String(i).padStart(2, "0")}`, 41.6);
  push("2022-12", 32);
  // 최근 — 47%. 표본 미달(29건) 달은 최저 후보에서 제외돼야 한다.
  push("2026-05", 10, TEMP_STORY_MIN_MATCHED - 1); // 10%지만 표본 미달 — 무시
  push("2026-06", 47);
  return { generatedAt: "2026-07-12", months, above, below, matched };
}

describe("tempStory — 비교 앵커", () => {
  it("최저점(표본 충족 달만)·국면 평균·오늘%를 파생한다", () => {
    const s = tempStory(makeSeries(), { above: 47, matched: 100 })!;
    expect(s.min).toEqual({ ym: "2022-12", pct: 32 });
    expect(Math.round(s.boomAvg!)).toBe(55);
    expect(Math.round(s.slumpAvg!)).toBe(40);
    expect(Math.round(s.todayPct)).toBe(47);
  });

  it("placeholder·오늘 표본 0이면 null", () => {
    expect(tempStory({ generatedAt: null, months: [], above: [], below: [], matched: [] }, { above: 1, matched: 2 })).toBeNull();
    expect(tempStory(makeSeries(), null)).toBeNull();
    expect(tempStory(makeSeries(), { above: 0, matched: 0 })).toBeNull();
  });

  it("비교 한 줄 — 판정 없이 관측값 나란히", () => {
    const line = tempStoryLine(tempStory(makeSeries(), { above: 47, matched: 100 })!)!;
    expect(line).toBe(
      "오늘 47% — 급락기('22) 평균 40%보다 +7%p · 폭등기('20.11~'21.10) 평균 55%보다 −8%p · 최저는 '22.12 32%",
    );
    // 판정·예측 어휘 금지 검증.
    for (const banned of ["초입", "불장", "상승기입니다", "하락장"]) {
      expect(line).not.toContain(banned);
    }
  });
});
