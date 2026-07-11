import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

// PWA 매니페스트 — "홈 화면/바탕화면에 설치"(A2HS) 가능하게 (2026-07-11 사장).
// Next 가 app/manifest.ts 를 /manifest.webmanifest 로 서빙하고 <link rel="manifest">를 자동 삽입.
// 아이콘은 public/icon-512.png(정적 안정 URL). display:standalone = 앱처럼 전체화면.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — 수도권 아파트 실거래 신문`,
    short_name: SITE_NAME,
    description: "국토부 실거래로 매일 아침 발행하는 수도권 아파트 실거래 신문. 동네 시세·회복률·주요 거래.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf6", // paper
    theme_color: "#e8571f", // coral
    lang: "ko-KR",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "192x192", type: "image/png", purpose: "any" },
    ],
  };
}
