import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHomeTypeBySlug, HOME_TYPE_SLUGS } from "@/lib/homeType";

// 유형 공유 링크 진입 페이지 — "당신은 ○○형!" 티저 + "나도 찾아보기" CTA.
// 프로필(소득·자산)은 안 담기고 유형 라벨만 — 바이럴 안전.

export function generateStaticParams() {
  return HOME_TYPE_SLUGS.map((type) => ({ type }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const ht = getHomeTypeBySlug(type);
  if (!ht) return { title: "비집고 — 내 통장으로 살 집 찾기" };
  return {
    title: `나의 집 찾기 유형: ${ht.name} | 비집고`,
    description: `${ht.tagline} — 비집고에서 내 통장으로 살 수 있는 집을 찾아보세요.`,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const ht = getHomeTypeBySlug(type);
  if (!ht) notFound();

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col items-center justify-center gap-5 px-5 py-12 text-center">
      <div
        className="biji-pop-in flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: "radial-gradient(circle, rgba(224,162,58,0.18) 0%, rgba(245,236,217,0) 70%)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ht.image}?v=1`} alt={`${ht.name} 비지`} className="h-36 w-auto" />
      </div>

      <p className="text-sm font-semibold tracking-wide" style={{ color: "#9a8f82" }}>
        내 집 찾기 유형
      </p>
      <h1 className="font-jua text-[2.4rem] leading-tight" style={{ color: "#3a2c1d" }}>
        {ht.name}
      </h1>
      <p className="text-[17px] leading-relaxed" style={{ color: "#6b6157" }}>
        {ht.tagline}
      </p>

      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center rounded-full bg-coral-600 px-7 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-coral-500"
      >
        나도 내 유형 찾기 →
      </Link>
      <p className="text-[12px]" style={{ color: "#9a8f82" }}>
        국토교통부 공개 실거래가 기반 · 회원가입 없이 무료
      </p>
    </main>
  );
}
