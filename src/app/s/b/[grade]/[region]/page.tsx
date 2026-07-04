import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTierBySlug, BEAVER_TIERS } from "@/lib/budgetPercentile";
import { getReachBySlug, composeReachName, type ReachLabel } from "@/lib/bijiName";
import { isKnownSigungu, normalizeSigungu } from "@/lib/molit";
import { BijiCard } from "@/components/BijiCard";

// 판정 공유 링크 진입 페이지 — "{시군구} {사정권 라벨}" 카드 + "나도 판정" CTA.
// 담기는 것: 사정권 라벨 + 시군구 1개뿐. 소득·자산·직장 없음 — 바이럴 안전.
//
// slug 이중 해석 (2026-07-04 비버 퇴장):
//  - 새 slug: ipseong/sajeonggwon/munbak/adeuk → 사정권 라벨 그대로.
//  - 레거시 slug: queen/rain/... (+justin 등 alias) → 404 차단용으로만 해석.
//    tier는 카드 색 테마로만 쓰고 이름(비버 등급명)은 노출하지 않는다 — 라벨은 중립 "판정".

/** region 파라미터를 안전하게 디코드·검증·정규화. 알려진 시군구가 아니면 '수도권'으로 폴백. */
function safeRegion(raw: string): string {
  try {
    const decoded = decodeURIComponent(raw);
    return isKnownSigungu(decoded) ? normalizeSigungu(decoded) : "수도권";
  } catch {
    return "수도권";
  }
}

/** slug → {reach(새) | null, 레거시 tier | null}. 둘 다 null이면 미지 slug. */
function resolveGrade(grade: string): { reach: ReachLabel | null; legacy: boolean } | null {
  const reach = getReachBySlug(grade);
  if (reach) return { reach, legacy: false };
  if (getTierBySlug(grade)) return { reach: null, legacy: true };
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ grade: string; region: string }>;
}): Promise<Metadata> {
  const { grade, region: rawRegion } = await params;
  const resolved = resolveGrade(grade);
  if (!resolved) return { title: "비집고 — 내 통장으로 비집고 들어갈 집" };
  const region = safeRegion(rawRegion);
  const title = resolved.reach
    ? `나는 ${region} ${resolved.reach.label} — 내 통장 판정`
    : `내 판정 — 내 통장으로 ${region}까지`;
  const description = "통장 까면 동네 나온다 — 비집고에서 30초 판정.";
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
  const resolved = resolveGrade(grade);
  if (!resolved) notFound();
  const region = safeRegion(rawRegion);

  // 색 테마 — 레거시 링크는 원래 tier 테마 유지, 새 링크는 중립(gukmin) 테마.
  const themeTier = getTierBySlug(grade) ?? BEAVER_TIERS.gukmin;
  // 시군구 폴백("수도권") 시엔 히어로 이름이 라벨 단독이 되게 sigungu=null로 넘김.
  const cardSigungu = region === "수도권" ? null : region;
  const heroName = composeReachName(cardSigungu, resolved.reach);

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col items-center justify-center gap-5 px-5 py-12 text-center">
      <div className="w-full max-w-[300px]">
        <BijiCard tier={themeTier} heroName={heroName} sigungu={cardSigungu} className="w-full" />
      </div>

      <p className="text-[17px] font-semibold leading-relaxed" style={{ color: "#3a322c" }}>
        내 통장으로 {region}까지 닿음
      </p>

      <p className="mt-1 text-[17px] font-bold" style={{ color: "#e8662f" }}>
        너는 어디까지 닿나? 👀
      </p>

      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-full bg-coral-600 px-7 py-3.5 text-base font-bold text-white shadow-lg transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-coral-500"
      >
        나도 30초 판정 →
      </Link>
      <p className="text-[12px]" style={{ color: "#9a8f82" }}>
        판정·동네만 담김 (소득·자산·직장 X) · 국토부 공개 실거래가 · 무료
      </p>
      <p className="text-[11px]" style={{ color: "#b3a99c" }}>
        실거래가 기반 추정 · 미래가치 예측 X · 부동산 중개·투자자문 아님
      </p>
    </main>
  );
}
