// /api/react — 오늘의 반응 스탬프 API (v2.6).
//
// POST {dealKey, stamp}: 화이트리스트 검증. 어뷰징 저항 원칙 — 유효하지 않은 입력은
//   429/400이 아니라 200 {ok:false}로 조용히 무시한다(스크립트에 판별 신호를 안 준다).
// GET ?dealKeys=k1,k2 (각 키 encodeURIComponent): 오늘(새벽 3시 경계) 집계 일괄 반환
//   — 동네면 한 페이지 분량 배치 1회 조회. 캐시 없음(동적).
// GET ?top=1: 오늘 최다 참여 거래 1건 — 내일 지면 "어제 최다 반응" 환류용(UI 스코프 밖).
//
// 개인정보·IP 저장 금지 — 서버에는 (dateKey, dealKey, stamp)별 카운트만 남는다.
// 중복 방지는 클라이언트 localStorage(1일 1거래 1스탬프) — 서버 강제는 v1 스코프 밖.

import { z } from "zod";
import {
  isReactionStamp,
  reactionDateKey,
  summarizeReactions,
  topReaction,
  REACTION_MAX_BATCH_KEYS,
  REACTION_MAX_DEAL_KEY_LEN,
} from "@/lib/reaction";
import { recordReaction, readTodayReactionRows } from "@/lib/reactionStore";

export const runtime = "nodejs";
// 빌드 타임 프리렌더 금지 — 집계는 요청 시점 "오늘 키" 기준(캐시 없음).
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/** dealKey 최소 위생 — patchNote dealKey 규격(구분자 "|" 5개 이상)·제어문자 금지.
 *  내용 검증은 하지 않는다(존재하지 않는 거래 키는 그냥 아무도 안 보는 카운터). */
function isPlausibleDealKey(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length > 0 &&
    v.length <= REACTION_MAX_DEAL_KEY_LEN &&
    v.split("|").length >= 6 &&
    !/[\u0000-\u001f\u007f]/.test(v)
  );
}

const postSchema = z.object({
  dealKey: z.string(),
  stamp: z.string(),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 200, headers: NO_STORE });
  }
  const parsed = postSchema.safeParse(body);
  if (
    !parsed.success ||
    !isReactionStamp(parsed.data.stamp) ||
    !isPlausibleDealKey(parsed.data.dealKey)
  ) {
    // 무엇이 틀렸는지 알려주지 않는다 — 200 무시(어뷰징 저항).
    return Response.json({ ok: false }, { status: 200, headers: NO_STORE });
  }
  const dateKey = reactionDateKey();
  await recordReaction(dateKey, parsed.data.dealKey, parsed.data.stamp);
  return Response.json({ ok: true, dateKey }, { status: 200, headers: NO_STORE });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const dateKey = reactionDateKey();

  // ── ?top=1 — 오늘 최다 참여 거래(이상 감지 거래 제외) ──
  if (url.searchParams.get("top") === "1") {
    const rows = await readTodayReactionRows(dateKey);
    return Response.json({ dateKey, top: topReaction(rows) }, { headers: NO_STORE });
  }

  // ── 배치 집계 — ?dealKeys=k1,k2 (각 키는 encodeURIComponent, 쉼표로 연결) ──
  const rawParam = url.searchParams.get("dealKeys") ?? "";
  const dealKeys = rawParam
    .split(",")
    .map((k) => {
      try {
        return decodeURIComponent(k);
      } catch {
        return "";
      }
    })
    .filter(isPlausibleDealKey)
    .slice(0, REACTION_MAX_BATCH_KEYS);

  if (dealKeys.length === 0) {
    return Response.json({ dateKey, reactions: {} }, { headers: NO_STORE });
  }

  const rows = await readTodayReactionRows(dateKey);
  const summaries = summarizeReactions(rows, dealKeys);
  return Response.json(
    {
      dateKey,
      reactions: Object.fromEntries(summaries.map((s) => [s.dealKey, s])),
    },
    { headers: NO_STORE },
  );
}
