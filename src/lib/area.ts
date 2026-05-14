// 1평 = 3.3058㎡ (한국 부동산 표준). 전용 평수 ↔ 전용㎡ 환산.
const M2_PER_PYEONG = 3.3058;

export function pyeongToM2(pyeong: number): number {
  return Math.round(pyeong * M2_PER_PYEONG * 100) / 100;
}

export function m2ToPyeong(m2: number): number {
  return Math.round((m2 / M2_PER_PYEONG) * 10) / 10;
}

/** "25평 (84㎡)" 형태로 표시. */
export function formatArea(m2: number): string {
  return `${m2ToPyeong(m2)}평 (${m2.toFixed(1)}㎡)`;
}

/** 공간 좁을 때: "25평" 만. */
export function formatPyeong(m2: number): string {
  return `${m2ToPyeong(m2)}평`;
}
