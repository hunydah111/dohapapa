// 팩트 카드 바로가기 — bijigo.kr/card/{동네} → 오늘자 동네판 og 카드 이미지 (2026-07-10).
//
// 용도: 뿌리기 리플 무기고. 커뮤니티·스레드 리플에 숫자만 쓰면 출처(비집고)가 안 실린다
// (사장 지적) — 제호·도메인이 박힌 그날 팩트 카드를 이미지로 첨부할 수 있게, 날짜 슬러그를
// 몰라도 되는 고정 주소를 제공한다. 이미지 자체는 opengraph-image 라우트가 렌더.
// 미지의 동네·인코딩 오류는 홈(1면) 카드로 폴백.

import { NextResponse, type NextRequest } from "next/server";
import { SIGUNGU_NAMES } from "@/lib/molit";
import dailyPatchRaw from "@/data/dailyPatch.json";
import { ogSlug } from "@/lib/ogSlug";

const patch = dailyPatchRaw as unknown as { generatedAt: string | null };
// ⚠️ opengraph-image 라우트들의 OG_ID 규약과 동일해야 한다(홈 v7- / 동네 v2- + ogSlug).
// 2026-07-13: 버전 프리픽스가 v1/v6에 묶여 있어 og v2/v7 승격 후 /card가 깨져 있었음 —
// 프리픽스를 바꾸면 이 파일도 반드시 같이(og 파일들 주석에도 명시).
const dateSlug = ogSlug(patch.generatedAt, dailyPatchRaw);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sigungu: string }> },
) {
  const { sigungu: raw } = await params;
  let decoded: string | null = null;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = null;
  }
  const target =
    decoded && SIGUNGU_NAMES.has(decoded)
      ? `/r/${encodeURIComponent(decoded)}/opengraph-image/v3-${dateSlug}`
      : `/opengraph-image/v7-${dateSlug}`;
  return NextResponse.redirect(new URL(target, req.url), 302);
}
