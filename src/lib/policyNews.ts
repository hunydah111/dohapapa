// [정책 브리핑] — 대출·부동산 정책 뉴스 (네이버 뉴스 검색 자동 + 신뢰 언론사 화이트리스트).
//
// 편집 헌장 정합: 우리가 정책을 "주장"하지 않는다 — 언론 보도를 링크로 큐레이션만 한다.
// 정책·대출 한도는 자주 바뀌고 은행별로 달라(예: 2026-07 생애최초 6억→3억은 KB 자체) 앱이
// 숫자를 단정하는 대신 최신 뉴스로 안내한다(무조작). 클릭베이트 방지 = 신뢰 언론사만.
//
// 생산: scripts/fetch-policy-news.ts (일간 크론 — 네이버 API 는 크론에서만 호출).
// 소비: 판정/예산 근처 [정책 브리핑] 코너 + 1면 "정책 바뀜 →" 링크 (빌드 타임 JSON import).
//
// 순수 함수 — API·파일 접근 없음. 스크립트와 테스트가 같은 함수를 쓴다.

/** 신뢰 언론사 화이트리스트 — originallink/link 도메인 → 표시용 언론사명. */
export const TRUSTED_SOURCES: Record<string, string> = {
  "yna.co.kr": "연합뉴스",
  "yonhapnewstv.co.kr": "연합뉴스TV",
  "hankookilbo.com": "한국일보",
  "fnnews.com": "파이낸셜뉴스",
  "news1.kr": "뉴스1",
  "chosun.com": "조선일보",
  "mk.co.kr": "매일경제",
  "hankyung.com": "한국경제",
  "edaily.co.kr": "이데일리",
  "sedaily.com": "서울경제",
  "mt.co.kr": "머니투데이",
  "heraldcorp.com": "헤럴드경제",
  "joongang.co.kr": "중앙일보",
  "donga.com": "동아일보",
  "kbs.co.kr": "KBS",
  "ytn.co.kr": "YTN",
  "khan.co.kr": "경향신문",
  "seoul.co.kr": "서울신문",
};

export interface PolicyNewsItem {
  /** HTML 태그·엔티티 제거된 제목. */
  title: string;
  /** 읽기 링크 — 네이버 뉴스(link) 우선, 없으면 원문(originallink). */
  url: string;
  /** 화이트리스트 언론사명. */
  source: string;
  /** "YYYY-MM-DD" (계약월 아님 — 기사 발행일). */
  dateISO: string;
}

export interface PolicyNewsFile {
  /** null = placeholder(첫 크론 전) — 코너는 조용히 접힌다. */
  generatedAt: string | null;
  items: PolicyNewsItem[];
}

/** 네이버 뉴스 API item 원형(필요 필드만). */
export interface RawNaverNews {
  title: string;
  originallink: string;
  link: string;
  description?: string;
  pubDate: string; // RFC-1123 예: "Fri, 10 Jul 2026 06:20:00 +0900"
}

/** <b> 등 태그·HTML 엔티티 제거. */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** url → 화이트리스트 언론사명. 밖이면 null(제외). */
export function trustedSourceOf(url: string): string | null {
  for (const [domain, name] of Object.entries(TRUSTED_SOURCES)) {
    if (url.includes(domain)) return name;
  }
  return null;
}

/** RFC-1123 pubDate → "YYYY-MM-DD". 파싱 실패면 null. */
export function pubDateToISO(pubDate: string): string | null {
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * 네이버 뉴스 원형 배열 → [정책 브리핑] 아이템. 신뢰 언론사만 · 제목 중복 제거 ·
 * 발행일 내림차순 · limit 개. originallink 가 화이트리스트면 그 언론사, 링크는 네이버(link)
 * 우선(인앱 읽기 안정) 없으면 원문.
 */
export function buildPolicyNews(raw: readonly RawNaverNews[], limit = 5): PolicyNewsItem[] {
  const seen = new Set<string>();
  const out: PolicyNewsItem[] = [];
  for (const r of raw) {
    const source = trustedSourceOf(r.originallink) ?? trustedSourceOf(r.link);
    if (!source) continue; // 화이트리스트 밖 — 제외
    const dateISO = pubDateToISO(r.pubDate);
    if (!dateISO) continue;
    const title = stripHtml(r.title);
    if (!title) continue;
    const key = title.replace(/\s+/g, ""); // 제목 기준 중복 제거
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      url: r.link && r.link.includes("naver.com") ? r.link : r.originallink,
      source,
      dateISO,
    });
  }
  out.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
  return out.slice(0, Math.max(0, limit));
}
