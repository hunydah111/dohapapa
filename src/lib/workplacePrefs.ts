// 직장 위치 로컬 저장 — 재입력 편의용. 기기 localStorage 에만 둔다(서버 전송 X).
//
// 프라이버시: 직장 좌표·라벨은 민감정보. searchPrefs.ts와 달리 *사용자 명시 의도*로
// 저장되며, 결과 화면 또는 폼 안에서 "지우기" 버튼으로 즉시 삭제 가능.
// 서버·DB로 전송되지 않음.

import type { Workplace, CommuteMode } from "@/types/profile";

const KEY = "biji-workplaces";

export interface WorkplacePrefs {
  workplaceA: Workplace | null;
  workplaceB: Workplace | null;
  modeA: CommuteMode;
  modeB: CommuteMode;
  maxCommuteA: number;
  maxCommuteB: number;
}

function isWorkplace(w: unknown): w is Workplace {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.label === "string" &&
    typeof o.lat === "number" &&
    typeof o.lng === "number" &&
    (o.commuteMode === "car" || o.commuteMode === "transit") &&
    typeof o.maxCommuteMinutes === "number"
  );
}

export function saveWorkplaces(prefs: WorkplacePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* 저장 실패 무시 — 부가기능 */
  }
}

export function loadWorkplaces(): WorkplacePrefs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<WorkplacePrefs>;
    if (!p) return null;
    const wpA = isWorkplace(p.workplaceA) ? p.workplaceA : null;
    const wpB = isWorkplace(p.workplaceB) ? p.workplaceB : null;
    if (!wpA && !wpB) return null;
    return {
      workplaceA: wpA,
      workplaceB: wpB,
      modeA: p.modeA === "transit" || p.modeA === "car" ? p.modeA : "car",
      modeB: p.modeB === "transit" || p.modeB === "car" ? p.modeB : "car",
      maxCommuteA: typeof p.maxCommuteA === "number" ? p.maxCommuteA : 60,
      maxCommuteB: typeof p.maxCommuteB === "number" ? p.maxCommuteB : 60,
    };
  } catch {
    return null;
  }
}

export function clearWorkplaces(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
