import { ListingInput, ComparableSet, SignalResult } from "@/types/listing";

// MVP placeholder: photo fingerprint/reuse data is not yet collected.
export default function scorePhotoReuse(
  _input: ListingInput,
  _comp: ComparableSet | null
): SignalResult {
  return {
    points: 0,
    reason: "사진 분석 데이터 누적 중 (MVP)",
    detail: { ready: false },
  };
}
