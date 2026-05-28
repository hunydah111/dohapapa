import type { Metadata } from "next";
import Link from "next/link";
import { BEAVER_TIERS } from "@/lib/budgetPercentile";

export const metadata: Metadata = {
  title: "비지 도감 — 비집고",
  description: "비집고 비지 11종 컬렉션. 너의 비지는 무슨 비버?",
  alternates: { canonical: "/biji" },
};

// 비지 도감 페이지 — 전 11종 비지(셀럽 3 + gukmin 4 + baby 3 + queen) 한눈에.
// 가챠 컬렉션 정서 + 등급별 라벨/카피로 탐험 즐거움. localStorage "biji-seen-variants"
// 비교 가능(클라이언트에서 별도 컴포넌트로 확장 가능 — 일단 정적 도감).
//
// 모바일 우선: 3-column grid. 데스크탑: 4-column.
// 각 비지 = 흰 polaroid 카드 + 라벨 + 등급 톤(coral·gold·sky·warm).

interface BijiEntry {
  src: string;
  label: string;
  tierLabel: string;
  tone: string; // 카드 코너 색 (등급 무드)
}

function entries(): BijiEntry[] {
  const out: BijiEntry[] = [];
  for (const tier of Object.values(BEAVER_TIERS)) {
    const tone = tier.theme.accent;
    if (Array.isArray(tier.image)) {
      tier.image.forEach((src, i) => {
        out.push({
          src,
          label: tier.label + (tier.image.length > 1 ? ` ${i + 1}` : ""),
          tierLabel: tier.label,
          tone,
        });
      });
    } else {
      out.push({ src: tier.image, label: tier.label, tierLabel: tier.label, tone });
    }
  }
  return out;
}

export default function BijiCollectionPage() {
  const list = entries();
  return (
    <div className="relative mx-auto max-w-3xl px-4 pt-6 pb-16">
      <header className="mb-6 text-center">
        <p className="font-jua text-[14px]" style={{ color: "#8a7d6e" }}>
          비집고 도감
        </p>
        <h1 className="font-jua text-[2.4rem] leading-tight" style={{ color: "#e8662f" }}>
          비지 {list.length}종
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "#6e5b46" }}>
          너의 비지는 무슨 비버? 30초컷 검색하고 비교해봐
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-coral-300"
        >
          내 비지 찾기 →
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
        {list.map((e, i) => (
          <article
            key={i}
            className="biji-pop-in relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5"
            style={{ aspectRatio: "1 / 1.15" }}
          >
            {/* 비지 영역 (상단 78%) */}
            <div className="absolute inset-x-0 top-0 h-[78%] overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${e.src}?v=4`}
                alt={`${e.label} 비지`}
                className="biji-breathe absolute inset-0 h-full w-full select-none"
                style={{ objectFit: "contain" }}
                draggable={false}
              />
            </div>
            {/* 라벨 영역 (하단 22%) */}
            <div
              className="absolute inset-x-0 bottom-0 flex h-[22%] items-center justify-center px-2 text-center"
              style={{ background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${e.tone}22 100%)` }}
            >
              <p
                className="font-jua text-[12px] leading-tight"
                style={{ color: e.tone }}
                title={e.label}
              >
                {e.label}
              </p>
            </div>
          </article>
        ))}
      </div>

      <footer className="mt-10 space-y-2 text-center">
        <p className="text-[12px]" style={{ color: "#9a8f82" }}>
          gukmin·baby는 시군구마다 다른 변주가 나옴 — 탭하면 다음 비지로
        </p>
        <p className="text-[11px]" style={{ color: "#b8ad9e" }}>
          정보 제공 도구 · 부동산 중개·투자 자문 아님
        </p>
      </footer>
    </div>
  );
}
