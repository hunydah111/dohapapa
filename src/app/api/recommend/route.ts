import { z } from "zod";
import { recommendComplexes } from "@/lib/recommend";
import type { CoupleProfile } from "@/types/profile";

export const runtime = "nodejs";

// workplaceA / workplaceB 공통 shape
const workplaceSchema = z.object({
  label: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

const coupleProfileSchema = z.object({
  priorities: z.object({
    commute: z.number().min(0).max(5),
    budgetFit: z.number().min(0).max(5),
    school: z.number().min(0).max(5),
    buildingAge: z.number().min(0).max(5),
  }),
  workplaceA: workplaceSchema,
  workplaceB: workplaceSchema.optional(),
  childrenAges: z.array(z.number().int().min(0).max(25)),
  householdIncomeKrwYear: z.number().nonnegative(),
  seedMoneyKrw: z.number().nonnegative(),
  existingLoanMonthlyKrw: z.number().nonnegative(),
  hasOwnedHomeBefore: z.boolean(),
  // 미입력 시 lib/recommend 내 DEFAULT_MAX_COMMUTE_MIN 으로 폴백 — 여기서는 값 존재만 검증
  maxCommuteMinutesA: z.number().int().positive().optional(),
  maxCommuteMinutesB: z.number().int().positive().optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    // ── 1. JSON 파싱 ──────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        {
          error: "PARSE_ERROR",
          message: "요청 본문이 유효한 JSON이 아닙니다.",
        },
        { status: 400 },
      );
    }

    // ── 2. Zod 유효성 검증 ────────────────────────────────────
    const parsed = coupleProfileSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "VALIDATION",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    // ── 3. 추천 계산 ──────────────────────────────────────────
    // safeParse 통과 후 타입이 zod 추론 타입이므로 CoupleProfile 로 단언해도 안전
    const profile = parsed.data as CoupleProfile;
    const result = await recommendComplexes(profile);

    // 모든 KRW 값은 number — bigint 없으므로 JSON 직렬화 문제 없음
    return Response.json(result);
  } catch (err: unknown) {
    console.error("[recommend] 예기치 않은 오류:", err);
    return Response.json(
      {
        error: "INTERNAL",
        message: "추천 계산 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
