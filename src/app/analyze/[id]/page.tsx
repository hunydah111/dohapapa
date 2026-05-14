import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ScoreCard } from "@/components/ScoreCard";
import { SignalBreakdown } from "@/components/SignalBreakdown";
import { PriceDistribution } from "@/components/PriceDistribution";
import type { ScoreResult, SignalKey } from "@/types/listing";

// Next.js 15: params is a Promise
type PageProps = { params: Promise<{ id: string }> };

function formatEok(krw: bigint): string {
  const eok = Number(krw) / 1_0000_0000;
  return `${eok.toFixed(1)}억`;
}

// Compute median of an array of numbers (sorted in place)
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export default async function AnalyzePage({ params }: PageProps) {
  const { id } = await params;

  const listing = await db.listing.findUnique({
    where: { id },
    include: { score: true, complex: true },
  });

  if (!listing) notFound();

  // score may be absent if the pipeline hasn't finished yet
  if (!listing.score) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          아직 분석이 완료되지 않았습니다. 잠시 후 새로고침해 주세요.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-zinc-500 underline"
        >
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  // Parse JSON columns stored as strings in SQLite
  const signals = JSON.parse(listing.score.signals) as Record<SignalKey, number>;
  const reasoning = JSON.parse(listing.score.reasoning) as Record<SignalKey, string>;

  const scoreResult: ScoreResult = {
    total: listing.score.total,
    band: listing.score.band as "green" | "yellow" | "red",
    signals,
    reasoning,
  };

  // Fetch recent comparable transactions (±3㎡ same complex, latest 50)
  const transactions = await db.transaction.findMany({
    where: {
      complexId: listing.complexId,
      area: { gte: listing.area - 3, lte: listing.area + 3 },
    },
    orderBy: { dealDate: "desc" },
    take: 50,
  });

  // Convert BigInt prices to plain numbers for chart (safe at 원 scale ≤ ~100억)
  const pricesKrw = transactions.map((t) => Number(t.priceKrw));
  const askPriceKrw = Number(listing.askPriceKrw);
  const medianKrw = median(pricesKrw);

  return (
    <main className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      {/* ── 헤더 ── */}
      <section className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
          >
            ← 목록으로
          </Link>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {listing.complex.name}
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            전용 {listing.area}㎡
            {listing.floor != null ? ` · ${listing.floor}층` : ""}
            {" · "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {formatEok(listing.askPriceKrw)}
            </span>
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {listing.complex.sigungu} {listing.complex.dongName}
          </p>
        </div>
      </section>

      {/* ── 점수 카드 & 신호 분석 ── */}
      <div className="mx-auto w-full max-w-2xl px-4 py-10 space-y-8">
        <ScoreCard score={scoreResult} />
        <SignalBreakdown score={scoreResult} />

        {/* ── 최근 거래 분포 ── */}
        {pricesKrw.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              최근 거래 분포
            </h2>
            <PriceDistribution
              pricesKrw={pricesKrw}
              askPriceKrw={askPriceKrw}
              medianKrw={medianKrw}
            />
          </section>
        )}

        {/* ── 허위매물 제보 ── */}
        <section className="rounded-xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              이 매물이 허위라고 판단되나요?
            </p>
            <p className="text-sm text-zinc-400 mt-0.5">
              제보 기능은 곧 제공될 예정입니다.
            </p>
          </div>
          {/* 제보 폼 UI는 추후 연결 — 현재는 stub 버튼 */}
          <button
            disabled
            className="rounded-lg bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 px-4 py-2 text-sm font-semibold cursor-not-allowed opacity-60"
          >
            허위매물 제보
          </button>
        </section>
      </div>
    </main>
  );
}
