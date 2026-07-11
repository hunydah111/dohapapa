// 주요 거래 카드 바로가기 — bijigo.kr/card/major → 오늘자 [주요 거래 TOP 7] og 카드 이미지
// (2026-07-11). 정적 세그먼트라 /card/[sigungu] 동적 라우트보다 먼저 매칭된다.
//
// 용도: 1면 [주요 거래] 코너의 원탭 공유 대상. 날짜 슬러그를 몰라도 되는 고정 주소를 주고,
// 이미지 자체는 /major/opengraph-image 라우트가 렌더. 스레드·단톡에 이 링크를 붙이면
// 그날 큰 거래 TOP 7 카드가 뜬다 — 매번 캡쳐·짤린 크롭 없이.

import { NextResponse, type NextRequest } from "next/server";
import dailyPatchRaw from "@/data/dailyPatch.json";

const patch = dailyPatchRaw as unknown as { generatedAt: string | null };
// major/opengraph-image 의 OG_ID 규약과 동일해야 한다(v1- + 발행일).
const dateSlug = (patch.generatedAt ?? "pre").slice(0, 10);

export async function GET(req: NextRequest) {
  return NextResponse.redirect(
    new URL(`/major/opengraph-image/v1-${dateSlug}`, req.url),
    302,
  );
}
