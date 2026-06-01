// 라이브 펄스 — "이 사이트 살아있다·매일 갱신된다"를 증명하는 신선도 신호. 번들 JSON만(DB0·API0).
// 하이브리드: dailyPulse(매일 실거래 확인) + rebWeekly(R-ONE 주간 시세) + dataMeta/leagueTable(주간 시세 재계산).
// 정직성: '오늘 확인'은 최근 거래월 신고분 폴링이고, 전체 시세 재계산은 주간 — 표기에서 섞지 않는다.

import dataMeta from "@/data/dataMeta.json";
import table from "@/data/leagueTable.json";
import dailyRaw from "@/data/dailyPulse.json";
import weekly from "@/data/rebWeekly.json";

const daily = dailyRaw as {
  checkedAt: string;
  windowFromMonth: string;
  windowToMonth: string;
  latestDealDate: string | null;
  recentCount: number;
  newSincePrev: number | null;
  guCount: number;
};

export interface PulseFact {
  icon: string;
  label: string;
  value: string;
}

export interface LivePulseData {
  /** 오늘 실거래를 확인한 날 "2026.6.2"(daily 폴링일). */
  checkedDate: string;
  /** 폴링한 거래월 창 "2026.4~2026.6". */
  windowLabel: string;
  /** 회전 티커용 살아있는 팩트. */
  facts: PulseFact[];
}

const dot = (d: string): string => {
  const [y, m, day] = (d ?? "").split("-");
  return day ? `${y}.${Number(m)}.${Number(day)}` : m ? `${y}.${Number(m)}` : d;
};

export function getLivePulse(): LivePulseData {
  const regions = table.regions;
  const mom = regions.find((r) => r.ranks.momentum === 1);
  const complexSum = regions.reduce((s, r) => s + r.complexCount, 0);
  const cap = (weekly.regions as Record<string, { changePct: number }>)["수도권"];

  const facts: PulseFact[] = [];

  // 오늘 확인 — 최근 거래월 신고분(신규 있으면 강조)
  if (daily.newSincePrev != null && daily.newSincePrev > 0) {
    facts.push({ icon: "🆕", label: "오늘 새로 반영", value: `실거래 +${daily.newSincePrev.toLocaleString()}건` });
  } else {
    facts.push({ icon: "📅", label: "오늘 확인", value: `거래월 ${dot(daily.windowFromMonth)}~${dot(daily.windowToMonth)} 신고분` });
  }
  // R-ONE 주간 시세(공식)
  if (cap) {
    facts.push({ icon: "📈", label: "R-ONE 주간 수도권", value: `${cap.changePct >= 0 ? "+" : ""}${cap.changePct}%` });
  }
  // 누적 실거래
  facts.push({ icon: "📊", label: "누적 실거래", value: `${dataMeta.txCount.toLocaleString()}건` });
  // 이 달 최고 상승 동네
  if (mom) facts.push({ icon: "🔥", label: "이 달 최고 상승", value: `${mom.sigungu} +${mom.momentumPct}%` });
  // 수록 단지
  facts.push({ icon: "🏠", label: "수록 단지", value: `${complexSum.toLocaleString()}곳` });

  return {
    checkedDate: dot(daily.checkedAt),
    windowLabel: `${dot(daily.windowFromMonth)}~${dot(daily.windowToMonth)}`,
    facts,
  };
}
