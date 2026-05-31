import { describe, it, expect } from "vitest";
import { QUESTIONS, classify, personaLabel, TYPES, type Answer } from "@/lib/game/persona";

// 헬퍼: 모든 문항을 a 또는 b로
const all = (pick: Answer): Answer[] => QUESTIONS.map(() => pick);

describe("persona 분류 — 직교 2축 4유형", () => {
  it("문항 10개(위험5+가치5), 각 축 5문항", () => {
    expect(QUESTIONS).toHaveLength(10);
    const risk = QUESTIONS.filter((q) => q.a.risk != null).length;
    const value = QUESTIONS.filter((q) => q.a.value != null).length;
    expect(risk).toBe(5);
    expect(value).toBe(5);
  });

  it("전부 a(공격+입지) = 호랑이, 찐", () => {
    const r = classify(all("a"));
    expect(r.type.id).toBe("tiger");
    expect(r.risk).toBe(5);
    expect(r.value).toBe(5);
    expect(r.strong).toBe(true);
    expect(personaLabel(r)).toBe(TYPES.tiger.strongLabel);
  });

  it("전부 b(안정+실속) = 거북이, 찐", () => {
    const r = classify(all("b"));
    expect(r.type.id).toBe("turtle");
    expect(r.risk).toBe(-5);
    expect(r.value).toBe(-5);
    expect(r.strong).toBe(true);
  });

  it("공격(위험 a) × 실속(가치 b) = 여우", () => {
    const ans: Answer[] = QUESTIONS.map((q) => (q.a.risk != null ? "a" : "b"));
    const r = classify(ans);
    expect(r.type.id).toBe("fox");
    expect(r.risk).toBeGreaterThan(0);
    expect(r.value).toBeLessThan(0);
  });

  it("안정(위험 b) × 입지(가치 a) = 부엉이", () => {
    const ans: Answer[] = QUESTIONS.map((q) => (q.a.risk != null ? "b" : "a"));
    const r = classify(ans);
    expect(r.type.id).toBe("owl");
    expect(r.risk).toBeLessThan(0);
    expect(r.value).toBeGreaterThan(0);
  });

  it("각 축 합은 홀수 → 0(무승부) 절대 없음 = 유형 항상 결정적", () => {
    // 가능한 모든 위험 답안 조합에서 risk≠0 (5문항이라 −5,−3,−1,1,3,5만 가능)
    for (let mask = 0; mask < 32; mask++) {
      const ans: Answer[] = QUESTIONS.map((q, i) => {
        const isRisk = q.a.risk != null;
        if (!isRisk) return "a";
        const idx = QUESTIONS.filter((x) => x.a.risk != null).indexOf(q);
        return (mask >> idx) & 1 ? "a" : "b";
      });
      const r = classify(ans);
      expect(r.risk).not.toBe(0);
    }
  });

  it("4유형 모두 도달 가능 + 라벨 비어있지 않음", () => {
    const ids = new Set([
      classify(all("a")).type.id,
      classify(all("b")).type.id,
      classify(QUESTIONS.map((q) => (q.a.risk != null ? "a" : "b"))).type.id,
      classify(QUESTIONS.map((q) => (q.a.risk != null ? "b" : "a"))).type.id,
    ]);
    expect(ids).toEqual(new Set(["tiger", "fox", "owl", "turtle"]));
    for (const t of Object.values(TYPES)) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.image).toMatch(/^\/biji\/persona\/\w+\.png$/);
    }
  });

  it("약하게 치우치면(±1~3) 찐 아님", () => {
    // 위험: a 3개 b 2개 = +1, 가치: a 3개 b 2개 = +1 → tiger, strong=false
    let rTaken = 0, vTaken = 0;
    const ans: Answer[] = QUESTIONS.map((q) => {
      if (q.a.risk != null) { rTaken++; return rTaken <= 3 ? "a" : "b"; }
      vTaken++; return vTaken <= 3 ? "a" : "b";
    });
    const r = classify(ans);
    expect(r.type.id).toBe("tiger");
    expect(Math.abs(r.risk)).toBeLessThan(4);
    expect(r.strong).toBe(false);
  });
});
