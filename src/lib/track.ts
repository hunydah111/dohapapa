// GA4 이벤트 헬퍼 — gtag 전역이 없으면(측정ID 미설정·차단) 조용히 무시.
// 한 방 계측 5지표: result_card_created · share_click · friend_visit · friend_convert · policy_cta_click

export function track(
  event: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  try {
    w.gtag?.("event", event, params);
  } catch {
    /* 계측 실패는 기능에 영향 없음 */
  }
}
