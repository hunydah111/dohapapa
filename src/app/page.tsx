import type { Metadata } from "next";
import { HomeExperience } from "@/components/HomeExperience";
import { DailyFront } from "@/components/DailyFront";
import { decodeFriend, friendReachName, FRIEND_PARAM } from "@/lib/friendShare";
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
  const friendName = friendReachName(tag)!;
  const ogImage = `${SITE_URL}/api/og-friend?f=${encodeURIComponent(friendRaw!)}`;
  return {
    alternates: { canonical: "/" },
    title: `${friendName} 친구가 판정 까고 던졌다 · 비집고`,
    description: "통장 까면 동네 나온다 — 닿는 단지·D-day·정책대출 자격 30초 판독.",
    openGraph: {
      title: `${friendName} — 친구가 판정 까고 던졌다`,
      description: "통장 까면 동네 나온다. 너도 30초 까봐 🦫",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${friendName} 판정 카드` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${friendName} — 친구가 판정 까고 던졌다`,
      description: "통장 까면 동네 나온다. 너도 30초 까봐 🦫",
      images: [ogImage],
    },
  };
}

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 pt-4">
      {/* ── 메인 경험 (오늘의 1면 → 랜딩 히어로 → 폼 → 결과) ──
          오늘의 1면(DailyFront, 서버 컴포넌트)은 prop 으로 넘겨 랜딩 상태에서만 렌더
          — 판정 폼 진행·결과 화면에선 접힌다(집중 유지, 2026-07-06 폼 UX).
          id=biji-verdict 앵커(지면 CTA·게이지의 스크롤 목적지)는 HomeExperience 내부,
          frontPage 아래 본 경험 컨테이너에 붙는다. */}
      <HomeExperience frontPage={<DailyFront />} />

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
