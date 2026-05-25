export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.homenasia.kr";

// 표시용 도메인 — OG 카드·워터마크 등에 박던 호스트 문자열의 단일 소스.
// SITE_URL 에서 프로토콜·www 만 떼어 파생하므로, 도메인 변경은 NEXT_PUBLIC_SITE_URL(+위 폴백)
// 한 곳만 바꾸면 전부 따라온다. (예: https://www.homenasia.kr → "homenasia.kr")
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "").replace(/^www\./, "");

export const SITE_NAME = "비집고";

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hunydah111@gmail.com";

export const SERVICE_START_DATE = "2026-05-15";
