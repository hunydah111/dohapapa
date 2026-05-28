import { z } from "zod";
import { recommendComplexes } from "@/lib/recommend";
import type { RecommendOptions } from "@/lib/recommend";
import type { CoupleProfile } from "@/types/profile";
import { getHomeType } from "@/lib/homeType";
import { incrementTypeCount } from "@/lib/typeStats";
import { recordNeighborhoods } from "@/lib/neighborhoodChart";
import { recordPopularComplexes } from "@/lib/popularComplexChart";
import { recordBijiDistribution, getBijiDistribution } from "@/lib/bijiDistribution";
import { budgetTier, budgetTopPercent } from "@/lib/budgetPercentile";

export const runtime = "nodejs";

// ── 2-pass 재랭킹 옵션 — 클라가 모은 대중교통 실측을 넘겨 티어를 실측 기준으로 재계산 ──
const recommendOptionsSchema = z.object({
  transitOverrides: z
    .record(
      z.string(),
      z.object({
        A: z.number().int().positive().max(600).optional(),
        B: z.number().int().positive().max(600).optional(),
      }),
    )
    .optional(),
  restrictToComplexIds: z.array(z.string()).max(60).optional(),
});

// ── Workplace 스키마 — 자차/대중교통(ODsay) ───────────────────────────────────
// 대중교통 랭킹은 서버 mock(직선거리) 기준, 실측 시간은 결과 화면에서 ODsay(브라우저)로 채운다.
const workplaceSchema = z.object({
  label: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  commuteMode: z.enum(["car", "transit"]),
  maxCommuteMinutes: z.number().int().positive(),
});

// ── 기존 주택 갈아타기 스키마 ────────────────────────────────────────────────
const existingHomeSchema = z.object({
  expectedSalePriceKrw: z.number().nonnegative(),
  remainingLoanKrw: z.number().nonnegative(),
  qualifiesForTaxExemption: z.boolean(),
});

