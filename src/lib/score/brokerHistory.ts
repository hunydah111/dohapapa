import { ListingInput, ComparableSet, SignalResult } from "@/types/listing";

// MVP placeholder: broker complaint/violation history is not yet collected.
export default function scoreBrokerHistory(
  _input: ListingInput,
  _comp: ComparableSet | null
): SignalResult {
  return {
    points: 0,
    reason: "중개사 이력 데이터 누적 중 (MVP)",
    detail: { ready: false },
  };
}
