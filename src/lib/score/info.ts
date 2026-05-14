import { ListingInput, ComparableSet, SignalResult } from "@/types/listing";

export default function scoreInfo(
  input: ListingInput,
  _comp: ComparableSet | null
): SignalResult {
  const missingFields: string[] = [];

  if (input.floor === undefined || input.floor === null) {
    missingFields.push("floor");
  }
  if (!input.direction) {
    missingFields.push("direction");
  }
  if (!input.description || input.description.length < 20) {
    missingFields.push("description");
  }

  // Treat missing/zero photos as an additional gap, capped at 4 total before scoring
  const photoCount = input.photoCount;
  const hasNoPhotos = photoCount === undefined || photoCount === 0;

  // Build total missing count (photos count as one additional gap)
  const missingCount = missingFields.length + (hasNoPhotos ? 1 : 0);

  const detail: Record<string, unknown> = {
    missing: missingFields,
    photoCount: photoCount ?? 0,
  };

  // Korean labels for reason text
  const labelMap: Record<string, string> = {
    floor: "층",
    direction: "향",
    description: "상세설명",
  };
  const missingLabels = missingFields.map((f) => labelMap[f] ?? f);
  if (hasNoPhotos) missingLabels.push("사진");

  if (missingCount === 0) {
    return { points: 0, reason: "", detail };
  }

  const pointsMap: Record<number, number> = { 1: 2, 2: 4 };
  const points = missingCount >= 3 ? 5 : (pointsMap[missingCount] ?? 0);
  const reason = `${missingLabels.join("/")} 누락`;

  return { points, reason, detail };
}
