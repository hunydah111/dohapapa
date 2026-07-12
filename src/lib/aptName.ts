// 단지명 표기 헬퍼 — 국토부 등록명이 축약형인 옛 단지 보정 (2026-07-12 사장 제보).
//
// "여의도동 서울"(서울아파트 '76)·"일원동 수서"(수서아파트 '92)·"풍림"·"주공2"처럼
// 짧은 등록명은 지면에서 단지명으로 안 읽힌다. 3글자 이하 + "아파트"로 안 끝나는 이름에
// "아파트"를 붙인다 — 정식 명칭 복원이지 조작이 아님. 4글자 이상(까치마을·창전래미안 등)은
// 그대로 둔다(이미 단지명으로 읽힘 + 지면 폭 예산).

export function aptDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 3) return trimmed;
  if (trimmed.endsWith("아파트")) return trimmed;
  return `${trimmed}아파트`;
}
