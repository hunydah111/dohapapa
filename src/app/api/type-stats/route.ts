// 집 찾기 유형 분포 조회 — 결과 화면의 "유형 희귀도" 줄세우기용. 비-PII 집계만 반환.
import { getTypeCounts } from "@/lib/typeStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 항상 최신 분포

export async function GET(): Promise<Response> {
  const data = await getTypeCounts();
  return Response.json(data);
}
