import Link from "next/link";
import { ListingForm } from "@/components/ListingForm";
import { db } from "@/lib/db";
import { formatPyeong } from "@/lib/area";

// Convert BigInt 원 → "X.X억" display string (rounds to 1 decimal)
function formatEok(krw: bigint): string {
  const eok = Number(krw) / 1_0000_0000;
  return `${eok.toFixed(1)}억`;
}

const BAND_DOT: Record<"green" | "yellow" | "red", string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

const BAND_SCORE_COLOR: Record<"green" | "yellow" | "red", string> = {
  green: "text-green-600",
  yellow: "text-yellow-600",
  red: "text-red-600",
};

export default async function HomePage() {
  const listings = await db.listing.findMany({
    take: 10,
    orderBy: { submittedAt: "desc" },
    include: { score: true, complex: true },
  });

  return (
    <main className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      {/* ── 히어로 ── */}
      <section className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            이 매물, 진짜일까요?
          </h1>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
            국토부 실거래가와 비교해 허위매물 가능성을 자동으로 점수화합니다.
          </p>
          <div className="mt-10">
            <ListingForm />
          </div>
        </div>
      </section>

      {/* ── 최근 분석된 매물 ── */}
      <section className="mx-auto w-full max-w-2xl px-4 py-12">
        <h2 className="mb-6 text-xl font-semibold text-zinc-800 dark:text-zinc-200">
          최근 분석된 매물
        </h2>

        {listings.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">
            아직 분석된 매물이 없습니다. 위에 매물 정보를 입력해 보세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {listings.map((listing) => {
              // score may be null if analysis is still pending
              const band = (listing.score?.band ?? "green") as
                | "green"
                | "yellow"
                | "red";
              const total = listing.score?.total ?? null;

              return (
                <li key={listing.id}>
                  <Link
                    href={`/analyze/${listing.id}`}
                    className="flex items-center gap-4 rounded-xl bg-white dark:bg-zinc-900 px-4 py-3 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 hover:ring-zinc-400 dark:hover:ring-zinc-500 transition"
                  >
                    {/* 밴드 색상 점 */}
                    <span
                      className={`h-3 w-3 flex-none rounded-full ${BAND_DOT[band]}`}
                      aria-hidden
                    />

                    {/* 단지명 · 평형 · 호가 */}
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {listing.complex.name}
                      </span>
                      <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {formatPyeong(listing.area)}
                        {listing.floor != null ? ` · ${listing.floor}층` : ""}
                        {" · "}
                        {formatEok(listing.askPriceKrw)}
                      </span>
                    </span>

                    {/* 의심도 점수 */}
                    {total !== null ? (
                      <span
                        className={`text-sm font-bold tabular-nums ${BAND_SCORE_COLOR[band]}`}
                      >
                        {total}점
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-400">분석 중</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
