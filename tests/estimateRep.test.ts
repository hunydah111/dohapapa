import { describe, it, expect } from "vitest";
import { estimateRepFromComps, type CompPoint, type TargetInfo } from "@/lib/recommend/estimateRep";

// 기준점(개포 부근). 경도 0.0034°≈0.3km, 0.057°≈5km (위도 37.5 기준).
const BASE = { lat: 37.49, lng: 127.05 };
const farRiver = 8; // 한강에서 먼 단지(km)

const comp = (
  buildYear: number,
  perM2man: number,
  lngOff: number,
  riverKm = farRiver,
): CompPoint => ({
  buildYear,
  perM2: perM2man * 10_000,
  area: 84,
  lat: BASE.lat,
  lng: BASE.lng + lngOff,
  riverKm,
});

const target = (over: Partial<TargetInfo> = {}): TargetInfo => ({
  buildYear: 2023,
  lat: BASE.lat,
  lng: BASE.lng,
  riverKm: farRiver,
  ...over,
});

describe("estimateRepFromComps — 거리·연식·한강근접 가중 환산", () => {
  // 같은 해 대장(0km)·옛 단지(가까이)들. ㎡단가 만원 단위.
  const comps: CompPoint[] = [
    comp(2023, 4483, 0), // 같은 해, 같은 위치 → 지배적
    comp(2020, 4007, 0.0034), // 0.3km
    comp(2019, 4179, 0.0057), // 0.5km
  ];

  it("연식·거리 가까운 같은 해 대장에 수렴(2023 → 37억대)", () => {
    const est = estimateRepFromComps(comps, target());
    expect(est).not.toBeNull();
    expect(est!.area).toBe(84);
    expect(est!.priceKrw / 1e8).toBeGreaterThan(36.5);
    expect(est!.priceKrw / 1e8).toBeLessThan(38);
  });

  it("비교 단지 3곳 미만이면 null", () => {
    expect(estimateRepFromComps(comps.slice(0, 2), target())).toBeNull();
    expect(estimateRepFromComps([], target())).toBeNull();
    expect(estimateRepFromComps(undefined, target())).toBeNull();
  });

  it("연식 정보 없으면 null", () => {
    expect(estimateRepFromComps(comps, target({ buildYear: null }))).toBeNull();
  });

  it("반경(3km) 밖 비교점은 제외 — 남은 게 부족하면 null", () => {
    const far: CompPoint[] = [
      comp(2023, 4483, 0.057), // ~5km
      comp(2022, 4400, 0.06),
      comp(2024, 4500, 0.065),
    ];
    expect(estimateRepFromComps(far, target())).toBeNull();
  });

  it("한강근접 유사도 — 한강변 타깃은 한강변 comp에 가중된다", () => {
    // 같은 해·같은 거리, 한쪽은 한강변(0.2km) 비싸고 한쪽은 내륙(8km) 쌈.
    const river: CompPoint[] = [
      comp(2023, 6000, 0.001, 0.2), // 한강변 대장
      comp(2023, 6000, 0.0012, 0.2),
      comp(2023, 4000, 0.001, 8), // 내륙
      comp(2023, 4000, 0.0012, 8),
    ];
    const riversideTarget = estimateRepFromComps(river, target({ riverKm: 0.2 }));
    const inlandTarget = estimateRepFromComps(river, target({ riverKm: 8 }));
    // 한강변 타깃은 비싼(한강변) comp 쪽으로, 내륙 타깃은 싼 쪽으로 갈린다.
    expect(riversideTarget!.priceKrw).toBeGreaterThan(inlandTarget!.priceKrw);
  });
});
