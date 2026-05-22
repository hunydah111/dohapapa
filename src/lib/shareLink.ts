// 공유 URL 인코딩 — CoupleProfile 을 URL-safe 문자열로 직렬화/복원한다.
//
// 컴플라이언스: 프로필을 DB 에 저장하지 않는다(메모리 원칙). 대신 URL 자체에
// 인코딩해 부부 두 명이 같은 결과를 볼 수 있게 한다. 서버를 거치지 않으므로
// 데이터 보관 책임이 발생하지 않는다. (= 짧은 코드형 단축은 불가 — 프로필 전체가
// URL 에 담겨야 한다.)
//
// 길이 최적화 3단:
//   ① 기본값/빈 값과 같은 필드 제거, ② 좌표 6자리(약 0.1m) 반올림,
//   ③ deflate 압축(브라우저 CompressionStream) 후 base64url.
// 압축 포맷은 base64url 알파벳 밖 문자 MARKER(".")로 시작해 구버전(비압축 JSON)
// 링크와 구분한다. CompressionStream 미지원/실패 시 비압축(레거시 호환) 폴백.
// 디코드는 두 포맷을 모두 처리하고, 빠진 필수 필드는 기본값으로 병합 복원한다.

import type { CoupleProfile, PriorityKey, AreaRangeKey } from "@/types/profile";
import { DEFAULT_PRIORITIES, DEFAULT_AREA_RANGE } from "@/types/profile";

export const SHARE_PARAM = "p";

// 압축 포맷 v1 식별자. base64url([A-Za-z0-9_-]) 밖 문자라야 레거시와 안 겹친다.
const MARKER = ".";

const COORD_DECIMALS = 6;
const roundCoord = (n: number): number => {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(n * f) / f;
};

// Zod 필수 필드의 기본값 — 디코드 병합 베이스. 이 값과 같은 필드는 인코딩에서 생략된다.
// (householdType 등 핵심 필드는 항상 실값이 들어가도록 둔다.)
const DEFAULTS = {
  householdIncomeKrwYear: 0,
  seedMoneyKrw: 0,
  netAssetsKrw: 0,
  existingLoanMonthlyKrw: 0,
  hasSchoolAgedChild: false,
  hasInfant: false,
  hasTwoOrMoreChildren: false,
  hasThreeOrMoreChildren: false,
  isExpectingChild: false,
  hasOwnedHomeBefore: false,
  isNewlywed: false,
} as const;

// ── base64url ↔ bytes ────────────────────────────────────────────────────────
function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── deflate ↔ inflate (브라우저 내장 스트림) ─────────────────────────────────
// Blob.stream().pipeThrough(...) 경유 — writer API 의 엄격한 타입 마찰을 피한다.
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  // Uint8Array.from → ArrayBuffer-backed 사본 (엄격 타입드어레이 타입 마찰 회피)
  const stream = new Blob([Uint8Array.from(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([Uint8Array.from(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ── 압축 전 컴팩트화: 기본값 제거 + 좌표 반올림 ──────────────────────────────
function buildCompact(profile: CoupleProfile): Record<string, unknown> {
  const compact: Record<string, unknown> = { ...profile };

  if (profile.workplaceA)
    compact.workplaceA = {
      ...profile.workplaceA,
      lat: roundCoord(profile.workplaceA.lat),
      lng: roundCoord(profile.workplaceA.lng),
    };
  if (profile.workplaceB)
    compact.workplaceB = {
      ...profile.workplaceB,
      lat: roundCoord(profile.workplaceB.lat),
      lng: roundCoord(profile.workplaceB.lng),
    };

  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (compact[k] === v) delete compact[k];
  }
  const pr = profile.priorities;
  const prSame = (Object.keys(DEFAULT_PRIORITIES) as PriorityKey[]).every(
    (k) => (pr[k] ?? DEFAULT_PRIORITIES[k]) === DEFAULT_PRIORITIES[k],
  );
  if (prSame) delete compact.priorities;
  if (
    compact.locationVibes &&
    Object.keys(compact.locationVibes as object).length === 0
  )
    delete compact.locationVibes;
  if (
    Array.isArray(compact.requiredRegions) &&
    compact.requiredRegions.length === 0
  )
    delete compact.requiredRegions;

  return compact;
}

function mergeDefaults(parsed: Partial<CoupleProfile>): CoupleProfile {
  // 레거시 링크는 단일 preferredAreaRange 를 담았다 → 배열로 승격(경계 호환).
  const legacyArea = (parsed as { preferredAreaRange?: AreaRangeKey })
    .preferredAreaRange;
  const preferredAreaRanges =
    parsed.preferredAreaRanges && parsed.preferredAreaRanges.length > 0
      ? parsed.preferredAreaRanges
      : legacyArea
        ? [legacyArea]
        : [DEFAULT_AREA_RANGE];
  return {
    ...DEFAULTS,
    ...parsed,
    preferredAreaRanges,
    priorities: { ...DEFAULT_PRIORITIES, ...(parsed.priorities ?? {}) },
  } as CoupleProfile;
}

// ── 공개 API ─────────────────────────────────────────────────────────────────
export async function encodeProfile(profile: CoupleProfile): Promise<string> {
  const json = JSON.stringify(buildCompact(profile));
  const bytes = new TextEncoder().encode(json);
  try {
    const deflated = await deflate(bytes);
    return MARKER + bytesToB64url(deflated);
  } catch {
    // CompressionStream 미지원 — 비압축 base64url 폴백(레거시 포맷, 디코드 호환).
    return bytesToB64url(bytes);
  }
}

export async function decodeProfile(
  encoded: string,
): Promise<CoupleProfile | null> {
  try {
    let json: string;
    if (encoded.startsWith(MARKER)) {
      const inflated = await inflate(b64urlToBytes(encoded.slice(MARKER.length)));
      json = new TextDecoder().decode(inflated);
    } else {
      // 레거시(또는 압축 폴백) — 비압축 base64url JSON.
      json = new TextDecoder().decode(b64urlToBytes(encoded));
    }
    const parsed = JSON.parse(json) as Partial<CoupleProfile>;
    return mergeDefaults(parsed);
  } catch {
    return null;
  }
}
