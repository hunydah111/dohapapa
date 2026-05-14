import {
  ListingInput,
  ComparableSet,
  ScoreResult,
  SignalKey,
  SignalResult,
  bandFor,
} from "@/types/listing";

import scorePrice from "./price";
import scoreBrokerConcentration from "./brokerConcentration";
import scoreStale from "./stale";
import scoreRefresh from "./refresh";
import scorePhotoReuse from "./photoReuse";
import scoreInfo from "./info";
import scoreKeywords from "./keywords";
import scoreBrokerHistory from "./brokerHistory";

type SignalFn = (
  input: ListingInput,
  comp: ComparableSet | null
) => SignalResult;

const SIGNAL_FNS: Record<SignalKey, SignalFn> = {
  price: scorePrice,
  brokerConcentration: scoreBrokerConcentration,
  stale: scoreStale,
  refresh: scoreRefresh,
  photoReuse: scorePhotoReuse,
  info: scoreInfo,
  keywords: scoreKeywords,
  brokerHistory: scoreBrokerHistory,
};

// Ordered for deterministic output
const SIGNAL_ORDER: SignalKey[] = [
  "price",
  "brokerConcentration",
  "stale",
  "refresh",
  "photoReuse",
  "info",
  "keywords",
  "brokerHistory",
];

export function computeScore(
  input: ListingInput,
  comp: ComparableSet | null
): ScoreResult {
  const signals = {} as Record<SignalKey, number>;
  const reasoning = {} as Record<SignalKey, string>;

  let total = 0;

  for (const key of SIGNAL_ORDER) {
    const result = SIGNAL_FNS[key](input, comp);
    signals[key] = result.points;
    reasoning[key] = result.reason;
    total += result.points;
  }

  // Clamp to [0, 100] in case future weights shift
  total = Math.min(100, Math.max(0, total));

  return {
    total,
    band: bandFor(total),
    signals,
    reasoning,
  };
}
