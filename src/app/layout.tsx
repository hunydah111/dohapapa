import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BrandMark } from "@/components/BrandMark";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "홈앤나사이 — 우리, 어디 살 수 있을까",
  description:
    "Home & 나 사이의 거리. 국토부 실거래가로 통근·예산·학군 조건에 맞는 아파트 단지를 좁혀주는 정보 제공 도구.",
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
      </body>
    </html>
  );
}
