import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { LAWD_CODES } from "@/lib/molit";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // 동네면 /r/[시군구] 81개 — 매일 새벽 데이터 커밋 → 재배포로 갱신.
  const regionPages: MetadataRoute.Sitemap = Object.keys(LAWD_CODES).map((sigungu) => ({
    url: `${SITE_URL}/r/${encodeURIComponent(sigungu)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }));
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...regionPages,
    {
      url: `${SITE_URL}/principles`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
