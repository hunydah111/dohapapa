import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 추천 엔진은 런타임에 src/data/complexSnapshot.json 을 fs 로 읽는다(요청당 DB 읽기 0).
  // 런타임 경로 조합이라 트레이서가 자동 감지 못 하므로 명시적으로 번들에 포함시킨다.
  outputFileTracingIncludes: {
    "/api/recommend": ["src/data/complexSnapshot.json"],
  },
  // 2026-06-11 라우트 학살 — 정보뭉치(리그·놀이·성향·업데이트·유형카드) 제거.
  // 옛 공유/북마크 링크는 홈으로 308. /s/b/:grade/:region(등급 OG)은 3세그먼트라 안 걸림.
  // 2026-07-11: 클릭되는 공유 링크카드 /s/major·strong·weak·recovery·trade 신설 — 이 kind들은
  // 홈 리다이렉트에서 제외(negative lookahead)해 실제 착지 페이지가 뜨게 한다.
  async redirects() {
    return [
      { source: "/league", destination: "/", permanent: true },
      { source: "/play", destination: "/", permanent: true },
      { source: "/persona", destination: "/", permanent: true },
      { source: "/updates", destination: "/", permanent: true },
      {
        source: "/s/:type((?!major$|strong$|weak$|recovery$|trade$)[^/]+)",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
