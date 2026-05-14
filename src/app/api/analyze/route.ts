export const runtime = "nodejs";

import { z } from "zod";
import { db } from "@/lib/db";
import { hashIp, extractIp } from "@/lib/hashIp";
import { buildComparables } from "@/lib/comparables";
import { computeScore } from "@/lib/score";
import type { ListingInput, ScoreResult } from "@/types/listing";

// ---------------------------------------------------------------------------
// Zod schema — askPriceKrw is transmitted as a decimal string to avoid JSON
// losing precision on large bigints.
// ---------------------------------------------------------------------------
const BodySchema = z.object({
  complexName: z.string().min(1),
  sigungu: z.string().optional(),
  dongName: z.string().optional(),
  askPriceKrw: z.string().transform((v) => BigInt(v)),
  area: z.number().positive(),
  floor: z.number().int().optional(),
  direction: z.string().optional(),
  description: z.string().optional(),
  externalUrl: z.string().url().optional(),
  brokerName: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Inline bigint-safe serialiser.
// ---------------------------------------------------------------------------
function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        toJsonSafe(v),
      ])
    );
  }
  return value;
}

export async function POST(req: Request): Promise<Response> {
  // 1. Parse & validate body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      { error: "PARSE_ERROR", message: "요청 본문이 유효한 JSON이 아닙니다." },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 2. Build the ListingInput object (zod output → domain type).
  const input: ListingInput = {
    complexName: data.complexName,
    sigungu: data.sigungu,
    dongName: data.dongName,
    askPriceKrw: data.askPriceKrw,
    area: data.area,
    floor: data.floor,
    direction: data.direction,
    description: data.description,
    externalUrl: data.externalUrl,
    brokerName: data.brokerName,
  };

  // 3. Find or create the Complex.
  // Priority: (a) exact (sigungu, dongName, name) match if both provided;
  //           (b) otherwise resolve by name alone — accepts the existing row
  //               if there's a single complex with that name, so users typing
  //               just "잠실엘스" still hit the seeded record. Falls back to
  //               creating a "미상/미상" placeholder when truly unknown.
  let complexId: string;
  if (data.sigungu && data.dongName) {
    const c = await db.complex.upsert({
      where: {
        sigungu_dongName_name: {
          sigungu: data.sigungu,
          dongName: data.dongName,
          name: data.complexName,
        },
      },
      create: { sigungu: data.sigungu, dongName: data.dongName, name: data.complexName },
      update: {},
      select: { id: true },
    });
    complexId = c.id;
  } else {
    const candidates = await db.complex.findMany({
      where: {
        name: data.complexName,
        ...(data.sigungu ? { sigungu: data.sigungu } : {}),
        ...(data.dongName ? { dongName: data.dongName } : {}),
      },
      select: { id: true, sigungu: true, dongName: true },
    });
    if (candidates.length === 1) {
      complexId = candidates[0].id;
    } else if (candidates.length === 0) {
      const c = await db.complex.create({
        data: {
          name: data.complexName,
          sigungu: data.sigungu ?? "미상",
          dongName: data.dongName ?? "미상",
        },
        select: { id: true },
      });
      complexId = c.id;
    } else {
      // Multiple complexes share this name; ask user to disambiguate.
      return Response.json(
        {
          error: "AMBIGUOUS_COMPLEX",
          message: `'${data.complexName}'(이)라는 단지가 여러 곳 등록되어 있습니다. 시군구·법정동을 함께 입력해 주세요.`,
          candidates: candidates.map((c) => ({ sigungu: c.sigungu, dongName: c.dongName })),
        },
        { status: 400 }
      );
    }
  }

  // 4. Build comparable transactions (may return null if < 3 exist).
  const comp = await buildComparables({
    complexId,
    area: data.area,
  });

  // 5. Compute suspicion score.
  const score: ScoreResult = computeScore(input, comp);

  // 6. Persist Listing + nested Score in one operation.
  const listing = await db.listing.create({
    data: {
      complexId,
      askPriceKrw: data.askPriceKrw,
      area: data.area,
      floor: data.floor ?? null,
      direction: data.direction ?? null,
      description: data.description ?? null,
      externalUrl: data.externalUrl ?? null,
      brokerName: data.brokerName ?? null,
      submitterIpHash: hashIp(extractIp(req)),
      score: {
        create: {
          total: score.total,
          band: score.band,
          // Stored as JSON strings (SQLite-compatible String columns).
          signals: JSON.stringify(score.signals),
          reasoning: JSON.stringify(score.reasoning),
        },
      },
    },
    select: { id: true },
  });

  // 7. Return a bigint-safe JSON response.
  return Response.json(
    toJsonSafe({
      id: listing.id,
      score: {
        total: score.total,
        band: score.band,
        signals: score.signals,
        reasoning: score.reasoning,
      },
      askPriceKrw: data.askPriceKrw.toString(),
    })
  );
}
