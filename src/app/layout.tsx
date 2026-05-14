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
  title: "dohapapa — 우리 부부, 어디 살 수 있을까",
  description:
    "국토부 실거래가로 부부 두 직장 통근·예산·학군 조건에 맞는 아파트 단지를 좁혀주는 정보 제공 도구.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              도
            </span>
            <span className="text-base font-bold tracking-tight text-gray-900">
              dohapapa
            </span>
            <span className="hidden text-xs text-gray-400 sm:inline">
              우리 부부, 어디 살 수 있을까
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
