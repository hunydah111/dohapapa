import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { SITE_URL } from "@/lib/site";
// 지면 제호와 동일 토큰 (공유 단일 소스) — 헤더 로고 = 제호 미니 버전.
// 제호 "비집고" 워드마크 = Pretendard Bold (2026-07-11 프리미엄 하이브리드).
import { PAPER, INK_SOFT, RULE, CORAL, pretendard } from "@/lib/paperTone";

export const metadata: Metadata = {
  // og:image 등 메타 URL을 절대경로로 만들어 카카오톡·SNS가 썸네일을 가져갈 수 있게 한다.
  // 도메인은 site.ts(SITE_URL) 단일 소스를 따른다.
  metadataBase: new URL(SITE_URL),
  // SEO(2026-07-11) — "비집고" 단독은 EBS "세상을 비집고"와 충돌해 안 뜬다. 제호는 지키되
  // "비집고 부동산·수도권 아파트 실거래·동네 시세·회복률" 키워드를 앞세워 EBS 경쟁이 덜한
  // 검색어에서 잡히게 한다. 부동산 정체성(v2 데이터 신문)을 title/description 에 명시.
  title: "비집고 — 수도권 아파트 실거래 · 동네 시세 · 회복률 매일 아침 신문",
  description:
    "국토부 실거래 공개분으로 매일 아침 발행하는 수도권 아파트 실거래 신문. 동네별 실거래·전고점 대비 회복률·오늘의 주요 거래, 그리고 내 통장으로 닿는 단지·정책대출 자격까지. 비집고(bijigo.kr).",
  keywords: [
    "비집고",
    "비집고 부동산",
    "수도권 아파트 실거래",
    "아파트 실거래가",
    "동네 시세",
    "부동산 실거래 신문",
    "국토부 실거래가",
    "아파트 시세 조회",
    "전고점 회복률",
    "정책대출 자격",
  ],
  openGraph: {
    title: "비집고 — 수도권 아파트 실거래 신문",
    description: "국토부 실거래로 매일 아침 발행 — 동네 시세·전고점 회복률·오늘의 주요 거래·내 통장 판정.",
    type: "website",
    locale: "ko_KR",
    siteName: "비집고",
  },
  twitter: {
    card: "summary_large_image",
    title: "비집고 — 수도권 아파트 실거래 신문",
    description: "국토부 실거래로 매일 아침 발행 — 동네 시세·회복률·주요 거래·내 통장 판정.",
  },
  // iOS 사파리 "홈 화면에 추가" 시 앱처럼(상태바·전체화면) + 홈 아이콘(app/apple-icon.png).
  appleWebApp: {
    capable: true,
    title: "비집고",
    statusBarStyle: "default",
  },
  verification: {
    other: {
      "naver-site-verification": "19575f0573a982d969ea4b33a64ff4973798a9a6",
    },
  },
};

// PWA/브라우저 테마색 — Next 는 themeColor 를 viewport 로 받는다(metadata 아님).
export const viewport: Viewport = {
  themeColor: "#fbfaf6",
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
      <body className="min-h-screen flex flex-col overflow-x-clip antialiased">
        {/* ── 헤더 ── */}
        <header
          className="sticky top-0 z-20 border-b backdrop-blur-md"
          style={{
            WebkitBackdropFilter: "blur(12px)",
            borderColor: RULE,
            background: "rgba(251,250,246,0.88)", // 종이 반투명
          }}
        >
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-4">
            {/* 로고+브랜드명 클릭 → 첫 화면(홈)으로. 풀 리로드로 결과 화면 상태까지 초기화한다. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              aria-label="비집고 홈으로"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-coral-500"
            >
              {/* 브랜드 마크 — 지면 제호(코랄 플레이트 흰 Pretendard Bold)의 미니 버전. 각진 사각, 라운드 금지. */}
              <span
                className={`${pretendard.className} inline-block px-2 py-[3px] text-[15px] font-bold leading-none tracking-[0.06em]`}
                style={{ background: CORAL, color: PAPER }}
              >
                비집고
              </span>
            </a>

            {/* 서브 태그라인 — 본문 카피와 중복 피하려 차별화(기능 요약) */}
            <span
              className="hidden text-xs sm:inline"
              style={{ color: INK_SOFT }}
            >
              예산으로 찾는 수도권 아파트
            </span>
          </div>
        </header>

        {/* ── 본문 ── */}
        <main className="flex-1">{children}</main>

        {/* ── 푸터 ── */}
        <footer className="mt-12 border-t" style={{ borderColor: RULE }}>
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p style={{ color: "#8a857a" }}>
              © {new Date().getFullYear()} 비집고 — 정보 제공 도구
            </p>
            <nav className="flex flex-wrap gap-4" style={{ color: INK_SOFT }}>
              <Link href="/principles" className="hover:text-coral-600">
                원칙
              </Link>
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
