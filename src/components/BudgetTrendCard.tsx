"use client";

import { tierOf, tierTrend } from "@/lib/recommend/trendIndex";

// "내 예산대 시세 흐름" — 사용자 구매력 가격대(low/mid/high)의 최근 3개월 실거래 추세를
// 이미 구운 trendIndex(시군구×가격대×월 반복매매 지수)에서 읽어 보여준다. 신규 비용 0.
// 재방문 훅: "매주 갱신 — 또 확인해보세요". 데이터 없으면(추세 산출 불가) 조용히 숨음.
// 컴플라이언스: 과거 실거래 지수 변동(사실)일 뿐 미래가치 예측·투자권유 아님. 매수자 관점이라
// 상승=호재식 색(초록)을 쓰지 않고 중립 톤으로 사실만 전달한다.

const BRACKET_LABEL: Record<string, string> = {
  low: "10억 미만",
  mid: "10~30억",
  high: "30억 이상",
};

export function BudgetTrendCard({
  netPurchasePowerKrw,
  sigungu,
}: {
  netPurchasePowerKrw: number;
  sigungu?: string;
}) {
  if (!netPurchasePowerKrw || netPurchasePowerKrw <= 0) return null;
  const tier = tierOf(netPurchasePowerKrw);
  const trend = tierTrend(sigungu ?? "", tier, 3);
  if (!trend) return null;

  const pct = trend.changeRatio * 100;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const arrow = flat ? "–" : up ? "▲" : "▼";
  const word = flat ? "보합" : up ? "상승세" : "하락세";

  return (
    <section
      className="rounded-2xl bg-white p-4"
      style={{
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.08)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-bold" style={{ color: "#191713" }}>
          📊 내 예산대 시세 흐름
        </p>
        <p className="text-[11px]" style={{ color: "#8a857a" }}>
          매주 갱신
        </p>
      </div>
      <p className="mt-2 text-[14px]" style={{ color: "#191713" }}>
        {trend.scope} · {BRACKET_LABEL[tier]} 실거래 · 최근 3개월{" "}
        <span className="font-extrabold" style={{ color: "#e8571f" }}>
          {arrow} {Math.abs(pct).toFixed(1)}% {word}
        </span>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#8a857a" }}>
        과거 실거래 추세 · 미래 예측 아님 · 다음에 또 보자~
      </p>
    </section>
  );
}
