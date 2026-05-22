import { z } from "zod";
import { getNeighborhood } from "@/lib/neighborhood";
import type { NeighborhoodData } from "@/lib/neighborhood";

export const runtime = "nodejs";

// 표시 단지(상위 후보)의 동네 시설 집계. 좌표는 추천 결과의 단지 좌표 그대로.
const bodySchema = z.object({
  points: z
    .array(
      z.object({
        id: z.string(),
        lat: z.number(),
        lng: z.number(),
        transactionCount: z.number().nonnegative().default(0),
      }),
    )
    .max(12),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "PARSE_ERROR" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const results: Record<string, NeighborhoodData | null> = {};
  await Promise.all(
    parsed.data.points.map(async (p) => {
      results[p.id] = await getNeighborhood(p.lat, p.lng, p.transactionCount);
    }),
  );

  return Response.json({ results });
}
