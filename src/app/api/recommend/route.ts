import { z } from "zod";
import { recommendComplexes } from "@/lib/recommend";
import type { CoupleProfile } from "@/types/profile";

export const runtime = "nodejs";

// ── Workplace 스키마 — commuteMode·maxCommuteMinutes 를 직장별로 보유 ────────
// (P1#4: 맞벌이에서 본인은 자차, 배우자는 지하철처럼 수단이 다를 수 있다.)
const workplaceSchema = z.object({
  label: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  commuteMode: z.enum(["transit", "car"]),
  maxCommuteMinutes: z.number().int().positive(),
});

// ── 기존 주택 갈아타기 스키마 ────────────────────────────────────────────────
const existingHomeSchema = z.object({
  expectedSalePriceKrw: z.number().nonnegative(),
  remainingLoanKrw: z.number().nonnegative(),
  qualifiesForTaxExemption: z.boolean(),
});

// ── 가구 프로필 스키마 ────────────────────────────────────────────────────────
const coupleProfileSchema = z.object({
  // P0#1: householdType 으로 1인·은퇴 분기 처리
  householdType: z.enum(["single", "dualIncome", "singleIncome", "retired"]),
  priorities: z.object({
    commute: z.number().min(0).max(5),
    school: z.number().min(0).max(5),
    buildingAge: z.number().min(0).max(5),
  }),
  preferredAreaRange: z.enum([
    "under18",
    "p19_25",
    "p26_31",
    "p32_35",
    "p36_40",
    "p41_45",
    "over45",
  ]),
  // 1인 가구: workplaceA 만, retired: 둘 다 없을 수 있음
  workplaceA: workplaceSchema.optional(),
  workplaceB: workplaceSchema.optional(),
  childrenAges: z.array(z.number().int().min(0).max(25)),
  householdIncomeKrwYear: z.number().nonnegative(),
  seedMoneyKrw: z.number().nonnegative(),
  existingLoanMonthlyKrw: z.number().nonnegative(),
  hasOwnedHomeBefore: z.boolean(),
  existingHome: existingHomeSchema.optional(),
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
    // safeParse 통과 후 zod 추론 타입이 CoupleProfile 와 일치하므로 단언 안전
    const profile = parsed.data as CoupleProfile;
    const result = await recommendComplexes(profile);

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
