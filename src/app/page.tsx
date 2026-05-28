import type { Metadata } from "next";
import { HomeExperience } from "@/components/HomeExperience";
import { decodeFriend, FRIEND_PARAM } from "@/lib/friendShare";
import { composeBijiName } from "@/lib/bijiName";
import { SITE_URL } from "@/lib/site";

// apex(bijigo.kr)가 정본. www·옛 도메인(homenasia.kr 등)은 Vercel에서 bijigo.kr로 308 리다이렉트.
// 상대경로 canonical 은 layout 의 metadataBase(SITE_URL=https://bijigo.kr)로 합성됨.
//
// 친구 비교 진입(?f={slug}.{sigungu}) 시 동적 OG 카드로 override — 카톡 미리보기에서
// 친구 비지가 보임 → 클릭 유도 funnel.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = params[FRIEND_PARAM];
  const friendRaw = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  const tag = decodeFriend(friendRaw);
  if (!tag) {
    return { alternates: { canonical: "/" } };
  }
  const friendName = composeBijiName(tag.sigungu, tag.tier);
  const ogImage = `${SITE_URL}/api/og-friend?f=${encodeURIComponent(friendRaw!)}`;
  return {
    alternates: { canonical: "/" },
    title: `${friendName} 친구가 너랑 비교하래 · 비집고`,
    description: "내 통장으로 살 집 어디까지? 30초컷으로 비지 찾고 친구랑 나란히 세워보자.",
    openGraph: {
      title: `${friendName} 친구가 너랑 비교하래`,
      description: "비집고 30초컷 검색하고 비지 옆에 나란히!",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${friendName} — 비교중` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${friendName} 친구가 너랑 비교하래`,
      description: "비집고에서 너도 비지 찾기",
      images: [ogImage],
    },
  };
}

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 pt-4">
      {/* ── 메인 경험 (랜딩 히어로 → 폼 → 결과) ── */}
      <HomeExperience />

      {/* ── 면책 안내 ── */}
      <p
        className="py-10 text-center text-xs leading-relaxed"
        style={{ color: "#9a8f82" }}
      >
        본 서비스는 정보 제공 도구이며, 부동산 중개·투자 자문이 아닙니다.
      </p>
    </div>
  );
}
