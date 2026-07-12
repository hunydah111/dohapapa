// og 이미지 URL 슬러그 — 발행판 단위 캐시 무효화 (2026-07-13 사장 제보).
//
// 메신저(카톡·스레드)는 og 이미지를 "스크랩 시점"에 받아 자기 서버에 캐싱한다 — 실시간
// 갱신은 원래 불가. 우리가 보장할 수 있는 건 "스크랩하는 순간 최신판이 잡히는 것"뿐인데,
// 종전 슬러그가 날짜(YYYY-MM-DD)만 담아 새벽 3단 발행(05:20/05:50/06:12)이 같은 URL을
// 썼다 — 05:20판이 캐싱되면 06:12판과 어긋난다. generatedAt이 날짜뿐이라(시각 없음)
// **지면 내용 해시**를 뒤에 붙인다: 내용이 바뀐 발행판만 새 URL, 무변경 재발행은 캐시
// 재활용. (이미 공유된 글의 카드가 그 시점 지면인 것은 신문 1판/2판과 같은 정직한
// 스냅샷 — 결함 아님.)
//
// ⚠️ og 라우트(OG_ID)와 /card 리다이렉트 타깃이 같은 슬러그를 써야 한다 — 반드시 이
// 헬퍼에 같은 content(dailyPatchRaw)를 넘겨서.

/** 발행일 + 지면 내용 해시 → "2026-07-12-x3k9f2a". content 생략 시 날짜만. */
export function ogSlug(generatedAt: string | null, content?: unknown): string {
  const base = (generatedAt ?? "pre").slice(0, 10);
  if (content === undefined) return base;
  const s = JSON.stringify(content);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${base}-${h.toString(36)}`;
}
