// 동네판 데이터 호스트 (서버 컴포넌트, v2.6) — 빌드 타임 JSON 4종을 전 시군구 압축
// 브리핑(buildLocalFrontData)으로 줄여 클라이언트(LocalFront)에 넘긴다.
//
// 동네 선택이 기기(localStorage)에만 있어 서버는 어느 동네인지 모른다 — 그래서 전
// 시군구분을 내려보내되, 원본(dailyRecent 320KB·regionTop 260KB)이 아니라 발췌본만.
// placeholder(generatedAt null)에서도 빌드가 통과한다 — 각 필드는 builder 가 방어.

import dailyPatchRaw from "@/data/dailyPatch.json";
import dailyRecentRaw from "@/data/dailyRecent.json";
import regionTopRaw from "@/data/regionTop.json";
import regionSeriesRaw from "@/data/regionSeries.json";
import regionPeaksRaw from "@/data/regionPeaks.json";
import {
  buildLocalFrontData,
  type LocalPatchInput,
  type RecentDay,
} from "@/lib/localFront";
import type { RegionTopFile } from "@/lib/regionTop";
import type { RegionSeriesFile } from "@/lib/regionSeries";
import type { RegionPeaksFile } from "@/lib/regionPeaks";
import { LocalFront } from "./LocalFront";

// placeholder(빈 배열)는 never[] 로 추론되므로 명시 캐스팅 (DailyFront 와 동일 사정).
const patch = dailyPatchRaw as unknown as LocalPatchInput;
const recent = dailyRecentRaw as unknown as { updatedAt?: string; days?: RecentDay[] };
const regionTop = regionTopRaw as unknown as RegionTopFile;
const series = regionSeriesRaw as unknown as RegionSeriesFile;
const peaks = regionPeaksRaw as unknown as RegionPeaksFile;

export function LocalFrontHost() {
  const data = buildLocalFrontData({
    patch,
    recentDays: recent.days ?? [],
    regionTop,
    series,
    peaks,
  });
  return <LocalFront data={data} />;
}
