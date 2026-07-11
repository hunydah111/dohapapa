// [정책 브리핑] 뉴스 수집 — 네이버 뉴스 검색 API 로 대출·부동산 정책 기사를 모아
// 신뢰 언론사만 걸러 src/data/policyNews.json 에 적재(일간 크론). 앱은 런타임에 이 JSON 만
// 읽는다(요청당 외부 API 0). 키 없으면 placeholder 유지(빌드·페이지 graceful).
//
// 편집 헌장: 우리가 정책을 주장하지 않고 언론 링크만 큐레이션 — policyNews.ts 상단 주석 참조.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildPolicyNews,
  type PolicyNewsFile,
  type RawNaverNews,
} from "../src/lib/policyNews";

// 대출·정책 뉴스 겨냥 질의어 — 각각 최신순으로 받아 병합·중복제거(buildPolicyNews).
const QUERIES = [
  "주택담보대출 한도",
  "부동산 대출 규제",
  "생애최초 대출",
  "디딤돌 대출",
  "DSR 대출 대책",
];

const DEST = resolve(process.cwd(), "src/data/policyNews.json");

async function searchNews(
  query: string,
  id: string,
  secret: string,
): Promise<RawNaverNews[]> {
  const url =
    `https://openapi.naver.com/v1/search/news.json` +
    `?query=${encodeURIComponent(query)}&display=20&sort=date`;
  const res = await fetch(url, {
    headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
  });
  if (!res.ok) {
    console.error(`네이버 뉴스 검색 실패(${query}): ${res.status} ${res.statusText}`);
    return [];
  }
  const data = (await res.json()) as { items?: RawNaverNews[] };
  return data.items ?? [];
}

function writePlaceholderAndExit(reason: string): void {
  console.warn(`[정책 브리핑] ${reason} — placeholder 유지.`);
  const placeholder: PolicyNewsFile = { generatedAt: null, items: [] };
  writeFileSync(DEST, JSON.stringify(placeholder), "utf-8");
}

async function main(): Promise<void> {
  const id = process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!id || !secret) {
    writePlaceholderAndExit("NAVER_SEARCH_CLIENT_ID/SECRET 미설정");
    return;
  }

  const merged: RawNaverNews[] = [];
  for (const q of QUERIES) {
    const items = await searchNews(q, id, secret);
    merged.push(...items);
    // 네이버 API 초당 제한 여유 — 질의 간 짧은 간격.
    await new Promise((r) => setTimeout(r, 200));
  }

  const items = buildPolicyNews(merged, 5);
  if (items.length === 0) {
    writePlaceholderAndExit("신뢰 언론사 기사 0건");
    return;
  }

  const out: PolicyNewsFile = {
    generatedAt: new Date().toISOString(),
    items,
  };
  writeFileSync(DEST, JSON.stringify(out), "utf-8");
  console.log(
    `[정책 브리핑] ${items.length}건 적재 → ${DEST}\n` +
      items.map((i) => `  ${i.dateISO} · ${i.source} · ${i.title}`).join("\n"),
  );
}

main().catch((err) => {
  console.error("[정책 브리핑] 수집 오류:", err);
  // 실패해도 빌드/페이지가 죽지 않게 placeholder 로 폴백.
  writePlaceholderAndExit("수집 중 예외");
  process.exitCode = 0;
});
