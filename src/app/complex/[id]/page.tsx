import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPyeong } from "@/lib/area";

// Next.js 15: params is a Promise
type PageProps = { params: Promise<{ id: string }> };

function formatEok(krw: bigint): string {
  const eok = Number(krw) / 1_0000_0000;
  return `${eok.toFixed(1)}억`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const BAND_LABEL: Record<"green" | "yellow" | "red", string> = {
  green: "낮음",
  yellow: "주의",
  red: "높음",
};

const BAND_CLASSES: Record<"green" | "yellow" | "red", string> = {
  green:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  yellow:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export default async function ComplexPage({ params }: PageProps) {
  const { id } = await params;

  const complex = await db.complex.findUnique({
    where: { id },
    include: {
      listings: {
        include: { score: true },
        orderBy: { score: { total: "desc" } },
        take: 50,
      },
    },
  });

  if (!complex) notFound();

  return (
    <main className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950">
      {/* ── 헤더 ── */}
      <section className="w-full bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
          >
            ← 홈으로
          </Link>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            {complex.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {complex.sigungu} {complex.dongName}
            {complex.buildYear != null ? ` · 건축 ${complex.buildYear}년` : ""}
            {complex.totalHouseholds != null
              ? ` · 총 ${complex.totalHouseholds.toLocaleString("ko-KR")}세대`
              : ""}
          </p>
        </div>
      </section>

      {/* ── 매물 의심도 순위 ── */}
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          등록 매물 의심도 순위
        </h2>

        {complex.listings.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">
            이 단지에 등록된 매물이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-700 bg-white dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3 text-left font-medium">평형</th>
                  <th className="px-4 py-3 text-left font-medium">층</th>
                  <th className="px-4 py-3 text-left font-medium">호가</th>
                  <th className="px-4 py-3 text-center font-medium">의심도</th>
                  <th className="px-4 py-3 text-left font-medium">등록일</th>
                </tr>
              </thead>
              <tbody>
                {complex.listings.map((listing, idx) => {
                  const band = (listing.score?.band ?? "green") as
                    | "green"
                    | "yellow"
                    | "red";
                  const total = listing.score?.total ?? null;

                  return (
                    <tr
                      key={listing.id}
                      className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                        idx % 2 === 0 ? "" : "bg-zinc-50/50 dark:bg-zinc-900/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        <Link
                          href={`/analyze/${listing.id}`}
                          className="hover:underline"
                        >
                          {formatPyeong(listing.area)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                        {listing.floor != null ? `${listing.floor}층` : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                        {formatEok(listing.askPriceKrw)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {total !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BAND_CLASSES[band]}`}
                          >
                            {total}점 · {BAND_LABEL[band]}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">분석 중</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {formatDate(listing.submittedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
