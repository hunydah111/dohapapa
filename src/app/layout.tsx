import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "dohapapa — 우리, 어디 살 수 있을까",
  description:
    "국토부 실거래가로 통근·예산·학군 조건에 맞는 아파트 단지를 좁혀주는 정보 제공 도구.",
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
            {/* 로고 마크 */}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white select-none"
              style={{ background: "#4f46e5" }}
              aria-hidden="true"
            >
              도
            </span>

            {/* 브랜드 */}
            <span
              className="text-[15px] font-bold tracking-tight"
              style={{ color: "#1d1d1f" }}
            >
              dohapapa
            </span>

            {/* 서브 태그라인 */}
            <span
              className="hidden text-xs sm:inline"
              style={{ color: "#86868b" }}
            >
              우리, 어디 살 수 있을까
            </span>
          </div>
        </header>

        {/* ── 본문 ── */}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
