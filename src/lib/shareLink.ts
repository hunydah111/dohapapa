// 공유 URL 인코딩 — CoupleProfile 을 URL-safe base64 로 직렬화/복원한다.
//
// 컴플라이언스: 프로필을 DB 에 저장하지 않는다(메모리 원칙). 대신 URL 자체에
// 인코딩해 부부 두 명이 같은 결과를 볼 수 있게 한다. 서버를 거치지 않으므로
// 데이터 보관 책임이 발생하지 않는다.

import type { CoupleProfile } from "@/types/profile";

export const SHARE_PARAM = "p";

/** Browser-only: btoa/atob 와 TextEncoder/Decoder 사용. */
export function encodeProfile(profile: CoupleProfile): string {
  const json = JSON.stringify(profile);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeProfile(encoded: string): CoupleProfile | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as CoupleProfile;
  } catch {
    return null;
  }
}
