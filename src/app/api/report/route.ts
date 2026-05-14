export const runtime = "nodejs";

import { z } from "zod";
import { db } from "@/lib/db";
import { hashIp, extractIp } from "@/lib/hashIp";

const ALLOWED_REASONS = [
  "방금나갔다고함",
  "전화안받음",
  "사진과다름",
  "가격다름",
  "기타",
] as const;

const BodySchema = z.object({
  listingId: z.string().min(1),
  reason: z.enum(ALLOWED_REASONS),
  description: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  // 1. Parse body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      { error: "PARSE_ERROR", message: "요청 본문이 유효한 JSON이 아닙니다." },
      { status: 400 }
    );
  }

  // 2. Validate.
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { listingId, reason, description } = parsed.data;

  // 3. Verify the target listing exists before creating the report.
  const listingExists = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  });

  if (!listingExists) {
    return Response.json(
      { error: "NOT_FOUND", message: "해당 매물을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 4. Persist the Report.
  await db.report.create({
    data: {
      listingId,
      reason,
      description: description ?? null,
      reporterIpHash: hashIp(extractIp(req)),
    },
  });

  return Response.json({ ok: true });
}
