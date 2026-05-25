import { describe, it, expect } from "vitest";
import { policyFreshness, POLICY_META, POLICY_BASIS } from "@/lib/policyLoan";

describe("policyFreshness / POLICY_META", () => {
  const verified = new Date(`${POLICY_META.lastVerified}T00:00:00Z`);

  it("검증일 직후엔 stale 아님 + 경과일 계산", () => {
    const f = policyFreshness(new Date(verified.getTime() + 10 * 86_400_000));
    expect(f.daysSinceVerified).toBe(10);
    expect(f.stale).toBe(false);
  });

  it("120일 초과면 stale (재확인 권고)", () => {
    expect(policyFreshness(new Date(verified.getTime() + 121 * 86_400_000)).stale).toBe(true);
  });

  it("검증일 이전(시계 오차)도 음수 없이 0", () => {
    const f = policyFreshness(new Date(verified.getTime() - 5 * 86_400_000));
    expect(f.daysSinceVerified).toBe(0);
    expect(f.stale).toBe(false);
  });

  it("POLICY_BASIS는 effectiveLabel·lastVerified에서 파생", () => {
    expect(POLICY_BASIS).toContain(POLICY_META.effectiveLabel);
    expect(POLICY_BASIS).toContain(POLICY_META.lastVerified);
  });
});
