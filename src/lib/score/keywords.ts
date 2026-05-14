import { ListingInput, ComparableSet, SignalResult } from "@/types/listing";

const BAIT_KEYWORDS = [
  "급매",
  "급처분",
  "즉시입주",
  "VIP",
  "확실",
  "로얄",
  "방금",
  "초특가",
  "단독",
  "특A",
  "이번주만",
  "이번 주만",
  "선착순",
];

export default function scoreKeywords(
  input: ListingInput,
  _comp: ComparableSet | null
): SignalResult {
  const text = input.description ?? "";

  const matched = BAIT_KEYWORDS.filter((kw) =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  const detail = { matched };

  if (matched.length === 0) {
    return { points: 0, reason: "", detail };
  }

  const pointsMap: Record<number, number> = { 1: 2, 2: 4 };
  const points = matched.length >= 3 ? 5 : (pointsMap[matched.length] ?? 0);

  const keywordList = matched.map((k) => `"${k}"`).join("·");
  const reason = `${keywordList} 등 ${matched.length}건 발견`;

  return { points, reason, detail };
}