// ── 가구 프로필 스키마 ────────────────────────────────────────────────────────
const coupleProfileSchema = z
  .object({
    // P0#1: householdType 으로 1인·은퇴 분기 처리
    householdType: z.enum(["single", "dualIncome", "singleIncome", "retired"]),
    priorities: z.object({
      commute: z.number().min(0).max(5),
      school: z.number().min(0).max(5),
      buildingAge: z.number().min(0).max(5),
      largeComplex: z.number().min(0).max(5).optional(),
    }),
    preferredAreaRanges: z
      .array(
        z.enum([
          "under18",
          "p19_25",
          "p26_31",
          "p32_35",
          "p36_40",
          "p41_45",
          "over45",
        ]),
      )
      .min(1)
      .max(7),
    locationVibes: z
      .object({
        riverside: z.number().int().min(1).max(3).optional(),
        quiet: z.number().int().min(1).max(3).optional(),
      })
      .optional(),
    requiredRegions: z.array(z.string()).max(72).optional(),
    budgetFlex: z.enum(["tight", "normal", "relaxed"]).optional(),
    // 1인 가구: workplaceA 만, retired: 둘 다 없을 수 있음
    workplaceA: workplaceSchema.optional(),
    workplaceB: workplaceSchema.optional(),
    /** 초·중·고 자녀 있음 — 학군 점수 적용. */
    hasSchoolAgedChild: z.boolean(),
    /** 영유아(만 1세 이하) 있음 — 신생아 특례 디딤돌 자격 판정. */
    hasInfant: z.boolean(),
    /** 자녀 2명 이상 — 디딤돌(일반) 소득 기준 완화 판정. */
    hasTwoOrMoreChildren: z.boolean(),
    /** 자녀 3명 이상 (다자녀) — 안내용. 현 산식엔 미반영. */
    hasThreeOrMoreChildren: z.boolean(),
    /** 임신 중·출산 예정 — 안내용. 출산 후 재시뮬레이션 권고. */
    isExpectingChild: z.boolean(),
    householdIncomeKrwYear: z.number().nonnegative(),
    seedMoneyKrw: z.number().nonnegative(),
    /** 순자산 총액 (원). 정책대출 자산요건 판정용. */
    netAssetsKrw: z.number().nonnegative(),
    existingLoanMonthlyKrw: z.number().nonnegative(),
    hasOwnedHomeBefore: z.boolean(),
    /** 예산 입력 방식 — 간단(가용예산 직접) / 자세히(소득·대출 계산). */
    budgetMode: z.enum(["simple", "detailed"]).optional(),
    availableBudgetKrw: z.number().nonnegative().optional(),
    ownedHomeCount: z.number().int().min(0).max(10).optional(),
    additionalFundsKrw: z.number().nonnegative().optional(),
    /** 혼인 7년 이내 신혼 여부. 정책대출 신혼 요건 판정용. */
    isNewlywed: z.boolean(),
    existingHome: existingHomeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const { householdType, workplaceA, workplaceB } = data;

    if (householdType === "dualIncome") {
      // 맞벌이: workplaceA·B 둘 다 필수
      if (!workplaceA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workplaceA"],
          message: "맞벌이(dualIncome) 가구는 workplaceA 가 필수입니다.",
        });
      }
      if (!workplaceB) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workplaceB"],
          message: "맞벌이(dualIncome) 가구는 workplaceB 가 필수입니다.",
        });
      }
    } else if (householdType === "single" || householdType === "singleIncome") {
      // 1인·외벌이: workplaceA 필수, workplaceB 금지
      if (!workplaceA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workplaceA"],
          message: `${householdType === "single" ? "1인(single)" : "외벌이(singleIncome)"} 가구는 workplaceA 가 필수입니다.`,
        });
      }
      if (workplaceB !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workplaceB"],
          message: `${householdType === "single" ? "1인(single)" : "외벌이(singleIncome)"} 가구는 workplaceB 를 입력할 수 없습니다.`,
        });
      }
    } else if (householdType === "retired") {
      // 은퇴: 직장 정보 둘 다 금지
      if (workplaceA !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workplaceA"],
          message: "은퇴(retired) 가구는 workplaceA 를 입력할 수 없습니다.",
        });
      }
      if (workplaceB !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workplaceB"],
          message: "은퇴(retired) 가구는 workplaceB 를 입력할 수 없습니다.",
        });
      }
    }
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

    // 재랭킹 옵션(있으면) — 본문에서 별도 파싱. 실패해도 기본 추천은 진행.
    const optsParsed = recommendOptionsSchema.safeParse(body);
    const opts: RecommendOptions = optsParsed.success ? optsParsed.data : {};

    const result = await recommendComplexes(profile, opts);

    // 집계 — pass-1(최초 검색)에서만. 2-pass 대중교통 재랭킹(restrictToComplexIds)은
    // 같은 세션의 재계산이라 중복 카운트 방지로 건너뛴다. 모두 비-PII(슬러그·시군구만).
    if (!opts.restrictToComplexIds) {
      await incrementTypeCount(getHomeType(profile).slug);
      // 주간 동네 인기차트 — 상위 후보의 시군구만 집계. 결과 0건이면 가장 가까운 후보로.
      const src =
        result.candidates.length > 0
          ? result.candidates
          : result.closestCandidates;
      await recordNeighborhoods(src.map((c) => c.sigungu));
      // 주간 인기 아파트 차트 — 상위 단지 집계(비-PII: 단지명·시군구·동만).
      await recordPopularComplexes(
        src.map((c) => ({
          complexId: c.complexId,
          complexName: c.complexName,
          sigungu: c.sigungu,
          dongName: c.dongName,
        })),
      );
      // 동네 비지 분포 — top 후보 시군구 + 사용자 등급 누적. 분포 조회는 record 직후라
      // 사용자 본인 카운트도 표시 분포에 포함됨 (자연스러움).
      const topPct = budgetTopPercent(result.budget.netPurchasePowerKrw);
      if (topPct != null && src.length > 0) {
        const tier = budgetTier(topPct);
        await recordBijiDistribution(src[0].sigungu, tier.slug);
        result.bijiDistribution = await getBijiDistribution(src[0].sigungu, tier.slug);
      }
    }

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
