"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Props {
  /** Recent transaction prices in 원, for histogram. */
  pricesKrw: number[];
  /** The user's asking price in 원, marked on the histogram. */
  askPriceKrw: number;
  /** Median for reference line, in 원. */
  medianKrw: number;
}

/** Format a 원 value as "X.X억" for axis ticks and tooltips. */
function toEok(won: number): string {
  return `${(won / 100_000_000).toFixed(1)}억`;
}

interface Bin {
  /** Lower bound of bucket (원) — used as bar category key. */
  from: number;
  /** Label shown on x-axis. */
  label: string;
  count: number;
}

function buildBins(prices: number[], bucketCount: number): Bin[] {
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  // Avoid divide-by-zero when all prices are identical.
  const range = max - min || 1;
  const step = range / bucketCount;

  const bins: Bin[] = Array.from({ length: bucketCount }, (_, i) => ({
    from: min + i * step,
    label: toEok(min + i * step),
    count: 0,
  }));

  for (const price of prices) {
    // Last bucket is inclusive on the right edge.
    const idx = Math.min(
      Math.floor((price - min) / step),
      bucketCount - 1
    );
    bins[idx].count += 1;
  }

  return bins;
}

/** Find the bin whose `from` value is closest to a reference price. */
function nearestBinFrom(bins: Bin[], priceKrw: number): number {
  return bins.reduce((best, bin) =>
    Math.abs(bin.from - priceKrw) < Math.abs(best.from - priceKrw) ? bin : best
  ).from;
}

export function PriceDistribution({
  pricesKrw,
  askPriceKrw,
  medianKrw,
}: Props) {
  if (pricesKrw.length < 3) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 h-40 text-sm text-gray-400">
        비교 거래 표본이 부족합니다 (3건 미만)
      </div>
    );
  }

  const BUCKET_COUNT = 10;
  const bins = buildBins(pricesKrw, BUCKET_COUNT);

  const askRef = nearestBinFrom(bins, askPriceKrw);
  const medianRef = nearestBinFrom(bins, medianKrw);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <h2 className="text-base font-semibold text-gray-800 mb-3">
        실거래가 분포
      </h2>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-rose-500" />
          호가 ({toEok(askPriceKrw)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-sky-500" />
          중위가 ({toEok(medianKrw)})
        </span>
      </div>

      {/*
        ResponsiveContainer height changes with breakpoint via class.
        Recharts reads the container's rendered pixel height, so we wrap
        in a div whose height changes — Tailwind md: variant does the job.
      */}
      <div className="h-60 md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bins}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

            <XAxis
              dataKey="from"
              tickFormatter={toEok}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              // Show only first and last tick to avoid crowding on mobile.
              interval="preserveStartEnd"
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              width={28}
            />

            <Tooltip
              formatter={(value: number) => [`${value}건`, "거래 수"]}
              labelFormatter={(from: number) => toEok(from)}
              contentStyle={{ fontSize: 12 }}
            />

            <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />

            <ReferenceLine
              x={askRef}
              stroke="#f43f5e"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{ value: "호가", position: "top", fontSize: 10, fill: "#f43f5e" }}
            />

            <ReferenceLine
              x={medianRef}
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{ value: "중위", position: "top", fontSize: 10, fill: "#0ea5e9" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
