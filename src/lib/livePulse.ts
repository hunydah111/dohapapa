// 라이브 펄스 — "이 사이트 살아있다"를 증명하는 신선도 신호. 번들 JSON만 읽음(DB0·API0).
// dataMeta(주간 크론 갱신) + leagueTable(주간 크론 갱신)에서 매주 바뀌는 값만 뽑아 회전 티커로.
// 모든 값이 weekly-data-refresh 크론으로 자동 갱신되므로, 방치해도 매주 새 숫자가 흐른다.

import dataMeta from "@/data/dataMeta.json";
import table from "@/data/leagueTable.json";

export interface PulseFact {
  icon: string;
  label: string;
  value: string;
}

export interface LivePulseData {
  /** 최신 실거래 반영일 "2026.5.29". */
  freshDate: string;
  /** 리그 기준월 "2026.5". */
  asOfLabel: string;
  /** 회전 티커용 살아있는 팩트(전부 주간 갱신). */
  facts: PulseFact[];
}

const fmtDate = (d: string): string => {
  const [y, m, day] = d.split("-");
  return day ? `${y}.${Number(m)}.${Number(day)}` : `${y}.${Number(m)}`;
};

export function getLivePulse(): LivePulseData {
  const regions = table.regions;
  const mom = regions.find((r) => r.ranks.momentum === 1);
  const tr = regions.find((r) => r.ranks.trades === 1);
  const complexSum = regions.reduce((s, r) => s + r.complexCount, 0);

  const facts: PulseFact[] = [
    { icon: "📊", label: "누적 실거래", value: `${dataMeta.txCount.toLocaleString()}건` },
    ...(mom ? [{ icon: "🔥", label: "이 달 최고 상승", value: `${mom.sigungu} +${mom.momentumPct}%` }] : []),
    ...(tr ? [{ icon: "📈", label: "거래 가장 활발", value: `${tr.sigungu} ${tr.trades.toLocaleString()}건` }] : []),
    { icon: "🏠", label: "수록 단지", value: `${complexSum.toLocaleString()}곳` },
  ];

  const [y, m] = (table.asOf ?? "").split("-");
  return {
    freshDate: fmtDate(dataMeta.latestDealDate),
    asOfLabel: m ? `${y}.${Number(m)}` : "",
    facts,
  };
}
