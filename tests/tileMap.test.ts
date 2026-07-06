// [오늘의 거래 지도] 타일 격자 — 82개 시군구 전수 매핑·좌표 불변 계약 검증.
import { describe, it, expect } from "vitest";
import { LAWD_CODES } from "@/lib/molit";
import {
  TILE_MAP,
  TILE_GRID_COLS,
  TILE_GRID_ROWS,
  TILE_LEVEL_MID,
  TILE_LEVEL_HIGH,
  tileLevel,
} from "@/lib/tileMap";

describe("tileMap.TILE_MAP — 82개 시군구 전수 매핑", () => {
  it("키가 LAWD_CODES 시군구 풀네임과 정확히 1:1 (82개, 초과·누락 0)", () => {
    const lawd = Object.keys(LAWD_CODES).sort();
    const tiles = Object.keys(TILE_MAP).sort();
    expect(lawd).toHaveLength(82); // 서울 25 + 경기 47 + 인천 10
    expect(tiles).toEqual(lawd);
  });

  it("타일 좌표 충돌 0 — (col,row) 전부 고유", () => {
    const seen = new Map<string, string>();
    for (const [sigungu, t] of Object.entries(TILE_MAP)) {
      const key = `${t.col},${t.row}`;
      expect(seen.get(key), `좌표 충돌: ${seen.get(key)} vs ${sigungu} @ ${key}`).toBeUndefined();
      seen.set(key, sigungu);
    }
  });

  it("좌표가 격자 범위 안 — col ∈ [1,12], row ∈ [1,14]", () => {
    for (const [sigungu, t] of Object.entries(TILE_MAP)) {
      expect(t.col, `${sigungu} col`).toBeGreaterThanOrEqual(1);
      expect(t.col, `${sigungu} col`).toBeLessThanOrEqual(TILE_GRID_COLS);
      expect(t.row, `${sigungu} row`).toBeGreaterThanOrEqual(1);
      expect(t.row, `${sigungu} row`).toBeLessThanOrEqual(TILE_GRID_ROWS);
      expect(Number.isInteger(t.col) && Number.isInteger(t.row), `${sigungu} 정수 좌표`).toBe(
        true,
      );
    }
  });

  it("라벨은 2~4자 축약이고 서로 겹치지 않는다", () => {
    const labels = new Set<string>();
    for (const [sigungu, t] of Object.entries(TILE_MAP)) {
      expect(t.label.length, `${sigungu} 라벨 "${t.label}"`).toBeGreaterThanOrEqual(2);
      expect(t.label.length, `${sigungu} 라벨 "${t.label}"`).toBeLessThanOrEqual(4);
      expect(labels.has(t.label), `라벨 중복: ${t.label}`).toBe(false);
      labels.add(t.label);
    }
  });

  it("대표 축약 규칙 — 일반구는 구명, 인천 중복명은 '인천' 접두, 서울은 '구' 생략", () => {
    expect(TILE_MAP["고양시 일산동구"].label).toBe("일산동");
    expect(TILE_MAP["수원시 팔달구"].label).toBe("팔달");
    expect(TILE_MAP["인천 중구"].label).toBe("인천중"); // 서울 중구와 구분
    expect(TILE_MAP["중구"].label).toBe("중구"); // 서울 중구 — '구'까지 떼면 1자
    expect(TILE_MAP["은평구"].label).toBe("은평");
    expect(TILE_MAP["동두천시"].label).toBe("동두천");
  });

  it("지리 방위 불변 — 북부 경기 위 · 인천 좌 · 남부 경기 아래 · 서울 중앙", () => {
    // 북부(연천·포천) < 서울 은평 < 남부(평택·안성) — row 증가 = 남하.
    expect(TILE_MAP["연천군"].row).toBeLessThan(TILE_MAP["은평구"].row);
    expect(TILE_MAP["포천시"].row).toBeLessThan(TILE_MAP["은평구"].row);
    expect(TILE_MAP["은평구"].row).toBeLessThan(TILE_MAP["평택시"].row);
    expect(TILE_MAP["은평구"].row).toBeLessThan(TILE_MAP["안성시"].row);
    // 인천은 서울보다 서쪽(col 작음).
    expect(TILE_MAP["부평구"].col).toBeLessThan(TILE_MAP["마포구"].col);
    expect(TILE_MAP["연수구"].col).toBeLessThan(TILE_MAP["영등포구"].col);
    // 실제 인접 축 몇 개 — 덕양은 은평 바로 위, 의정부는 도봉 바로 위, 하남은 강동 옆줄.
    expect(TILE_MAP["고양시 덕양구"].col).toBe(TILE_MAP["은평구"].col);
    expect(TILE_MAP["고양시 덕양구"].row).toBe(TILE_MAP["은평구"].row - 1);
    expect(TILE_MAP["의정부시"].col).toBe(TILE_MAP["도봉구"].col);
    expect(TILE_MAP["의정부시"].row).toBe(TILE_MAP["도봉구"].row - 1);
  });
});

describe("tileMap.tileLevel — 농도 4단계 (시안 B 범례)", () => {
  it("0건=0 · 1~2=1 · 3~6=2 · 7+=3", () => {
    expect(tileLevel(0)).toBe(0);
    expect(tileLevel(1)).toBe(1);
    expect(tileLevel(2)).toBe(1);
    expect(tileLevel(TILE_LEVEL_MID)).toBe(2); // 3
    expect(tileLevel(6)).toBe(2);
    expect(tileLevel(TILE_LEVEL_HIGH)).toBe(3); // 7
    expect(tileLevel(42)).toBe(3);
  });
});
