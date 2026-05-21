import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Homi } from "@/components/Homi";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  // og:image 등 메타 URL을 절대경로로 만들어 카카오톡·SNS가 썸네일을 가져갈 수 있게 한다.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.homenasia.kr",
  ),
  title: "비집고 — 내 통장으로 어디 살 수 있을까?",
  description:
    "비버 비지가 직장·예산·학군 조건으로 국토부 실거래가에서 살 만한 아파트 단지를 비집고 찾아주는 정보 제공 도구.",
  openGraph: {
    title: "비집고",
    description: "내 통장으로 어디 살 수 있을까?",
    type: "website",
    locale: "ko_KR",
    siteName: "비집고",
  },
  twitter: {
    card: "summary_large_image",
    title: "비집고",
    description: "내 통장으로 어디 살 수 있을까?",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* 본문 고운돋움 + 제목 주아체 (SIL OFL 무료, 한글 포함) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        {/* ── 헤더 ── */}
        <header
          className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/85 backdrop-blur-md"
          style={{ WebkitBackdropFilter: "blur(12px)" }}
        >
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-4">
            {/* 로고+브랜드명 클릭 → 첫 화면(홈)으로. 풀 리로드로 결과 화면 상태까지 초기화한다. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              aria-label="비집고 홈으로"
              className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-coral-500"
            >
              {/* 마스코트 비지 얼굴 — 로고 */}
              <Homi mood="face" size={28} className="shrink-0" />

              {/* 브랜드명 */}
              <span
                className="font-jua text-[18px] tracking-tight"
                style={{ color: "#3a322c" }}
              >
                비집고
              </span>
            </a>

            {/* 서브 태그라인 — 캐치프레이즈로 통일 */}
            <span
              className="hidden text-xs sm:inline"
              style={{ color: "#9a8f82" }}
            >
              내 통장으로 살 집 찾기
            </span>
          </div>
        </header>

        {/* ── 본문 ── */}
        <main className="flex-1">{children}</main>

        {/* ── 푸터 ── */}
        <footer className="mt-12 border-t border-black/[0.06] bg-white/60">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p style={{ color: "#9a8f82" }}>
              © {new Date().getFullYear()} 비집고 — 정보 제공 도구
            </p>
            <nav className="flex flex-wrap gap-4" style={{ color: "#6b6157" }}>
              <Link href="/privacy" className="hover:text-coral-600">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="hover:text-coral-600">
                이용약관
              </Link>
              <Link href="/contact" className="hover:text-coral-600">
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
