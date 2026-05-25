// 주간 인기 아파트 차트 조회 — 랜딩의 "이번 주 인기 아파트"(멜론식)용. 비-PII 집계만 반환.
import { getPopularComplexChart } from "@/lib/popularComplexChart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // 항상 최신 집계

export async function GET(): Promise<Response> {
  const data = await getPopularComplexChart();
  return Response.json(data);
}
