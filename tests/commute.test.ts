import { describe, it, expect } from "vitest";
import { mockProvider } from "@/lib/commute/mockProvider";
import type { LatLng } from "@/types/profile";

describe("mockProvider.travelMinutes", () => {
  it("identical origin and dest → returns minimum (5) — only car overhead", async () => {
    const point: LatLng = { lat: 37.5665, lng: 126.978 };
    const { minutes: carMinutes } = await mockProvider.travelMinutes(point, point, "car");
    // distance = 0 → car: round(0) + 5 = 5 → max(5, 5) = 5
    expect(carMinutes).toBe(5);
  });

  it("~9km apart (Gangnam to Yeouido): returns a positive integer", async () => {
    const gangnam: LatLng = { lat: 37.4979, lng: 127.0276 };
    const yeouido: LatLng = { lat: 37.5219, lng: 126.9245 };

    const { minutes: carMinutes } = await mockProvider.travelMinutes(gangnam, yeouido, "car");

    expect(carMinutes).toBeGreaterThan(0);
    expect(Number.isInteger(carMinutes)).toBe(true);
  });

  it("mock has no road distance — UI falls back to straight-line", async () => {
    const gangnam: LatLng = { lat: 37.4979, lng: 127.0276 };
    const yeouido: LatLng = { lat: 37.5219, lng: 126.9245 };
    const result = await mockProvider.travelMinutes(gangnam, yeouido, "car");
    expect(result.roadDistanceKm).toBeUndefined();
  });

  it("result is always an integer >= 5 for various inputs", async () => {
    const cases: [LatLng, LatLng][] = [
      [{ lat: 37.5665, lng: 126.978 }, { lat: 37.5665, lng: 126.978 }],
      [{ lat: 37.4979, lng: 127.0276 }, { lat: 37.5219, lng: 126.9245 }],
      [{ lat: 37.5326, lng: 126.9903 }, { lat: 37.5133, lng: 127.1001 }],
    ];

    for (const [origin, dest] of cases) {
      const { minutes } = await mockProvider.travelMinutes(origin, dest, "car");
      expect(Number.isInteger(minutes)).toBe(true);
      expect(minutes).toBeGreaterThanOrEqual(5);
    }
  });
});
