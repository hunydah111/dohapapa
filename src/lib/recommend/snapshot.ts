// 추천 엔진 핫패스용 단지 스냅샷 — "요청당 DB 읽기 0".
//
// scripts/build-snapshot.ts 가 Neon(또는 로컬 SQLite 백업) 실데이터로 단지 메타 +
// (평형별 추정 현재가)를 src/data/complexSnapshot.json 으로 구워 둔다. 런타임은 그 JSON 만
// 읽어 추천을 계산하므로 검색당 Neon 쿼리가 발생하지 않는다(데이터 전송 쿼터 소진 방지).
//
// 로딩: 정적 import 는 6.6MB JSON 의 리터럴 타입 추론으로 빌드를 망가뜨릴 수 있어, 런타임에
// fs 로 한 번 읽고 메모이즈한다. 번들 포함은 next.config 의 outputFileTracingIncludes 가 보장.
// JSON 이 없거나 깨지면 빈 스냅샷으로 degrade(앱은 죽지 않고 빈 결과만 반환).
//
// 갱신: 새 실거래 적재 후 build-snapshot 을 다시 굽고 커밋·배포한다(trendIndex.json 과 동일 주기).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AreaMedian } from "./complexMedian";

export interface SnapshotComplex {
  id: string;
  name: string;
  sigungu: string;
  dongName: string;
  buildYear: number | null;
  totalHouseholds: number | null;
  latitude: number;
  longitude: number;
  nearestElemSchoolM: number | null;
  nearestSubwayM: number | null;
  medians: AreaMedian[];
}

interface SnapshotFile {
  generatedAt: string;
  source: string;
  complexCount: number;
  complexes: SnapshotComplex[];
}

// index.ts 의 좌표 sanity 박스와 동일 — 수도권만(오지오코딩 단지 전역 제외).
const BOX = { latMin: 36.8, latMax: 38.5, lngMin: 126.2, lngMax: 127.95 };

let cache: SnapshotFile | null = null;
let medianIndex: Map<string, AreaMedian[]> | null = null;

function load(): SnapshotFile {
  if (cache) return cache;
  try {
    const raw = readFileSync(
      join(process.cwd(), "src/data/complexSnapshot.json"),
      "utf8",
    );
    cache = JSON.parse(raw) as SnapshotFile;
  } catch (e) {
    console.error(
      "[snapshot] complexSnapshot.json 로드 실패 — 빈 스냅샷으로 degrade:",
      e,
    );
    cache = { generatedAt: "", source: "missing", complexCount: 0, complexes: [] };
  }
  return cache;
}

function medianMap(): Map<string, AreaMedian[]> {
  if (medianIndex) return medianIndex;
  medianIndex = new Map(load().complexes.map((c) => [c.id, c.medians]));
  return medianIndex;
}

/** 스냅샷 생성 시각(ISO). 미생성/실패 시 "". */
export function snapshotGeneratedAt(): string {
  return load().generatedAt;
}

/** 스냅샷이 비었는지(미생성·로드 실패). 비면 추천 결과가 빈다. */
export function isSnapshotEmpty(): boolean {
  return load().complexes.length === 0;
}

/**
 * 수도권 박스 안 단지를 반환한다(엔진의 db.complex.findMany 대체).
 * restrictIds(2-pass 재랭킹 한정)가 있으면 그 id 들로, 없고 sigungus(필수지역)가 있으면
 * 그 시군구로 한정한다 — index.ts 의 기존 where 우선순위와 동일.
 */
export function getSnapshotComplexes(opts?: {
  ids?: string[];
  sigungus?: string[];
}): SnapshotComplex[] {
  const { complexes } = load();
  const idSet = opts?.ids && opts.ids.length > 0 ? new Set(opts.ids) : null;
  const sggSet =
    opts?.sigungus && opts.sigungus.length > 0 ? new Set(opts.sigungus) : null;
  return complexes.filter((c) => {
    if (
      c.latitude < BOX.latMin ||
      c.latitude > BOX.latMax ||
      c.longitude < BOX.lngMin ||
      c.longitude > BOX.lngMax
    )
      return false;
    if (idSet) return idSet.has(c.id); // restrictIds 우선
    if (sggSet) return sggSet.has(c.sigungu);
    return true;
  });
}

/**
 * 주어진 단지들의 평형별 추정 현재가를 반환한다(엔진의 getAreaMediansForMany 대체, 동기).
 * 시점 보정은 스냅샷 생성 시 이미 적용돼 있다. 호출자가 자유롭게 .set 할 수 있도록 새 Map 반환.
 */
export function getMediansForIds(ids: string[]): Map<string, AreaMedian[]> {
  const all = medianMap();
  const out = new Map<string, AreaMedian[]>();
  for (const id of ids) {
    const m = all.get(id);
    if (m) out.set(id, m);
  }
  return out;
}
