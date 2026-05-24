import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTierBySlug } from "@/lib/budgetPercentile";
import { isKnownSigungu } from "@/lib/molit";

// 비버 등급 공유 링크 진입 페이지 — "나는 ○○비버! 내 예산이면 △△구까지" + "나도 찾기" CTA.
// 담기는 것: 등급(6단계) + 시군구 1개뿐. 소득·자산·직장 없음 — 바이럴 안전.

/** region 파라미터를 안전하게 디코드·검증. 알려진 시군구가 아니면 '수도권'으로 폴백. */
function safeRegion(raw: string): string {
  try {
    const decoded = decodeURIComponent(raw);
    return isKnownSigungu(decoded) ? decoded : "수도권";
  } catch {
    return "수도권";
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ grade: string; region: string }>;
}): Promise<Metadata> {
  const { grade, region: rawRegion } = await params;
  const tier = getTierBySlug(grade);
  if (!tier) return { title: "비집고 — 내 통장으로 살 집 찾기" };
  const region = safeRegion(rawRegion);
  return {
    title: `나는 ${tier.label} — 내 예산이면 ${region}까지 | 비집고`,
    description: `${tier.drip} — 비집고에서 내 통장으로 살 수 있는 집을 찾아보세요.`,
    alternates: { canonical: `/s/b/${grade}/${encodeURIComponent(region)}` },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ grade: string; region: string }>;
}) {
  const { grade, region: rawRegion } = await params;
  const tier = getTierBySlug(grade);
  if (!tier) notFound();
  const region = safeRegion(rawRegion);

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col items-center justify-center gap-5 px-5 py-12 text-center">
      <div
        className="biji-pop-in flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: "radial-gradient(circle, rgba(224,162,58,0.18) 0%, rgba(245,236,217,0) 70%)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${tier.image}?v=2`} alt={`${tier.label} 비지`} className="h-36 w-auto" />
      </div>

      <p className="text-sm font-semibold tracking-wide" style={{ color: "#9a8f82" }}>
        내 비버 등급
      </p>
      <h1 className="font-jua text-[2.4rem] leading-tight" style={{ color: "#3a2c1d" }}>
        {tier.emoji} {tier.label}
      </h1>
      <p className="text-[19px] font-semibold leading-relaxed" style={{ color: "#3a322c" }}>
        내 예산이면 {region}까지 닿아요
      </p>
      <p className="text-[15px] leading-relaxed" style={{ color: "#6b6157" }}>
        “{tier.drip}”
      </p>

      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center rounded-full bg-coral-600 px-7 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-coral-500"
      >
        나도 내 비버 찾기 →
      </Link>
      <p className="text-[12px]" style={{ color: "#9a8f82" }}>
        등급·동네만 담겨요 (소득·자산·직장 X) · 국토부 공개 실거래가 · 무료
      </p>
      <p className="text-[11px]" style={{ color: "#b3a99c" }}>
        실거래가 기반 추정 · 미래가치 예측이나 부동산 중개·투자자문이 아닙니다
      </p>
    </main>
  );
}
