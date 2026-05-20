import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BrandMark } from "@/components/BrandMark";
import { Analytics } from "@/components/Analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // og:image 등 메타 URL을 절대경로로 만들어 카카오톡·SNS가 썸네일을 가져갈 수 있게 한다.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://homenasia.kr",
  ),
  title: "홈앤나사이 — 재미로 한번 돌려보는 내 집 찾기",
  description:
    "Home & 나 사이의 거리. 직장·예산·학군 조건으로 국토부 실거래가에 살 만한 아파트 단지를 좁혀주는 정보 제공 도구.",
  openGraph: {
    title: "홈앤나사이",
    description: "재미로 한번 돌려보는 내 집 찾기",
    type: "website",
    locale: "ko_KR",
    siteName: "홈앤나사이",
  },
  twitter: {
    card: "summary_large_image",
    title: "홈앤나사이",
    description: "재미로 한번 돌려보는 내 집 찾기",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        {/* ── 헤더 ── */}
        <header
          className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/85 backdrop-blur-md"
          style={{ WebkitBackdropFilter: "blur(12px)" }}
        >
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-4">
            {/* 콤파스 마크 — indigo currentColor 상속 */}
            <span
              className="shrink-0 text-indigo-600"
              aria-hidden="true"
            >
              <BrandMark size={28} />
            </span>

            {/* 브랜드명 */}
            <span
              className="text-[15px] font-bold tracking-tight"
              style={{ color: "#1d1d1f" }}
            >
              홈앤나사이
            </span>

            {/* 서브 태그라인 */}
            <span
              className="hidden text-xs sm:inline"
              style={{ color: "#86868b" }}
            >
              Home & 나 사이의 거리
            </span>
          </div>
        </header>

        {/* ── 본문 ── */}
        <main className="flex-1">{children}</main>

        {/* ── 푸터 ── */}
        <footer className="mt-12 border-t border-black/[0.06] bg-white/60">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p style={{ color: "#86868b" }}>
              © {new Date().getFullYear()} 홈앤나사이 — 정보 제공 도구
            </p>
            <nav className="flex flex-wrap gap-4" style={{ color: "#6e6e73" }}>
              <Link href="/privacy" className="hover:text-indigo-600">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="hover:text-indigo-600">
                이용약관
              </Link>
              <Link href="/contact" className="hover:text-indigo-600">
                연락처
              </Link>
            </nav>
          </div>
        </footer>

        <Analytics />
      </body>
    </html>
  );
}
