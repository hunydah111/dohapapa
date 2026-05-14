import { describe, it, expect } from "vitest";
import { parseNaverUrl } from "@/lib/parseNaverUrl";

describe("parseNaverUrl", () => {
  // ────────────────────────────────────────────────────────
  // Non-Naver / unrecognized URLs
  // ────────────────────────────────────────────────────────

  it("returns recognized=false for a non-Naver URL", () => {
    const result = parseNaverUrl("https://www.daum.net/property/12345");
    expect(result.recognized).toBe(false);
    expect(result.naverListingId).toBeNull();
    expect(result.note).toMatch(/네이버 부동산/);
  });

  it("returns recognized=false for an empty string", () => {
    const result = parseNaverUrl("");
    expect(result.recognized).toBe(false);
    expect(result.naverListingId).toBeNull();
  });

  it("returns recognized=false for a whitespace-only string", () => {
    const result = parseNaverUrl("   ");
    expect(result.recognized).toBe(false);
    expect(result.naverListingId).toBeNull();
  });

  it("returns recognized=false for a non-real-estate Naver URL", () => {
    const result = parseNaverUrl("https://news.naver.com/article/12345");
    expect(result.recognized).toBe(false);
    expect(result.naverListingId).toBeNull();
  });

  // ────────────────────────────────────────────────────────
  // Legacy: land.naver.com/article/<id>
  // ────────────────────────────────────────────────────────

  it("parses legacy URL: land.naver.com/article/<id>", () => {
    const result = parseNaverUrl("https://land.naver.com/article/2398457201");
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
    expect(result.partial.externalUrl).toBe("https://land.naver.com/article/2398457201");
  });

  it("parses legacy URL with trailing slash", () => {
    const result = parseNaverUrl("https://land.naver.com/article/2398457201/");
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses legacy URL with extra query params", () => {
    const result = parseNaverUrl(
      "https://land.naver.com/article/2398457201?ref=main"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses legacy URL with hash fragment", () => {
    const result = parseNaverUrl(
      "https://land.naver.com/article/2398457201#overview"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses legacy URL over http (not https)", () => {
    const result = parseNaverUrl("http://land.naver.com/article/9876543210");
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("9876543210");
  });

  // ────────────────────────────────────────────────────────
  // Mobile: m.land.naver.com/article/info/<id>
  // ────────────────────────────────────────────────────────

  it("parses mobile URL: m.land.naver.com/article/info/<id>", () => {
    const result = parseNaverUrl(
      "https://m.land.naver.com/article/info/1122334455"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("1122334455");
    expect(result.partial.externalUrl).toContain("m.land.naver.com");
  });

  it("parses mobile URL with query params", () => {
    const result = parseNaverUrl(
      "https://m.land.naver.com/article/info/1122334455?tab=detail"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("1122334455");
  });

  it("parses mobile URL over http", () => {
    const result = parseNaverUrl(
      "http://m.land.naver.com/article/info/5544332211"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("5544332211");
  });

  // ────────────────────────────────────────────────────────
  // Current desktop: new.land.naver.com/articles/<id>
  // ────────────────────────────────────────────────────────

  it("parses current desktop URL: new.land.naver.com/articles/<id>", () => {
    const result = parseNaverUrl(
      "https://new.land.naver.com/articles/2398457201"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses current desktop URL with trailing slash", () => {
    const result = parseNaverUrl(
      "https://new.land.naver.com/articles/2398457201/"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses current desktop URL with extra query params", () => {
    const result = parseNaverUrl(
      "https://new.land.naver.com/articles/2398457201?ms=37.5,127.0,15"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses current desktop URL over http", () => {
    const result = parseNaverUrl(
      "http://new.land.naver.com/articles/3344556677"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("3344556677");
  });

  // ────────────────────────────────────────────────────────
  // Complex page: new.land.naver.com/complexes/<complexId>?articleNo=<id>
  // ────────────────────────────────────────────────────────

  it("parses complex page URL with articleNo query param", () => {
    const result = parseNaverUrl(
      "https://new.land.naver.com/complexes/112233?articleNo=2398457201"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses complex page URL with articleNo and additional query params", () => {
    const result = parseNaverUrl(
      "https://new.land.naver.com/complexes/112233?articleNo=2398457201&tab=complex"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("2398457201");
  });

  it("parses complex page URL with articleNo param in different order", () => {
    const result = parseNaverUrl(
      "https://new.land.naver.com/complexes/998877?tab=article&articleNo=7654321"
    );
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBe("7654321");
  });

  it("recognizes complex page URL without articleNo param but cannot extract id", () => {
    // URL matches complex path pattern but has no articleNo
    const result = parseNaverUrl(
      "https://new.land.naver.com/complexes/112233"
    );
    // The URL is a Naver land URL; path pattern matches, but no articleNo
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBeNull();
    expect(result.note).toMatch(/매물 ID를 추출하지 못했습니다/);
  });

  // ────────────────────────────────────────────────────────
  // Recognized host but unmatched path
  // ────────────────────────────────────────────────────────

  it("returns recognized=true but null id for a Naver land URL with unknown path", () => {
    const result = parseNaverUrl("https://new.land.naver.com/some/unknown/path");
    // Host matches Naver land but no path pattern matches → recognized=true, id=null
    expect(result.recognized).toBe(true);
    expect(result.naverListingId).toBeNull();
    expect(result.note).toMatch(/매물 ID를 추출하지 못했습니다/);
  });

  // ────────────────────────────────────────────────────────
  // Return shape invariants
  // ────────────────────────────────────────────────────────

  it("always returns a partial object (even if empty)", () => {
    const result = parseNaverUrl("https://example.com/not-naver");
    expect(result.partial).toBeDefined();
    expect(typeof result.partial).toBe("object");
  });

  it("sets partial.externalUrl to the original URL when id is found", () => {
    const url = "https://new.land.naver.com/articles/1234567890";
    const result = parseNaverUrl(url);
    expect(result.partial.externalUrl).toBe(url);
  });

  it("returns a Korean note string in all cases", () => {
    const urls = [
      "",
      "https://example.com",
      "https://land.naver.com/article/123",
      "https://new.land.naver.com/articles/456",
    ];
    for (const url of urls) {
      const result = parseNaverUrl(url);
      expect(typeof result.note).toBe("string");
      expect(result.note.length).toBeGreaterThan(0);
    }
  });
});
