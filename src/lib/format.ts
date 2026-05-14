// 금액 포맷 공통 유틸 — 컴포넌트마다 중복 선언하던 것을 통일.

/** 원 → "X.X억" (소수점 1자리). */
export function formatEok(krw: number): string {
  return `${(krw / 100_000_000).toFixed(1)}억`;
}

/** 원 → "X,XXX만원" (만원 단위 반올림, 천단위 콤마). */
export function formatManwon(krw: number): string {
  const manwon = Math.round(krw / 10_000);
  return `${manwon.toLocaleString("ko-KR")}만원`;
}

/**
 * 원 → 사람이 읽기 좋은 한국식 금액.
 * 1억 이상은 "X억 Y천만원" 꼴, 미만은 "X,XXX만원".
 */
export function formatKrwHuman(krw: number): string {
  const abs = Math.abs(krw);
  const sign = krw < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const remainManwon = Math.round((abs % 100_000_000) / 10_000);
    if (remainManwon === 0) return `${sign}${eok}억`;
    const cheonman = Math.round(remainManwon / 1000);
    if (remainManwon % 1000 === 0 && cheonman > 0) {
      return `${sign}${eok}억 ${cheonman}천만원`;
    }
    return `${sign}${eok}억 ${remainManwon.toLocaleString("ko-KR")}만원`;
  }
  return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
}
