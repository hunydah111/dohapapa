import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// ── 대중교통(ODsay) 통근시간 캐시 ─────────────────────────────────────────────
// ODsay 는 브라우저(클라이언트)에서 호출하므로(URI 키), 결과를 이 라우트로 받아
// CommuteCache(mode="transit")에 적재해 모든 사용자가 재사용한다. 대중교통 시간은
// 스케줄 고정이라 사실상 영구 캐시 — 무료 쿼터(1,000콜/일) 안에서 운영하기 위함.
// PII 없음: 직장 좌표는 100m로 반올림한 originKey 로만 저장(프로필은 저장 안 함).

const lookupLegSchema = z.object({
  key: z.string().min(1).max(80),
  complexId: z.string().min(1),
  originLat: z.number(),
  originLng: z.number(),
});

const saveLegSchema = z.object({
  complexId: z.string().min(1),
  originLat: z.number(),
  originLng: z.number(),
  minutes: z.number().int().positive().max(600),
});

const bodySchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("lookup"), legs: z.array(lookupLegSchema).min(1).max(20) }),
  z.object({ op: z.literal("save"), legs: z.array(saveLegSchema).min(1).max(20) }),
]);

// 직장 좌표를 소수점 3자리(~100m)로 반올림 — 인근 직장끼리 캐시 공유 + 좌표 익명화.
function originKeyOf(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "PARSE_ERROR" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    if (data.op === "lookup") {
      const rows = await db.commuteCache.findMany({
        where: {
          mode: "transit",
          OR: data.legs.map((l) => ({
            originKey: originKeyOf(l.originLat, l.originLng),
            complexId: l.complexId,
          })),
        },
      });
      const byPair = new Map(
        rows.map((r) => [`${r.originKey}|${r.complexId}`, r.minutes]),
      );
      const results: Record<string, number | null> = {};
      for (const l of data.legs) {
        const m = byPair.get(
          `${originKeyOf(l.originLat, l.originLng)}|${l.complexId}`,
        );
        results[l.key] = typeof m === "number" ? m : null;
      }
      return Response.json({ results });
    }

    // op === "save"
    await Promise.all(
      data.legs.map((l) => {
        const originKey = originKeyOf(l.originLat, l.originLng);
        return db.commuteCache.upsert({
          where: {
            originKey_complexId_mode: { originKey, complexId: l.complexId, mode: "transit" },
          },
          update: { minutes: l.minutes },
          create: { originKey, complexId: l.complexId, mode: "transit", minutes: l.minutes },
        });
      }),
    );
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[transit] 캐시 처리 오류:", err);
    return Response.json({ error: "INTERNAL" }, { status: 500 });
  }
}
