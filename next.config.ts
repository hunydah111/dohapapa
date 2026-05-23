import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 추천 엔진은 런타임에 src/data/complexSnapshot.json 을 fs 로 읽는다(요청당 DB 읽기 0).
  // 런타임 경로 조합이라 트레이서가 자동 감지 못 하므로 명시적으로 번들에 포함시킨다.
  outputFileTracingIncludes: {
    "/api/recommend": ["src/data/complexSnapshot.json"],
  },
};

export default nextConfig;
