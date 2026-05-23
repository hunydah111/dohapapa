// 주간 동네 인기차트 조회 — 랜딩의 "이번 주 인기 동네"(멜론식)용. 비-PII 집계만 반환.
import { getNeighborhoodChart } from "@/lib/neighborhoodChart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 항상 최신 집계

export async function GET(): Promise<Response> {
  const data = await getNeighborhoodChart();
  return Response.json(data);
}
