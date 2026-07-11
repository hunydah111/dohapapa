// 하위호환 리다이렉트 — 종전 /card/major(raw og 카드 302)는 스레드·카톡에 붙이면
// 이미지로만 떠 탭해도 홈에 안 왔다(유입 실패). 이제 클릭되는 링크카드 페이지 /s/major
// 로 넘긴다(2026-07-11 사장 지시). 외부에 이미 뿌려진 /card/major 링크의 하위호환용 —
// 새 공유는 전부 /s/major 를 쓴다(DailyFront ShareButton). 카드 이미지는 /s/major 페이지의
// opengraph-image 가 렌더.

import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/s/major", req.url), 302);
}
