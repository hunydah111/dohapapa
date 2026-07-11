// [정책 브리핑] 순수 함수 테스트 — 크론과 페이지가 같은 함수를 쓴다.
import { describe, expect, it } from "vitest";
import {
  buildPolicyNews,
  pubDateToISO,
  stripHtml,
  trustedSourceOf,
  type RawNaverNews,
} from "@/lib/policyNews";

describe("stripHtml — 태그·엔티티 제거", () => {
  it("<b> 태그와 엔티티를 제거한다", () => {
    expect(stripHtml("생애최초 <b>대출</b> 한도 6억&#39;→3억&quot;")).toBe("생애최초 대출 한도 6억'→3억\"");
  });
});

describe("trustedSourceOf — 화이트리스트", () => {
  it("신뢰 언론사 도메인은 언론사명, 밖은 null", () => {
    expect(trustedSourceOf("https://www.fnnews.com/news/123")).toBe("파이낸셜뉴스");
    expect(trustedSourceOf("https://n.news.naver.com/mnews/article/001/000")).toBe(null); // naver 자체는 화이트리스트 아님(originallink로 판정)
    expect(trustedSourceOf("https://spam-blog.tistory.com/1")).toBe(null);
  });
});

describe("pubDateToISO", () => {
  it("RFC-1123 → YYYY-MM-DD", () => {
    expect(pubDateToISO("Fri, 10 Jul 2026 06:20:00 +0900")).toBe("2026-07-09"); // UTC 기준
    expect(pubDateToISO("깨진값")).toBe(null);
  });
});

describe("buildPolicyNews — 화이트리스트·중복·정렬·상한", () => {
  const raw: RawNaverNews[] = [
    { title: "생애최초 <b>대출</b> 3억 축소", originallink: "https://www.fnnews.com/a", link: "https://n.news.naver.com/a", pubDate: "Fri, 10 Jul 2026 06:20:00 +0900" },
    { title: "DSR 3단계 시행", originallink: "https://www.hankookilbo.com/b", link: "https://n.news.naver.com/b", pubDate: "Thu, 09 Jul 2026 09:00:00 +0900" },
    { title: "생애최초 대출 3억 축소", originallink: "https://blog.tistory.com/c", link: "https://blog.tistory.com/c", pubDate: "Fri, 10 Jul 2026 07:00:00 +0900" }, // 화이트리스트 밖 → 제외
    { title: "DSR 3단계 시행", originallink: "https://www.mk.co.kr/d", link: "https://n.news.naver.com/d", pubDate: "Thu, 09 Jul 2026 10:00:00 +0900" }, // 제목 중복 → 제외
  ];

  it("신뢰 언론사만 + 제목 중복 제거 + 발행일 내림차순", () => {
    const out = buildPolicyNews(raw, 5);
    expect(out).toHaveLength(2); // 티스토리 제외, 중복 제외
    expect(out[0].title).toBe("생애최초 대출 3억 축소"); // 태그 제거 + 최신
    expect(out[0].source).toBe("파이낸셜뉴스");
    expect(out[0].url).toContain("naver.com"); // 네이버 링크 우선
    expect(out[1].title).toBe("DSR 3단계 시행");
  });

  it("limit 상한 적용", () => {
    expect(buildPolicyNews(raw, 1)).toHaveLength(1);
  });

  it("빈 입력·전부 화이트리스트 밖이면 빈 배열", () => {
    expect(buildPolicyNews([], 5)).toEqual([]);
    expect(buildPolicyNews([{ title: "x", originallink: "https://spam.com/1", link: "https://spam.com/1", pubDate: "Fri, 10 Jul 2026 06:20:00 +0900" }], 5)).toEqual([]);
  });
});
