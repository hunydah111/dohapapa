import { ListingInput, ComparableSet, SignalResult } from "@/types/listing";

const WINDOW_DAYS = 7;

export default function scoreRefresh(
  input: ListingInput,
  _comp: ComparableSet | null
): SignalResult {
  const history = input.refreshHistory;

  if (!history || history.length < 2) {
    return { points: 0, reason: "" };
  }

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Count entries within the window where no real change was made (timestamp bump only)
  const phantomRefreshCount = history.filter(
    (entry) => entry.at >= cutoff && entry.modified === false
  ).length;

  const detail = { phantomRefreshCount, windowDays: WINDOW_DAYS };

  if (phantomRefreshCount >= 3) {
    return {
      points: 15,
      reason: `7일 내 무변경 갱신 ${phantomRefreshCount}회 (상단 노출 active bait 의심)`,
      detail,
    };
  }

  if (phantomRefreshCount === 2) {
    return {
      points: 8,
      reason: "7일 내 무변경 갱신 2회 (상단 노출 의심)",
      detail,
    };
  }

  return { points: 0, reason: "", detail };
}
