import { ListingInput, ComparableSet, SignalResult } from "@/types/listing";

export default function scoreStale(
  input: ListingInput,
  _comp: ComparableSet | null
): SignalResult {
  if (!input.postedAt) {
    return { points: 0, reason: "" };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor((Date.now() - input.postedAt.getTime()) / msPerDay);

  if (days >= 60) {
    return {
      points: 10,
      reason: `등록 후 ${days}일 경과 (이례적 장기 체류)`,
      detail: { days },
    };
  }

  if (days >= 30) {
    return {
      points: 5,
      reason: `등록 후 ${days}일 경과 (장기 체류)`,
      detail: { days },
    };
  }

  return { points: 0, reason: "", detail: { days } };
}
