import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTierBySlug } from "@/lib/budgetPercentile";
import { isKnownSigungu } from "@/lib/molit";
import { BijiCard } from "@/components/BijiCard";

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
  if (!tier) return { title: "비집고 — 내 통장으로 비집고 들어갈 집" };
  const region = safeRegion(rawRegion);
  const title = `나는 ${tier.label} — 내 통장으로 ${region}까지`;
  const description = `${tier.drip} — 비집고에서 내 통장으로 비집고 들어갈 집 잡기.`;
  const path = `/s/b/${grade}/${encodeURIComponent(region)}`;
  return {
    title: `${title} | 비집고`,
    description,
    alternates: { canonical: path },
    // 공유 미리보기(카톡 등)에 일반 기본값 대신 개인화된 제목·설명이 뜨도록 명시.
    // og:image 는 opengraph-image.tsx 가 자동 주입하므로 여기서 images 는 건드리지 않는다.
    openGraph: { title, description, type: "website", url: path },
    twitter: { title, description, card: "summary_large_image" },
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

  // 시군구 폴백("수도권") 시엔 합성 이름이 라벨로 되돌아가게 sigungu=null로 넘김.
  const cardSigungu = region === "수도권" ? null : region;
  // 공유 진입은 위 isFlex 단계 정보만 있고 라이프스타일·평형은 없음 — 칩 비움.

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col items-center justify-center gap-5 px-5 py-12 text-center">
      <div className="w-full max-w-[300px]">
        <BijiCard tier={tier} sigungu={cardSigungu} className="w-full" />
      </div>

      <p className="text-[17px] font-semibold leading-relaxed" style={{ color: "#3a322c" }}>
        내 통장으로 {region}까지 닿음
      </p>
      <p className="text-[14px] leading-relaxed" style={{ color: "#6b6157" }}>
        “{tier.drip}”
      </p>

      <p className="mt-1 text-[17px] font-bold" style={{ color: "#e8662f" }}>
        너는 무슨 비버? 👀
      </p>

      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-full bg-coral-600 px-7 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-coral-500"
      >
        나도 내 비버 찾기 →
      </Link>
      <p className="text-[12px]" style={{ color: "#9a8f82" }}>
        등급·동네만 담김 (소득·자산·직장 X) · 국토부 공개 실거래가 · 무료
      </p>
      <p className="text-[11px]" style={{ color: "#b3a99c" }}>
        실거래가 기반 추정 · 미래가치 예측 X · 부동산 중개·투자자문 아님
      </p>
    </main>
  );
}
