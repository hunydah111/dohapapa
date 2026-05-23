// 주간 동네 인기차트 "부트스트랩" 시드 (일회성).
// 실유저 트래픽을 기다리지 않고, 대표 가구 프로필 묶음을 실제 추천엔진에 돌려 나온
// 진짜 시군구 분포로 이번 주 차트를 채운다. 가짜 숫자 조작이 아니라 차트 정의
// ("비집고에서 조건에 맞아 많이 뜬 동네")와 같은 산식의 결과다.
//
// 비용: 카카오 키를 비워(아래 delete) mock 통근으로만 돌려 외부 API 호출 0.
// 워크플레이스는 좌표를 직접 줘 geocoding 도 안 탄다.
//
// ⚠️ 멱등 아님 — 다시 돌리면 같은 주 버킷에 표가 더해진다(부트스트랩용 1회 실행).
// 실행:  npx tsx --env-file=.env.local scripts/seed-neighborhood-chart.ts

// 카카오 키 제거 → getProvider() 가 mockProvider 선택(호출 시점에 env 읽음). 비용 0.
delete process.env.KAKAO_REST_KEY;

import { recommendComplexes } from "@/lib/recommend";
import {
  recordNeighborhoods,
  getNeighborhoodChart,
} from "@/lib/neighborhoodChart";
import { DEFAULT_PRIORITIES, DEFAULT_AREA_RANGE } from "@/types/profile";
import type { CoupleProfile, HouseholdType } from "@/types/profile";

type Pt = { lat: number; lng: number; label: string };

// 수도권 주요 직장 거점
const W = {
  강남: { lat: 37.4979, lng: 127.0276, label: "강남역" },
  여의도: { lat: 37.5219, lng: 126.9245, label: "여의도" },
  판교: { lat: 37.3947, lng: 127.1112, label: "판교역" },
  광화문: { lat: 37.5663, lng: 126.9779, label: "광화문" },
  구로: { lat: 37.4853, lng: 126.9015, label: "구로디지털단지" },
  가산: { lat: 37.4795, lng: 126.8826, label: "가산디지털단지" },
  상암: { lat: 37.5797, lng: 126.8895, label: "상암DMC" },
  마곡: { lat: 37.5601, lng: 126.8254, label: "마곡" },
  잠실: { lat: 37.5133, lng: 127.1, label: "잠실" },
  정자: { lat: 37.365, lng: 127.1085, label: "분당 정자" },
  수원: { lat: 37.2659, lng: 127.0001, label: "수원역" },
  일산: { lat: 37.668, lng: 126.746, label: "일산 킨텍스" },
  용산: { lat: 37.5299, lng: 126.9648, label: "용산" },
  성수: { lat: 37.5446, lng: 127.056, label: "성수" },
  영등포: { lat: 37.5157, lng: 126.9072, label: "영등포" },
  평촌: { lat: 37.3925, lng: 126.9568, label: "안양 평촌" },
  과천: { lat: 37.4292, lng: 126.9876, label: "과천" },
  하남: { lat: 37.5392, lng: 127.2147, label: "하남" },
} satisfies Record<string, Pt>;

function wp(p: Pt) {
  return { label: p.label, lat: p.lat, lng: p.lng, commuteMode: "car" as const, maxCommuteMinutes: 60 };
}

function profile(opts: {
  wpA: Pt;
  wpB?: Pt;
  eok: number; // 가용 예산(억)
  household?: HouseholdType;
}): CoupleProfile {
  return {
    householdType: opts.household ?? (opts.wpB ? "dualIncome" : "single"),
    priorities: { ...DEFAULT_PRIORITIES },
    preferredAreaRanges: [DEFAULT_AREA_RANGE],
    budgetFlex: "normal",
    workplaceA: wp(opts.wpA),
    workplaceB: opts.wpB ? wp(opts.wpB) : undefined,
    hasSchoolAgedChild: false,
    hasInfant: false,
    hasTwoOrMoreChildren: false,
    hasThreeOrMoreChildren: false,
    isExpectingChild: false,
    budgetMode: "simple",
    availableBudgetKrw: Math.round(opts.eok * 100_000_000),
    householdIncomeKrwYear: 80_000_000,
    seedMoneyKrw: Math.round(opts.eok * 100_000_000),
    netAssetsKrw: Math.round(opts.eok * 100_000_000),
    existingLoanMonthlyKrw: 0,
    hasOwnedHomeBefore: false,
    isNewlywed: false,
  };
}

// 직장×예산을 다양하게 — 결과가 여러 시군구로 자연스럽게 퍼지도록.
const PROFILES: CoupleProfile[] = [
  profile({ wpA: W.강남, eok: 18 }),
  profile({ wpA: W.강남, eok: 11 }),
  profile({ wpA: W.강남, eok: 7 }),
  profile({ wpA: W.여의도, eok: 14 }),
  profile({ wpA: W.여의도, eok: 8 }),
  profile({ wpA: W.판교, eok: 13 }),
  profile({ wpA: W.판교, eok: 8 }),
  profile({ wpA: W.광화문, eok: 12 }),
  profile({ wpA: W.광화문, eok: 7 }),
  profile({ wpA: W.구로, eok: 7 }),
  profile({ wpA: W.가산, eok: 6 }),
  profile({ wpA: W.상암, eok: 9 }),
  profile({ wpA: W.마곡, eok: 8 }),
  profile({ wpA: W.잠실, eok: 13 }),
  profile({ wpA: W.정자, eok: 10 }),
  profile({ wpA: W.수원, eok: 6 }),
  profile({ wpA: W.일산, eok: 6 }),
  profile({ wpA: W.용산, eok: 15 }),
  profile({ wpA: W.성수, eok: 12 }),
  profile({ wpA: W.영등포, eok: 8 }),
  profile({ wpA: W.평촌, eok: 7 }),
  profile({ wpA: W.과천, eok: 14 }),
  profile({ wpA: W.하남, eok: 9 }),
  profile({ wpA: W.강남, wpB: W.판교, eok: 13 }),
  profile({ wpA: W.여의도, wpB: W.광화문, eok: 12 }),
  profile({ wpA: W.잠실, wpB: W.강남, eok: 11 }),
];

async function main() {
  console.log(`시드 시작 — 프로필 ${PROFILES.length}개 (mock 통근, 카카오 0비용)`);
  let recorded = 0;
  for (let i = 0; i < PROFILES.length; i++) {
    try {
      const result = await recommendComplexes(PROFILES[i], {});
      const src =
        result.candidates.length > 0 ? result.candidates : result.closestCandidates;
      const sgg = src.map((c) => c.sigungu);
      await recordNeighborhoods(sgg);
      recorded++;
      console.log(`  [${i + 1}/${PROFILES.length}] ${PROFILES[i].workplaceA?.label} ${(PROFILES[i].availableBudgetKrw ?? 0) / 1e8}억 → ${[...new Set(sgg)].slice(0, 3).join(", ") || "(없음)"}`);
    } catch (e) {
      console.warn(`  [${i + 1}] 실패:`, (e as Error).message);
    }
  }
  console.log(`\n기록 완료: ${recorded}/${PROFILES.length}`);
  const chart = await getNeighborhoodChart();
  console.log(`\n=== 이번 주(${chart.week}) 인기 동네 (total ${chart.total}) ===`);
  for (const e of chart.entries) {
    console.log(`  ${e.rank}. ${e.sigungu} — ${e.count}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
