import { describe, it, expect } from "vitest";
import { mockProvider } from "@/lib/commute/mockProvider";
import type { LatLng } from "@/types/profile";

describe("mockProvider.travelMinutes", () => {
  it("identical origin and dest → returns minimum (5) or only overhead", async () => {
    const point: LatLng = { lat: 37.5665, lng: 126.978 };
    const transitMinutes = await mockProvider.travelMinutes(point, point, "transit");
    const carMinutes = await mockProvider.travelMinutes(point, point, "car");

    // distance = 0 → transit: round(0) + 12 = 12 → max(5, 12) = 12
    //              car: round(0) + 5 = 5 → max(5, 5) = 5
    expect(transitMinutes).toBe(12);
    expect(carMinutes).toBe(5);
  });

  it("~9km apart (Gangnam to Yeouido): transit and car both return positive integers, transit > car", async () => {
    // Gangnam station area
    const gangnam: LatLng = { lat: 37.4979, lng: 127.0276 };
    // Yeouido area (~9km west)
    const yeouido: LatLng = { lat: 37.5219, lng: 126.9245 };

    const transitMinutes = await mockProvider.travelMinutes(gangnam, yeouido, "transit");
    const carMinutes = await mockProvider.travelMinutes(gangnam, yeouido, "car");

    expect(transitMinutes).toBeGreaterThan(0);
    expect(carMinutes).toBeGreaterThan(0);
    expect(Number.isInteger(transitMinutes)).toBe(true);
    expect(Number.isInteger(carMinutes)).toBe(true);
    // transit (22km/h + 12min overhead) is slower than car (28km/h + 5min overhead)
    expect(transitMinutes).toBeGreaterThan(carMinutes);
  });

  it("result is always an integer >= 5 for various inputs", async () => {
    const cases: [LatLng, LatLng][] = [
      [{ lat: 37.5665, lng: 126.978 }, { lat: 37.5665, lng: 126.978 }], // same point
      [{ lat: 37.4979, lng: 127.0276 }, { lat: 37.5219, lng: 126.9245 }], // ~9km
      [{ lat: 37.5326, lng: 126.9903 }, { lat: 37.5133, lng: 127.1001 }], // ~10km
    ];

    for (const [origin, dest] of cases) {
      for (const mode of ["transit", "car"] as const) {
        const minutes = await mockProvider.travelMinutes(origin, dest, mode);
        expect(Number.isInteger(minutes)).toBe(true);
        expect(minutes).toBeGreaterThanOrEqual(5);
      }
    }
  });
});
